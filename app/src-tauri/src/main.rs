mod comfyui;
mod ollama;
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
async fn launch_rom_path(rom_path: String) -> Result<starter_rom::StarterRomPreview, String> {
    tauri::async_runtime::spawn_blocking(move || starter_rom::launch_rom_path(rom_path))
        .await
        .map_err(|error| format!("ROM launch task failed: {}", error))?
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
            connected_providers: Vec::new(),
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
async fn set_opencode_auth(
    request: opencode::OpenCodeAuthRequest,
) -> Result<opencode::OpenCodeAuthResult, String> {
    tauri::async_runtime::spawn_blocking(move || opencode::set_opencode_auth(request))
        .await
        .map_err(|error| format!("OpenCode auth task failed: {}", error))?
}

#[tauri::command]
async fn ensure_active_project() -> Result<project::ActiveProjectResult, String> {
    tauri::async_runtime::spawn_blocking(project::ensure_active_project)
        .await
        .map_err(|error| format!("Active project task failed: {}", error))?
}

#[tauri::command]
async fn reset_active_project() -> Result<project::ActiveProjectResult, String> {
    tauri::async_runtime::spawn_blocking(project::reset_active_project)
        .await
        .map_err(|error| format!("Active project reset failed: {}", error))?
}

#[tauri::command]
fn load_project_summary() -> project::ProjectSummary {
    project::load_project_summary()
}

#[tauri::command]
fn list_project_snapshots() -> Vec<project::ProjectSnapshot> {
    project::list_project_snapshots()
}

#[tauri::command]
async fn prepare_rom_import() -> Result<project::RomImportReadiness, String> {
    tauri::async_runtime::spawn_blocking(project::prepare_rom_import)
        .await
        .map_err(|error| format!("ROM import task failed: {}", error))?
}

#[tauri::command]
async fn import_rom_bytes(
    request: project::RomImportRequest,
) -> Result<project::RomImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || project::import_rom_bytes(request))
        .await
        .map_err(|error| format!("ROM import task failed: {}", error))?
}

#[tauri::command]
async fn import_test_rom() -> Result<project::RomImportResult, String> {
    tauri::async_runtime::spawn_blocking(project::import_test_rom)
        .await
        .map_err(|error| format!("Test ROM import task failed: {}", error))?
}

#[tauri::command]
async fn export_current_rom() -> Result<project::RomExportResult, String> {
    tauri::async_runtime::spawn_blocking(project::export_current_rom)
        .await
        .map_err(|error| format!("ROM export task failed: {}", error))?
}

#[tauri::command]
async fn export_rom_path(source_rom_path: String) -> Result<project::RomExportResult, String> {
    tauri::async_runtime::spawn_blocking(move || project::export_rom_path(source_rom_path))
        .await
        .map_err(|error| format!("ROM export task failed: {}", error))?
}

#[tauri::command]
async fn read_rom_bytes(rom_path: String) -> Result<project::RomReadResult, String> {
    tauri::async_runtime::spawn_blocking(move || project::read_rom_bytes(rom_path))
        .await
        .map_err(|error| format!("ROM read task failed: {}", error))?
}

#[tauri::command]
fn load_interactive_core_status() -> project::InteractiveCoreStatusResult {
    project::load_interactive_core_status()
}

#[tauri::command]
async fn prepare_interactive_core_import() -> Result<project::InteractiveCoreStatusResult, String> {
    tauri::async_runtime::spawn_blocking(project::prepare_interactive_core_import)
        .await
        .map_err(|error| format!("Interactive core task failed: {}", error))?
}

#[tauri::command]
async fn import_interactive_core_files(
    request: project::InteractiveCoreImportRequest,
) -> Result<project::InteractiveCoreImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || project::import_interactive_core_files(request))
        .await
        .map_err(|error| format!("Interactive core import task failed: {}", error))?
}

#[tauri::command]
async fn read_interactive_core_files() -> Result<project::InteractiveCoreReadResult, String> {
    tauri::async_runtime::spawn_blocking(project::read_interactive_core_files)
        .await
        .map_err(|error| format!("Interactive core read task failed: {}", error))?
}

#[tauri::command]
async fn save_current_project() -> Result<project::ProjectSaveResult, String> {
    tauri::async_runtime::spawn_blocking(project::save_current_project)
        .await
        .map_err(|error| format!("Project save task failed: {}", error))?
}

#[tauri::command]
async fn save_project_path(
    source_project_path: String,
) -> Result<project::ProjectSaveResult, String> {
    tauri::async_runtime::spawn_blocking(move || project::save_project_path(source_project_path))
        .await
        .map_err(|error| format!("Project save task failed: {}", error))?
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
            checks: Vec::new(),
        })
}

#[tauri::command]
async fn check_ollama_endpoint(
    request: ollama::OllamaEndpointRequest,
) -> ollama::OllamaEndpointStatus {
    tauri::async_runtime::spawn_blocking(move || ollama::check_endpoint(request))
        .await
        .unwrap_or_else(|error| ollama::OllamaEndpointStatus {
            generated_at: "0".to_string(),
            state: "warning".to_string(),
            detail: format!("Ollama task failed: {}", error),
            base_url: String::new(),
            tags_url: String::new(),
            model: String::new(),
            models: Vec::new(),
        })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            run_preflight,
            launch_starter_rom,
            launch_rom_path,
            connect_opencode,
            send_opencode_message,
            set_opencode_auth,
            ensure_active_project,
            reset_active_project,
            load_project_summary,
            list_project_snapshots,
            prepare_rom_import,
            import_rom_bytes,
            import_test_rom,
            export_current_rom,
            export_rom_path,
            read_rom_bytes,
            load_interactive_core_status,
            prepare_interactive_core_import,
            import_interactive_core_files,
            read_interactive_core_files,
            save_current_project,
            save_project_path,
            run_v1_prompt,
            run_phase4_music_prompt,
            check_comfyui_endpoint,
            check_ollama_endpoint
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Drive16");
}
