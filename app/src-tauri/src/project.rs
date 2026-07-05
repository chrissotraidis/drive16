use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const STARTER_PROJECT: &str = "examples/app-starter-blank";
const STARTER_ROM: &str = "examples/app-starter-blank/out/rom.bin";
const ACTIVE_PROJECT_DIRECTORY: &str = "artifacts/phase3/active-project";
const EXPORT_DIRECTORY: &str = "artifacts/phase3/exports";
const PROJECT_SAVE_DIRECTORY: &str = "artifacts/phase3/projects";
const ROM_IMPORT_DIRECTORY: &str = "artifacts/phase5/imports";
const ROM_IMPORT_EXTENSIONS: [&str; 4] = [".bin", ".gen", ".md", ".smd"];
const INTERACTIVE_CORE_DIRECTORY: &str = "artifacts/phase7/interactive-core";
const INTERACTIVE_CORE_NAME: &str = "genesis_plus_gx";
const INTERACTIVE_CORE_JS: &str = "genesis_plus_gx_libretro.js";
const INTERACTIVE_CORE_WASM: &str = "genesis_plus_gx_libretro.wasm";
const INTERACTIVE_CORE_INPUT_EXTENSIONS: [&str; 3] = [".zip", ".js", ".wasm"];
const INTERACTIVE_CORE_STORAGE_EXTENSIONS: [&str; 2] = [".js", ".wasm"];
// Genesis ROMs top out around 8 MB with mappers; emscripten cores run tens
// of MB. Anything past these caps is a wrong file, not a big game.
const MAX_ROM_IMPORT_BYTES: usize = 16 * 1024 * 1024;
const MAX_CORE_FILE_BYTES: usize = 96 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub generated_at: String,
    pub name: String,
    pub project_path: String,
    pub rom_path: String,
    pub export_directory: String,
    pub rom_status: String,
    pub rom_detail: String,
    pub files: Vec<ProjectFileEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileEntry {
    pub label: String,
    pub path: String,
    pub state: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RomExportResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub source_rom_path: String,
    pub export_path: String,
    pub bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSaveResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub source_project_path: String,
    pub snapshot_path: String,
    pub files: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveProjectResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub project_path: String,
    pub rom_path: String,
    pub rom_exists: bool,
    pub created: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub generated_at: String,
    pub name: String,
    pub project_path: String,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RomImportReadiness {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub import_directory: String,
    pub accepted_extensions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RomImportRequest {
    pub file_name: String,
    pub data_base64: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RomImportResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub source_name: String,
    pub import_path: String,
    pub bytes: u64,
    pub accepted_extensions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RomReadResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub rom_path: String,
    pub source_name: String,
    pub bytes: u64,
    pub data_base64: String,
    pub accepted_extensions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveCoreStatusResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub core_name: String,
    pub source: String,
    pub import_directory: String,
    pub js_path: Option<String>,
    pub wasm_path: Option<String>,
    pub js_bytes: Option<u64>,
    pub wasm_bytes: Option<u64>,
    pub accepted_extensions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveCoreUploadFile {
    pub file_name: String,
    pub data_base64: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveCoreImportRequest {
    pub files: Vec<InteractiveCoreUploadFile>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveCoreImportResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub core_name: String,
    pub source: String,
    pub import_directory: String,
    pub js_path: String,
    pub wasm_path: String,
    pub js_bytes: u64,
    pub wasm_bytes: u64,
    pub accepted_extensions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InteractiveCoreReadResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub core_name: String,
    pub source: String,
    pub js_path: String,
    pub wasm_path: String,
    pub js_bytes: u64,
    pub wasm_bytes: u64,
    pub js_data_base64: String,
    pub wasm_data_base64: String,
}

struct ProjectPaths {
    repo_root: PathBuf,
    project_path: PathBuf,
    rom_path: PathBuf,
    export_directory: PathBuf,
    project_save_directory: PathBuf,
    rom_import_directory: PathBuf,
    interactive_core_directory: PathBuf,
    build_sgdk_script: PathBuf,
}

pub fn load_project_summary() -> ProjectSummary {
    project_summary_for_repo(repo_root())
}

pub fn export_current_rom() -> Result<RomExportResult, String> {
    export_current_rom_for_repo(repo_root())
}

pub fn save_current_project() -> Result<ProjectSaveResult, String> {
    save_current_project_for_repo(repo_root())
}

pub fn save_project_path(source_project_path: String) -> Result<ProjectSaveResult, String> {
    save_project_path_for_repo(repo_root(), source_project_path)
}

pub fn list_project_snapshots() -> Vec<ProjectSnapshot> {
    list_project_snapshots_for_repo(repo_root())
}

pub fn ensure_active_project() -> Result<ActiveProjectResult, String> {
    ensure_active_project_for_repo(repo_root())
}

// New Project: throw away the working copy and start from the template.
pub fn reset_active_project() -> Result<ActiveProjectResult, String> {
    let root = repo_root();
    let active = root.join(ACTIVE_PROJECT_DIRECTORY);
    if active.is_dir() {
        fs::remove_dir_all(&active).map_err(|error| {
            format!(
                "Could not clear the active project {}: {}",
                active.display(),
                error
            )
        })?;
    }
    ensure_active_project_for_repo(root)
}

// The agent needs a mutable SGDK workspace; the starter template stays
// pristine and the active project lives under ignored artifacts.
fn ensure_active_project_for_repo(repo_root: PathBuf) -> Result<ActiveProjectResult, String> {
    let starter = repo_root.join(STARTER_PROJECT);
    let active = repo_root.join(ACTIVE_PROJECT_DIRECTORY);
    let marker = active.join("src").join("main.c");

    let created = if marker.is_file() {
        false
    } else {
        if !starter.is_dir() {
            return Err(format!(
                "Starter project template is missing: {}",
                starter.display()
            ));
        }
        copy_project_tree(&starter, &active)?;
        true
    };

    let rom_path = active.join("out").join("rom.bin");
    Ok(ActiveProjectResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: if created {
            "Active project created from the starter template".to_string()
        } else {
            "Active project is ready".to_string()
        },
        project_path: repo_relative(&repo_root, &active),
        rom_path: repo_relative(&repo_root, &rom_path),
        rom_exists: rom_path.is_file(),
        created,
    })
}

pub fn prepare_rom_import() -> Result<RomImportReadiness, String> {
    prepare_rom_import_for_repo(repo_root())
}

pub fn import_rom_bytes(request: RomImportRequest) -> Result<RomImportResult, String> {
    import_rom_bytes_for_repo(repo_root(), request)
}

pub fn import_test_rom() -> Result<RomImportResult, String> {
    import_test_rom_for_repo(repo_root())
}

pub fn export_rom_path(source_rom_path: String) -> Result<RomExportResult, String> {
    export_rom_path_for_repo(repo_root(), source_rom_path)
}

pub fn read_rom_bytes(rom_path: String) -> Result<RomReadResult, String> {
    read_rom_bytes_for_repo(repo_root(), rom_path)
}

pub fn load_interactive_core_status() -> InteractiveCoreStatusResult {
    interactive_core_status_for_repo(repo_root())
}

pub fn prepare_interactive_core_import() -> Result<InteractiveCoreStatusResult, String> {
    prepare_interactive_core_import_for_repo(repo_root())
}

pub fn import_interactive_core_files(
    request: InteractiveCoreImportRequest,
) -> Result<InteractiveCoreImportResult, String> {
    import_interactive_core_files_for_repo(repo_root(), request)
}

pub fn read_interactive_core_files() -> Result<InteractiveCoreReadResult, String> {
    read_interactive_core_files_for_repo(repo_root())
}

fn project_summary_for_repo(repo_root: PathBuf) -> ProjectSummary {
    let paths = ProjectPaths::new(repo_root);
    let rom_status = if paths.rom_path.is_file() {
        "ready"
    } else {
        "missing"
    };
    let rom_detail = fs::metadata(&paths.rom_path)
        .map(|metadata| format!("{} bytes", metadata.len()))
        .unwrap_or_else(|_| "Build starter ROM before export".to_string());

    ProjectSummary {
        generated_at: unix_timestamp(),
        name: "Starter Project".to_string(),
        project_path: repo_relative(&paths.repo_root, &paths.project_path),
        rom_path: repo_relative(&paths.repo_root, &paths.rom_path),
        export_directory: repo_relative(&paths.repo_root, &paths.export_directory),
        rom_status: rom_status.to_string(),
        rom_detail,
        files: vec![
            file_entry(
                &paths.repo_root,
                paths.project_path.join("src/main.c"),
                "Main C",
            ),
            file_entry(
                &paths.repo_root,
                paths.project_path.join("res/resources.res"),
                "Resources",
            ),
            file_entry(
                &paths.repo_root,
                paths.repo_root.join("assets/core/player.png"),
                "Bundled sprite",
            ),
            file_entry(
                &paths.repo_root,
                paths.repo_root.join("assets/core/loop.vgm"),
                "Bundled loop",
            ),
        ],
    }
}

fn export_current_rom_for_repo(repo_root: PathBuf) -> Result<RomExportResult, String> {
    let paths = ProjectPaths::new(repo_root);
    ensure_rom(&paths)?;
    export_rom_file(&paths, &paths.rom_path)
}

fn export_rom_path_for_repo(
    repo_root: PathBuf,
    source_rom_path: String,
) -> Result<RomExportResult, String> {
    let paths = ProjectPaths::new(repo_root);
    let source_path = resolve_repo_path(&paths.repo_root, &source_rom_path)?;
    export_rom_file(&paths, &source_path)
}

fn read_rom_bytes_for_repo(repo_root: PathBuf, rom_path: String) -> Result<RomReadResult, String> {
    let paths = ProjectPaths::new(repo_root);
    let source_path = resolve_repo_path(&paths.repo_root, &rom_path)?;
    if !source_path.is_file() {
        return Err(format!("ROM is missing: {}", source_path.display()));
    }
    let source_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("ROM path has no file name: {}", source_path.display()))?;
    accepted_rom_extension(source_name).ok_or_else(|| {
        format!(
            "Unsupported ROM extension for {}. Accepted: {}",
            source_name,
            accepted_extensions().join(", ")
        )
    })?;

    let data = fs::read(&source_path)
        .map_err(|error| format!("Could not read ROM {}: {}", source_path.display(), error))?;
    if data.is_empty() {
        return Err(format!("ROM file was empty: {}", source_path.display()));
    }

    Ok(RomReadResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "ROM bytes ready for interactive player".to_string(),
        rom_path: repo_relative(&paths.repo_root, &source_path),
        source_name: source_name.to_string(),
        bytes: data.len() as u64,
        data_base64: general_purpose::STANDARD.encode(data),
        accepted_extensions: accepted_extensions(),
    })
}

fn export_rom_file(paths: &ProjectPaths, source_path: &Path) -> Result<RomExportResult, String> {
    if !source_path.is_file() {
        return Err(format!("ROM is missing: {}", source_path.display()));
    }
    let source_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("ROM path has no file name: {}", source_path.display()))?;
    let extension = accepted_rom_extension(source_name).ok_or_else(|| {
        format!(
            "Unsupported ROM extension for {}. Accepted: {}",
            source_name,
            accepted_extensions().join(", ")
        )
    })?;

    fs::create_dir_all(&paths.export_directory).map_err(|error| {
        format!(
            "Could not create export directory {}: {}",
            paths.export_directory.display(),
            error
        )
    })?;

    let source_stem = Path::new(source_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_file_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "rom".to_string());
    let export_path = paths.export_directory.join(format!(
        "drive16-{}-{}{}",
        source_stem,
        unique_stamp(),
        extension
    ));
    let bytes = fs::copy(source_path, &export_path).map_err(|error| {
        format!(
            "Could not export ROM from {} to {}: {}",
            source_path.display(),
            export_path.display(),
            error
        )
    })?;

    Ok(RomExportResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "ROM exported".to_string(),
        source_rom_path: repo_relative(&paths.repo_root, source_path),
        export_path: repo_relative(&paths.repo_root, &export_path),
        bytes,
    })
}

fn save_current_project_for_repo(repo_root: PathBuf) -> Result<ProjectSaveResult, String> {
    let paths = ProjectPaths::new(repo_root);
    let source_project = paths.project_path.clone();
    save_project_directory_for_repo(paths, source_project)
}

fn save_project_path_for_repo(
    repo_root: PathBuf,
    source_project_path: String,
) -> Result<ProjectSaveResult, String> {
    let paths = ProjectPaths::new(repo_root);
    let source_project = resolve_repo_path(&paths.repo_root, &source_project_path)?;
    save_project_directory_for_repo(paths, source_project)
}

fn save_project_directory_for_repo(
    paths: ProjectPaths,
    source_project: PathBuf,
) -> Result<ProjectSaveResult, String> {
    if !source_project.is_dir() {
        return Err(format!("Project is missing: {}", source_project.display()));
    }
    fs::create_dir_all(&paths.project_save_directory).map_err(|error| {
        format!(
            "Could not create project save directory {}: {}",
            paths.project_save_directory.display(),
            error
        )
    })?;

    let project_name = source_project
        .file_name()
        .and_then(|value| value.to_str())
        .map(sanitize_file_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "project".to_string());
    let snapshot_path =
        paths
            .project_save_directory
            .join(format!("drive16-{}-{}", project_name, unique_stamp()));
    let files = copy_project_tree(&source_project, &snapshot_path)?;

    Ok(ProjectSaveResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "Project snapshot saved".to_string(),
        source_project_path: repo_relative(&paths.repo_root, &source_project),
        snapshot_path: repo_relative(&paths.repo_root, &snapshot_path),
        files,
    })
}

fn list_project_snapshots_for_repo(repo_root: PathBuf) -> Vec<ProjectSnapshot> {
    let paths = ProjectPaths::new(repo_root);
    let mut snapshots = fs::read_dir(&paths.project_save_directory)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.filter_map(Result::ok))
        .filter_map(|entry| {
            let entry_path = entry.path();
            let metadata = entry.metadata().ok()?;
            if !metadata.is_dir() {
                return None;
            }

            let modified = metadata.modified().ok();
            let detail = modified
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| format!("Saved at {}", duration.as_secs()))
                .unwrap_or_else(|| "Saved project snapshot".to_string());

            Some((
                modified,
                ProjectSnapshot {
                    generated_at: unix_timestamp(),
                    name: entry.file_name().to_string_lossy().to_string(),
                    project_path: repo_relative(&paths.repo_root, &entry_path),
                    detail,
                },
            ))
        })
        .collect::<Vec<_>>();

    snapshots.sort_by(|left, right| right.0.cmp(&left.0));
    snapshots
        .into_iter()
        .take(6)
        .map(|(_, snapshot)| snapshot)
        .collect()
}

fn prepare_rom_import_for_repo(repo_root: PathBuf) -> Result<RomImportReadiness, String> {
    let paths = ProjectPaths::new(repo_root);
    fs::create_dir_all(&paths.rom_import_directory).map_err(|error| {
        format!(
            "Could not create import directory {}: {}",
            paths.rom_import_directory.display(),
            error
        )
    })?;

    Ok(RomImportReadiness {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "Import storage ready".to_string(),
        import_directory: repo_relative(&paths.repo_root, &paths.rom_import_directory),
        accepted_extensions: accepted_extensions(),
    })
}

fn import_rom_bytes_for_repo(
    repo_root: PathBuf,
    request: RomImportRequest,
) -> Result<RomImportResult, String> {
    check_base64_size(&request.data_base64, MAX_ROM_IMPORT_BYTES, "ROM file")?;
    let data = general_purpose::STANDARD
        .decode(request.data_base64.trim())
        .map_err(|error| format!("ROM data was not valid base64: {}", error))?;
    import_rom_data_for_repo(repo_root, &request.file_name, &data)
}

fn import_test_rom_for_repo(repo_root: PathBuf) -> Result<RomImportResult, String> {
    let paths = ProjectPaths::new(repo_root.clone());
    ensure_rom(&paths)?;
    let data = fs::read(&paths.rom_path).map_err(|error| {
        format!(
            "Could not read starter test ROM {}: {}",
            paths.rom_path.display(),
            error
        )
    })?;
    import_rom_data_for_repo(repo_root, "starter-test-rom.bin", &data)
}

fn import_rom_data_for_repo(
    repo_root: PathBuf,
    source_name: &str,
    data: &[u8],
) -> Result<RomImportResult, String> {
    if data.is_empty() {
        return Err("ROM file was empty".to_string());
    }

    let paths = ProjectPaths::new(repo_root);
    let safe_name = sanitize_rom_file_name(source_name)?;
    let extension = accepted_rom_extension(&safe_name).ok_or_else(|| {
        format!(
            "Unsupported ROM extension for {}. Accepted: {}",
            safe_name,
            accepted_extensions().join(", ")
        )
    })?;
    fs::create_dir_all(&paths.rom_import_directory).map_err(|error| {
        format!(
            "Could not create import directory {}: {}",
            paths.rom_import_directory.display(),
            error
        )
    })?;

    let stem = Path::new(&safe_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .map(sanitize_file_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "rom".to_string());
    let import_path = paths.rom_import_directory.join(format!(
        "drive16-import-{}-{}{}",
        unique_stamp(),
        stem,
        extension
    ));
    fs::write(&import_path, data).map_err(|error| {
        format!(
            "Could not copy ROM into {}: {}",
            import_path.display(),
            error
        )
    })?;

    Ok(RomImportResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "Imported ROM copied into ignored local storage".to_string(),
        source_name: safe_name,
        import_path: repo_relative(&paths.repo_root, &import_path),
        bytes: data.len() as u64,
        accepted_extensions: accepted_extensions(),
    })
}

fn interactive_core_status_for_repo(repo_root: PathBuf) -> InteractiveCoreStatusResult {
    let paths = ProjectPaths::new(repo_root);
    let js_path = paths.interactive_core_directory.join(INTERACTIVE_CORE_JS);
    let wasm_path = paths.interactive_core_directory.join(INTERACTIVE_CORE_WASM);
    let js_bytes = readable_nonempty_file_bytes(&js_path);
    let wasm_bytes = readable_nonempty_file_bytes(&wasm_path);
    let has_core = js_bytes.is_some() && wasm_bytes.is_some();

    InteractiveCoreStatusResult {
        generated_at: unix_timestamp(),
        status: if has_core { "available" } else { "missing" }.to_string(),
        detail: if has_core {
            "User-supplied Genesis core is installed in ignored local storage.".to_string()
        } else {
            "Set Up Play with a core .zip or .js + .wasm pair.".to_string()
        },
        core_name: INTERACTIVE_CORE_NAME.to_string(),
        source: if has_core {
            "User core".to_string()
        } else {
            "No user core".to_string()
        },
        import_directory: repo_relative(&paths.repo_root, &paths.interactive_core_directory),
        js_path: js_bytes
            .as_ref()
            .map(|_| repo_relative(&paths.repo_root, &js_path)),
        wasm_path: wasm_bytes
            .as_ref()
            .map(|_| repo_relative(&paths.repo_root, &wasm_path)),
        js_bytes,
        wasm_bytes,
        accepted_extensions: accepted_interactive_core_extensions(),
    }
}

fn prepare_interactive_core_import_for_repo(
    repo_root: PathBuf,
) -> Result<InteractiveCoreStatusResult, String> {
    let paths = ProjectPaths::new(repo_root);
    fs::create_dir_all(&paths.interactive_core_directory).map_err(|error| {
        format!(
            "Could not create interactive core directory {}: {}",
            paths.interactive_core_directory.display(),
            error
        )
    })?;

    Ok(interactive_core_status_for_repo(paths.repo_root))
}

fn import_interactive_core_files_for_repo(
    repo_root: PathBuf,
    request: InteractiveCoreImportRequest,
) -> Result<InteractiveCoreImportResult, String> {
    let mut js_data: Option<Vec<u8>> = None;
    let mut wasm_data: Option<Vec<u8>> = None;

    if request.files.is_empty() {
        return Err("Choose a .zip archive or .js + .wasm pair.".to_string());
    }

    for upload in request.files {
        let safe_name = sanitize_upload_file_name(&upload.file_name)?;
        let extension =
            accepted_interactive_core_storage_extension(&safe_name).ok_or_else(|| {
                format!(
                    "Unsupported core file {}. Accepted stored files: {}",
                    safe_name,
                    INTERACTIVE_CORE_STORAGE_EXTENSIONS.join(", ")
                )
            })?;
        check_base64_size(&upload.data_base64, MAX_CORE_FILE_BYTES, "Play core file")?;
        let data = general_purpose::STANDARD
            .decode(upload.data_base64.trim())
            .map_err(|error| format!("Core file {} was not valid base64: {}", safe_name, error))?;
        if data.is_empty() {
            return Err(format!("Core file was empty: {}", safe_name));
        }

        match extension {
            ".js" => js_data = Some(data),
            ".wasm" => wasm_data = Some(data),
            _ => {}
        }
    }

    let js_data = js_data.ok_or_else(|| "Core setup needs a .js loader file.".to_string())?;
    let wasm_data =
        wasm_data.ok_or_else(|| "Core setup needs a matching .wasm file.".to_string())?;

    let paths = ProjectPaths::new(repo_root);
    fs::create_dir_all(&paths.interactive_core_directory).map_err(|error| {
        format!(
            "Could not create interactive core directory {}: {}",
            paths.interactive_core_directory.display(),
            error
        )
    })?;

    let js_path = paths.interactive_core_directory.join(INTERACTIVE_CORE_JS);
    let wasm_path = paths.interactive_core_directory.join(INTERACTIVE_CORE_WASM);
    fs::write(&js_path, &js_data)
        .map_err(|error| format!("Could not write core JS {}: {}", js_path.display(), error))?;
    fs::write(&wasm_path, &wasm_data).map_err(|error| {
        format!(
            "Could not write core WebAssembly {}: {}",
            wasm_path.display(),
            error
        )
    })?;

    Ok(InteractiveCoreImportResult {
        generated_at: unix_timestamp(),
        status: "available".to_string(),
        detail: "User-supplied Genesis core copied into ignored local storage.".to_string(),
        core_name: INTERACTIVE_CORE_NAME.to_string(),
        source: "User core".to_string(),
        import_directory: repo_relative(&paths.repo_root, &paths.interactive_core_directory),
        js_path: repo_relative(&paths.repo_root, &js_path),
        wasm_path: repo_relative(&paths.repo_root, &wasm_path),
        js_bytes: js_data.len() as u64,
        wasm_bytes: wasm_data.len() as u64,
        accepted_extensions: accepted_interactive_core_extensions(),
    })
}

fn read_interactive_core_files_for_repo(
    repo_root: PathBuf,
) -> Result<InteractiveCoreReadResult, String> {
    let paths = ProjectPaths::new(repo_root);
    let js_path = paths.interactive_core_directory.join(INTERACTIVE_CORE_JS);
    let wasm_path = paths.interactive_core_directory.join(INTERACTIVE_CORE_WASM);

    let js_data = fs::read(&js_path)
        .map_err(|error| format!("Could not read core JS {}: {}", js_path.display(), error))?;
    if js_data.is_empty() {
        return Err(format!("Core JS file was empty: {}", js_path.display()));
    }
    let wasm_data = fs::read(&wasm_path).map_err(|error| {
        format!(
            "Could not read core WebAssembly {}: {}",
            wasm_path.display(),
            error
        )
    })?;
    if wasm_data.is_empty() {
        return Err(format!(
            "Core WebAssembly file was empty: {}",
            wasm_path.display()
        ));
    }

    Ok(InteractiveCoreReadResult {
        generated_at: unix_timestamp(),
        status: "available".to_string(),
        detail: "User-supplied Genesis core bytes ready for interactive Play.".to_string(),
        core_name: INTERACTIVE_CORE_NAME.to_string(),
        source: "User core".to_string(),
        js_path: repo_relative(&paths.repo_root, &js_path),
        wasm_path: repo_relative(&paths.repo_root, &wasm_path),
        js_bytes: js_data.len() as u64,
        wasm_bytes: wasm_data.len() as u64,
        js_data_base64: general_purpose::STANDARD.encode(js_data),
        wasm_data_base64: general_purpose::STANDARD.encode(wasm_data),
    })
}

impl ProjectPaths {
    fn new(repo_root: PathBuf) -> Self {
        Self {
            project_path: repo_root.join(STARTER_PROJECT),
            rom_path: repo_root.join(STARTER_ROM),
            export_directory: repo_root.join(EXPORT_DIRECTORY),
            project_save_directory: repo_root.join(PROJECT_SAVE_DIRECTORY),
            rom_import_directory: repo_root.join(ROM_IMPORT_DIRECTORY),
            interactive_core_directory: repo_root.join(INTERACTIVE_CORE_DIRECTORY),
            build_sgdk_script: repo_root.join("scripts/build-sgdk.sh"),
            repo_root,
        }
    }
}

fn ensure_rom(paths: &ProjectPaths) -> Result<(), String> {
    if paths.rom_path.is_file() {
        return Ok(());
    }
    if !paths.build_sgdk_script.is_file() {
        return Err(format!(
            "SGDK build script is missing: {}",
            paths.build_sgdk_script.display()
        ));
    }

    let mut command = Command::new(&paths.build_sgdk_script);
    command.current_dir(&paths.repo_root).arg(STARTER_PROJECT);
    crate::starter_rom::run_command_with_timeout(
        &mut command,
        "SGDK starter ROM build",
        std::time::Duration::from_secs(15 * 60),
    )?;
    if paths.rom_path.is_file() {
        Ok(())
    } else {
        Err(format!(
            "SGDK build finished, but the starter ROM was not found: {}",
            paths.rom_path.display()
        ))
    }
}

fn file_entry(repo_root: &Path, path: PathBuf, label: &str) -> ProjectFileEntry {
    ProjectFileEntry {
        label: label.to_string(),
        path: repo_relative(repo_root, &path),
        state: if path.is_file() { "ready" } else { "missing" }.to_string(),
    }
}

fn check_base64_size(encoded: &str, max_bytes: usize, label: &str) -> Result<(), String> {
    // Base64 expands by 4/3, so the decoded size is bounded before decoding.
    let decoded_upper_bound = encoded.trim().len() / 4 * 3;
    if decoded_upper_bound > max_bytes {
        return Err(format!(
            "{} is too large ({} MB). The limit is {} MB — check that you picked the right file.",
            label,
            decoded_upper_bound / (1024 * 1024),
            max_bytes / (1024 * 1024)
        ));
    }
    Ok(())
}

fn resolve_repo_path(repo_root: &Path, source_rom_path: &str) -> Result<PathBuf, String> {
    let trimmed = source_rom_path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".to_string());
    }

    let requested = PathBuf::from(trimmed);
    if requested.is_absolute() {
        return Err("Path must be inside the Drive16 workspace".to_string());
    }

    let candidate = repo_root.join(requested);
    let canonical_repo = repo_root.canonicalize().map_err(|error| {
        format!(
            "Could not resolve repo root {}: {}",
            repo_root.display(),
            error
        )
    })?;
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|error| format!("Could not resolve path {}: {}", candidate.display(), error))?;
    if !canonical_candidate.starts_with(&canonical_repo) {
        return Err("Path must stay inside the Drive16 workspace".to_string());
    }

    Ok(candidate)
}

fn sanitize_rom_file_name(source_name: &str) -> Result<String, String> {
    sanitize_upload_file_name(source_name)
}

fn sanitize_upload_file_name(source_name: &str) -> Result<String, String> {
    let file_name = Path::new(source_name)
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "File name is missing".to_string())?;
    let sanitized = file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();

    if sanitized
        .trim_matches(|character| character == '.' || character == '-')
        .is_empty()
    {
        Err("File name is not usable".to_string())
    } else {
        Ok(sanitized)
    }
}

fn sanitize_file_stem(source_name: &str) -> String {
    source_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn accepted_rom_extension(file_name: &str) -> Option<&'static str> {
    let lower_name = file_name.to_ascii_lowercase();
    ROM_IMPORT_EXTENSIONS
        .iter()
        .copied()
        .find(|extension| lower_name.ends_with(extension))
}

fn accepted_extensions() -> Vec<String> {
    ROM_IMPORT_EXTENSIONS
        .iter()
        .map(|extension| extension.to_string())
        .collect()
}

fn accepted_interactive_core_storage_extension(file_name: &str) -> Option<&'static str> {
    let lower_name = file_name.to_ascii_lowercase();
    INTERACTIVE_CORE_STORAGE_EXTENSIONS
        .iter()
        .copied()
        .find(|extension| lower_name.ends_with(extension))
}

fn accepted_interactive_core_extensions() -> Vec<String> {
    INTERACTIVE_CORE_INPUT_EXTENSIONS
        .iter()
        .map(|extension| extension.to_string())
        .collect()
}

fn readable_nonempty_file_bytes(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .ok()
        .filter(|metadata| metadata.is_file() && metadata.len() > 0)
        .map(|metadata| metadata.len())
}

fn copy_project_tree(source: &Path, destination: &Path) -> Result<u64, String> {
    fs::create_dir_all(destination).map_err(|error| {
        format!(
            "Could not create snapshot directory {}: {}",
            destination.display(),
            error
        )
    })?;

    let mut copied_files = 0;
    for entry in fs::read_dir(source).map_err(|error| {
        format!(
            "Could not read project directory {}: {}",
            source.display(),
            error
        )
    })? {
        let entry = entry.map_err(|error| {
            format!(
                "Could not read a project entry in {}: {}",
                source.display(),
                error
            )
        })?;
        let entry_path = entry.path();
        let target_path = destination.join(entry.file_name());
        let file_type = entry.file_type().map_err(|error| {
            format!(
                "Could not inspect project entry {}: {}",
                entry_path.display(),
                error
            )
        })?;

        if file_type.is_dir() {
            copied_files += copy_project_tree(&entry_path, &target_path)?;
        } else if file_type.is_file() {
            fs::copy(&entry_path, &target_path).map_err(|error| {
                format!(
                    "Could not copy project file {} to {}: {}",
                    entry_path.display(),
                    target_path.display(),
                    error
                )
            })?;
            copied_files += 1;
        }
    }

    Ok(copied_files)
}

fn repo_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .unwrap_or(manifest_dir)
}

fn repo_relative(repo_root: &Path, path: &Path) -> String {
    path.strip_prefix(repo_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

fn unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn unique_stamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_summary_reports_starter_paths() {
        let temp_dir = temp_repo("summary");
        fs::create_dir_all(temp_dir.join("examples/app-starter-blank/src")).unwrap();
        fs::create_dir_all(temp_dir.join("examples/app-starter-blank/res")).unwrap();
        fs::create_dir_all(temp_dir.join("assets/core")).unwrap();
        fs::write(
            temp_dir.join("examples/app-starter-blank/src/main.c"),
            "int main(){}",
        )
        .unwrap();
        fs::write(
            temp_dir.join("examples/app-starter-blank/res/resources.res"),
            "",
        )
        .unwrap();
        fs::write(temp_dir.join("assets/core/player.png"), b"png").unwrap();
        fs::write(temp_dir.join("assets/core/loop.vgm"), b"vgm").unwrap();

        let summary = project_summary_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(summary.name, "Starter Project");
        assert_eq!(summary.project_path, "examples/app-starter-blank");
        assert_eq!(summary.rom_path, "examples/app-starter-blank/out/rom.bin");
        assert_eq!(summary.export_directory, "artifacts/phase3/exports");
        assert_eq!(summary.files.len(), 4);
        assert!(summary.files.iter().all(|file| file.state == "ready"));
    }

    #[test]
    fn export_current_rom_copies_existing_rom_to_exports() {
        let temp_dir = temp_repo("export");
        let rom_path = temp_dir.join(STARTER_ROM);
        fs::create_dir_all(rom_path.parent().unwrap()).unwrap();
        fs::write(&rom_path, b"DRIVE16ROM").unwrap();

        let result = export_current_rom_for_repo(temp_dir.clone()).expect("ROM should export");
        let exported = temp_dir.join(&result.export_path);
        let exported_bytes = fs::read(&exported).expect("exported ROM should exist");
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(result.source_rom_path, STARTER_ROM);
        assert_eq!(result.bytes, 10);
        assert_eq!(exported_bytes, b"DRIVE16ROM");
    }

    #[test]
    fn save_current_project_copies_starter_tree_to_snapshot() {
        let temp_dir = temp_repo("save");
        fs::create_dir_all(temp_dir.join("examples/app-starter-blank/src")).unwrap();
        fs::create_dir_all(temp_dir.join("examples/app-starter-blank/res")).unwrap();
        fs::write(
            temp_dir.join("examples/app-starter-blank/src/main.c"),
            "int main(){}",
        )
        .unwrap();
        fs::write(
            temp_dir.join("examples/app-starter-blank/res/resources.res"),
            "SPRITE player",
        )
        .unwrap();

        let result = save_current_project_for_repo(temp_dir.clone()).expect("project saves");
        let saved_main = temp_dir.join(&result.snapshot_path).join("src/main.c");
        let saved_resources = temp_dir
            .join(&result.snapshot_path)
            .join("res/resources.res");
        let saved_main_contents = fs::read_to_string(saved_main).unwrap();
        let saved_resources_contents = fs::read_to_string(saved_resources).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(result.source_project_path, STARTER_PROJECT);
        assert_eq!(result.files, 2);
        assert_eq!(saved_main_contents, "int main(){}");
        assert_eq!(saved_resources_contents, "SPRITE player");
    }

    #[test]
    fn save_project_path_copies_repo_local_project_tree_to_snapshot() {
        let temp_dir = temp_repo("save-active");
        let active_project = temp_dir.join("artifacts/phase3/generated-core");
        fs::create_dir_all(active_project.join("src")).unwrap();
        fs::create_dir_all(active_project.join("out")).unwrap();
        fs::write(active_project.join("src/main.c"), "int generated(){}").unwrap();
        fs::write(active_project.join("out/rom.bin"), b"GENERATED").unwrap();

        let result = save_project_path_for_repo(
            temp_dir.clone(),
            "artifacts/phase3/generated-core".to_string(),
        )
        .expect("active project saves");
        let saved_main = temp_dir.join(&result.snapshot_path).join("src/main.c");
        let saved_rom = temp_dir.join(&result.snapshot_path).join("out/rom.bin");
        let saved_main_contents = fs::read_to_string(saved_main).unwrap();
        let saved_rom_contents = fs::read(saved_rom).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(
            result.source_project_path,
            "artifacts/phase3/generated-core"
        );
        assert_eq!(result.files, 2);
        assert_eq!(saved_main_contents, "int generated(){}");
        assert_eq!(saved_rom_contents, b"GENERATED");
    }

    #[test]
    fn list_project_snapshots_reports_saved_directories() {
        let temp_dir = temp_repo("snapshots");
        fs::create_dir_all(
            temp_dir
                .join(PROJECT_SAVE_DIRECTORY)
                .join("drive16-starter-a"),
        )
        .unwrap();
        fs::create_dir_all(
            temp_dir
                .join(PROJECT_SAVE_DIRECTORY)
                .join("drive16-starter-b"),
        )
        .unwrap();
        fs::write(
            temp_dir
                .join(PROJECT_SAVE_DIRECTORY)
                .join("not-a-project.txt"),
            "skip",
        )
        .unwrap();

        let snapshots = list_project_snapshots_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(snapshots.len(), 2);
        assert!(snapshots
            .iter()
            .all(|snapshot| snapshot.project_path.starts_with(PROJECT_SAVE_DIRECTORY)));
    }

    #[test]
    fn prepare_rom_import_creates_ignored_storage_path() {
        let temp_dir = temp_repo("import");
        let readiness = prepare_rom_import_for_repo(temp_dir.clone()).unwrap();
        let import_directory = temp_dir.join(&readiness.import_directory);
        let import_directory_exists = import_directory.is_dir();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(readiness.status, "ready");
        assert_eq!(readiness.import_directory, ROM_IMPORT_DIRECTORY);
        assert_eq!(
            readiness.accepted_extensions,
            ROM_IMPORT_EXTENSIONS
                .iter()
                .map(|extension| extension.to_string())
                .collect::<Vec<_>>()
        );
        assert!(import_directory_exists);
    }

    #[test]
    fn import_rom_bytes_copies_selected_rom_to_ignored_storage() {
        let temp_dir = temp_repo("import-bytes");
        let result = import_rom_bytes_for_repo(
            temp_dir.clone(),
            RomImportRequest {
                file_name: "../My Test ROM.BIN".to_string(),
                data_base64: general_purpose::STANDARD.encode(b"DRIVE16 IMPORT"),
            },
        )
        .expect("ROM import should copy bytes");
        let imported_bytes = fs::read(temp_dir.join(&result.import_path)).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(result.source_name, "My-Test-ROM.BIN");
        assert!(result.import_path.starts_with(ROM_IMPORT_DIRECTORY));
        assert!(result.import_path.ends_with(".bin"));
        assert_eq!(result.bytes, 14);
        assert_eq!(imported_bytes, b"DRIVE16 IMPORT");
    }

    #[test]
    fn import_rom_bytes_rejects_unsupported_extensions() {
        let temp_dir = temp_repo("import-reject");
        let result = import_rom_bytes_for_repo(
            temp_dir.clone(),
            RomImportRequest {
                file_name: "notes.txt".to_string(),
                data_base64: general_purpose::STANDARD.encode(b"not a rom"),
            },
        );
        let import_directory_exists = temp_dir.join(ROM_IMPORT_DIRECTORY).exists();
        let _ = fs::remove_dir_all(temp_dir);

        assert!(result.is_err());
        assert!(!import_directory_exists);
    }

    #[test]
    fn import_test_rom_copies_starter_rom_fixture() {
        let temp_dir = temp_repo("import-test-rom");
        let rom_path = temp_dir.join(STARTER_ROM);
        fs::create_dir_all(rom_path.parent().unwrap()).unwrap();
        fs::write(&rom_path, b"STARTER TEST ROM").unwrap();

        let result = import_test_rom_for_repo(temp_dir.clone()).expect("test ROM should import");
        let imported_bytes = fs::read(temp_dir.join(&result.import_path)).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(result.source_name, "starter-test-rom.bin");
        assert_eq!(imported_bytes, b"STARTER TEST ROM");
    }

    #[test]
    fn export_rom_path_copies_imported_rom() {
        let temp_dir = temp_repo("export-imported");
        let imported_path = temp_dir
            .join(ROM_IMPORT_DIRECTORY)
            .join("drive16-import-test.gen");
        fs::create_dir_all(imported_path.parent().unwrap()).unwrap();
        fs::write(&imported_path, b"IMPORTED GENESIS").unwrap();

        let result = export_rom_path_for_repo(
            temp_dir.clone(),
            "artifacts/phase5/imports/drive16-import-test.gen".to_string(),
        )
        .expect("imported ROM should export");
        let exported_bytes = fs::read(temp_dir.join(&result.export_path)).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(
            result.source_rom_path,
            "artifacts/phase5/imports/drive16-import-test.gen"
        );
        assert!(result.export_path.ends_with(".gen"));
        assert_eq!(result.bytes, 16);
        assert_eq!(exported_bytes, b"IMPORTED GENESIS");
    }

    #[test]
    fn export_rom_path_rejects_paths_outside_repo() {
        let temp_dir = temp_repo("export-reject");
        fs::create_dir_all(&temp_dir).unwrap();
        let result = export_rom_path_for_repo(temp_dir.clone(), "../outside.bin".to_string());
        fs::remove_dir_all(temp_dir).unwrap();

        assert!(result.is_err());
    }

    #[test]
    fn read_rom_bytes_returns_repo_local_rom_payload() {
        let temp_dir = temp_repo("read-rom");
        let rom_path = temp_dir.join(ROM_IMPORT_DIRECTORY).join("playable-test.md");
        fs::create_dir_all(rom_path.parent().unwrap()).unwrap();
        fs::write(&rom_path, b"PLAYABLE ROM").unwrap();

        let result = read_rom_bytes_for_repo(
            temp_dir.clone(),
            "artifacts/phase5/imports/playable-test.md".to_string(),
        )
        .expect("ROM bytes should be readable for player");
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert_eq!(result.rom_path, "artifacts/phase5/imports/playable-test.md");
        assert_eq!(result.source_name, "playable-test.md");
        assert_eq!(result.bytes, 12);
        assert_eq!(
            general_purpose::STANDARD
                .decode(result.data_base64)
                .unwrap(),
            b"PLAYABLE ROM"
        );
    }

    #[test]
    fn read_rom_bytes_rejects_paths_outside_repo() {
        let temp_dir = temp_repo("read-outside");
        fs::create_dir_all(&temp_dir).unwrap();
        let result = read_rom_bytes_for_repo(temp_dir.clone(), "../outside.bin".to_string());
        fs::remove_dir_all(temp_dir).unwrap();

        assert!(result.is_err());
    }

    #[test]
    fn read_rom_bytes_rejects_unsupported_extensions() {
        let temp_dir = temp_repo("read-extension");
        let text_path = temp_dir.join("notes.txt");
        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(&text_path, b"not a rom").unwrap();

        let result = read_rom_bytes_for_repo(temp_dir.clone(), "notes.txt".to_string());
        fs::remove_dir_all(temp_dir).unwrap();

        assert!(result.is_err());
    }

    #[test]
    fn interactive_core_status_reports_missing_without_user_pair() {
        let temp_dir = temp_repo("core-missing");
        fs::create_dir_all(&temp_dir).unwrap();

        let status = interactive_core_status_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(status.status, "missing");
        assert_eq!(status.import_directory, INTERACTIVE_CORE_DIRECTORY);
        assert!(status.js_path.is_none());
        assert!(status.wasm_path.is_none());
        assert_eq!(
            status.accepted_extensions,
            INTERACTIVE_CORE_INPUT_EXTENSIONS
                .iter()
                .map(|extension| extension.to_string())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn prepare_interactive_core_import_creates_ignored_storage_path() {
        let temp_dir = temp_repo("core-prepare");
        let status = prepare_interactive_core_import_for_repo(temp_dir.clone()).unwrap();
        let import_directory_exists = temp_dir.join(&status.import_directory).is_dir();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(status.status, "missing");
        assert_eq!(status.import_directory, INTERACTIVE_CORE_DIRECTORY);
        assert!(import_directory_exists);
    }

    #[test]
    fn import_interactive_core_files_copies_pair_to_stable_ignored_paths() {
        let temp_dir = temp_repo("core-import");
        let result = import_interactive_core_files_for_repo(
            temp_dir.clone(),
            InteractiveCoreImportRequest {
                files: vec![
                    InteractiveCoreUploadFile {
                        file_name: "../custom-core.js".to_string(),
                        data_base64: general_purpose::STANDARD.encode(b"core js"),
                    },
                    InteractiveCoreUploadFile {
                        file_name: "custom-core.wasm".to_string(),
                        data_base64: general_purpose::STANDARD.encode(b"core wasm"),
                    },
                ],
            },
        )
        .expect("core pair should import");
        let imported_js = fs::read(temp_dir.join(&result.js_path)).unwrap();
        let imported_wasm = fs::read(temp_dir.join(&result.wasm_path)).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "available");
        assert_eq!(result.core_name, INTERACTIVE_CORE_NAME);
        assert_eq!(
            result.js_path,
            format!("{}/{}", INTERACTIVE_CORE_DIRECTORY, INTERACTIVE_CORE_JS)
        );
        assert_eq!(
            result.wasm_path,
            format!("{}/{}", INTERACTIVE_CORE_DIRECTORY, INTERACTIVE_CORE_WASM)
        );
        assert_eq!(imported_js, b"core js");
        assert_eq!(imported_wasm, b"core wasm");
    }

    #[test]
    fn import_interactive_core_files_rejects_missing_wasm_pair() {
        let temp_dir = temp_repo("core-missing-wasm");
        let result = import_interactive_core_files_for_repo(
            temp_dir.clone(),
            InteractiveCoreImportRequest {
                files: vec![InteractiveCoreUploadFile {
                    file_name: "custom-core.js".to_string(),
                    data_base64: general_purpose::STANDARD.encode(b"core js"),
                }],
            },
        );
        let import_directory_exists = temp_dir.join(INTERACTIVE_CORE_DIRECTORY).exists();
        let _ = fs::remove_dir_all(temp_dir);

        assert!(result.is_err());
        assert!(!import_directory_exists);
    }

    #[test]
    fn import_interactive_core_files_rejects_unsupported_storage_extension() {
        let temp_dir = temp_repo("core-reject-extension");
        let result = import_interactive_core_files_for_repo(
            temp_dir.clone(),
            InteractiveCoreImportRequest {
                files: vec![
                    InteractiveCoreUploadFile {
                        file_name: "core.zip".to_string(),
                        data_base64: general_purpose::STANDARD.encode(b"zip data"),
                    },
                    InteractiveCoreUploadFile {
                        file_name: "core.wasm".to_string(),
                        data_base64: general_purpose::STANDARD.encode(b"wasm data"),
                    },
                ],
            },
        );
        let import_directory_exists = temp_dir.join(INTERACTIVE_CORE_DIRECTORY).exists();
        let _ = fs::remove_dir_all(temp_dir);

        assert!(result.is_err());
        assert!(!import_directory_exists);
    }

    #[test]
    fn read_interactive_core_files_returns_user_core_payload() {
        let temp_dir = temp_repo("core-read");
        let core_directory = temp_dir.join(INTERACTIVE_CORE_DIRECTORY);
        fs::create_dir_all(&core_directory).unwrap();
        fs::write(core_directory.join(INTERACTIVE_CORE_JS), b"read js").unwrap();
        fs::write(core_directory.join(INTERACTIVE_CORE_WASM), b"read wasm").unwrap();

        let result = read_interactive_core_files_for_repo(temp_dir.clone())
            .expect("core payload should read");
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "available");
        assert_eq!(result.core_name, INTERACTIVE_CORE_NAME);
        assert_eq!(
            general_purpose::STANDARD
                .decode(result.js_data_base64)
                .unwrap(),
            b"read js"
        );
        assert_eq!(
            general_purpose::STANDARD
                .decode(result.wasm_data_base64)
                .unwrap(),
            b"read wasm"
        );
    }

    fn temp_repo(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "drive16-project-{}-{}-{}",
            label,
            unique_stamp(),
            std::process::id()
        ))
    }
}
