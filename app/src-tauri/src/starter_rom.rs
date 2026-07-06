use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use std::{
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const SGDK_BUILD_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const GENTEEL_BUILD_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const GENTEEL_RUN_TIMEOUT: Duration = Duration::from_secs(3 * 60);

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
    pub frame_width: u16,
    pub frame_height: u16,
    pub framebuffer_frames: Vec<FramebufferFrame>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FramebufferFrame {
    pub frame_index: u64,
    pub width: u16,
    pub height: u16,
    pub format: String,
    pub rgb565_data: String,
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

pub fn launch_rom_path(source_rom_path: String) -> Result<StarterRomPreview, String> {
    launch_rom_path_for_repo(repo_root(), source_rom_path)
}

fn launch_starter_rom_for_repo(repo_root: PathBuf) -> Result<StarterRomPreview, String> {
    let paths = StarterPaths::new(repo_root);
    paths.ensure_artifact_dir()?;
    ensure_rom(&paths)?;
    let project_path = paths.project_path.clone();
    let rom_path = paths.rom_path.clone();
    launch_rom_for_paths(
        paths,
        project_path,
        rom_path,
        "Starter ROM captured from Genteel",
    )
}

fn launch_rom_path_for_repo(
    repo_root: PathBuf,
    source_rom_path: String,
) -> Result<StarterRomPreview, String> {
    let paths = StarterPaths::new(repo_root);
    paths.ensure_artifact_dir()?;
    let rom_path = resolve_repo_path(&paths.repo_root, &source_rom_path)?;
    if !rom_path.is_file() {
        return Err(format!("ROM is missing: {}", rom_path.display()));
    }
    let project_path = rom_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| paths.repo_root.clone());
    launch_rom_for_paths(
        paths,
        project_path,
        rom_path,
        "Active ROM captured from Genteel",
    )
}

fn launch_rom_for_paths(
    paths: StarterPaths,
    project_path: PathBuf,
    rom_path: PathBuf,
    detail: &str,
) -> Result<StarterRomPreview, String> {
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
        .arg(&rom_path);

    run_command_with_timeout(&mut command, "Genteel starter ROM launch", GENTEEL_RUN_TIMEOUT)?;

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

    let framebuffer_frames = read_frame_stream(&paths.frame_stream_path)?;
    let first_frame = framebuffer_frames
        .first()
        .ok_or_else(|| "Frame stream did not contain any frames".to_string())?;
    let frame_width = first_frame.width;
    let frame_height = first_frame.height;
    let streamed_frames = framebuffer_frames.len();
    let screenshot_data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(screenshot_bytes)
    );

    Ok(StarterRomPreview {
        status: "ready".to_string(),
        detail: detail.to_string(),
        generated_at: unix_timestamp(),
        project_path: repo_relative(&paths.repo_root, &project_path),
        rom_path: repo_relative(&paths.repo_root, &rom_path),
        screenshot_path: repo_relative(&paths.repo_root, &paths.screenshot_path),
        frame_stream_path: repo_relative(&paths.repo_root, &paths.frame_stream_path),
        screenshot_data_url,
        frames: STARTER_FRAMES,
        stream_every: STREAM_EVERY,
        streamed_frames,
        frame_width,
        frame_height,
        framebuffer_frames,
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
    run_command_with_timeout(&mut command, "SGDK starter ROM build", SGDK_BUILD_TIMEOUT)?;

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
    let output = run_command_with_timeout(&mut command, "Genteel build", GENTEEL_BUILD_TIMEOUT)?;
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

// GUI apps on macOS get a minimal PATH without /usr/local/bin or Homebrew,
// which hides docker, node, and cargo from every child process. Extend it
// for everything we spawn.
pub(crate) fn extended_path_env() -> String {
    let current = env::var("PATH").unwrap_or_default();
    let mut path = current.clone();
    let mut extras: Vec<String> = vec![
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
    ];
    if let Some(home) = env::var_os("HOME") {
        let home = PathBuf::from(home);
        extras.push(home.join(".cargo/bin").to_string_lossy().into_owned());
        extras.push(home.join(".opencode/bin").to_string_lossy().into_owned());
        extras.push(home.join("Library/pnpm").to_string_lossy().into_owned());
    }
    for extra in extras {
        if !current.split(':').any(|part| part == extra) {
            path.push(':');
            path.push_str(&extra);
        }
    }
    path
}

// Toolchain shell-outs (Docker builds, emulator runs) must never hang the
// app: spawn with piped output, poll, and kill past the deadline. Output is
// drained on threads so a chatty build cannot deadlock the pipe buffer.
pub(crate) fn run_command_with_timeout(
    command: &mut Command,
    label: &str,
    timeout: Duration,
) -> Result<String, String> {
    command
        .env("PATH", extended_path_env())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("{} could not run: {}", label, error))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let stdout_reader = thread::spawn(move || drain_pipe(stdout));
    let stderr_reader = thread::spawn(move || drain_pipe(stderr));

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "{} timed out after {} minutes and was stopped. Check that Docker is running and try again.",
                        label,
                        timeout.as_secs() / 60
                    ));
                }
                thread::sleep(Duration::from_millis(150));
            }
            Err(error) => {
                return Err(format!("{} could not be monitored: {}", label, error));
            }
        }
    };

    let stdout_bytes = stdout_reader.join().unwrap_or_default();
    let stderr_bytes = stderr_reader.join().unwrap_or_default();
    let combined = combined_output(&stdout_bytes, &stderr_bytes);
    if status.success() {
        Ok(combined)
    } else {
        Err(format!("{} failed:\n{}", label, tail(&combined, 4000)))
    }
}

fn drain_pipe(pipe: Option<impl Read>) -> Vec<u8> {
    let mut buffer = Vec::new();
    if let Some(mut pipe) = pipe {
        let _ = pipe.read_to_end(&mut buffer);
    }
    buffer
}

fn read_frame_stream(path: &Path) -> Result<Vec<FramebufferFrame>, String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "Starter ROM frame stream was not created at {}: {}",
            path.display(),
            error
        )
    })?;
    let mut offset = 0;
    let mut frames = Vec::new();

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
        let frame_index = read_u64(&data, offset + 12)?;
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
                frames.len()
            ));
        }
        frames.push(FramebufferFrame {
            frame_index,
            width,
            height,
            format: "RGB565".to_string(),
            rgb565_data: general_purpose::STANDARD.encode(&data[payload_offset..next_offset]),
        });
        offset = next_offset;
    }

    if frames.is_empty() {
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

fn read_u64(data: &[u8], offset: usize) -> Result<u64, String> {
    let bytes = data
        .get(offset..offset + 8)
        .ok_or_else(|| format!("Missing u64 at byte {}", offset))?;
    Ok(u64::from_le_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    ]))
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
        assert_eq!(preview.frame_width, 320);
        assert_eq!(preview.frame_height, 240);
        assert_eq!(preview.streamed_frames, preview.framebuffer_frames.len());
        assert!(preview
            .framebuffer_frames
            .iter()
            .all(|frame| frame.format == "RGB565"));
        assert_eq!(preview.rom_path, "examples/app-starter-blank/out/rom.bin");
    }

    #[test]
    fn launch_rom_path_rejects_paths_outside_repo() {
        let temp_dir = std::env::temp_dir().join(format!(
            "drive16-rom-path-test-{}-{}",
            unix_timestamp(),
            std::process::id()
        ));
        fs::create_dir_all(&temp_dir).expect("temp dir should be created");
        let result = launch_rom_path_for_repo(temp_dir.clone(), "../outside.bin".to_string());
        fs::remove_dir_all(&temp_dir).expect("temp dir should be removed");

        assert!(result.is_err());
    }

    #[test]
    fn frame_stream_reader_decodes_rgb565_records() {
        let temp_dir = std::env::temp_dir().join(format!(
            "drive16-frame-stream-test-{}-{}",
            unix_timestamp(),
            std::process::id()
        ));
        fs::create_dir_all(&temp_dir).expect("temp dir should be created");
        let stream_path = temp_dir.join("frames.rgb565");
        let width = 320u16;
        let height = 240u16;
        let payload = vec![0x1f; width as usize * height as usize * 2];
        let mut stream = Vec::new();
        stream.extend_from_slice(b"D16F");
        stream.extend_from_slice(&1u16.to_le_bytes());
        stream.extend_from_slice(&width.to_le_bytes());
        stream.extend_from_slice(&height.to_le_bytes());
        stream.extend_from_slice(&565u16.to_le_bytes());
        stream.extend_from_slice(&42u64.to_le_bytes());
        stream.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        stream.extend_from_slice(&payload);
        fs::write(&stream_path, stream).expect("frame stream should be written");

        let frames = read_frame_stream(&stream_path).expect("frame stream should parse");
        fs::remove_dir_all(&temp_dir).expect("temp dir should be removed");

        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].frame_index, 42);
        assert_eq!(frames[0].width, 320);
        assert_eq!(frames[0].height, 240);
        assert_eq!(frames[0].format, "RGB565");
        assert_eq!(
            frames[0].rgb565_data,
            general_purpose::STANDARD.encode(payload)
        );
    }
}
