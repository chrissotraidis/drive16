mod preflight;

#[tauri::command]
fn run_preflight() -> preflight::PreflightReport {
    preflight::run_preflight()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![run_preflight])
        .run(tauri::generate_context!())
        .expect("failed to run Drive16");
}
