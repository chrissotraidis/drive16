use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    env,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const HOST: &str = "127.0.0.1";
const PORT: u16 = 4096;
const BASE_URL: &str = "http://127.0.0.1:4096";
const HEALTH_PATH: &str = "/global/health";
const EVENT_PATH: &str = "/global/event";

static OPENCODE_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeSendRequest {
    pub session_id: Option<String>,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeSendResult {
    pub session_id: String,
    pub message_id: String,
    pub part_id: String,
    pub state: String,
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
    match wait_for_health(Duration::from_millis(250), Duration::from_millis(250)) {
        Ok(health) => status(
            "ready",
            "OpenCode server already running",
            Some(health),
            false,
        ),
        Err(_) => match start_opencode() {
            Ok(()) => match wait_for_health(Duration::from_secs(8), Duration::from_millis(250)) {
                Ok(health) => status("ready", "OpenCode server launched", Some(health), true),
                Err(error) => status(
                    "warning",
                    &format!("OpenCode launched but did not become ready: {}", error),
                    None,
                    true,
                ),
            },
            Err(error) => status("missing", &error, None, false),
        },
    }
}

pub fn send_opencode_message(request: OpenCodeSendRequest) -> Result<OpenCodeSendResult, String> {
    let text = request.text.trim();
    if text.is_empty() {
        return Err("OpenCode message text cannot be empty".to_string());
    }

    wait_for_health(Duration::from_secs(3), Duration::from_millis(200))
        .map_err(|error| format!("OpenCode server is not ready: {}", error))?;

    let session_id = match request.session_id.filter(|value| !value.trim().is_empty()) {
        Some(session_id) => session_id,
        None => create_session()?,
    };

    let stamp = unique_stamp();
    let message_id = format!("msg_drive16_{}", stamp);
    let part_id = format!("prt_drive16_{}", stamp);
    let body = json!({
        "messageID": message_id,
        "noReply": true,
        "parts": [
            {
                "id": part_id,
                "type": "text",
                "text": text
            }
        ]
    });
    let path = format!("/session/{}/message", session_id);
    let response = http_request("POST", &path, Some(&body))?;
    require_success(response.status, &response.body, "post message")?;

    Ok(OpenCodeSendResult {
        session_id,
        message_id,
        part_id,
        state: "ready".to_string(),
        detail: "Message posted to OpenCode with noReply".to_string(),
    })
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
        .args([
            "serve",
            "--hostname",
            HOST,
            "--port",
            &PORT.to_string(),
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
    let address = SocketAddr::from(([127, 0, 0, 1], PORT));
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))
        .map_err(|error| format!("Could not connect to {}: {}", BASE_URL, error))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| format!("Could not set OpenCode read timeout: {}", error))?;

    let body_text = body.map(Value::to_string).unwrap_or_default();
    let mut request = format!(
        "{} {} HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nConnection: close\r\n",
        method, path, HOST, PORT
    );

    if body.is_some() {
        request.push_str("Content-Type: application/json\r\n");
        request.push_str(&format!(
            "Content-Length: {}\r\n",
            body_text.as_bytes().len()
        ));
    }

    request.push_str("\r\n");
    request.push_str(&body_text);

    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Could not write OpenCode request: {}", error))?;

    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|error| format!("Could not read OpenCode response: {}", error))?;

    parse_http_response(&raw)
}

fn parse_http_response(raw: &str) -> Result<HttpResponse, String> {
    let (headers, body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| "OpenCode returned a malformed HTTP response".to_string())?;
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "OpenCode response did not include an HTTP status".to_string())?;

    Ok(HttpResponse {
        status,
        body: body.to_string(),
    })
}

fn require_success(status: u16, body: &str, label: &str) -> Result<(), String> {
    if (200..300).contains(&status) {
        Ok(())
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
    OpenCodeBridgeStatus {
        generated_at: unix_timestamp(),
        state: state.to_string(),
        detail: detail.to_string(),
        base_url: BASE_URL.to_string(),
        health_url: format!("{}{}", BASE_URL, HEALTH_PATH),
        event_url: format!("{}{}", BASE_URL, EVENT_PATH),
        version: health.map(|value| value.version),
        launched,
    }
}

fn repo_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .unwrap_or(manifest_dir)
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
    fn parse_http_response_extracts_status_and_body() {
        let response = parse_http_response(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"healthy\":true}",
        )
        .expect("response should parse");

        assert_eq!(response.status, 200);
        assert_eq!(response.body, "{\"healthy\":true}");
    }
}
