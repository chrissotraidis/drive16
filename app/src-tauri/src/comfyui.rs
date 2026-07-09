use serde::Serialize;
use serde_json::Value;
use std::{
    env, fs,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, ExitStatus, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const DEFAULT_PORT: u16 = 8188;
const SYSTEM_STATS_PATH: &str = "/system_stats";
const OBJECT_INFO_PATH: &str = "/object_info";
const MANIFEST_RELATIVE: &str = "assets/enhancements/comfyui/manifest.json";
const WORKFLOW_RELATIVE: &str = "assets/enhancements/comfyui/drive16-genesis-sprite.workflow.json";
const LAUNCH_LOG_RELATIVE: &str = "artifacts/phase4/comfyui-api/drive16-comfyui-launch.log";
const CHECKPOINT_SUFFIXES: [&str; 3] = ["safetensors", "ckpt", "pt"];
const LORA_SUFFIXES: [&str; 3] = ["safetensors", "ckpt", "pt"];

static COMFYUI_CHILD: OnceLock<Mutex<Option<ManagedComfyUiProcess>>> = OnceLock::new();

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiEndpointRequest {
    pub endpoint: String,
    pub checkpoint: Option<String>,
    pub lora: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiEndpointStatus {
    pub generated_at: String,
    pub state: String,
    pub detail: String,
    pub base_url: String,
    pub system_stats_url: String,
    pub version: Option<String>,
    pub devices: usize,
    pub checks: Vec<ComfyUiReadinessCheck>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiReadinessCheck {
    pub name: String,
    pub state: String,
    pub detail: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub hints: Vec<String>,
}

#[derive(Debug, Clone, PartialEq)]
struct LocalEndpoint {
    host: String,
    port: u16,
    base_url: String,
}

struct HttpResponse {
    status: u16,
    body: String,
}

struct ManagedComfyUiProcess {
    child: Child,
    endpoint: LocalEndpoint,
    log_path: PathBuf,
}

pub fn check_endpoint(request: ComfyUiEndpointRequest) -> ComfyUiEndpointStatus {
    match normalize_endpoint(&request.endpoint) {
        Ok(endpoint) => {
            check_endpoint_for_repo(repo_root(), endpoint, request.checkpoint, request.lora)
        }
        Err(error) => ComfyUiEndpointStatus {
            generated_at: unix_timestamp(),
            state: "missing".to_string(),
            detail: error,
            base_url: String::new(),
            system_stats_url: String::new(),
            version: None,
            devices: 0,
            checks: Vec::new(),
        },
    }
}

pub fn launch_endpoint(request: ComfyUiEndpointRequest) -> ComfyUiEndpointStatus {
    let repo_root = repo_root();
    let endpoint = match normalize_endpoint(&request.endpoint) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            return ComfyUiEndpointStatus {
                generated_at: unix_timestamp(),
                state: "missing".to_string(),
                detail: error,
                base_url: String::new(),
                system_stats_url: String::new(),
                version: None,
                devices: 0,
                checks: Vec::new(),
            };
        }
    };

    let checkpoint = request.checkpoint.clone();
    let lora = request.lora.clone();
    let existing = check_endpoint_for_repo(
        repo_root.clone(),
        endpoint.clone(),
        checkpoint.clone(),
        lora.clone(),
    );
    if existing.state == "ready" || existing.state == "warning" {
        return ComfyUiEndpointStatus {
            detail: format!("ComfyUI already running. {}", existing.detail),
            ..existing
        };
    }

    let launch_log_path = match start_comfyui(&repo_root, &endpoint) {
        Ok(path) => path,
        Err(error) => {
            let checks = phase4_readiness_checks(
                &repo_root,
                Err(&error),
                checkpoint,
                lora,
                readiness_check("API", "missing", &error),
            );
            return status("missing", &error, &endpoint, None, 0, checks);
        }
    };

    let launch_log_display = repo_relative_or_display(&repo_root, &launch_log_path);
    let starting_detail = format!("Launch log: {}", launch_log_display);

    let mut startup_checks = phase4_readiness_checks(
        &repo_root,
        Err(&starting_detail),
        checkpoint.clone(),
        lora.clone(),
        readiness_check("API", "starting", &starting_detail),
    );
    if let Some(api_check) = startup_checks.iter_mut().find(|check| check.name == "API") {
        api_check.hints.push(launch_log_display.clone());
    }

    let deadline = std::time::Instant::now() + Duration::from_secs(20);
    while std::time::Instant::now() < deadline {
        thread::sleep(Duration::from_millis(500));

        if let Some(exit_detail) = comfyui_launch_exit_detail(&repo_root) {
            let checks = phase4_readiness_checks(
                &repo_root,
                Err(&exit_detail),
                checkpoint,
                lora,
                readiness_check("API", "missing", &exit_detail),
            );
            return status("missing", &exit_detail, &endpoint, None, 0, checks);
        }

        let current = check_endpoint_for_repo(
            repo_root.clone(),
            endpoint.clone(),
            checkpoint.clone(),
            lora.clone(),
        );
        if current.state == "ready" || current.state == "warning" {
            return ComfyUiEndpointStatus {
                detail: format!("ComfyUI launched. {}", current.detail),
                ..current
            };
        }
    }

    let detail = format!(
        "ComfyUI launch started at {}, but the API is not ready yet. Keep Settings open and Test again shortly. {}",
        endpoint.base_url, starting_detail
    );
    status("starting", &detail, &endpoint, None, 0, startup_checks)
}

fn start_comfyui(repo_root: &Path, endpoint: &LocalEndpoint) -> Result<PathBuf, String> {
    let script = repo_root.join("scripts/launch-phase4-comfyui-api.sh");
    if !script.is_file() {
        return Err(format!(
            "ComfyUI launch script not found: {}",
            script.display()
        ));
    }

    let child_slot = COMFYUI_CHILD.get_or_init(|| Mutex::new(None));
    let mut guard = child_slot
        .lock()
        .map_err(|_| "ComfyUI process lock was poisoned".to_string())?;

    if let Some(managed) = guard.as_mut() {
        match managed
            .child
            .try_wait()
            .map_err(|error| format!("Could not inspect ComfyUI process: {}", error))?
        {
            None if managed.endpoint == *endpoint => return Ok(managed.log_path.clone()),
            None => {
                if let Some(mut stale) = guard.take() {
                    let _ = stale.child.kill();
                    let _ = stale.child.wait();
                }
            }
            Some(_) => {
                *guard = None;
            }
        }
    }

    let log_path = repo_root.join(LAUNCH_LOG_RELATIVE);
    let log_parent = log_path
        .parent()
        .ok_or_else(|| "ComfyUI launch log path has no parent directory".to_string())?;
    fs::create_dir_all(log_parent).map_err(|error| {
        format!(
            "Could not create ComfyUI launch log directory {}: {}",
            log_parent.display(),
            error
        )
    })?;
    let mut launch_log = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_path)
        .map_err(|error| {
            format!(
                "Could not open ComfyUI launch log {}: {}",
                log_path.display(),
                error
            )
        })?;
    writeln!(
        launch_log,
        "Drive16 ComfyUI launch at {} for {}",
        unix_timestamp(),
        endpoint.base_url
    )
    .ok();
    let launch_log_for_stderr = launch_log.try_clone().map_err(|error| {
        format!(
            "Could not attach stderr to ComfyUI launch log {}: {}",
            log_path.display(),
            error
        )
    })?;

    let child = Command::new(script)
        .env("COMFYUI_HOST", &endpoint.host)
        .env("COMFYUI_PORT", endpoint.port.to_string())
        .current_dir(repo_root)
        .stdin(Stdio::null())
        .stdout(Stdio::from(launch_log))
        .stderr(Stdio::from(launch_log_for_stderr))
        .spawn()
        .map_err(|error| format!("Could not launch ComfyUI: {}", error))?;

    *guard = Some(ManagedComfyUiProcess {
        child,
        endpoint: endpoint.clone(),
        log_path: log_path.clone(),
    });
    Ok(log_path)
}

fn comfyui_launch_exit_detail(repo_root: &Path) -> Option<String> {
    let child_slot = COMFYUI_CHILD.get_or_init(|| Mutex::new(None));
    let mut guard = child_slot.lock().ok()?;
    let managed = guard.as_mut()?;
    let status = match managed.child.try_wait() {
        Ok(Some(status)) => status,
        Ok(None) => return None,
        Err(error) => {
            let detail = format!("Could not inspect ComfyUI launch process: {}", error);
            *guard = None;
            return Some(detail);
        }
    };
    let log_tail = launch_log_tail(&managed.log_path, 12).unwrap_or_else(|| {
        format!(
            "{} had no readable output",
            repo_relative_or_display(repo_root, &managed.log_path)
        )
    });
    let detail = format!(
        "ComfyUI launch exited before the API became ready ({}). {}",
        exit_status_text(status),
        log_tail
    );
    *guard = None;
    Some(detail)
}

fn exit_status_text(status: ExitStatus) -> String {
    match status.code() {
        Some(code) => format!("exit code {}", code),
        None => "terminated by signal".to_string(),
    }
}

fn launch_log_tail(path: &Path, max_lines: usize) -> Option<String> {
    let text = fs::read_to_string(path).ok()?;
    let mut lines = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if lines.is_empty() {
        return None;
    }
    if lines.len() > max_lines {
        lines = lines.split_off(lines.len() - max_lines);
    }
    Some(format!("Launch log tail: {}", lines.join(" | ")))
}

fn repo_relative_or_display(repo_root: &Path, path: &Path) -> String {
    path.strip_prefix(repo_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

fn check_endpoint_for_repo(
    repo_root: PathBuf,
    endpoint: LocalEndpoint,
    checkpoint_override: Option<String>,
    lora_override: Option<String>,
) -> ComfyUiEndpointStatus {
    let stats = match probe_system_stats(&endpoint) {
        Ok(stats) => stats,
        Err(error) => {
            let friendly = format!(
                "ComfyUI is not running at {}. Start it with scripts/launch-phase4-comfyui-api.sh, then Test again. ({})",
                endpoint.base_url, error
            );
            let checks = phase4_readiness_checks(
                &repo_root,
                Err(&error),
                checkpoint_override,
                lora_override,
                readiness_check("API", "missing", &friendly),
            );
            return status("missing", &friendly, &endpoint, None, 0, checks);
        }
    };
    let version = extract_version(&stats);
    let devices = extract_device_count(&stats);
    let object_info = probe_object_info(&endpoint);
    let checks = phase4_readiness_checks(
        &repo_root,
        object_info.as_ref(),
        checkpoint_override,
        lora_override,
        readiness_check("API", "ready", "System stats available"),
    );
    let (state, detail) = summarize_readiness(&checks);

    status(&state, &detail, &endpoint, version, devices, checks)
}

fn probe_system_stats(endpoint: &LocalEndpoint) -> Result<Value, String> {
    let response = http_get(endpoint, SYSTEM_STATS_PATH)?;
    if !(200..300).contains(&response.status) {
        return Err(format!(
            "ComfyUI system stats failed with HTTP {}",
            response.status
        ));
    }

    let stats: Value = serde_json::from_str(&response.body)
        .map_err(|error| format!("ComfyUI system stats were not JSON: {}", error))?;
    if stats.get("system").is_none() {
        return Err("ComfyUI response did not include system stats".to_string());
    }

    Ok(stats)
}

fn probe_object_info(endpoint: &LocalEndpoint) -> Result<Value, String> {
    let response = http_get(endpoint, OBJECT_INFO_PATH)?;
    if !(200..300).contains(&response.status) {
        return Err(format!(
            "ComfyUI object info failed with HTTP {}",
            response.status
        ));
    }

    serde_json::from_str(&response.body)
        .map_err(|error| format!("ComfyUI object info was not JSON: {}", error))
}

fn http_get(endpoint: &LocalEndpoint, path: &str) -> Result<HttpResponse, String> {
    let address = SocketAddr::from(([127, 0, 0, 1], endpoint.port));
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))
        .map_err(|error| format!("Could not connect to {}: {}", endpoint.base_url, error))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| format!("Could not set ComfyUI read timeout: {}", error))?;

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        path, endpoint.host, endpoint.port
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Could not write ComfyUI request: {}", error))?;

    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|error| format!("Could not read ComfyUI response: {}", error))?;

    parse_http_response(&raw)
}

fn normalize_endpoint(input: &str) -> Result<LocalEndpoint, String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("ComfyUI endpoint required".to_string());
    }

    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{}", trimmed)
    };
    let rest = with_scheme
        .strip_prefix("http://")
        .ok_or_else(|| "Use a local http:// ComfyUI endpoint".to_string())?;
    if rest.contains('@') {
        return Err("ComfyUI endpoint must not include credentials".to_string());
    }

    let authority = rest.split('/').next().unwrap_or(rest);
    let (host, port) = parse_host_port(authority)?;
    if host != "127.0.0.1" && host != "localhost" {
        return Err("ComfyUI endpoint must be local".to_string());
    }

    Ok(LocalEndpoint {
        host: host.to_string(),
        port,
        base_url: format!("http://{}:{}", host, port),
    })
}

fn parse_host_port(authority: &str) -> Result<(&str, u16), String> {
    if authority.is_empty() {
        return Err("ComfyUI endpoint host required".to_string());
    }

    let mut pieces = authority.split(':');
    let host = pieces
        .next()
        .ok_or_else(|| "ComfyUI endpoint host required".to_string())?;
    let port = match pieces.next() {
        Some(value) if !value.is_empty() => value
            .parse::<u16>()
            .map_err(|_| "ComfyUI endpoint port must be a number".to_string())?,
        Some(_) => return Err("ComfyUI endpoint port required".to_string()),
        None => DEFAULT_PORT,
    };
    if pieces.next().is_some() {
        return Err("ComfyUI endpoint must use host:port".to_string());
    }

    Ok((host, port))
}

fn parse_http_response(raw: &str) -> Result<HttpResponse, String> {
    let (headers, body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| "ComfyUI returned a malformed HTTP response".to_string())?;
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "ComfyUI response did not include an HTTP status".to_string())?;

    Ok(HttpResponse {
        status,
        body: body.to_string(),
    })
}

fn extract_version(stats: &Value) -> Option<String> {
    stats
        .get("system")
        .and_then(|system| system.get("comfyui_version"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
}

fn extract_device_count(stats: &Value) -> usize {
    stats
        .get("devices")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0)
}

fn phase4_readiness_checks(
    repo_root: &Path,
    object_info: Result<&Value, &String>,
    checkpoint_override: Option<String>,
    lora_override: Option<String>,
    api_check: ComfyUiReadinessCheck,
) -> Vec<ComfyUiReadinessCheck> {
    let manifest_path = repo_root.join(MANIFEST_RELATIVE);
    let workflow_path = repo_root.join(WORKFLOW_RELATIVE);
    let manifest = match read_json_file(&manifest_path) {
        Ok(value) => value,
        Err(error) => {
            return vec![api_check, readiness_check("Contract", "missing", &error)];
        }
    };
    let workflow = match read_json_file(&workflow_path) {
        Ok(value) => value,
        Err(error) => {
            return vec![api_check, readiness_check("Contract", "missing", &error)];
        }
    };

    let manifest_checkpoint = manifest_checkpoint(&manifest);
    let manifest_lora = manifest_lora(&manifest);
    let checkpoint = selected_checkpoint(&manifest_checkpoint, checkpoint_override.as_deref());
    let lora = selected_lora(&manifest_lora, lora_override.as_deref());
    let required_classes = class_types(&workflow);
    let comfyui_root = comfyui_root();

    let mut checks = vec![api_check];
    checks.push(checkpoint_readiness(
        &comfyui_root,
        &checkpoint,
        object_info.ok(),
    ));
    checks.push(lora_readiness(&comfyui_root, &lora, object_info.ok()));
    checks.push(pixydust_readiness(&comfyui_root, object_info.ok()));
    checks.push(workflow_class_readiness(&required_classes, object_info));
    checks
}

fn read_json_file(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("Could not read {}: {}", path.display(), error))?;
    serde_json::from_str(&text)
        .map_err(|error| format!("{} was not JSON: {}", path.display(), error))
}

fn manifest_checkpoint(manifest: &Value) -> String {
    manifest
        .get("model")
        .and_then(|model| model.get("checkpoint"))
        .and_then(Value::as_str)
        .unwrap_or("sd_xl_base_1.0.safetensors")
        .to_string()
}

fn manifest_lora(manifest: &Value) -> String {
    manifest
        .get("model")
        .and_then(|model| model.get("lora"))
        .and_then(Value::as_str)
        .unwrap_or("pixel-art-xl.safetensors")
        .to_string()
}

fn selected_checkpoint(manifest_checkpoint: &str, checkpoint_override: Option<&str>) -> String {
    checkpoint_override
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            env::var("DRIVE16_COMFYUI_CHECKPOINT")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| manifest_checkpoint.to_string())
}

fn selected_lora(manifest_lora: &str, lora_override: Option<&str>) -> String {
    lora_override
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            env::var("DRIVE16_COMFYUI_LORA")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_else(|| manifest_lora.to_string())
}

fn class_types(workflow: &Value) -> Vec<String> {
    let mut classes = workflow
        .as_object()
        .map(|nodes| {
            nodes
                .values()
                .filter_map(|node| node.get("class_type").and_then(Value::as_str))
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    classes.sort();
    classes.dedup();
    classes
}

fn object_info_classes(object_info: &Value) -> Vec<String> {
    let mut classes = object_info
        .as_object()
        .map(|nodes| nodes.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();
    classes.sort();
    classes
}

fn checkpoint_names_from_object_info(object_info: &Value) -> Vec<String> {
    object_info
        .get("CheckpointLoaderSimple")
        .and_then(|checkpoint| checkpoint.get("input"))
        .and_then(|input| input.get("required"))
        .and_then(|required| required.get("ckpt_name"))
        .and_then(Value::as_array)
        .and_then(|entries| entries.first())
        .and_then(Value::as_array)
        .map(|names| {
            names
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn lora_names_from_object_info(object_info: &Value) -> Vec<String> {
    object_info
        .get("LoraLoader")
        .and_then(|lora| lora.get("input"))
        .and_then(|input| input.get("required"))
        .and_then(|required| required.get("lora_name"))
        .and_then(Value::as_array)
        .and_then(|entries| entries.first())
        .and_then(Value::as_array)
        .map(|names| {
            names
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn checkpoint_readiness(
    comfyui_root: &Path,
    checkpoint: &str,
    object_info: Option<&Value>,
) -> ComfyUiReadinessCheck {
    if let Some(object_info) = object_info {
        if checkpoint_names_from_object_info(object_info)
            .iter()
            .any(|name| name == checkpoint)
        {
            return readiness_check("Checkpoint", "ready", checkpoint);
        }
    }

    let candidates = checkpoint_candidates(comfyui_root, checkpoint);
    if let Some(existing) = candidates.iter().find(|path| path.is_file()) {
        return readiness_check("Checkpoint", "ready", &existing.display().to_string());
    }

    readiness_check_with_hints(
        "Checkpoint",
        "missing",
        checkpoint,
        nearby_checkpoint_hints(comfyui_root, &candidates),
    )
}

fn lora_readiness(
    comfyui_root: &Path,
    lora: &str,
    object_info: Option<&Value>,
) -> ComfyUiReadinessCheck {
    if let Some(object_info) = object_info {
        if lora_names_from_object_info(object_info)
            .iter()
            .any(|name| name == lora)
        {
            return readiness_check("LoRA", "ready", lora);
        }
    }

    let candidates = lora_candidates(comfyui_root, lora);
    if let Some(existing) = candidates.iter().find(|path| path.is_file()) {
        return readiness_check("LoRA", "ready", &existing.display().to_string());
    }

    readiness_check_with_hints(
        "LoRA",
        "missing",
        lora,
        nearby_lora_hints(comfyui_root, &candidates),
    )
}

fn checkpoint_candidates(comfyui_root: &Path, checkpoint: &str) -> Vec<PathBuf> {
    let checkpoint_path = PathBuf::from(checkpoint);
    if checkpoint_path.is_absolute() {
        return vec![checkpoint_path];
    }

    vec![
        comfyui_root
            .join("models")
            .join("checkpoints")
            .join(checkpoint),
        comfyui_root.join("models").join(checkpoint),
    ]
}

fn lora_candidates(comfyui_root: &Path, lora: &str) -> Vec<PathBuf> {
    let lora_path = PathBuf::from(lora);
    if lora_path.is_absolute() {
        return vec![lora_path];
    }

    vec![
        comfyui_root.join("models").join("loras").join(lora),
        comfyui_root.join("models").join("lora").join(lora),
        comfyui_root.join("models").join(lora),
    ]
}

fn checkpoint_hint_directories(comfyui_root: &Path) -> Vec<PathBuf> {
    let mut directories = vec![
        comfyui_root.join("models").join("checkpoints"),
        comfyui_root.join("models"),
    ];
    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        directories.push(
            home.join("Documents")
                .join("GitHub")
                .join("Fooocus")
                .join("models")
                .join("checkpoints"),
        );
        directories.push(home.join(".diffusionbee").join("downloaded_assets"));
    }
    directories
}

fn lora_hint_directories(comfyui_root: &Path) -> Vec<PathBuf> {
    vec![
        comfyui_root.join("models").join("loras"),
        comfyui_root.join("models").join("lora"),
        comfyui_root.join("models"),
    ]
}

fn nearby_checkpoint_hints(comfyui_root: &Path, checked_paths: &[PathBuf]) -> Vec<String> {
    nearby_model_hints(
        checkpoint_hint_directories(comfyui_root),
        checked_paths,
        &CHECKPOINT_SUFFIXES,
    )
}

fn nearby_lora_hints(comfyui_root: &Path, checked_paths: &[PathBuf]) -> Vec<String> {
    nearby_model_hints(
        lora_hint_directories(comfyui_root),
        checked_paths,
        &LORA_SUFFIXES,
    )
}

fn nearby_model_hints(
    directories: Vec<PathBuf>,
    checked_paths: &[PathBuf],
    suffixes: &[&str],
) -> Vec<String> {
    let checked = checked_paths
        .iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>();
    let mut hints = Vec::new();
    for directory in directories {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .map(str::to_ascii_lowercase);
            if !extension
                .as_deref()
                .map(|value| suffixes.contains(&value))
                .unwrap_or(false)
            {
                continue;
            }
            let path_text = path.to_string_lossy().to_string();
            if checked.contains(&path_text) || hints.contains(&path_text) {
                continue;
            }
            hints.push(path_text);
        }
    }
    hints.sort();
    hints.truncate(12);
    hints
}

fn pixydust_readiness(comfyui_root: &Path, object_info: Option<&Value>) -> ComfyUiReadinessCheck {
    if object_info
        .map(object_info_classes)
        .unwrap_or_default()
        .iter()
        .any(|class_name| class_name == "Quantizer")
    {
        return readiness_check("Pixydust", "ready", "Quantizer node available");
    }

    let custom_nodes = comfyui_root.join("custom_nodes");
    let filesystem_ready = fs::read_dir(&custom_nodes)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .any(|entry| {
            let name = entry.file_name().to_string_lossy().to_lowercase();
            entry.path().is_dir() && (name.contains("pixydust") || name.contains("quantizer"))
        });
    if filesystem_ready {
        return readiness_check("Pixydust", "ready", &custom_nodes.display().to_string());
    }

    readiness_check("Pixydust", "missing", "Quantizer node missing")
}

fn workflow_class_readiness(
    required_classes: &[String],
    object_info: Result<&Value, &String>,
) -> ComfyUiReadinessCheck {
    let object_info = match object_info {
        Ok(value) => value,
        Err(error) => return readiness_check("Workflow", "missing", error),
    };
    let available = object_info_classes(object_info);
    let missing = required_classes
        .iter()
        .filter(|class_name| !available.contains(class_name))
        .cloned()
        .collect::<Vec<_>>();
    if missing.is_empty() {
        readiness_check("Workflow", "ready", "Required classes available")
    } else {
        readiness_check("Workflow", "missing", &missing.join(", "))
    }
}

fn summarize_readiness(checks: &[ComfyUiReadinessCheck]) -> (String, String) {
    let missing = checks
        .iter()
        .filter(|check| check.state != "ready")
        .map(|check| check.name.as_str())
        .collect::<Vec<_>>();
    if missing.is_empty() {
        (
            "ready".to_string(),
            "ComfyUI sprite prerequisites ready".to_string(),
        )
    } else {
        (
            "warning".to_string(),
            format!("ComfyUI reachable, check {}", missing.join(", ")),
        )
    }
}

fn readiness_check(name: &str, state: &str, detail: &str) -> ComfyUiReadinessCheck {
    readiness_check_with_hints(name, state, detail, Vec::new())
}

fn readiness_check_with_hints(
    name: &str,
    state: &str,
    detail: &str,
    hints: Vec<String>,
) -> ComfyUiReadinessCheck {
    ComfyUiReadinessCheck {
        name: name.to_string(),
        state: state.to_string(),
        detail: detail.to_string(),
        hints,
    }
}

fn comfyui_root() -> PathBuf {
    env::var_os("COMFYUI_ROOT")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join("Documents/ComfyUI")))
        .unwrap_or_else(|| PathBuf::from("ComfyUI"))
}

fn repo_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .unwrap_or(manifest_dir)
}

fn status(
    state: &str,
    detail: &str,
    endpoint: &LocalEndpoint,
    version: Option<String>,
    devices: usize,
    checks: Vec<ComfyUiReadinessCheck>,
) -> ComfyUiEndpointStatus {
    ComfyUiEndpointStatus {
        generated_at: unix_timestamp(),
        state: state.to_string(),
        detail: detail.to_string(),
        base_url: endpoint.base_url.clone(),
        system_stats_url: format!("{}{}", endpoint.base_url, SYSTEM_STATS_PATH),
        version,
        devices,
        checks,
    }
}

fn unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    use std::{net::TcpListener, thread};

    fn clear_managed_comfyui_child() {
        if let Ok(mut guard) = COMFYUI_CHILD.get_or_init(|| Mutex::new(None)).lock() {
            if let Some(mut managed) = guard.take() {
                let _ = managed.child.kill();
                let _ = managed.child.wait();
            }
        }
    }

    fn test_stamp() -> String {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos().to_string())
            .unwrap_or_else(|_| "0".to_string())
    }

    #[test]
    fn normalizes_local_comfyui_endpoint() {
        let endpoint = normalize_endpoint(" 127.0.0.1:8188/ ").expect("endpoint should normalize");

        assert_eq!(
            endpoint,
            LocalEndpoint {
                host: "127.0.0.1".to_string(),
                port: 8188,
                base_url: "http://127.0.0.1:8188".to_string(),
            }
        );
    }

    #[test]
    fn defaults_localhost_port() {
        let endpoint = normalize_endpoint("http://localhost").expect("endpoint should normalize");

        assert_eq!(endpoint.host, "localhost");
        assert_eq!(endpoint.port, 8188);
        assert_eq!(endpoint.base_url, "http://localhost:8188");
    }

    #[test]
    fn rejects_non_local_endpoint() {
        let error = normalize_endpoint("https://example.com:8188")
            .expect_err("remote https endpoint should be rejected");

        assert_eq!(error, "Use a local http:// ComfyUI endpoint");
    }

    #[test]
    fn parses_http_response() {
        let response = parse_http_response(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"system\":{}}",
        )
        .expect("response should parse");

        assert_eq!(response.status, 200);
        assert_eq!(response.body, "{\"system\":{}}");
    }

    #[test]
    fn launch_log_tail_reports_recent_lines() {
        let log_path =
            std::env::temp_dir().join(format!("drive16-comfyui-launch-log-{}.log", test_stamp()));
        fs::write(&log_path, "one\ntwo\nthree\nfour\n").expect("log should write");

        let tail = launch_log_tail(&log_path, 2).expect("tail should read");
        let _ = fs::remove_file(&log_path);

        assert_eq!(tail, "Launch log tail: three | four");
    }

    #[test]
    fn start_comfyui_reports_missing_launch_script() {
        clear_managed_comfyui_child();
        let repo_root =
            std::env::temp_dir().join(format!("drive16-comfyui-missing-script-{}", test_stamp()));
        fs::create_dir_all(&repo_root).expect("temp repo should exist");
        let endpoint = normalize_endpoint("127.0.0.1:8188").expect("endpoint should normalize");

        let error =
            start_comfyui(&repo_root, &endpoint).expect_err("missing launch script should fail");
        let _ = fs::remove_dir_all(&repo_root);
        clear_managed_comfyui_child();

        assert!(error.contains("ComfyUI launch script not found"));
    }

    #[cfg(unix)]
    #[test]
    fn start_comfyui_relaunches_when_endpoint_changes() {
        clear_managed_comfyui_child();
        let repo_root = std::env::temp_dir().join(format!(
            "drive16-comfyui-endpoint-change-{}-{}",
            test_stamp(),
            std::process::id()
        ));
        let scripts_dir = repo_root.join("scripts");
        fs::create_dir_all(&scripts_dir).expect("scripts dir should exist");
        let script_path = scripts_dir.join("launch-phase4-comfyui-api.sh");
        fs::write(
            &script_path,
            "#!/usr/bin/env bash\necho \"fake comfy on $COMFYUI_HOST:$COMFYUI_PORT\"\nsleep 30\n",
        )
        .expect("fake launch script should write");
        let mut permissions = fs::metadata(&script_path)
            .expect("fake launch script metadata should read")
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script_path, permissions).expect("fake launch script should chmod");

        let first = normalize_endpoint("127.0.0.1:8188").expect("endpoint should normalize");
        let second = normalize_endpoint("127.0.0.1:8288").expect("endpoint should normalize");
        let log_path = start_comfyui(&repo_root, &first).expect("first launch should start");
        thread::sleep(Duration::from_millis(100));

        start_comfyui(&repo_root, &second).expect("second endpoint should relaunch");
        thread::sleep(Duration::from_millis(100));
        let log_text = fs::read_to_string(&log_path).expect("launch log should read");

        clear_managed_comfyui_child();
        let _ = fs::remove_dir_all(&repo_root);

        assert!(
            log_text.contains("for http://127.0.0.1:8288"),
            "log should show the relaunched endpoint: {log_text}"
        );
    }

    #[test]
    fn extracts_stats_fields() {
        let stats: Value = serde_json::json!({
            "system": {
                "comfyui_version": "0.3.99"
            },
            "devices": [{ "name": "GPU" }]
        });

        assert_eq!(extract_version(&stats).as_deref(), Some("0.3.99"));
        assert_eq!(extract_device_count(&stats), 1);
    }

    #[test]
    fn extracts_phase4_workflow_classes() {
        let workflow: Value = serde_json::json!({
            "1": { "class_type": "CheckpointLoaderSimple" },
            "2": { "class_type": "Quantizer" },
            "3": { "class_type": "Quantizer" }
        });

        assert_eq!(
            class_types(&workflow),
            vec![
                "CheckpointLoaderSimple".to_string(),
                "Quantizer".to_string()
            ]
        );
    }

    #[test]
    fn extracts_checkpoint_names_from_object_info() {
        let object_info: Value = serde_json::json!({
            "CheckpointLoaderSimple": {
                "input": {
                    "required": {
                        "ckpt_name": [[
                            "pixel-art-diffusion-xl.safetensors",
                            "sd_xl_base_1.0.safetensors",
                            "alternate-pixel.safetensors"
                        ]]
                    }
                }
            }
        });

        assert_eq!(
            checkpoint_names_from_object_info(&object_info),
            vec![
                "pixel-art-diffusion-xl.safetensors".to_string(),
                "sd_xl_base_1.0.safetensors".to_string(),
                "alternate-pixel.safetensors".to_string()
            ]
        );
    }

    #[test]
    fn extracts_lora_names_from_object_info() {
        let object_info: Value = serde_json::json!({
            "LoraLoader": {
                "input": {
                    "required": {
                        "lora_name": [[
                            "pixel-art-xl.safetensors",
                            "alternate-pixel-lora.safetensors"
                        ]]
                    }
                }
            }
        });

        assert_eq!(
            lora_names_from_object_info(&object_info),
            vec![
                "pixel-art-xl.safetensors".to_string(),
                "alternate-pixel-lora.safetensors".to_string()
            ]
        );
    }

    #[test]
    fn summarizes_warning_when_sprite_prereqs_are_missing() {
        let checks = vec![
            readiness_check("API", "ready", "System stats available"),
            readiness_check("Checkpoint", "missing", "sd_xl_base_1.0.safetensors"),
            readiness_check("LoRA", "missing", "pixel-art-xl.safetensors"),
            readiness_check("Pixydust", "ready", "Quantizer node available"),
        ];

        let (state, detail) = summarize_readiness(&checks);

        assert_eq!(state, "warning");
        assert_eq!(detail, "ComfyUI reachable, check Checkpoint, LoRA");
    }

    #[test]
    fn checkpoint_readiness_reports_nearby_hints_without_passing() {
        let root = std::env::temp_dir().join(format!("drive16-comfyui-hints-{}", unix_timestamp()));
        let checkpoints = root.join("models").join("checkpoints");
        fs::create_dir_all(&checkpoints).expect("hint directory should be created");
        fs::write(checkpoints.join("nearby.safetensors"), b"fixture")
            .expect("hint checkpoint should be written");

        let check = checkpoint_readiness(&root, "sd_xl_base_1.0.safetensors", None);

        assert_eq!(check.name, "Checkpoint");
        assert_eq!(check.state, "missing");
        assert!(check
            .hints
            .iter()
            .any(|hint| hint.ends_with("nearby.safetensors")));

        fs::remove_dir_all(root).expect("hint fixture should be removed");
    }

    #[test]
    fn endpoint_check_reports_phase4_sprite_readiness() {
        let workflow = read_json_file(&repo_root().join(WORKFLOW_RELATIVE))
            .expect("workflow contract should load");
        let mut object_info = serde_json::Map::new();
        for class_name in class_types(&workflow) {
            object_info.insert(class_name, serde_json::json!({}));
        }
        object_info.insert(
            "CheckpointLoaderSimple".to_string(),
            serde_json::json!({
                "input": {
                    "required": {
                        "ckpt_name": [["sd_xl_base_1.0.safetensors"]]
                    }
                }
            }),
        );
        object_info.insert(
            "LoraLoader".to_string(),
            serde_json::json!({
                "input": {
                    "required": {
                        "lora_name": [["pixel-art-xl.safetensors"]]
                    }
                }
            }),
        );
        object_info.insert("Quantizer".to_string(), serde_json::json!({}));

        let (endpoint, handle) =
            spawn_comfyui_server(serde_json::Value::Object(object_info).to_string());
        let status = check_endpoint(ComfyUiEndpointRequest {
            endpoint,
            checkpoint: None,
            lora: None,
        });
        handle.join().expect("test server should exit cleanly");

        assert_eq!(status.state, "ready");
        assert_eq!(status.detail, "ComfyUI sprite prerequisites ready");
        assert_eq!(status.checks.len(), 5);
        assert!(status.checks.iter().all(|check| check.state == "ready"));
    }

    #[test]
    fn endpoint_check_uses_request_checkpoint_override() {
        let workflow = read_json_file(&repo_root().join(WORKFLOW_RELATIVE))
            .expect("workflow contract should load");
        let mut object_info = serde_json::Map::new();
        for class_name in class_types(&workflow) {
            object_info.insert(class_name, serde_json::json!({}));
        }
        object_info.insert(
            "CheckpointLoaderSimple".to_string(),
            serde_json::json!({
                "input": {
                    "required": {
                        "ckpt_name": [["alternate-pixel.safetensors"]]
                    }
                }
            }),
        );
        object_info.insert(
            "LoraLoader".to_string(),
            serde_json::json!({
                "input": {
                    "required": {
                        "lora_name": [["alternate-pixel-lora.safetensors"]]
                    }
                }
            }),
        );
        object_info.insert("Quantizer".to_string(), serde_json::json!({}));

        let (endpoint, handle) =
            spawn_comfyui_server(serde_json::Value::Object(object_info).to_string());
        let status = check_endpoint(ComfyUiEndpointRequest {
            endpoint,
            checkpoint: Some("alternate-pixel.safetensors".to_string()),
            lora: Some("alternate-pixel-lora.safetensors".to_string()),
        });
        handle.join().expect("test server should exit cleanly");

        assert_eq!(status.state, "ready");
        assert!(status.checks.iter().any(|check| {
            check.name == "Checkpoint"
                && check.state == "ready"
                && check.detail == "alternate-pixel.safetensors"
        }));
        assert!(status.checks.iter().any(|check| {
            check.name == "LoRA"
                && check.state == "ready"
                && check.detail == "alternate-pixel-lora.safetensors"
        }));
    }

    fn spawn_comfyui_server(object_info: String) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let endpoint = format!(
            "http://127.0.0.1:{}",
            listener.local_addr().expect("test server address").port()
        );
        let handle = thread::spawn(move || {
            for _ in 0..2 {
                let (mut stream, _) = listener.accept().expect("test server connection");
                let mut request_buffer = [0; 1024];
                let bytes = stream
                    .read(&mut request_buffer)
                    .expect("test server should read request");
                let request = String::from_utf8_lossy(&request_buffer[..bytes]);
                let body = if request.contains("GET /object_info ") {
                    object_info.as_str()
                } else {
                    r#"{"system":{"comfyui_version":"test"},"devices":[{"name":"GPU"}]}"#
                };
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                stream
                    .write_all(response.as_bytes())
                    .expect("test server should write response");
            }
        });

        (endpoint, handle)
    }
}
