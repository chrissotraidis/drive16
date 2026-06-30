use crate::v1_prompt::{V1FramebufferFrame, V1PromptResult};
use base64::{engine::general_purpose, Engine as _};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const PROJECT_RELATIVE: &str = "artifacts/phase4/generated-music-prompt/project";
const ARTIFACT_DIR: &str = "artifacts/phase4/generated-music-prompt";
const FRAMES: u32 = 180;
const STREAM_EVERY: u32 = 30;
const FRAME_HEADER_BYTES: usize = 24;
const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";

struct Phase4MusicPaths {
    repo_root: PathBuf,
    project_path: PathBuf,
    artifact_dir: PathBuf,
    res_dir: PathBuf,
    src_dir: PathBuf,
    rom_path: PathBuf,
    mml_path: PathBuf,
    vgm_path: PathBuf,
    compile_log_path: PathBuf,
    neutral_screenshot_path: PathBuf,
    right_screenshot_path: PathBuf,
    audio_dump_path: PathBuf,
    frame_stream_path: PathBuf,
    input_script_path: PathBuf,
    build_sgdk_script: PathBuf,
    build_genteel_script: PathBuf,
    build_ctrmml_script: PathBuf,
    local_genteel_bin: PathBuf,
    sprite_movement_validator: PathBuf,
    fm_presets_path: PathBuf,
}

pub fn run_phase4_music_prompt(prompt: String) -> Result<V1PromptResult, String> {
    run_phase4_music_prompt_for_repo(repo_root(), prompt)
}

fn run_phase4_music_prompt_for_repo(
    repo_root: PathBuf,
    prompt: String,
) -> Result<V1PromptResult, String> {
    let paths = Phase4MusicPaths::new(repo_root);
    paths.prepare_project()?;
    compile_generated_music(&paths)?;
    build_rom(&paths)?;
    let genteel_bin = find_genteel_bin(&paths)?;

    remove_if_exists(&paths.neutral_screenshot_path)?;
    remove_if_exists(&paths.right_screenshot_path)?;
    remove_if_exists(&paths.audio_dump_path)?;
    remove_if_exists(&paths.frame_stream_path)?;
    fs::write(&paths.input_script_path, "0,...R....,........\n").map_err(|error| {
        format!(
            "Could not write Phase 4 input script {}: {}",
            paths.input_script_path.display(),
            error
        )
    })?;

    let mut neutral = Command::new(&genteel_bin);
    neutral
        .current_dir(&paths.repo_root)
        .arg("--headless")
        .arg(FRAMES.to_string())
        .arg("--stream-frames")
        .arg(&paths.frame_stream_path)
        .arg("--stream-every")
        .arg(STREAM_EVERY.to_string())
        .arg("--screenshot")
        .arg(&paths.neutral_screenshot_path)
        .arg(&paths.rom_path);
    run_command(&mut neutral, "Genteel Phase 4 music neutral run")?;

    let mut right = Command::new(&genteel_bin);
    right
        .current_dir(&paths.repo_root)
        .arg("--script")
        .arg(&paths.input_script_path)
        .arg("--headless")
        .arg(FRAMES.to_string())
        .arg("--screenshot")
        .arg(&paths.right_screenshot_path)
        .arg("--dump-audio")
        .arg(&paths.audio_dump_path)
        .arg(&paths.rom_path);
    run_command(&mut right, "Genteel Phase 4 music Right-input run")?;

    ensure_png(&paths.neutral_screenshot_path, "neutral screenshot")?;
    ensure_png(&paths.right_screenshot_path, "Right-input screenshot")?;
    let movement_detail = validate_sprite_movement(&paths)?;
    let audio_max_abs = wav_max_abs(&paths.audio_dump_path)?;
    if audio_max_abs == 0 {
        return Err("Phase 4 generated music audio dump is silent".to_string());
    }

    let framebuffer_frames = read_frame_stream(&paths.frame_stream_path)?;
    let first_frame = framebuffer_frames
        .first()
        .ok_or_else(|| "Phase 4 frame stream did not contain any frames".to_string())?;
    let frame_width = first_frame.width;
    let frame_height = first_frame.height;
    let streamed_frames = framebuffer_frames.len();
    let screenshot_bytes = fs::read(&paths.neutral_screenshot_path).map_err(|error| {
        format!(
            "Could not read Phase 4 screenshot {}: {}",
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
        detail: "Generated MML music and bundled sprite ROM verified".to_string(),
        generated_at: unix_timestamp(),
        prompt,
        project_path: PROJECT_RELATIVE.to_string(),
        rom_path: repo_relative(&paths.repo_root, &paths.rom_path),
        neutral_screenshot_path: repo_relative(&paths.repo_root, &paths.neutral_screenshot_path),
        right_screenshot_path: repo_relative(&paths.repo_root, &paths.right_screenshot_path),
        audio_dump_path: repo_relative(&paths.repo_root, &paths.audio_dump_path),
        frame_stream_path: repo_relative(&paths.repo_root, &paths.frame_stream_path),
        screenshot_data_url,
        frames: FRAMES,
        stream_every: STREAM_EVERY,
        streamed_frames,
        frame_width,
        frame_height,
        framebuffer_frames,
        movement_detail,
        audio_max_abs,
    })
}

impl Phase4MusicPaths {
    fn new(repo_root: PathBuf) -> Self {
        let artifact_dir = repo_root.join(ARTIFACT_DIR);
        let project_path = repo_root.join(PROJECT_RELATIVE);
        let res_dir = project_path.join("res");
        let src_dir = project_path.join("src");
        Self {
            rom_path: project_path.join("out/rom.bin"),
            mml_path: res_dir.join("generated_music.mml"),
            vgm_path: res_dir.join("generated_music.vgm"),
            compile_log_path: artifact_dir.join("generated-music.log"),
            neutral_screenshot_path: artifact_dir.join("phase4-music-neutral.png"),
            right_screenshot_path: artifact_dir.join("phase4-music-right.png"),
            audio_dump_path: artifact_dir.join("phase4-music-audio.wav"),
            frame_stream_path: artifact_dir.join("phase4-music-frames.rgb565"),
            input_script_path: artifact_dir.join("hold-right.csv"),
            build_sgdk_script: repo_root.join("scripts/build-sgdk.sh"),
            build_genteel_script: repo_root.join("scripts/build-genteel.sh"),
            build_ctrmml_script: repo_root.join("scripts/build-ctrmml.sh"),
            local_genteel_bin: repo_root
                .join("artifacts/phase0/genteel-src/target/release/genteel"),
            sprite_movement_validator: repo_root.join("scripts/validate-sprite-movement.py"),
            fm_presets_path: repo_root.join("assets/enhancements/mml/fm-presets.mml"),
            artifact_dir,
            project_path,
            res_dir,
            src_dir,
            repo_root,
        }
    }

    fn prepare_project(&self) -> Result<(), String> {
        if self.project_path.exists() {
            fs::remove_dir_all(&self.project_path).map_err(|error| {
                format!(
                    "Could not clear generated Phase 4 project {}: {}",
                    self.project_path.display(),
                    error
                )
            })?;
        }
        fs::create_dir_all(&self.res_dir).map_err(|error| {
            format!(
                "Could not create Phase 4 resource directory {}: {}",
                self.res_dir.display(),
                error
            )
        })?;
        fs::create_dir_all(&self.src_dir).map_err(|error| {
            format!(
                "Could not create Phase 4 source directory {}: {}",
                self.src_dir.display(),
                error
            )
        })?;
        fs::create_dir_all(&self.artifact_dir).map_err(|error| {
            format!(
                "Could not create Phase 4 artifact directory {}: {}",
                self.artifact_dir.display(),
                error
            )
        })?;
        fs::write(self.project_path.join("Makefile"), makefile()).map_err(|error| {
            format!(
                "Could not write Phase 4 Makefile in {}: {}",
                self.project_path.display(),
                error
            )
        })?;
        fs::write(self.src_dir.join("main.c"), main_c()).map_err(|error| {
            format!(
                "Could not write Phase 4 main.c in {}: {}",
                self.src_dir.display(),
                error
            )
        })?;
        fs::write(self.res_dir.join("resources.h"), resources_h()).map_err(|error| {
            format!(
                "Could not write Phase 4 resources.h in {}: {}",
                self.res_dir.display(),
                error
            )
        })?;
        fs::write(self.res_dir.join("resources.res"), resources_res()).map_err(|error| {
            format!(
                "Could not write Phase 4 resources.res in {}: {}",
                self.res_dir.display(),
                error
            )
        })
    }
}

fn makefile() -> &'static str {
    "GDK ?= /sgdk\n\ninclude $(GDK)/makefile.gen\n"
}

fn resources_res() -> &'static str {
    concat!(
        "SPRITE drive16_player \"../../../../../assets/core/player.png\" 4 4 NONE 0\n",
        "XGM drive16_generated_music \"generated_music.vgm\"\n",
    )
}

fn resources_h() -> &'static str {
    concat!(
        "#include <genesis.h>\n\n",
        "#ifndef _RES_RESOURCES_H_\n",
        "#define _RES_RESOURCES_H_\n\n",
        "extern const SpriteDefinition drive16_player;\n",
        "extern const u8 drive16_generated_music[512];\n\n",
        "#endif\n",
    )
}

fn main_c() -> &'static str {
    concat!(
        "#include <genesis.h>\n",
        "#include \"resources.h\"\n\n",
        "#define PLAYER_SPEED 2\n",
        "#define PLAYER_MIN_X 0\n",
        "#define PLAYER_MAX_X 288\n",
        "#define PLAYER_MIN_Y 24\n",
        "#define PLAYER_MAX_Y 192\n\n",
        "static Sprite *player;\n",
        "static s16 playerX = 144;\n",
        "static s16 playerY = 104;\n\n",
        "static void updatePlayer(void)\n",
        "{\n",
        "    const u16 joy = JOY_readJoypad(JOY_1);\n\n",
        "    if ((joy & BUTTON_LEFT) && (playerX > PLAYER_MIN_X))\n",
        "        playerX -= PLAYER_SPEED;\n",
        "    if ((joy & BUTTON_RIGHT) && (playerX < PLAYER_MAX_X))\n",
        "        playerX += PLAYER_SPEED;\n",
        "    if ((joy & BUTTON_UP) && (playerY > PLAYER_MIN_Y))\n",
        "        playerY -= PLAYER_SPEED;\n",
        "    if ((joy & BUTTON_DOWN) && (playerY < PLAYER_MAX_Y))\n",
        "        playerY += PLAYER_SPEED;\n\n",
        "    SPR_setPosition(player, playerX, playerY);\n",
        "}\n\n",
        "int main(bool hardReset)\n",
        "{\n",
        "    if (!hardReset)\n",
        "        SYS_hardReset();\n\n",
        "    JOY_init();\n",
        "    SPR_init();\n\n",
        "    PAL_setPalette(PAL1, drive16_player.palette->data, DMA);\n",
        "    VDP_setTextPalette(PAL1);\n",
        "    VDP_drawText(\"Drive16 Phase 4\", 9, 3);\n",
        "    VDP_drawText(\"Bundled sprite\", 5, 5);\n",
        "    VDP_drawText(\"Generated MML music\", 5, 24);\n\n",
        "    player = SPR_addSprite(&drive16_player, playerX, playerY, TILE_ATTR(PAL1, TRUE, FALSE, FALSE));\n",
        "    if (player == NULL)\n",
        "        SYS_die(\"Sprite allocation failed\");\n\n",
        "    XGM_startPlay(drive16_generated_music);\n\n",
        "    while (TRUE)\n",
        "    {\n",
        "        updatePlayer();\n",
        "        SPR_update();\n",
        "        SYS_doVBlankProcess();\n",
        "    }\n\n",
        "    return 0;\n",
        "}\n",
    )
}

fn compile_generated_music(paths: &Phase4MusicPaths) -> Result<(), String> {
    if !paths.fm_presets_path.is_file() {
        return Err(format!(
            "FM preset include is missing: {}",
            paths.fm_presets_path.display()
        ));
    }
    let presets = fs::read_to_string(&paths.fm_presets_path)
        .map_err(|error| format!("Could not read FM presets: {}", error))?;
    fs::write(&paths.mml_path, generated_mml(&presets)).map_err(|error| {
        format!(
            "Could not write generated MML {}: {}",
            paths.mml_path.display(),
            error
        )
    })?;

    let compiler = build_ctrmml(paths)?;
    let mut command = Command::new(&compiler);
    command
        .current_dir(&paths.repo_root)
        .arg("--output")
        .arg(&paths.vgm_path)
        .arg("--format")
        .arg("vgm")
        .arg(&paths.mml_path);
    let log = run_command(&mut command, "ctrmml generated music compile")?;
    fs::write(&paths.compile_log_path, &log).map_err(|error| {
        format!(
            "Could not write generated music compile log {}: {}",
            paths.compile_log_path.display(),
            error
        )
    })?;
    ensure_vgm(&paths.vgm_path)
}

fn generated_mml(presets: &str) -> String {
    format!(
        concat!(
            "#title Drive16 Generated MML Loop\n",
            "#platform megadrive\n\n",
            "{}\n",
            "A t128 @80 v13 o3 l8 c c g c >c< g c r L c4 r4\n",
            "B      @81 v11 o4 l8 c d e g a g e d L c4 r4\n",
            "C      @82 v8  o4 l4 c e g >c< L c2 r2\n",
        ),
        presets
    )
}

fn build_ctrmml(paths: &Phase4MusicPaths) -> Result<PathBuf, String> {
    if !paths.build_ctrmml_script.is_file() {
        return Err(format!(
            "ctrmml build script is missing: {}",
            paths.build_ctrmml_script.display()
        ));
    }
    let mut command = Command::new(&paths.build_ctrmml_script);
    command.current_dir(&paths.repo_root);
    let output = run_command(&mut command, "ctrmml build")?;
    let compiler = output
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .last()
        .map(PathBuf::from)
        .ok_or_else(|| "ctrmml build did not print a compiler path".to_string())?;
    if compiler.is_file() {
        Ok(compiler)
    } else {
        Err(format!(
            "ctrmml build did not create the expected compiler: {}",
            compiler.display()
        ))
    }
}

fn build_rom(paths: &Phase4MusicPaths) -> Result<(), String> {
    if !paths.build_sgdk_script.is_file() {
        return Err(format!(
            "SGDK build script is missing: {}",
            paths.build_sgdk_script.display()
        ));
    }

    let mut command = Command::new(&paths.build_sgdk_script);
    command.current_dir(&paths.repo_root).arg(PROJECT_RELATIVE);
    run_command(&mut command, "SGDK Phase 4 generated music ROM build")?;

    if paths.rom_path.is_file() {
        Ok(())
    } else {
        Err(format!(
            "SGDK build finished, but the Phase 4 ROM was not found: {}",
            paths.rom_path.display()
        ))
    }
}

fn find_genteel_bin(paths: &Phase4MusicPaths) -> Result<PathBuf, String> {
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

fn validate_sprite_movement(paths: &Phase4MusicPaths) -> Result<String, String> {
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
    run_command(&mut command, "Phase 4 sprite movement validation")
        .map(|output| tail(output.trim(), 240))
}

fn read_frame_stream(path: &Path) -> Result<Vec<V1FramebufferFrame>, String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "Phase 4 frame stream was not created at {}: {}",
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
        Err("Phase 4 frame stream did not contain any frames".to_string())
    } else {
        Ok(frames)
    }
}

fn wav_max_abs(path: &Path) -> Result<i16, String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "Phase 4 audio dump was not created at {}: {}",
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
    let data = fs::read(path)
        .map_err(|error| format!("Phase 4 {} missing at {}: {}", label, path.display(), error))?;
    if data.starts_with(PNG_SIGNATURE) {
        Ok(())
    } else {
        Err(format!(
            "Phase 4 {} is not a PNG: {}",
            label,
            path.display()
        ))
    }
}

fn ensure_vgm(path: &Path) -> Result<(), String> {
    let data = fs::read(path).map_err(|error| {
        format!(
            "Generated VGM was not created at {}: {}",
            path.display(),
            error
        )
    })?;
    if data.len() >= 0x30 && &data[0..4] == b"Vgm " {
        Ok(())
    } else {
        Err(format!(
            "Generated music is not a VGM file: {}",
            path.display()
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
    fn phase4_music_project_contract_uses_generated_music() {
        assert!(resources_res().contains("SPRITE drive16_player"));
        assert!(resources_res().contains("XGM drive16_generated_music"));
        assert!(main_c().contains("Drive16 Phase 4"));
        assert!(main_c().contains("Generated MML music"));
        assert!(main_c().contains("XGM_startPlay(drive16_generated_music)"));
        assert!(!resources_res().contains("drive16_loop"));
    }

    #[test]
    fn generated_mml_uses_drive16_presets() {
        let mml = generated_mml("@80 fm\n  0 0\n");
        assert!(mml.contains("#platform megadrive"));
        assert!(mml.contains("@80 v13"));
        assert!(mml.contains("@81 v11"));
        assert!(mml.contains("@82 v8"));
    }

    #[test]
    #[ignore = "builds a generated-MML ROM and runs Genteel with screenshots and audio"]
    fn phase4_music_prompt_runs_when_tools_are_available() {
        let result = run_phase4_music_prompt(
            "make a sprite I can move left and right with music".to_string(),
        )
        .expect("Phase 4 music prompt should run");

        assert_eq!(result.status, "ready");
        assert!(result
            .screenshot_data_url
            .starts_with("data:image/png;base64,"));
        assert!(result.streamed_frames >= 1);
        assert!(result.audio_max_abs > 0);
        assert!(result
            .rom_path
            .ends_with("artifacts/phase4/generated-music-prompt/project/out/rom.bin"));
    }
}
