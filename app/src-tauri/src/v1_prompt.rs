use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const AGENT_PROJECT: &str = "artifacts/phase2/agent-loop/project";
const REFERENCE_PROJECT: &str = "examples/phase2-core-assets";
const V1_ARTIFACT_DIR: &str = "artifacts/phase3/v1-prompt";
const V1_FRAMES: u32 = 180;
const STREAM_EVERY: u32 = 30;
const FRAME_HEADER_BYTES: usize = 24;
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct V1PromptResult {
    pub status: String,
    pub detail: String,
    pub generated_at: String,
    pub prompt: String,
    pub project_path: String,
    pub rom_path: String,
    pub neutral_screenshot_path: String,
    pub right_screenshot_path: String,
    pub audio_dump_path: String,
    pub frame_stream_path: String,
    pub screenshot_data_url: String,
    pub frames: u32,
    pub stream_every: u32,
    pub streamed_frames: usize,
    pub frame_width: u16,
    pub frame_height: u16,
    pub framebuffer_frames: Vec<V1FramebufferFrame>,
    pub movement_detail: String,
    pub audio_max_abs: i16,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct V1FramebufferFrame {
    pub frame_index: u64,
    pub width: u16,
    pub height: u16,
    pub format: String,
    pub rgb565_data: String,
}

struct V1Paths {
    repo_root: PathBuf,
    project_relative: String,
    project_path: PathBuf,
    rom_path: PathBuf,
    artifact_dir: PathBuf,
    neutral_screenshot_path: PathBuf,
    right_screenshot_path: PathBuf,
    audio_dump_path: PathBuf,
    frame_stream_path: PathBuf,
    input_script_path: PathBuf,
    build_sgdk_script: PathBuf,
    build_genteel_script: PathBuf,
    local_genteel_bin: PathBuf,
    core_asset_validator: PathBuf,
    sprite_movement_validator: PathBuf,
}

pub fn run_v1_prompt(prompt: String) -> Result<V1PromptResult, String> {
    run_v1_prompt_for_repo(repo_root(), prompt)
}

fn run_v1_prompt_for_repo(repo_root: PathBuf, prompt: String) -> Result<V1PromptResult, String> {
    let paths = V1Paths::new(repo_root);
    paths.ensure_artifact_dir()?;
    verify_project_contract(&paths)?;
    validate_core_assets(&paths)?;
    build_core_rom(&paths)?;
    let genteel_bin = find_genteel_bin(&paths)?;

    remove_if_exists(&paths.neutral_screenshot_path)?;
    remove_if_exists(&paths.right_screenshot_path)?;
    remove_if_exists(&paths.audio_dump_path)?;
    remove_if_exists(&paths.frame_stream_path)?;
    fs::write(&paths.input_script_path, "0,...R....,........\n").map_err(|error| {
        format!(
            "Could not write v1 prompt input script {}: {}",
            paths.input_script_path.display(),
            error
        )
    })?;

    let mut neutral = Command::new(&genteel_bin);
    neutral
        .current_dir(&paths.repo_root)
        .arg("--headless")
        .arg(V1_FRAMES.to_string())
        .arg("--stream-frames")
        .arg(&paths.frame_stream_path)
        .arg("--stream-every")
        .arg(STREAM_EVERY.to_string())
        .arg("--screenshot")
        .arg(&paths.neutral_screenshot_path)
        .arg(&paths.rom_path);
    run_command(&mut neutral, "Genteel v1 prompt neutral run")?;

    let mut right = Command::new(&genteel_bin);
    right
        .current_dir(&paths.repo_root)
        .arg("--script")
        .arg(&paths.input_script_path)
        .arg("--headless")
        .arg(V1_FRAMES.to_string())
        .arg("--screenshot")
        .arg(&paths.right_screenshot_path)
        .arg("--dump-audio")
        .arg(&paths.audio_dump_path)
        .arg(&paths.rom_path);
    run_command(&mut right, "Genteel v1 prompt Right-input run")?;

    ensure_png(&paths.neutral_screenshot_path, "neutral screenshot")?;
    ensure_png(&paths.right_screenshot_path, "Right-input screenshot")?;
    let movement_detail = validate_sprite_movement(&paths)?;
    let audio_max_abs = wav_max_abs(&paths.audio_dump_path)?;
    if audio_max_abs == 0 {
        return Err("V1 prompt audio dump is silent".to_string());
    }

    let framebuffer_frames = read_frame_stream(&paths.frame_stream_path)?;
    let first_frame = framebuffer_frames
        .first()
        .ok_or_else(|| "V1 prompt frame stream did not contain any frames".to_string())?;
    let frame_width = first_frame.width;
    let frame_height = first_frame.height;
    let streamed_frames = framebuffer_frames.len();
    let screenshot_bytes = fs::read(&paths.neutral_screenshot_path).map_err(|error| {
        format!(
            "Could not read v1 prompt screenshot {}: {}",
            paths.neutral_screenshot_path.display(),
            error
        )
    })?;
    let screenshot_data_url = format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(screenshot_bytes)
    );

    Ok(V1PromptResult {
        status: "ready".to_string(),
        detail: "Bundled sprite and music ROM verified".to_string(),
        generated_at: unix_timestamp(),
        prompt,
        project_path: repo_relative(&paths.repo_root, &paths.project_path),
        rom_path: repo_relative(&paths.repo_root, &paths.rom_path),
        neutral_screenshot_path: repo_relative(&paths.repo_root, &paths.neutral_screenshot_path),
        right_screenshot_path: repo_relative(&paths.repo_root, &paths.right_screenshot_path),
        audio_dump_path: repo_relative(&paths.repo_root, &paths.audio_dump_path),
        frame_stream_path: repo_relative(&paths.repo_root, &paths.frame_stream_path),
        screenshot_data_url,
        frames: V1_FRAMES,
        stream_every: STREAM_EVERY,
        streamed_frames,
        frame_width,
        frame_height,
        framebuffer_frames,
        movement_detail,
        audio_max_abs,
    })
}

impl V1Paths {
    fn new(repo_root: PathBuf) -> Self {
        let artifact_dir = repo_root.join(V1_ARTIFACT_DIR);
        let project_relative = select_core_project(&repo_root);
        let project_path = repo_root.join(&project_relative);
        Self {
            rom_path: project_path.join("out/rom.bin"),
            neutral_screenshot_path: artifact_dir.join("v1-neutral.png"),
            right_screenshot_path: artifact_dir.join("v1-right.png"),
            audio_dump_path: artifact_dir.join("v1-audio.wav"),
            frame_stream_path: artifact_dir.join("v1-frames.rgb565"),
            input_script_path: artifact_dir.join("hold-right.csv"),
            build_sgdk_script: repo_root.join("scripts/build-sgdk.sh"),
            build_genteel_script: repo_root.join("scripts/build-genteel.sh"),
            local_genteel_bin: repo_root
                .join("artifacts/phase0/genteel-src/target/release/genteel"),
            core_asset_validator: repo_root.join("scripts/validate-core-assets.py"),
            sprite_movement_validator: repo_root.join("scripts/validate-sprite-movement.py"),
            artifact_dir,
            project_relative,
            project_path,
            repo_root,
        }
    }

    fn ensure_artifact_dir(&self) -> Result<(), String> {
        fs::create_dir_all(&self.artifact_dir).map_err(|error| {
            format!(
                "Could not create v1 prompt artifact directory {}: {}",
                self.artifact_dir.display(),
                error
            )
        })
    }
}

fn verify_project_contract(paths: &V1Paths) -> Result<(), String> {
    let source = read_text(&paths.project_path.join("src/main.c"))?;
    require_terms(
        "v1 prompt source",
        &source,
        &[
            "Drive16 Phase 2",
            "drive16_player",
            "drive16_loop",
            "JOY_readJoypad",
            "SPR_addSprite",
            "SPR_update",
            "XGM_startPlay",
        ],
    )?;
    if source.contains("ComfyUI") || source.contains("MML") {
        return Err("V1 prompt source must stay on CORE bundled assets".to_string());
    }

    let resources = read_text(&paths.project_path.join("res/resources.res"))?;
    require_terms(
        "v1 prompt resources",
        &resources,
        &[
            "SPRITE drive16_player",
            "XGM drive16_loop",
            "assets/core/player.png",
            "assets/core/loop.vgm",
        ],
    )?;

    Ok(())
}

fn validate_core_assets(paths: &V1Paths) -> Result<(), String> {
    if !paths.core_asset_validator.is_file() {
        return Err(format!(
            "Core asset validator is missing: {}",
            paths.core_asset_validator.display()
        ));
    }

    let mut command = Command::new(&paths.core_asset_validator);
    command.current_dir(&paths.repo_root);
    run_command(&mut command, "CORE asset validation").map(|_| ())
}

fn build_core_rom(paths: &V1Paths) -> Result<(), String> {
    if !paths.build_sgdk_script.is_file() {
        return Err(format!(
            "SGDK build script is missing: {}",
            paths.build_sgdk_script.display()
        ));
    }

    let mut command = Command::new(&paths.build_sgdk_script);
    command
        .current_dir(&paths.repo_root)
        .arg(&paths.project_relative);
    run_command(&mut command, "SGDK v1 prompt ROM build")?;

    if paths.rom_path.is_file() {
        Ok(())
    } else {
        Err(format!(
            "SGDK build finished, but the v1 prompt ROM was not found: {}",
            paths.rom_path.display()
        ))
    }
}

fn find_genteel_bin(paths: &V1Paths) -> Result<PathBuf, String> {
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
        .last()
        .map(PathBuf::from)
        .ok_or_else(|| "Genteel build did not print a binary path".to_string())?;
    if printed_path.is_file() {
        Ok(printed_path)
    } else {
        Err(format!(
            "Genteel build did not create the expected binary: {}",
            printed_path.display()
        ))
    }
}

fn select_core_project(repo_root: &Path) -> String {
    let agent_project = repo_root.join(AGENT_PROJECT);
    if agent_project.join("src/main.c").is_file()
        && agent_project.join("res/resources.res").is_file()
    {
        AGENT_PROJECT.to_string()
    } else {
        REFERENCE_PROJECT.to_string()
    }
}

fn validate_sprite_movement(paths: &V1Paths) -> Result<String, String> {
    if !paths.sprite_movement_validator.is_file() {
        return Err(format!(
            "Sprite movement validator is missing: {}",
            paths.sprite_movement_validator.display()
        ));
    }

    let mut command = Command::new(&paths.sprite_movement_validator);
    command
        .current_dir(&paths.repo_root)
        .arg(&paths.neutral_screenshot_path)
        .arg(&paths.right_screenshot_path)
        .arg("--direction")
        .arg("right")
        .arg("--min-delta")
        .arg("24")
        .arg("--min-changed")
        .arg("40");
    run_command(&mut command, "V1 prompt sprite movement validation")
        .map(|output| tail(output.trim(), 240))
}

fn read_frame_stream(path: &Path) -> Result<Vec<V1FramebufferFrame>, String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "V1 prompt frame stream was not created at {}: {}",
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

        frames.push(V1FramebufferFrame {
            frame_index,
            width,
            height,
            format: "RGB565".to_string(),
            rgb565_data: general_purpose::STANDARD.encode(&data[payload_offset..next_offset]),
        });
        offset = next_offset;
    }

    if frames.is_empty() {
        Err("V1 prompt frame stream did not contain any frames".to_string())
    } else {
        Ok(frames)
    }
}

fn wav_max_abs(path: &Path) -> Result<i16, String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "V1 prompt audio dump was not created at {}: {}",
            path.display(),
            error
        )
    })?;
    if data.len() < 44 || &data[0..4] != b"RIFF" || &data[8..12] != b"WAVE" {
        return Err(format!("Audio dump is not a WAV file: {}", path.display()));
    }

    let mut offset = 12;
    while offset + 8 <= data.len() {
        let chunk_id = &data[offset..offset + 4];
        let chunk_len = read_u32(&data, offset + 4)? as usize;
        let chunk_start = offset + 8;
        let chunk_end = chunk_start + chunk_len;
        if chunk_end > data.len() {
            return Err("WAV chunk is truncated".to_string());
        }

        if chunk_id == b"data" {
            let mut max_abs = 0i16;
            for index in (chunk_start..chunk_end.saturating_sub(1)).step_by(2) {
                let sample = i16::from_le_bytes([data[index], data[index + 1]]);
                max_abs = max_abs.max(sample.saturating_abs());
            }
            return Ok(max_abs);
        }

        offset = chunk_end + (chunk_len % 2);
    }

    Err("WAV file did not include a data chunk".to_string())
}

fn ensure_png(path: &Path, label: &str) -> Result<(), String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "V1 prompt {} missing at {}: {}",
            label,
            path.display(),
            error
        )
    })?;
    if data.starts_with(PNG_SIGNATURE) {
        Ok(())
    } else {
        Err(format!(
            "V1 prompt {} is not a PNG: {}",
            label,
            path.display()
        ))
    }
}

fn read_text(path: &Path) -> Result<String, String> {
    fs::read_to_string(path)
        .map_err(|error| format!("Could not read {}: {}", path.display(), error))
}

fn require_terms(label: &str, text: &str, terms: &[&str]) -> Result<(), String> {
    let missing: Vec<&str> = terms
        .iter()
        .copied()
        .filter(|term| !text.contains(term))
        .collect();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!("{} missing expected terms: {:?}", label, missing))
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
    fn v1_prompt_fixture_contains_core_contract() {
        let paths = V1Paths::new(repo_root());

        verify_project_contract(&paths).expect("CORE fixture should satisfy v1 prompt contract");
    }

    #[test]
    fn v1_frame_stream_reader_decodes_rgb565_records() {
        let temp_dir = temp_dir("frames");
        fs::create_dir_all(&temp_dir).unwrap();
        let stream_path = temp_dir.join("frames.rgb565");
        let width = 320u16;
        let height = 240u16;
        let payload = vec![0x7f; width as usize * height as usize * 2];
        let mut stream = Vec::new();
        stream.extend_from_slice(b"D16F");
        stream.extend_from_slice(&1u16.to_le_bytes());
        stream.extend_from_slice(&width.to_le_bytes());
        stream.extend_from_slice(&height.to_le_bytes());
        stream.extend_from_slice(&565u16.to_le_bytes());
        stream.extend_from_slice(&30u64.to_le_bytes());
        stream.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        stream.extend_from_slice(&payload);
        fs::write(&stream_path, stream).unwrap();

        let frames = read_frame_stream(&stream_path).expect("frame stream should parse");
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0].frame_index, 30);
        assert_eq!(frames[0].format, "RGB565");
        assert_eq!(
            frames[0].rgb565_data,
            general_purpose::STANDARD.encode(payload)
        );
    }

    #[test]
    fn wav_max_abs_reads_pcm_data_chunk() {
        let temp_dir = temp_dir("wav");
        fs::create_dir_all(&temp_dir).unwrap();
        let wav_path = temp_dir.join("audio.wav");
        fs::write(&wav_path, tiny_wav(&[-5, 12, -22, 4])).unwrap();

        let max_abs = wav_max_abs(&wav_path).expect("WAV should parse");
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(max_abs, 22);
    }

    #[test]
    #[ignore = "builds the CORE ROM and runs Genteel with screenshots and audio"]
    fn v1_prompt_runs_core_asset_rom_when_tools_are_available() {
        let result =
            run_v1_prompt("make a sprite I can move left and right with music".to_string())
                .expect("v1 prompt should run");

        assert_eq!(result.status, "ready");
        assert!(result
            .screenshot_data_url
            .starts_with("data:image/png;base64,"));
        assert!(result.streamed_frames >= 1);
        assert!(result.audio_max_abs > 0);
        assert!(result.rom_path.ends_with("/out/rom.bin"));
    }

    fn temp_dir(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "drive16-v1-{}-{}-{}",
            label,
            unix_timestamp(),
            std::process::id()
        ))
    }

    fn tiny_wav(samples: &[i16]) -> Vec<u8> {
        let data_len = samples.len() * 2;
        let mut wav = Vec::new();
        wav.extend_from_slice(b"RIFF");
        wav.extend_from_slice(&(36 + data_len as u32).to_le_bytes());
        wav.extend_from_slice(b"WAVEfmt ");
        wav.extend_from_slice(&16u32.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&1u16.to_le_bytes());
        wav.extend_from_slice(&44100u32.to_le_bytes());
        wav.extend_from_slice(&(44100u32 * 2).to_le_bytes());
        wav.extend_from_slice(&2u16.to_le_bytes());
        wav.extend_from_slice(&16u16.to_le_bytes());
        wav.extend_from_slice(b"data");
        wav.extend_from_slice(&(data_len as u32).to_le_bytes());
        for sample in samples {
            wav.extend_from_slice(&sample.to_le_bytes());
        }
        wav
    }
}
