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
const EXPORT_DIRECTORY: &str = "artifacts/phase3/exports";
const PROJECT_SAVE_DIRECTORY: &str = "artifacts/phase3/projects";
const ROM_IMPORT_DIRECTORY: &str = "artifacts/phase5/imports";
const ROM_IMPORT_EXTENSIONS: [&str; 4] = [".bin", ".gen", ".md", ".smd"];

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

struct ProjectPaths {
    repo_root: PathBuf,
    project_path: PathBuf,
    rom_path: PathBuf,
    export_directory: PathBuf,
    project_save_directory: PathBuf,
    rom_import_directory: PathBuf,
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

pub fn list_project_snapshots() -> Vec<ProjectSnapshot> {
    list_project_snapshots_for_repo(repo_root())
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
    if !paths.project_path.is_dir() {
        return Err(format!(
            "Starter project is missing: {}",
            paths.project_path.display()
        ));
    }
    fs::create_dir_all(&paths.project_save_directory).map_err(|error| {
        format!(
            "Could not create project save directory {}: {}",
            paths.project_save_directory.display(),
            error
        )
    })?;

    let snapshot_path = paths
        .project_save_directory
        .join(format!("drive16-starter-{}", unique_stamp()));
    let files = copy_project_tree(&paths.project_path, &snapshot_path)?;

    Ok(ProjectSaveResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "Project snapshot saved".to_string(),
        source_project_path: repo_relative(&paths.repo_root, &paths.project_path),
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

impl ProjectPaths {
    fn new(repo_root: PathBuf) -> Self {
        Self {
            project_path: repo_root.join(STARTER_PROJECT),
            rom_path: repo_root.join(STARTER_ROM),
            export_directory: repo_root.join(EXPORT_DIRECTORY),
            project_save_directory: repo_root.join(PROJECT_SAVE_DIRECTORY),
            rom_import_directory: repo_root.join(ROM_IMPORT_DIRECTORY),
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

    let output = Command::new(&paths.build_sgdk_script)
        .current_dir(&paths.repo_root)
        .arg(STARTER_PROJECT)
        .output()
        .map_err(|error| format!("SGDK starter ROM build could not run: {}", error))?;
    if !output.status.success() {
        return Err(format!(
            "SGDK starter ROM build failed:\n{}",
            tail(&combined_output(&output.stdout, &output.stderr), 4000)
        ));
    }
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

fn resolve_repo_path(repo_root: &Path, source_rom_path: &str) -> Result<PathBuf, String> {
    let trimmed = source_rom_path.trim();
    if trimmed.is_empty() {
        return Err("ROM path is empty".to_string());
    }

    let requested = PathBuf::from(trimmed);
    if requested.is_absolute() {
        return Err("ROM path must be inside the Drive16 workspace".to_string());
    }

    let candidate = repo_root.join(requested);
    let canonical_repo = repo_root.canonicalize().map_err(|error| {
        format!(
            "Could not resolve repo root {}: {}",
            repo_root.display(),
            error
        )
    })?;
    let canonical_candidate = candidate.canonicalize().map_err(|error| {
        format!(
            "Could not resolve ROM path {}: {}",
            candidate.display(),
            error
        )
    })?;
    if !canonical_candidate.starts_with(&canonical_repo) {
        return Err("ROM path must stay inside the Drive16 workspace".to_string());
    }

    Ok(candidate)
}

fn sanitize_rom_file_name(source_name: &str) -> Result<String, String> {
    let file_name = Path::new(source_name)
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "ROM file name is missing".to_string())?;
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
        Err("ROM file name is not usable".to_string())
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

fn combined_output(stdout: &[u8], stderr: &[u8]) -> String {
    let mut combined = String::new();
    combined.push_str(&String::from_utf8_lossy(stdout));
    if !stderr.is_empty() {
        if !combined.ends_with('\n') && !combined.is_empty() {
            combined.push('\n');
        }
        combined.push_str(&String::from_utf8_lossy(stderr));
    }
    combined
}

fn tail(text: &str, max_chars: usize) -> String {
    if text.len() <= max_chars {
        text.to_string()
    } else {
        text[text.len() - max_chars..].to_string()
    }
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

    fn temp_repo(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "drive16-project-{}-{}-{}",
            label,
            unique_stamp(),
            std::process::id()
        ))
    }
}
