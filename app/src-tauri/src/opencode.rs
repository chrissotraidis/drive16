use crate::runtime::repo_root;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    env,
    net::TcpListener,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 4096;
const DEFAULT_COMFYUI_URL: &str = "http://127.0.0.1:8188";
const DEFAULT_COMFYUI_CHECKPOINT: &str = "sd_xl_base_1.0.safetensors";
const DEFAULT_COMFYUI_LORA: &str = "pixel-art-xl.safetensors";
const HEALTH_PATH: &str = "/global/health";
const EVENT_PATH: &str = "/global/event";

static OPENCODE_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();
static OPENCODE_ENDPOINT: OnceLock<Mutex<OpenCodeEndpoint>> = OnceLock::new();
static OPENCODE_RUNTIME: OnceLock<Mutex<OpenCodeRuntimeConfig>> = OnceLock::new();
static OPENCODE_BACKGROUND_ERRORS: OnceLock<Mutex<Vec<String>>> = OnceLock::new();

#[derive(Debug, Clone)]
struct OpenCodeEndpoint {
    port: u16,
    base_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OpenCodeRuntimeConfig {
    comfy_ui_endpoint: String,
    comfy_ui_checkpoint: String,
    comfy_ui_lora: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeBridgeStatus {
    pub generated_at: String,
    pub state: String,
    pub detail: String,
    pub base_url: String,
    pub health_url: String,
    pub event_url: String,
    pub version: Option<String>,
    pub launched: bool,
    pub connected_providers: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeSendRequest {
    pub session_id: Option<String>,
    pub text: String,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub no_reply: Option<bool>,
    pub background: Option<bool>,
    pub comfy_ui_endpoint: Option<String>,
    pub comfy_ui_checkpoint: Option<String>,
    pub comfy_ui_lora: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeSendResult {
    pub session_id: String,
    pub message_id: String,
    pub part_id: String,
    pub state: String,
    pub detail: String,
    pub reply_text: Option<String>,
    pub finish: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeAuthRequest {
    pub provider_id: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeAuthResult {
    pub connected: bool,
    pub restarted: bool,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeBackgroundError {
    pub generated_at: String,
    pub detail: String,
}

#[derive(Debug, Deserialize)]
struct HealthResponse {
    healthy: bool,
    version: String,
}

struct HttpResponse {
    status: u16,
    body: String,
}

pub fn connect_opencode() -> OpenCodeBridgeStatus {
    let initial_endpoint = current_endpoint();
    match wait_for_health(Duration::from_millis(250), Duration::from_millis(250)) {
        Ok(health) => status(
            "ready",
            "OpenCode server already running",
            Some(health),
            false,
        ),
        Err(error) => {
            let conflict = port_conflict_detail(&initial_endpoint, &error);
            if conflict.is_some() {
                match reserve_ephemeral_endpoint() {
                    Ok(endpoint) => set_current_endpoint(endpoint),
                    Err(error) => {
                        return status(
                            "missing",
                            &format!(
                                "{} Could not choose an alternate build-agent port: {}",
                                conflict.unwrap_or_default(),
                                error
                            ),
                            None,
                            false,
                        );
                    }
                }
            }

            match start_opencode() {
                Ok(()) => match wait_for_health(Duration::from_secs(8), Duration::from_millis(250))
                {
                    Ok(health) => {
                        let detail = conflict
                            .map(|value| {
                                format!(
                                    "{} Drive16 launched its own OpenCode server at {}.",
                                    value,
                                    current_endpoint().base_url
                                )
                            })
                            .unwrap_or_else(|| "OpenCode server launched".to_string());
                        status("ready", &detail, Some(health), true)
                    }
                    Err(error) => status(
                        "warning",
                        &format!("OpenCode launched but did not become ready: {}", error),
                        None,
                        true,
                    ),
                },
                Err(error) => status("missing", &error, None, false),
            }
        }
    }
}

fn port_conflict_detail(endpoint: &OpenCodeEndpoint, error: &str) -> Option<String> {
    if !error.contains("HTTP 401") && !error.to_lowercase().contains("requires authentication") {
        return None;
    }

    Some(format!(
        "Another local tool is using the build-agent port at {}.",
        endpoint.base_url
    ))
}

fn reserve_ephemeral_endpoint() -> Result<OpenCodeEndpoint, String> {
    let listener = TcpListener::bind((HOST, 0))
        .map_err(|error| format!("could not reserve a local port: {}", error))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("could not inspect reserved port: {}", error))?
        .port();
    drop(listener);
    Ok(endpoint_for_port(port))
}

fn endpoint_for_port(port: u16) -> OpenCodeEndpoint {
    OpenCodeEndpoint {
        port,
        base_url: format!("http://{}:{}", HOST, port),
    }
}

fn current_endpoint() -> OpenCodeEndpoint {
    OPENCODE_ENDPOINT
        .get_or_init(|| Mutex::new(endpoint_for_port(DEFAULT_PORT)))
        .lock()
        .map(|endpoint| endpoint.clone())
        .unwrap_or_else(|_| endpoint_for_port(DEFAULT_PORT))
}

fn set_current_endpoint(endpoint: OpenCodeEndpoint) {
    if let Ok(mut guard) = OPENCODE_ENDPOINT
        .get_or_init(|| Mutex::new(endpoint_for_port(DEFAULT_PORT)))
        .lock()
    {
        *guard = endpoint;
    }
}

pub fn send_opencode_message(request: OpenCodeSendRequest) -> Result<OpenCodeSendResult, String> {
    let text = request.text.trim();
    if text.is_empty() {
        return Err("OpenCode message text cannot be empty".to_string());
    }

    apply_runtime_config_from_request(&request)?;

    wait_for_health(Duration::from_secs(3), Duration::from_millis(200))
        .map_err(|error| format!("OpenCode server is not ready: {}", error))?;

    let session_id = match request.session_id.filter(|value| !value.trim().is_empty()) {
        Some(session_id) => session_id,
        None => create_session()?,
    };

    let stamp = unique_stamp();
    let message_id = format!("msg_drive16_{}", stamp);
    let part_id = format!("prt_drive16_{}", stamp);
    let no_reply = request.no_reply.unwrap_or(false);
    let background = request.background.unwrap_or(false);
    let mut body = json!({
        "messageID": message_id,
        "parts": [
            {
                "id": part_id,
                "type": "text",
                "text": text
            }
        ]
    });
    if no_reply {
        body["noReply"] = json!(true);
    }
    if let (Some(provider_id), Some(model_id)) = (&request.provider_id, &request.model_id) {
        body["model"] = json!({
            "providerID": provider_id,
            "modelID": model_id
        });
    }

    let path = format!("/session/{}/message", session_id);
    if background {
        let background_path = path.clone();
        let background_body = body.clone();
        thread::spawn(move || {
            let timeout = Duration::from_secs(20 * 60);
            match http_request_with_timeout(
                "POST",
                &background_path,
                Some(&background_body),
                timeout,
            )
            .and_then(|response| {
                require_success(response.status, &response.body, "post background message")?;
                Ok(())
            }) {
                Ok(()) => {}
                Err(error) => {
                    push_background_error(error.clone());
                    eprintln!("Drive16 OpenCode background message failed: {}", error);
                }
            }
        });

        return Ok(OpenCodeSendResult {
            session_id,
            message_id,
            part_id,
            state: "ready".to_string(),
            detail: "OpenCode agent request started in the background".to_string(),
            reply_text: None,
            finish: None,
        });
    }

    // A real agent run holds the connection open while it plans, edits, and
    // builds; give it a long window instead of the default request timeout.
    let timeout = if no_reply {
        Duration::from_secs(5)
    } else {
        Duration::from_secs(10 * 60)
    };
    let response = http_request_with_timeout("POST", &path, Some(&body), timeout)?;
    require_success(response.status, &response.body, "post message")?;

    if no_reply {
        return Ok(OpenCodeSendResult {
            session_id,
            message_id,
            part_id,
            state: "ready".to_string(),
            detail: "Message posted to OpenCode with noReply".to_string(),
            reply_text: None,
            finish: None,
        });
    }

    if response.body.trim().is_empty() {
        return Err(
            "The model returned an empty reply. The API key may be invalid or out of credit — \
             re-test it in Settings and try again."
                .to_string(),
        );
    }

    let value: Value = serde_json::from_str(&response.body)
        .map_err(|error| format!("OpenCode reply was not JSON: {}", error))?;
    let reply_text = extract_reply_text(&value);
    let finish = value
        .get("info")
        .and_then(|info| info.get("finish"))
        .and_then(Value::as_str)
        .map(str::to_string);

    // OpenCode fails silently when the provider rejects a request (bad or
    // missing key, rate limit): it returns an assistant stub with no parts
    // and no finish reason. Surface that as an actionable error.
    let no_parts = value
        .get("parts")
        .and_then(Value::as_array)
        .map(|parts| parts.is_empty())
        .unwrap_or(true);
    if finish.is_none() && no_parts && reply_text.is_none() {
        return Err(
            "The model produced no reply. The provider likely rejected the request — \
             re-test the API key in Settings, check its credit, and try again."
                .to_string(),
        );
    }

    Ok(OpenCodeSendResult {
        session_id,
        message_id,
        part_id,
        state: "ready".to_string(),
        detail: "OpenCode agent reply completed".to_string(),
        reply_text,
        finish,
    })
}

pub fn set_opencode_auth(request: OpenCodeAuthRequest) -> Result<OpenCodeAuthResult, String> {
    let provider_id = request.provider_id.trim().to_string();
    let api_key = request.api_key.trim();
    if provider_id.is_empty() || api_key.is_empty() {
        return Err("Provider id and API key are both required".to_string());
    }

    wait_for_health(Duration::from_secs(3), Duration::from_millis(200))
        .map_err(|error| format!("OpenCode server is not ready: {}", error))?;

    let body = json!({
        "type": "api",
        "key": api_key
    });
    let path = format!("/auth/{}", provider_id);
    let response = http_request("PUT", &path, Some(&body))?;
    require_success(response.status, &response.body, "set auth")?;

    // OpenCode only loads a provider's model catalog at server start, so a
    // key set at runtime does not activate the provider until the server
    // restarts. Restart it here so the key works immediately.
    if connected_providers().contains(&provider_id) {
        return Ok(OpenCodeAuthResult {
            connected: true,
            restarted: false,
            detail: format!("{} is connected", provider_id),
        });
    }

    restart_opencode()?;
    let connected = connected_providers().contains(&provider_id);
    Ok(OpenCodeAuthResult {
        connected,
        restarted: true,
        detail: if connected {
            format!("{} key saved and activated", provider_id)
        } else {
            format!(
                "{} key was saved, but the provider did not come up after a restart",
                provider_id
            )
        },
    })
}

pub fn drain_background_errors() -> Vec<OpenCodeBackgroundError> {
    OPENCODE_BACKGROUND_ERRORS
        .get_or_init(|| Mutex::new(Vec::new()))
        .lock()
        .map(|mut errors| {
            errors
                .drain(..)
                .map(|detail| OpenCodeBackgroundError {
                    generated_at: unix_timestamp(),
                    detail,
                })
                .collect()
        })
        .unwrap_or_default()
}

fn push_background_error(detail: String) {
    if let Ok(mut errors) = OPENCODE_BACKGROUND_ERRORS
        .get_or_init(|| Mutex::new(Vec::new()))
        .lock()
    {
        errors.push(detail);
        if errors.len() > 20 {
            let drain_count = errors.len() - 20;
            errors.drain(0..drain_count);
        }
    }
}

fn apply_runtime_config_from_request(request: &OpenCodeSendRequest) -> Result<(), String> {
    let next = OpenCodeRuntimeConfig {
        comfy_ui_endpoint: request
            .comfy_ui_endpoint
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_COMFYUI_URL)
            .to_string(),
        comfy_ui_checkpoint: request
            .comfy_ui_checkpoint
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_COMFYUI_CHECKPOINT)
            .to_string(),
        comfy_ui_lora: request
            .comfy_ui_lora
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_COMFYUI_LORA)
            .to_string(),
    };

    let changed = set_runtime_config(next);
    if changed && probe_health().is_ok() {
        restart_opencode()?;
    }
    Ok(())
}

fn current_runtime_config() -> OpenCodeRuntimeConfig {
    OPENCODE_RUNTIME
        .get_or_init(|| Mutex::new(default_runtime_config()))
        .lock()
        .map(|config| config.clone())
        .unwrap_or_else(|_| default_runtime_config())
}

fn set_runtime_config(next: OpenCodeRuntimeConfig) -> bool {
    match OPENCODE_RUNTIME
        .get_or_init(|| Mutex::new(default_runtime_config()))
        .lock()
    {
        Ok(mut guard) => {
            if *guard == next {
                false
            } else {
                *guard = next;
                true
            }
        }
        Err(_) => false,
    }
}

fn default_runtime_config() -> OpenCodeRuntimeConfig {
    OpenCodeRuntimeConfig {
        comfy_ui_endpoint: DEFAULT_COMFYUI_URL.to_string(),
        comfy_ui_checkpoint: DEFAULT_COMFYUI_CHECKPOINT.to_string(),
        comfy_ui_lora: DEFAULT_COMFYUI_LORA.to_string(),
    }
}

fn connected_providers() -> Vec<String> {
    http_request("GET", "/provider", None)
        .ok()
        .and_then(|response| serde_json::from_str::<Value>(&response.body).ok())
        .and_then(|value| {
            value
                .get("connected")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
        })
        .unwrap_or_default()
}

fn restart_opencode() -> Result<(), String> {
    // Stop only the child we own. If another local tool is healthy on the
    // current endpoint, move Drive16 to a fresh local port instead of killing
    // unrelated OpenCode processes.
    let child_slot = OPENCODE_CHILD.get_or_init(|| Mutex::new(None));
    {
        let mut guard = child_slot
            .lock()
            .map_err(|_| "OpenCode process lock was poisoned".to_string())?;
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    if probe_health().is_ok() {
        let endpoint = reserve_ephemeral_endpoint()
            .map_err(|error| format!("OpenCode restart needs a free owned port: {}", error))?;
        set_current_endpoint(endpoint);
    }

    start_opencode()?;
    wait_for_health(Duration::from_secs(10), Duration::from_millis(250))
        .map(|_| ())
        .map_err(|error| format!("OpenCode did not come back after restart: {}", error))
}

fn extract_reply_text(message: &Value) -> Option<String> {
    let parts = message.get("parts")?.as_array()?;
    let text = parts
        .iter()
        .filter(|part| part.get("type").and_then(Value::as_str) == Some("text"))
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("\n\n");
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn create_session() -> Result<String, String> {
    let body = json!({
        "title": "Drive16 app conversation"
    });
    let response = http_request("POST", "/session", Some(&body))?;
    require_success(response.status, &response.body, "create session")?;
    let value: Value = serde_json::from_str(&response.body)
        .map_err(|error| format!("OpenCode session response was not JSON: {}", error))?;
    value
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "OpenCode session response did not include an id".to_string())
}

fn start_opencode() -> Result<(), String> {
    let command_path = find_command("opencode", &opencode_fallbacks())
        .ok_or_else(|| "Install or configure OpenCode".to_string())?;
    let endpoint = current_endpoint();
    let runtime = current_runtime_config();
    let child_slot = OPENCODE_CHILD.get_or_init(|| Mutex::new(None));
    let mut guard = child_slot
        .lock()
        .map_err(|_| "OpenCode process lock was poisoned".to_string())?;

    if let Some(child) = guard.as_mut() {
        if child
            .try_wait()
            .map_err(|error| format!("Could not inspect OpenCode process: {}", error))?
            .is_none()
        {
            return Ok(());
        }
    }

    let child = Command::new(command_path)
        .env("PATH", crate::starter_rom::extended_path_env())
        .env("COMFYUI_URL", &runtime.comfy_ui_endpoint)
        .env("DRIVE16_COMFYUI_CHECKPOINT", &runtime.comfy_ui_checkpoint)
        .env("DRIVE16_COMFYUI_LORA", &runtime.comfy_ui_lora)
        .args([
            "serve",
            "--hostname",
            HOST,
            "--port",
            &endpoint.port.to_string(),
            "--cors",
            "http://127.0.0.1:1420",
            "--cors",
            "http://tauri.localhost",
            "--cors",
            "tauri://localhost",
        ])
        .current_dir(repo_root())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start OpenCode: {}", error))?;

    *guard = Some(child);
    Ok(())
}

fn wait_for_health(timeout: Duration, interval: Duration) -> Result<HealthResponse, String> {
    let started_at = std::time::Instant::now();

    loop {
        match probe_health() {
            Ok(health) => return Ok(health),
            Err(error) => {
                if started_at.elapsed() >= timeout {
                    return Err(error);
                }
            }
        }

        thread::sleep(interval);
    }
}

fn probe_health() -> Result<HealthResponse, String> {
    let response = http_request("GET", HEALTH_PATH, None)?;
    require_success(response.status, &response.body, "health check")?;
    let health: HealthResponse = serde_json::from_str(&response.body)
        .map_err(|error| format!("OpenCode health response was not JSON: {}", error))?;

    if health.healthy {
        Ok(health)
    } else {
        Err("OpenCode reported unhealthy".to_string())
    }
}

fn http_request(method: &str, path: &str, body: Option<&Value>) -> Result<HttpResponse, String> {
    http_request_with_timeout(method, path, body, Duration::from_secs(5))
}

// A real HTTP client: the previous hand-rolled TcpStream reader never
// received the body of long-running responses (the server keeps the
// connection alive), which made every real agent reply hang the app.
fn http_request_with_timeout(
    method: &str,
    path: &str,
    body: Option<&Value>,
    read_timeout: Duration,
) -> Result<HttpResponse, String> {
    let endpoint = current_endpoint();
    let url = format!("{}{}", endpoint.base_url, path);
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(2))
        .timeout(read_timeout)
        .build();
    let request = agent
        .request(method, &url)
        .set("Accept", "application/json");

    let result = match body {
        Some(value) => request
            .set("Content-Type", "application/json")
            .send_string(&value.to_string()),
        None => request.call(),
    };

    match result {
        Ok(response) => {
            let status = response.status();
            let body = response
                .into_string()
                .map_err(|error| format!("Could not read OpenCode response: {}", error))?;
            Ok(HttpResponse { status, body })
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            Ok(HttpResponse { status, body })
        }
        Err(error) => Err(format!("Could not reach {}: {}", endpoint.base_url, error)),
    }
}

fn require_success(status: u16, body: &str, label: &str) -> Result<(), String> {
    if (200..300).contains(&status) {
        Ok(())
    } else if label == "health check" && status == 401 {
        Err(format!(
            "OpenCode {} failed with HTTP 401: another local tool is using {} and requires authentication",
            label,
            current_endpoint().base_url
        ))
    } else {
        Err(format!(
            "OpenCode {} failed with HTTP {}: {}",
            label, status, body
        ))
    }
}

fn status(
    state: &str,
    detail: &str,
    health: Option<HealthResponse>,
    launched: bool,
) -> OpenCodeBridgeStatus {
    let endpoint = current_endpoint();
    let connected = if state == "ready" {
        connected_providers()
    } else {
        Vec::new()
    };
    OpenCodeBridgeStatus {
        generated_at: unix_timestamp(),
        state: state.to_string(),
        detail: detail.to_string(),
        base_url: endpoint.base_url.clone(),
        health_url: format!("{}{}", endpoint.base_url, HEALTH_PATH),
        event_url: format!("{}{}", endpoint.base_url, EVENT_PATH),
        version: health.map(|value| value.version),
        launched,
        connected_providers: connected,
    }
}

fn opencode_fallbacks() -> Vec<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| vec![home.join(".opencode/bin")])
        .unwrap_or_default()
}

fn find_command(command_name: &str, fallbacks: &[PathBuf]) -> Option<PathBuf> {
    env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| env::split_paths(&paths).collect::<Vec<_>>())
        .chain(fallbacks.iter().cloned())
        .map(|directory| directory.join(command_name))
        .find(|candidate| candidate.is_file())
}

fn unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn unique_stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_status_uses_canonical_opencode_urls() {
        set_current_endpoint(endpoint_for_port(DEFAULT_PORT));
        let report = status(
            "ready",
            "test",
            Some(HealthResponse {
                healthy: true,
                version: "1.14.33".to_string(),
            }),
            false,
        );

        assert_eq!(report.base_url, "http://127.0.0.1:4096");
        assert_eq!(report.health_url, "http://127.0.0.1:4096/global/health");
        assert_eq!(report.event_url, "http://127.0.0.1:4096/global/event");
        assert_eq!(report.version.as_deref(), Some("1.14.33"));
    }

    #[test]
    fn detects_authenticated_port_conflict() {
        let endpoint = endpoint_for_port(4096);
        let detail = port_conflict_detail(
            &endpoint,
            "OpenCode health check failed with HTTP 401: authentication required",
        )
        .expect("401 should be treated as a port conflict");

        assert!(detail.contains("Another local tool is using the build-agent port"));
        assert!(detail.contains("http://127.0.0.1:4096"));
    }

    #[test]
    fn runtime_config_uses_request_comfyui_values() {
        let unused_endpoint =
            reserve_ephemeral_endpoint().expect("unused port should be available");
        set_current_endpoint(unused_endpoint);
        let request = OpenCodeSendRequest {
            session_id: None,
            text: "test".to_string(),
            provider_id: None,
            model_id: None,
            no_reply: None,
            background: None,
            comfy_ui_endpoint: Some("http://127.0.0.1:8288".to_string()),
            comfy_ui_checkpoint: Some("custom.safetensors".to_string()),
            comfy_ui_lora: Some("custom-lora.safetensors".to_string()),
        };

        let _ = set_runtime_config(default_runtime_config());
        apply_runtime_config_from_request(&request).expect("runtime config should update");
        let config = current_runtime_config();
        assert_eq!(config.comfy_ui_endpoint, "http://127.0.0.1:8288");
        assert_eq!(config.comfy_ui_checkpoint, "custom.safetensors");
        assert_eq!(config.comfy_ui_lora, "custom-lora.safetensors");
    }

    // Requires a running `opencode serve` on 4096. Run explicitly with:
    // cargo test live_agent_reply_roundtrip -- --ignored
    #[test]
    #[ignore]
    fn live_agent_reply_roundtrip() {
        let result = send_opencode_message(OpenCodeSendRequest {
            session_id: None,
            text: "Reply with the single word PONG. Do not use any tools.".to_string(),
            provider_id: Some("opencode".to_string()),
            model_id: Some("big-pickle".to_string()),
            no_reply: Some(false),
            background: Some(false),
            comfy_ui_endpoint: None,
            comfy_ui_checkpoint: None,
            comfy_ui_lora: None,
        })
        .expect("agent reply should complete");

        assert_eq!(result.finish.as_deref(), Some("stop"));
        let reply = result.reply_text.expect("reply text should be present");
        assert!(
            reply.to_uppercase().contains("PONG"),
            "reply was: {}",
            reply
        );
    }
}
