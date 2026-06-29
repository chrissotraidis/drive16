use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const STARTER_PROJECT: &str = "examples/app-starter-blank";
const STARTER_FRAMES: u32 = 180;
const STREAM_EVERY: u32 = 30;
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
const FRAME_HEADER_BYTES: usize = 24;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StarterRomPreview {
    pub status: String,
    pub detail: String,
    pub generated_at: String,
    pub project_path: String,
    pub rom_path: String,
    pub screenshot_path: String,
    pub frame_stream_path: String,
    pub screenshot_data_url: String,
    pub frames: u32,
    pub stream_every: u32,
    pub streamed_frames: usize,
}

#[derive(Debug)]
struct StarterPaths {
    repo_root: PathBuf,
    project_path: PathBuf,
    rom_path: PathBuf,
    screenshot_path: PathBuf,
    frame_stream_path: PathBuf,
    build_sgdk_script: PathBuf,
    build_genteel_script: PathBuf,
    local_genteel_bin: PathBuf,
}

pub fn launch_starter_rom() -> Result<StarterRomPreview, String> {
    launch_starter_rom_for_repo(repo_root())
}

fn launch_starter_rom_for_repo(repo_root: PathBuf) -> Result<StarterRomPreview, String> {
    let paths = StarterPaths::new(repo_root);
    paths.ensure_artifact_dir()?;
    ensure_rom(&paths)?;
    let genteel_bin = find_genteel_bin(&paths)?;

    remove_if_exists(&paths.screenshot_path)?;
    remove_if_exists(&paths.frame_stream_path)?;

    let mut command = Command::new(&genteel_bin);
    command
        .current_dir(&paths.repo_root)
        .arg("--headless")
        .arg(STARTER_FRAMES.to_string())
        .arg("--stream-frames")
        .arg(&paths.frame_stream_path)
        .arg("--stream-every")
        .arg(STREAM_EVERY.to_string())
        .arg("--screenshot")
        .arg(&paths.screenshot_path)
        .arg(&paths.rom_path);

    run_command(&mut command, "Genteel starter ROM launch")?;

    let screenshot_bytes = fs::read(&paths.screenshot_path).map_err(|error| {
        format!(
            "Starter ROM screenshot was not created at {}: {}",
            paths.screenshot_path.display(),
            error
        )
    })?;
    if !screenshot_bytes.starts_with(PNG_SIGNATURE) {
        return Err(format!(
            "Starter ROM screenshot is not a PNG: {}",
            paths.screenshot_path.display()
        ));
    }

    let streamed_frames = count_frame_stream(&paths.frame_stream_path)?;
    let screenshot_data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(screenshot_bytes)
    );

    Ok(StarterRomPreview {
        status: "ready".to_string(),
        detail: "Starter ROM captured from Genteel".to_string(),
        generated_at: unix_timestamp(),
        project_path: repo_relative(&paths.repo_root, &paths.project_path),
        rom_path: repo_relative(&paths.repo_root, &paths.rom_path),
        screenshot_path: repo_relative(&paths.repo_root, &paths.screenshot_path),
        frame_stream_path: repo_relative(&paths.repo_root, &paths.frame_stream_path),
        screenshot_data_url,
        frames: STARTER_FRAMES,
        stream_every: STREAM_EVERY,
        streamed_frames,
    })
}

impl StarterPaths {
    fn new(repo_root: PathBuf) -> Self {
        let project_path = repo_root.join(STARTER_PROJECT);
        Self {
            rom_path: project_path.join("out/rom.bin"),
            screenshot_path: repo_root.join("artifacts/phase3/starter-rom/starter-frame.png"),
            frame_stream_path: repo_root.join("artifacts/phase3/starter-rom/starter-frames.rgb565"),
            build_sgdk_script: repo_root.join("scripts/build-sgdk.sh"),
            build_genteel_script: repo_root.join("scripts/build-genteel.sh"),
            local_genteel_bin: repo_root
                .join("artifacts/phase0/genteel-src/target/release/genteel"),
            repo_root,
            project_path,
        }
    }

    fn ensure_artifact_dir(&self) -> Result<(), String> {
        let parent = self
            .screenshot_path
            .parent()
            .ok_or_else(|| "Starter ROM artifact path has no parent directory".to_string())?;
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "Could not create starter ROM artifact directory {}: {}",
                parent.display(),
                error
            )
        })
    }
}

fn ensure_rom(paths: &StarterPaths) -> Result<(), String> {
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
    run_command(&mut command, "SGDK starter ROM build")?;

    if paths.rom_path.is_file() {
        Ok(())
    } else {
        Err(format!(
            "SGDK build finished, but the starter ROM was not found: {}",
            paths.rom_path.display()
        ))
    }
}

fn find_genteel_bin(paths: &StarterPaths) -> Result<PathBuf, String> {
    if let Some(env_bin) = env::var_os("GENTEEL_BIN") {
        let env_path = PathBuf::from(env_bin);
        if env_path.is_absolute() && env_path.is_file() {
            return Ok(env_path);
        }
        if let Some(found) = find_command(&env_path) {
            return Ok(found);
        }
    }

    if paths.local_genteel_bin.is_file() {
        return Ok(paths.local_genteel_bin.clone());
    }
    if !paths.build_genteel_script.is_file() {
        return Err(format!(
            "Genteel build script is missing: {}",
            paths.build_genteel_script.display()
        ));
    }

    let mut command = Command::new(&paths.build_genteel_script);
    command.current_dir(&paths.repo_root);
    let output = run_command(&mut command, "Genteel build")?;
    let printed_path = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .last();
    let genteel_path = printed_path
        .map(PathBuf::from)
        .ok_or_else(|| "Genteel build did not print a binary path".to_string())?;
    if genteel_path.is_file() {
        Ok(genteel_path)
    } else {
        Err(format!(
            "Genteel build did not create the expected binary: {}",
            genteel_path.display()
        ))
    }
}

fn run_command(command: &mut Command, label: &str) -> Result<String, String> {
    let output = command
        .output()
        .map_err(|error| format!("{} could not run: {}", label, error))?;
    let combined = combined_output(&output.stdout, &output.stderr);
    if output.status.success() {
        Ok(combined)
    } else {
        Err(format!("{} failed:\n{}", label, tail(&combined, 4000)))
    }
}

fn count_frame_stream(path: &Path) -> Result<usize, String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "Starter ROM frame stream was not created at {}: {}",
            path.display(),
            error
        )
    })?;
    let mut offset = 0;
    let mut frames = 0;

    while offset < data.len() {
        if data.len() - offset < FRAME_HEADER_BYTES {
            return Err(format!("Truncated frame stream header at byte {}", offset));
        }
        if &data[offset..offset + 4] != b"D16F" {
            return Err(format!("Invalid frame stream magic at byte {}", offset));
        }
        let version = read_u16(&data, offset + 4)?;
        let width = read_u16(&data, offset + 6)?;
        let height = read_u16(&data, offset + 8)?;
        let format = read_u16(&data, offset + 10)?;
        let payload_len = read_u32(&data, offset + 20)? as usize;
        if version != 1 {
            return Err(format!("Unexpected frame stream version: {}", version));
        }
        if (width, height, format) != (320, 240, 565) {
            return Err(format!(
                "Unexpected frame stream metadata: {}x{} fmt {}",
                width, height, format
            ));
        }
        if payload_len != width as usize * height as usize * 2 {
            return Err(format!(
                "Unexpected frame stream payload length: {}",
                payload_len
            ));
        }
        let payload_offset = offset + FRAME_HEADER_BYTES;
        let next_offset = payload_offset + payload_len;
        if next_offset > data.len() {
            return Err(format!(
                "Truncated frame stream payload at frame {}",
                frames
            ));
        }
        frames += 1;
        offset = next_offset;
    }

    if frames == 0 {
        Err("Frame stream did not contain any frames".to_string())
    } else {
        Ok(frames)
    }
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16, String> {
    let bytes = data
        .get(offset..offset + 2)
        .ok_or_else(|| format!("Missing u16 at byte {}", offset))?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32, String> {
    let bytes = data
        .get(offset..offset + 4)
        .ok_or_else(|| format!("Missing u32 at byte {}", offset))?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
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

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove {}: {}", path.display(), error)),
    }
}

fn find_command(command_name: &Path) -> Option<PathBuf> {
    env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| env::split_paths(&paths).collect::<Vec<_>>())
        .map(|directory| directory.join(command_name))
        .find(|candidate| candidate.is_file())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starter_paths_stay_in_expected_locations() {
        let paths = StarterPaths::new(PathBuf::from("/tmp/drive16"));

        assert_eq!(
            paths.project_path,
            PathBuf::from("/tmp/drive16/examples/app-starter-blank")
        );
        assert_eq!(
            paths.rom_path,
            PathBuf::from("/tmp/drive16/examples/app-starter-blank/out/rom.bin")
        );
        assert_eq!(
            paths.screenshot_path,
            PathBuf::from("/tmp/drive16/artifacts/phase3/starter-rom/starter-frame.png")
        );
        assert_eq!(
            paths.frame_stream_path,
            PathBuf::from("/tmp/drive16/artifacts/phase3/starter-rom/starter-frames.rgb565")
        );
    }

    #[test]
    #[ignore = "runs the starter ROM through the local Genteel sidecar"]
    fn starter_rom_launches_existing_rom_when_assets_are_present() {
        let preview = launch_starter_rom().expect("starter ROM should launch");

        assert_eq!(preview.status, "ready");
        assert!(preview
            .screenshot_data_url
            .starts_with("data:image/png;base64,"));
        assert!(preview.streamed_frames >= 1);
        assert_eq!(preview.rom_path, "examples/app-starter-blank/out/rom.bin");
    }
}
