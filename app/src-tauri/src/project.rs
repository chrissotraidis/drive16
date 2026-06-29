use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const STARTER_PROJECT: &str = "examples/app-starter-blank";
const STARTER_ROM: &str = "examples/app-starter-blank/out/rom.bin";
const EXPORT_DIRECTORY: &str = "artifacts/phase3/exports";

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

struct ProjectPaths {
    repo_root: PathBuf,
    project_path: PathBuf,
    rom_path: PathBuf,
    export_directory: PathBuf,
    build_sgdk_script: PathBuf,
}

pub fn load_project_summary() -> ProjectSummary {
    project_summary_for_repo(repo_root())
}

pub fn export_current_rom() -> Result<RomExportResult, String> {
    export_current_rom_for_repo(repo_root())
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
    fs::create_dir_all(&paths.export_directory).map_err(|error| {
        format!(
            "Could not create export directory {}: {}",
            paths.export_directory.display(),
            error
        )
    })?;

    let export_path = paths
        .export_directory
        .join(format!("drive16-starter-{}.bin", unique_stamp()));
    let bytes = fs::copy(&paths.rom_path, &export_path).map_err(|error| {
        format!(
            "Could not export ROM from {} to {}: {}",
            paths.rom_path.display(),
            export_path.display(),
            error
        )
    })?;

    Ok(RomExportResult {
        generated_at: unix_timestamp(),
        status: "ready".to_string(),
        detail: "ROM exported".to_string(),
        source_rom_path: repo_relative(&paths.repo_root, &paths.rom_path),
        export_path: repo_relative(&paths.repo_root, &export_path),
        bytes,
    })
}

impl ProjectPaths {
    fn new(repo_root: PathBuf) -> Self {
        Self {
            project_path: repo_root.join(STARTER_PROJECT),
            rom_path: repo_root.join(STARTER_ROM),
            export_directory: repo_root.join(EXPORT_DIRECTORY),
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

    fn temp_repo(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "drive16-project-{}-{}-{}",
            label,
            unique_stamp(),
            std::process::id()
        ))
    }
}
