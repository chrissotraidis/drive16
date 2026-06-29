use serde::Serialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const DEFAULT_PORT: u16 = 8188;
const SYSTEM_STATS_PATH: &str = "/system_stats";

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComfyUiEndpointRequest {
    pub endpoint: String,
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
}

#[derive(Debug, PartialEq)]
struct LocalEndpoint {
    host: String,
    port: u16,
    base_url: String,
}

struct HttpResponse {
    status: u16,
    body: String,
}

pub fn check_endpoint(request: ComfyUiEndpointRequest) -> ComfyUiEndpointStatus {
    match normalize_endpoint(&request.endpoint) {
        Ok(endpoint) => match probe_system_stats(&endpoint) {
            Ok(stats) => status(
                "ready",
                "ComfyUI system stats available",
                &endpoint,
                extract_version(&stats),
                extract_device_count(&stats),
            ),
            Err(error) => status("missing", &error, &endpoint, None, 0),
        },
        Err(error) => ComfyUiEndpointStatus {
            generated_at: unix_timestamp(),
            state: "missing".to_string(),
            detail: error,
            base_url: String::new(),
            system_stats_url: String::new(),
            version: None,
            devices: 0,
        },
    }
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

fn status(
    state: &str,
    detail: &str,
    endpoint: &LocalEndpoint,
    version: Option<String>,
    devices: usize,
) -> ComfyUiEndpointStatus {
    ComfyUiEndpointStatus {
        generated_at: unix_timestamp(),
        state: state.to_string(),
        detail: detail.to_string(),
        base_url: endpoint.base_url.clone(),
        system_stats_url: format!("{}{}", endpoint.base_url, SYSTEM_STATS_PATH),
        version,
        devices,
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

    #[test]
    fn normalizes_local_comfyui_endpoint() {
        let endpoint =
            normalize_endpoint(" 127.0.0.1:8188/ ").expect("endpoint should normalize");

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
}
