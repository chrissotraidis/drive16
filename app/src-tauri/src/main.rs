mod comfyui;
mod opencode;
mod phase4_prompt;
mod preflight;
mod project;
mod starter_rom;
mod v1_prompt;

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

#[tauri::command]
fn load_project_summary() -> project::ProjectSummary {
    project::load_project_summary()
}

#[tauri::command]
async fn export_current_rom() -> Result<project::RomExportResult, String> {
    tauri::async_runtime::spawn_blocking(project::export_current_rom)
        .await
        .map_err(|error| format!("ROM export task failed: {}", error))?
}

#[tauri::command]
async fn run_v1_prompt(prompt: String) -> Result<v1_prompt::V1PromptResult, String> {
    tauri::async_runtime::spawn_blocking(move || v1_prompt::run_v1_prompt(prompt))
        .await
        .map_err(|error| format!("V1 prompt task failed: {}", error))?
}

#[tauri::command]
async fn run_phase4_music_prompt(
    request: phase4_prompt::Phase4PromptRequest,
) -> Result<v1_prompt::V1PromptResult, String> {
    tauri::async_runtime::spawn_blocking(move || phase4_prompt::run_phase4_music_prompt(request))
        .await
        .map_err(|error| format!("Phase 4 music prompt task failed: {}", error))?
}

#[tauri::command]
async fn check_comfyui_endpoint(
    request: comfyui::ComfyUiEndpointRequest,
) -> comfyui::ComfyUiEndpointStatus {
    tauri::async_runtime::spawn_blocking(move || comfyui::check_endpoint(request))
        .await
        .unwrap_or_else(|error| comfyui::ComfyUiEndpointStatus {
            generated_at: "0".to_string(),
            state: "warning".to_string(),
            detail: format!("ComfyUI task failed: {}", error),
            base_url: String::new(),
            system_stats_url: String::new(),
            version: None,
            devices: 0,
        })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_preflight,
            launch_starter_rom,
            connect_opencode,
            send_opencode_message,
            load_project_summary,
            export_current_rom,
            run_v1_prompt,
            run_phase4_music_prompt,
            check_comfyui_endpoint
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Drive16");
}
