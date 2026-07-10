use std::{
    env, fs,
    path::{Path, PathBuf},
    sync::OnceLock,
};
use tauri::Manager;

const SUPPORT_ENTRIES: [&str; 10] = [
    "agent",
    "assets",
    "corpus",
    "examples",
    "mcp-servers",
    "patches",
    "scripts",
    "bin",
    "LICENSE",
    "opencode.json",
];

static RUNTIME_ROOT: OnceLock<PathBuf> = OnceLock::new();

pub fn initialize(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let root = if let Some(explicit) = explicit_runtime_root() {
        explicit
    } else if cfg!(debug_assertions) && env::var_os("DRIVE16_PACKAGED_RUNTIME").is_none() {
        source_repo_root()
    } else {
        install_packaged_runtime(app)?
    };

    if let Some(current) = RUNTIME_ROOT.get() {
        if current != &root {
            return Err(format!(
                "Drive16 runtime root already initialized as {}, not {}",
                current.display(),
                root.display()
            )
            .into());
        }
        return Ok(());
    }
    RUNTIME_ROOT
        .set(root)
        .map_err(|_| "Could not initialize the Drive16 runtime root".into())
}

pub fn repo_root() -> PathBuf {
    explicit_runtime_root()
        .or_else(|| RUNTIME_ROOT.get().cloned())
        .unwrap_or_else(source_repo_root)
}

fn explicit_runtime_root() -> Option<PathBuf> {
    env::var_os("DRIVE16_REPO_ROOT")
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

fn source_repo_root() -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .unwrap_or(manifest_dir)
}

fn install_packaged_runtime(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("Could not resolve the packaged resource directory: {error}"))?;
    let bundled_root = resource_dir.join("drive16-support");
    if !bundled_root.join("opencode.json").is_file() {
        return Err(format!(
            "Drive16 support files are missing from {}",
            bundled_root.display()
        )
        .into());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the Drive16 app-data directory: {error}"))?;
    let runtime_root = app_data_dir.join("runtime");
    let staging_root = runtime_root.join(".support-staging");
    fs::create_dir_all(&runtime_root)?;
    if staging_root.exists() {
        fs::remove_dir_all(&staging_root)?;
    }
    fs::create_dir_all(&staging_root)?;

    for entry in SUPPORT_ENTRIES {
        copy_path(&bundled_root.join(entry), &staging_root.join(entry))?;
    }
    for entry in SUPPORT_ENTRIES {
        let target = runtime_root.join(entry);
        if target.is_dir() {
            fs::remove_dir_all(&target)?;
        } else if target.exists() {
            fs::remove_file(&target)?;
        }
        fs::rename(staging_root.join(entry), target)?;
    }
    fs::remove_dir_all(staging_root)?;
    Ok(runtime_root)
}

fn copy_path(source: &Path, target: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let metadata = fs::metadata(source)?;
    if metadata.is_dir() {
        fs::create_dir_all(target)?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            copy_path(&entry.path(), &target.join(entry.file_name()))?;
        }
        fs::set_permissions(target, metadata.permissions())?;
    } else {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(source, target)?;
        fs::set_permissions(target, metadata.permissions())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_root_contains_runtime_contract() {
        let root = source_repo_root();
        assert!(root.join("opencode.json").is_file());
        assert!(root.join("LICENSE").is_file());
        assert!(root.join("examples/app-starter-blank/Makefile").is_file());
        assert!(root.join("scripts/build-sgdk.sh").is_file());
    }
}
