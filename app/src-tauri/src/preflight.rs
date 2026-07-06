use serde::Serialize;
use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheck {
    pub name: String,
    pub state: String,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightReport {
    pub generated_at: String,
    pub summary_state: String,
    pub checks: Vec<HealthCheck>,
}

pub fn run_preflight() -> PreflightReport {
    let repo_root = repo_root();
    let checks = vec![
        command_check(
            "OpenCode",
            "opencode",
            &["--version"],
            opencode_fallbacks(),
            "Install or configure OpenCode",
        ),
        docker_daemon_check(),
        file_check(
            "SGDK build",
            repo_root.join("scripts/build-sgdk.sh"),
            "build-sgdk.sh ready",
            "Missing scripts/build-sgdk.sh",
        ),
        file_check(
            "Genteel",
            repo_root.join("artifacts/phase0/genteel-src/target/release/genteel"),
            "Genteel sidecar ready",
            "Run scripts/build-genteel.sh",
        ),
        file_check(
            "RAG corpus",
            repo_root.join("corpus/drive16/sgdk-project-patterns.md"),
            "Drive16 corpus ready",
            "Run scripts/fetch-rag-corpus.sh",
        ),
        file_check(
            "CORE assets",
            repo_root.join("assets/core/player.png"),
            "Bundled sprite pack ready",
            "Missing assets/core/player.png",
        ),
    ];

    let summary_state = if checks.iter().any(|check| check.state == "missing") {
        "missing"
    } else if checks.iter().any(|check| check.state == "warning") {
        "warning"
    } else {
        "ready"
    };

    PreflightReport {
        generated_at: unix_timestamp(),
        summary_state: summary_state.to_string(),
        checks,
    }
}

// `docker --version` succeeds with the daemon down, so probe the daemon
// itself and say exactly what to do when it is not running.
fn docker_daemon_check() -> HealthCheck {
    let fallbacks = vec![
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/opt/homebrew/bin"),
    ];
    let Some(docker) = find_command("docker", &fallbacks) else {
        return HealthCheck {
            name: "Docker".to_string(),
            state: "missing".to_string(),
            detail: "Install Docker Desktop — builds need it".to_string(),
        };
    };

    match Command::new(&docker)
        .args(["info", "--format", "server {{.ServerVersion}}"])
        .output()
    {
        Ok(output) if output.status.success() => HealthCheck {
            name: "Docker".to_string(),
            state: "ready".to_string(),
            detail: first_output_line(&output.stdout, &output.stderr)
                .unwrap_or_else(|| "Docker daemon running".to_string()),
        },
        _ => HealthCheck {
            name: "Docker".to_string(),
            state: "missing".to_string(),
            detail: "Docker Desktop is not running — start it, then refresh".to_string(),
        },
    }
}

fn command_check(
    name: &str,
    command_name: &str,
    args: &[&str],
    fallbacks: Vec<PathBuf>,
    missing_detail: &str,
) -> HealthCheck {
    match find_command(command_name, &fallbacks) {
        Some(command_path) => match Command::new(&command_path).args(args).output() {
            Ok(output) if output.status.success() => HealthCheck {
                name: name.to_string(),
                state: "ready".to_string(),
                detail: first_output_line(&output.stdout, &output.stderr)
                    .unwrap_or_else(|| format!("{} ready", command_name)),
            },
            Ok(output) => HealthCheck {
                name: name.to_string(),
                state: "warning".to_string(),
                detail: first_output_line(&output.stdout, &output.stderr)
                    .unwrap_or_else(|| format!("{} returned a non-zero status", command_name)),
            },
            Err(error) => HealthCheck {
                name: name.to_string(),
                state: "warning".to_string(),
                detail: format!("{} could not be run: {}", command_name, error),
            },
        },
        None => HealthCheck {
            name: name.to_string(),
            state: "missing".to_string(),
            detail: missing_detail.to_string(),
        },
    }
}

fn file_check(name: &str, path: PathBuf, ready_detail: &str, missing_detail: &str) -> HealthCheck {
    if path.exists() {
        HealthCheck {
            name: name.to_string(),
            state: "ready".to_string(),
            detail: ready_detail.to_string(),
        }
    } else {
        HealthCheck {
            name: name.to_string(),
            state: "missing".to_string(),
            detail: missing_detail.to_string(),
        }
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

fn opencode_fallbacks() -> Vec<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| vec![home.join(".opencode/bin")])
        .unwrap_or_default()
}

fn find_command(command_name: &str, fallbacks: &[PathBuf]) -> Option<PathBuf> {
    env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| env::split_paths(&paths).collect::<Vec<_>>())
        .chain(fallbacks.iter().cloned())
        .map(|directory| directory.join(command_name))
        .find(|candidate| candidate.is_file())
}

fn first_output_line(stdout: &[u8], stderr: &[u8]) -> Option<String> {
    let combined = if stdout.is_empty() { stderr } else { stdout };
    String::from_utf8_lossy(combined)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

fn unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preflight_reports_expected_core_checks() {
        let report = run_preflight();
        let names: Vec<&str> = report
            .checks
            .iter()
            .map(|check| check.name.as_str())
            .collect();

        assert!(names.contains(&"OpenCode"));
        assert!(names.contains(&"Docker"));
        assert!(names.contains(&"SGDK build"));
        assert!(names.contains(&"Genteel"));
        assert!(names.contains(&"RAG corpus"));
        assert!(names.contains(&"CORE assets"));
    }
}
