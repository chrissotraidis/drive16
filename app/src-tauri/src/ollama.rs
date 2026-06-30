use serde::Serialize;
use serde_json::Value;
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const DEFAULT_PORT: u16 = 11434;
const TAGS_PATH: &str = "/api/tags";

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaEndpointRequest {
    pub endpoint: String,
    pub model: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaEndpointStatus {
    pub generated_at: String,
    pub state: String,
    pub detail: String,
    pub base_url: String,
    pub tags_url: String,
    pub model: String,
    pub models: Vec<String>,
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

pub fn check_endpoint(request: OllamaEndpointRequest) -> OllamaEndpointStatus {
    let model = request.model.trim().to_string();
    match normalize_endpoint(&request.endpoint) {
        Ok(endpoint) => check_endpoint_model(endpoint, model),
        Err(error) => OllamaEndpointStatus {
            generated_at: unix_timestamp(),
            state: "missing".to_string(),
            detail: error,
            base_url: String::new(),
            tags_url: String::new(),
            model,
            models: Vec::new(),
        },
    }
}

fn check_endpoint_model(endpoint: LocalEndpoint, model: String) -> OllamaEndpointStatus {
    if model.is_empty() {
        return status(
            "missing",
            "Ollama model name required",
            &endpoint,
            model,
            Vec::new(),
        );
    }

    let models = match probe_tags(&endpoint) {
        Ok(models) => models,
        Err(error) => return status("missing", &error, &endpoint, model, Vec::new()),
    };

    if models.iter().any(|available| available == &model) {
        return status("ready", "Ollama model available", &endpoint, model, models);
    }

    if models.is_empty() {
        status(
            "warning",
            "Ollama API reachable, but no local models were reported",
            &endpoint,
            model,
            models,
        )
    } else {
        status(
            "warning",
            &format!("Ollama reachable, but {} is not installed", model),
            &endpoint,
            model,
            models,
        )
    }
}

fn probe_tags(endpoint: &LocalEndpoint) -> Result<Vec<String>, String> {
    let response = http_get(endpoint, TAGS_PATH)?;
    if !(200..300).contains(&response.status) {
        return Err(format!("Ollama tags failed with HTTP {}", response.status));
    }

    let payload: Value = serde_json::from_str(&response.body)
        .map_err(|error| format!("Ollama tags were not JSON: {}", error))?;
    let models = payload
        .get("models")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.get("name")
                        .or_else(|| item.get("model"))
                        .and_then(Value::as_str)
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                        .map(str::to_string)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(models)
}

fn http_get(endpoint: &LocalEndpoint, path: &str) -> Result<HttpResponse, String> {
    let address = SocketAddr::from(([127, 0, 0, 1], endpoint.port));
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2))
        .map_err(|error| format!("Could not connect to {}: {}", endpoint.base_url, error))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| format!("Could not set Ollama read timeout: {}", error))?;

    let request = format!(
        "GET {} HTTP/1.1\r\nHost: {}:{}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        path, endpoint.host, endpoint.port
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Could not write Ollama request: {}", error))?;

    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|error| format!("Could not read Ollama response: {}", error))?;

    parse_http_response(&raw)
}

fn normalize_endpoint(input: &str) -> Result<LocalEndpoint, String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Ollama endpoint required".to_string());
    }

    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("http://{}", trimmed)
    };
    let rest = with_scheme
        .strip_prefix("http://")
        .ok_or_else(|| "Use a local http:// Ollama endpoint".to_string())?;
    if rest.contains('@') {
        return Err("Ollama endpoint must not include credentials".to_string());
    }

    let authority = rest.split('/').next().unwrap_or(rest);
    let (host, port) = parse_host_port(authority)?;
    if host != "127.0.0.1" && host != "localhost" {
        return Err("Ollama endpoint must be local".to_string());
    }

    Ok(LocalEndpoint {
        host: host.to_string(),
        port,
        base_url: format!("http://{}:{}", host, port),
    })
}

fn parse_host_port(authority: &str) -> Result<(&str, u16), String> {
    if authority.is_empty() {
        return Err("Ollama endpoint host required".to_string());
    }

    let mut pieces = authority.split(':');
    let host = pieces
        .next()
        .ok_or_else(|| "Ollama endpoint host required".to_string())?;
    let port = match pieces.next() {
        Some(value) if !value.is_empty() => value
            .parse::<u16>()
            .map_err(|_| "Ollama endpoint port must be a number".to_string())?,
        Some(_) => return Err("Ollama endpoint port required".to_string()),
        None => DEFAULT_PORT,
    };
    if pieces.next().is_some() {
        return Err("Ollama endpoint must use host:port".to_string());
    }

    Ok((host, port))
}

fn parse_http_response(raw: &str) -> Result<HttpResponse, String> {
    let (headers, body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| "Ollama returned a malformed HTTP response".to_string())?;
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "Ollama response did not include an HTTP status".to_string())?;

    Ok(HttpResponse {
        status,
        body: body.to_string(),
    })
}

fn status(
    state: &str,
    detail: &str,
    endpoint: &LocalEndpoint,
    model: String,
    models: Vec<String>,
) -> OllamaEndpointStatus {
    OllamaEndpointStatus {
        generated_at: unix_timestamp(),
        state: state.to_string(),
        detail: detail.to_string(),
        base_url: endpoint.base_url.clone(),
        tags_url: format!("{}{}", endpoint.base_url, TAGS_PATH),
        model,
        models,
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
    use std::{net::TcpListener, thread};

    #[test]
    fn normalizes_local_ollama_endpoint() {
        let endpoint = normalize_endpoint(" 127.0.0.1:11434/ ").expect("endpoint should normalize");

        assert_eq!(
            endpoint,
            LocalEndpoint {
                host: "127.0.0.1".to_string(),
                port: 11434,
                base_url: "http://127.0.0.1:11434".to_string(),
            }
        );
    }

    #[test]
    fn defaults_localhost_port() {
        let endpoint = normalize_endpoint("http://localhost").expect("endpoint should normalize");

        assert_eq!(endpoint.host, "localhost");
        assert_eq!(endpoint.port, 11434);
        assert_eq!(endpoint.base_url, "http://localhost:11434");
    }

    #[test]
    fn rejects_non_local_endpoint() {
        let error = normalize_endpoint("https://example.com:11434")
            .expect_err("remote https endpoint should be rejected");

        assert_eq!(error, "Use a local http:// Ollama endpoint");
    }

    #[test]
    fn parses_tag_models() {
        let models = serde_json::json!({
            "models": [
                { "name": "qwen2.5-coder:7b" },
                { "model": "devstral:24b" }
            ]
        });

        let (endpoint, handle) = spawn_ollama_server(models.to_string());
        let status = check_endpoint(OllamaEndpointRequest {
            endpoint,
            model: "qwen2.5-coder:7b".to_string(),
        });
        handle.join().expect("test server should exit cleanly");

        assert_eq!(status.state, "ready");
        assert_eq!(status.detail, "Ollama model available");
        assert_eq!(
            status.models,
            vec!["qwen2.5-coder:7b".to_string(), "devstral:24b".to_string()]
        );
    }

    #[test]
    fn reports_warning_when_model_is_missing() {
        let models = serde_json::json!({
            "models": [{ "name": "devstral:24b" }]
        });

        let (endpoint, handle) = spawn_ollama_server(models.to_string());
        let status = check_endpoint(OllamaEndpointRequest {
            endpoint,
            model: "qwen2.5-coder:7b".to_string(),
        });
        handle.join().expect("test server should exit cleanly");

        assert_eq!(status.state, "warning");
        assert_eq!(
            status.detail,
            "Ollama reachable, but qwen2.5-coder:7b is not installed"
        );
    }

    fn spawn_ollama_server(body: String) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("test server should bind");
        let endpoint = format!(
            "http://127.0.0.1:{}",
            listener.local_addr().expect("test server address").port()
        );
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("test server connection");
            let mut request_buffer = [0; 1024];
            let bytes = stream
                .read(&mut request_buffer)
                .expect("test server should read request");
            let request = String::from_utf8_lossy(&request_buffer[..bytes]);
            assert!(request.contains("GET /api/tags "));
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream
                .write_all(response.as_bytes())
                .expect("test server should write response");
        });

        (endpoint, handle)
    }
}
