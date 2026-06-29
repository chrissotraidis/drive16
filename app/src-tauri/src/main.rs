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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_preflight, launch_starter_rom])
        .run(tauri::generate_context!())
        .expect("failed to run Drive16");
}
