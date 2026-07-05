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
    let no_reply = request.no_reply.unwrap_or(false);
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
    // A real agent run holds the connection open while it plans, edits, and
    // builds; give it a long window instead of the default request timeout.
    let timeout = if no_reply {
        Duration::from_secs(5)
    } else {
        Duration::from_secs(30 * 60)
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

fn connected_providers() -> Vec<String> {
    http_request("GET", "/provider", None)
        .ok()
        .and_then(|response| serde_json::from_str::<Value>(&response.body).ok())
        .and_then(|value| {
            value.get("connected").and_then(Value::as_array).map(|items| {
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
    // Stop the child we own, or any external `opencode serve` holding the
    // Drive16 port, then bring up a fresh server that reads current auth.
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
        let _ = Command::new("pkill")
            .args(["-f", "opencode serve"])
            .status();
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while probe_health().is_ok() && std::time::Instant::now() < deadline {
            thread::sleep(Duration::from_millis(150));
        }
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
    http_request_with_timeout(method, path, body, Duration::from_secs(5))
}

fn http_request_with_timeout(
    method: &str,
    path: &str,
    body: Option<&Value>,
    read_timeout: Duration,
) -> Result<HttpResponse, String> {
    let address = SocketAddr::from(([127, 0, 0, 1], PORT));
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))
        .map_err(|error| format!("Could not connect to {}: {}", BASE_URL, error))?;
    stream
        .set_read_timeout(Some(read_timeout))
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

    let chunked = headers
        .lines()
        .any(|line| line.to_ascii_lowercase().replace(' ', "") == "transfer-encoding:chunked");
    let body = if chunked {
        decode_chunked_body(body)?
    } else {
        body.to_string()
    };

    Ok(HttpResponse { status, body })
}

fn decode_chunked_body(raw: &str) -> Result<String, String> {
    let mut decoded: Vec<u8> = Vec::new();
    let mut rest = raw.as_bytes();
    loop {
        let line_end = find_crlf(rest)
            .ok_or_else(|| "OpenCode chunked response was truncated".to_string())?;
        let size_line = std::str::from_utf8(&rest[..line_end]).unwrap_or("");
        let size = usize::from_str_radix(size_line.trim(), 16)
            .map_err(|_| "OpenCode chunked response had an invalid chunk size".to_string())?;
        rest = &rest[line_end + 2..];
        if size == 0 {
            return Ok(String::from_utf8_lossy(&decoded).into_owned());
        }
        if rest.len() < size {
            return Err("OpenCode chunked response ended mid-chunk".to_string());
        }
        decoded.extend_from_slice(&rest[..size]);
        rest = &rest[size..];
        if rest.starts_with(b"\r\n") {
            rest = &rest[2..];
        }
    }
}

fn find_crlf(bytes: &[u8]) -> Option<usize> {
    bytes.windows(2).position(|pair| pair == b"\r\n")
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
    let connected = if state == "ready" {
        connected_providers()
    } else {
        Vec::new()
    };
    OpenCodeBridgeStatus {
        generated_at: unix_timestamp(),
        state: state.to_string(),
        detail: detail.to_string(),
        base_url: BASE_URL.to_string(),
        health_url: format!("{}{}", BASE_URL, HEALTH_PATH),
        event_url: format!("{}{}", BASE_URL, EVENT_PATH),
        version: health.map(|value| value.version),
        launched,
        connected_providers: connected,
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
