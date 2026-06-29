mod opencode;
mod preflight;
mod starter_rom;

#[tauri::command]
fn run_preflight() -> preflight::PreflightReport {
    preflight::run_preflight()
}

#[tauri::command]
async fn launch_starter_rom() -> Result<starter_rom::StarterRomPreview, String> {
    tauri::async_runtime::spawn_blocking(starter_rom::launch_starter_rom)
        .await
        .map_err(|error| format!("Starter ROM task failed: {}", error))?
}

#[tauri::command]
async fn connect_opencode() -> opencode::OpenCodeBridgeStatus {
    tauri::async_runtime::spawn_blocking(opencode::connect_opencode)
        .await
        .unwrap_or_else(|error| opencode::OpenCodeBridgeStatus {
            generated_at: "0".to_string(),
            state: "warning".to_string(),
            detail: format!("OpenCode task failed: {}", error),
            base_url: "http://127.0.0.1:4096".to_string(),
            health_url: "http://127.0.0.1:4096/global/health".to_string(),
            event_url: "http://127.0.0.1:4096/global/event".to_string(),
            version: None,
            launched: false,
        })
}

#[tauri::command]
async fn send_opencode_message(
    request: opencode::OpenCodeSendRequest,
) -> Result<opencode::OpenCodeSendResult, String> {
    tauri::async_runtime::spawn_blocking(move || opencode::send_opencode_message(request))
        .await
        .map_err(|error| format!("OpenCode message task failed: {}", error))?
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_preflight,
            launch_starter_rom,
            connect_opencode,
            send_opencode_message
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Drive16");
}
