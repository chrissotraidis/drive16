use crate::runtime::repo_root;
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const STARTER_PROJECT: &str = "examples/app-starter-blank";
const STARTER_ROM: &str = "examples/app-starter-blank/out/rom.bin";
const SNAKE_BASIC_SKELETON: &str = "examples/game-skeletons/snake-basic";
const PONG_BASIC_SKELETON: &str = "examples/game-skeletons/pong-basic";
const TETRIS_BASIC_SKELETON: &str = "examples/game-skeletons/tetris-basic";
const ASTEROIDS_BASIC_SKELETON: &str = "examples/game-skeletons/asteroids-basic";
const ACTIVE_PROJECT_DIRECTORY: &str = "artifacts/phase3/active-project";
const EXPORT_DIRECTORY: &str = "artifacts/phase3/exports";
const PROJECT_SAVE_DIRECTORY: &str = "artifacts/phase3/projects";
const ROM_IMPORT_DIRECTORY: &str = "artifacts/phase5/imports";
const PROJECT_MEMORY_FILES: [&str; 3] = ["GAME.md", "ASSETS.md", "PLAYTEST.md"];
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
const MAX_ASSET_PREVIEW_BYTES: u64 = 512 * 1024;

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
    pub asset_roles: Vec<ProjectAssetRole>,
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
pub struct ProjectAssetRole {
    pub role: String,
    pub source: String,
    pub symbol: String,
    pub status: String,
    pub notes: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_data_url: Option<String>,
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
    pub agent_project_path: String,
    pub rom_path: String,
    pub rom_exists: bool,
    pub created: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptSeedResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub project_path: String,
    pub rom_path: String,
    pub applied: bool,
    pub source: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMemoryAuditResult {
    pub generated_at: String,
    pub status: String,
    pub detail: String,
    pub project_path: String,
    pub gate: String,
    pub files: Vec<ProjectMemoryFileStatus>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMemoryFileStatus {
    pub name: String,
    pub status: String,
    pub detail: String,
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

pub fn seed_active_project_for_prompt(prompt: String) -> Result<PromptSeedResult, String> {
    seed_active_project_for_prompt_in_repo(repo_root(), &prompt)
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
    };
    ensure_active_project_for_repo(root)
}

fn seed_active_project_for_prompt_in_repo(
    repo_root: PathBuf,
    prompt: &str,
) -> Result<PromptSeedResult, String> {
    let active = repo_root.join(ACTIVE_PROJECT_DIRECTORY);
    let rom_path = active.join("out").join("rom.bin");
    let project_path = repo_relative(&repo_root, &active);
    let rom_path_label = repo_relative(&repo_root, &rom_path);

    let seed = if looks_like_simple_snake_request(prompt) {
        Some((
            "Snake",
            SNAKE_BASIC_SKELETON,
            "Loaded the simple Snake starter code and audio loop into the blank project",
        ))
    } else if looks_like_simple_pong_request(prompt) {
        Some((
            "Pong",
            PONG_BASIC_SKELETON,
            "Loaded the simple Pong starter code and audio loop into the blank project",
        ))
    } else if looks_like_simple_tetris_request(prompt) {
        Some((
            "Tetris",
            TETRIS_BASIC_SKELETON,
            "Loaded the simple Tetris starter code and audio loop into the blank project",
        ))
    } else if looks_like_simple_asteroids_request(prompt) {
        Some((
            "Asteroids",
            ASTEROIDS_BASIC_SKELETON,
            "Loaded the simple Asteroids starter code and audio loop into the blank project",
        ))
    } else {
        None
    };

    let Some((seed_label, seed_source, seed_detail)) = seed else {
        return Ok(PromptSeedResult {
            generated_at: unix_timestamp(),
            status: "skipped".to_string(),
            detail: "No starter seed matched this prompt".to_string(),
            project_path,
            rom_path: rom_path_label,
            applied: false,
            source: None,
        });
    };

    ensure_active_project_for_repo(repo_root.clone())?;

    let main_path = active.join("src").join("main.c");
    let current = fs::read_to_string(&main_path).map_err(|error| {
        format!(
            "Could not read active project source {}: {}",
            main_path.display(),
            error
        )
    })?;
    if !looks_like_blank_starter_main(&current) {
        return Ok(PromptSeedResult {
            generated_at: unix_timestamp(),
            status: "skipped".to_string(),
            detail: "Active project already has game code; starter seed not applied".to_string(),
            project_path,
            rom_path: rom_path_label,
            applied: false,
            source: None,
        });
    }

    let skeleton_path = repo_root.join(seed_source);
    if !skeleton_path.is_dir() {
        return Err(format!(
            "{} starter seed is missing: {}",
            seed_label,
            skeleton_path.display()
        ));
    }

    copy_project_tree(&skeleton_path, &active)?;
    remove_project_build_output(&active)?;

    Ok(PromptSeedResult {
        generated_at: unix_timestamp(),
        status: "seeded".to_string(),
        detail: seed_detail.to_string(),
        project_path,
        rom_path: rom_path_label,
        applied: true,
        source: Some(seed_source.to_string()),
    })
}

pub fn audit_active_project_memory() -> ProjectMemoryAuditResult {
    audit_project_memory_for_repo(repo_root())
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
        remove_project_build_output(&active)?;
        true
    };
    ensure_project_memory_files(&starter, &active)?;

    let rom_path = active.join("out").join("rom.bin");
    let rom_file_exists = rom_path.is_file();
    let rom_current = current_project_rom_exists(&active, &rom_path);
    Ok(ActiveProjectResult {
        generated_at: unix_timestamp(),
        status: if rom_file_exists && !rom_current {
            "stale".to_string()
        } else {
            "ready".to_string()
        },
        detail: if rom_file_exists && !rom_current {
            "Source changed after the last ROM build".to_string()
        } else if created {
            "Active project created from the starter template".to_string()
        } else {
            "Active project is ready".to_string()
        },
        project_path: repo_relative(&repo_root, &active),
        agent_project_path: active.to_string_lossy().into_owned(),
        rom_path: repo_relative(&repo_root, &rom_path),
        rom_exists: rom_current,
        created,
    })
}

fn audit_project_memory_for_repo(repo_root: PathBuf) -> ProjectMemoryAuditResult {
    let active = repo_root.join(ACTIVE_PROJECT_DIRECTORY);
    let mut files = Vec::new();
    let mut missing = false;
    let mut warnings = Vec::new();
    let mut game_text = String::new();
    let mut assets_text = String::new();
    let mut playtest_text = String::new();

    for file_name in PROJECT_MEMORY_FILES {
        let file_path = active.join(file_name);
        match fs::read_to_string(&file_path) {
            Ok(text) => {
                if file_name == "GAME.md" {
                    game_text = text.clone();
                }
                if file_name == "ASSETS.md" {
                    assets_text = text.clone();
                }
                if file_name == "PLAYTEST.md" {
                    playtest_text = text.clone();
                }
                let detail = match file_name {
                    "ASSETS.md" if !looks_like_asset_role_ledger(&text) => {
                        warnings.push("ASSETS.md is missing a role ledger table".to_string());
                        "Role ledger table missing".to_string()
                    }
                    "PLAYTEST.md" if playability_gate_status(&text) == "unknown" => {
                        warnings
                            .push("PLAYTEST.md is missing Playability gate: PASS/FAIL".to_string());
                        "Gate verdict missing".to_string()
                    }
                    _ => "Present".to_string(),
                };
                files.push(ProjectMemoryFileStatus {
                    name: file_name.to_string(),
                    status: if detail == "Present" {
                        "ready".to_string()
                    } else {
                        "warning".to_string()
                    },
                    detail,
                });
            }
            Err(error) => {
                missing = true;
                files.push(ProjectMemoryFileStatus {
                    name: file_name.to_string(),
                    status: "missing".to_string(),
                    detail: format!("Could not read {}: {}", file_name, error),
                });
            }
        }
    }

    let gate = playability_gate_status(&playtest_text);
    warnings.extend(project_memory_truth_warnings(
        &active,
        &gate,
        &game_text,
        &assets_text,
        &playtest_text,
    ));
    if gate == "pass" {
        warnings.extend(project_memory_pass_warnings(
            &game_text,
            &assets_text,
            &playtest_text,
        ));
    }
    let status = if missing {
        "missing"
    } else if gate == "pass" && warnings.is_empty() {
        "ready"
    } else {
        "warning"
    };
    let detail = if missing {
        "Project memory files are missing".to_string()
    } else if !warnings.is_empty() {
        warnings.join("; ")
    } else if gate == "pass" {
        "Project memory reports Playability gate: PASS".to_string()
    } else if gate == "fail" {
        "Project memory reports Playability gate: FAIL".to_string()
    } else {
        "PLAYTEST.md is missing Playability gate: PASS/FAIL".to_string()
    };

    ProjectMemoryAuditResult {
        generated_at: unix_timestamp(),
        status: status.to_string(),
        detail,
        project_path: repo_relative(&repo_root, &active),
        gate,
        files,
    }
}

fn looks_like_asset_role_ledger(text: &str) -> bool {
    text.contains("| Role | Source | Symbol / File | Status | Notes |")
}

fn asset_roles_for_project(repo_root: &Path, project_path: &Path) -> Vec<ProjectAssetRole> {
    fs::read_to_string(project_path.join("ASSETS.md"))
        .map(|text| {
            parse_asset_role_table(&text)
                .into_iter()
                .map(|mut asset| {
                    asset.preview_data_url =
                        asset_preview_data_url(repo_root, project_path, &asset.symbol);
                    asset
                })
                .collect()
        })
        .unwrap_or_default()
}

fn parse_asset_role_table(text: &str) -> Vec<ProjectAssetRole> {
    text.lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with('|') || !trimmed.ends_with('|') {
                return None;
            }

            let columns: Vec<String> = trimmed
                .trim_matches('|')
                .split('|')
                .map(|column| column.trim().to_string())
                .collect();
            if columns.len() < 5 {
                return None;
            }

            let role = columns[0].trim();
            if role.eq_ignore_ascii_case("role") || role.chars().all(|character| character == '-') {
                return None;
            }

            Some(ProjectAssetRole {
                role: columns[0].clone(),
                source: columns[1].clone(),
                symbol: columns[2].clone(),
                status: columns[3].clone(),
                notes: columns[4..].join(" | "),
                preview_data_url: None,
            })
        })
        .collect()
}

fn asset_preview_data_url(repo_root: &Path, project_path: &Path, symbol: &str) -> Option<String> {
    let symbol_path = clean_asset_symbol_path(symbol)?;
    if !symbol_path.to_ascii_lowercase().ends_with(".png") {
        return None;
    }

    let symbol_path = Path::new(&symbol_path);
    let mut candidates = Vec::new();
    if symbol_path.is_absolute() {
        candidates.push(symbol_path.to_path_buf());
    } else {
        candidates.push(project_path.join(symbol_path));
        candidates.push(repo_root.join(symbol_path));
    }

    let canonical_repo = repo_root.canonicalize().ok()?;
    for candidate in candidates {
        let Ok(canonical_candidate) = candidate.canonicalize() else {
            continue;
        };
        if !canonical_candidate.starts_with(&canonical_repo) {
            continue;
        }

        let Ok(metadata) = fs::metadata(&canonical_candidate) else {
            continue;
        };
        if !metadata.is_file() || metadata.len() > MAX_ASSET_PREVIEW_BYTES {
            continue;
        }

        let Ok(bytes) = fs::read(&canonical_candidate) else {
            continue;
        };
        if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            continue;
        }

        return Some(format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(bytes)
        ));
    }

    None
}

fn clean_asset_symbol_path(symbol: &str) -> Option<String> {
    let trimmed = symbol.trim();
    if trimmed.is_empty() || trimmed.contains("://") {
        return None;
    }

    if let Some(start) = trimmed.find('`') {
        let rest = &trimmed[start + 1..];
        if let Some(end) = rest.find('`') {
            let code_path = rest[..end].trim();
            if !code_path.is_empty() {
                return Some(code_path.to_string());
            }
        }
    }

    if let Some(open) = trimmed.rfind("](") {
        if trimmed.ends_with(')') {
            let markdown_path = trimmed[open + 2..trimmed.len() - 1].trim();
            if !markdown_path.is_empty() {
                return Some(markdown_path.to_string());
            }
        }
    }

    let unquoted = trimmed
        .trim_matches('`')
        .trim_matches('"')
        .trim_matches('\'')
        .trim();
    if unquoted.is_empty() {
        None
    } else {
        Some(unquoted.to_string())
    }
}

fn project_name_for_project(project_path: &Path) -> String {
    let text = match fs::read_to_string(project_path.join("GAME.md")) {
        Ok(text) => text,
        Err(_) => return "Starter Project".to_string(),
    };
    let lower = text.to_ascii_lowercase();
    if lower.contains("blank drive16 starter project") {
        return "Starter Project".to_string();
    }

    for (needle, name) in [
        ("space invaders", "Space Invaders"),
        ("asteroids", "Asteroids"),
        ("asteroid", "Asteroids"),
        ("breakout", "Breakout"),
        ("tetris", "Tetris"),
        ("snake", "Snake"),
        ("pong", "Pong"),
        ("platformer", "Platformer"),
    ] {
        if lower.contains(needle) {
            return name.to_string();
        }
    }

    let mut in_concept = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.eq_ignore_ascii_case("## Concept") {
            in_concept = true;
            continue;
        }
        if in_concept && trimmed.starts_with("## ") {
            break;
        }
        if in_concept && !trimmed.is_empty() && !trimmed.starts_with('#') {
            return concise_project_name(trimmed);
        }
    }

    "Active Project".to_string()
}

fn concise_project_name(text: &str) -> String {
    let cleaned = text
        .trim_start_matches(['-', '*', ' '])
        .trim()
        .trim_end_matches('.');
    let first_sentence = cleaned.split(['.', ':']).next().unwrap_or(cleaned).trim();
    if first_sentence.chars().count() <= 36 {
        return first_sentence.to_string();
    }

    let mut name = first_sentence.chars().take(33).collect::<String>();
    name.push_str("...");
    name
}

fn playability_gate_status(text: &str) -> String {
    let mut gate = "unknown";
    for line in text.lines() {
        let lower = line.trim().to_ascii_lowercase();
        if !lower.starts_with("playability gate:") {
            continue;
        }
        if lower.contains("pass") {
            gate = "pass";
        } else if lower.contains("fail") {
            gate = "fail";
        }
    }
    gate.to_string()
}

fn project_memory_pass_warnings(
    game_text: &str,
    assets_text: &str,
    playtest_text: &str,
) -> Vec<String> {
    let mut warnings = Vec::new();
    let evidence = markdown_section(playtest_text, "Evidence");
    let evidence_lower = evidence.to_ascii_lowercase();

    if evidence.trim().is_empty() {
        warnings.push("PLAYTEST.md pass is missing an Evidence section".to_string());
    }

    if evidence_has_unfinished_marker(&evidence_lower) {
        warnings.push("PLAYTEST.md pass still has pending or untested evidence".to_string());
    }

    for field in missing_quality_review_fields(playtest_text) {
        warnings.push(format!(
            "PLAYTEST.md pass is missing a specific Quality Review observation for {}",
            field
        ));
    }

    let combined_text = format!("{}\n{}", game_text, playtest_text);
    let genre = detected_game_genre(&combined_text);
    if genre != "unknown"
        && (!evidence_lower.contains("genre checks:")
            || !evidence_lower.contains(genre)
            || evidence_lower.contains("genre checks: pending"))
    {
        warnings.push(format!(
            "PLAYTEST.md pass is missing {} genre evidence",
            genre
        ));
    }

    if !has_captured_or_omitted_audio(assets_text, playtest_text) {
        warnings.push(
            "PLAYTEST.md pass does not record captured audio or an explicit no-audio request"
                .to_string(),
        );
    }

    warnings
}

fn project_memory_truth_warnings(
    project_path: &Path,
    gate: &str,
    game_text: &str,
    assets_text: &str,
    playtest_text: &str,
) -> Vec<String> {
    let mut warnings = Vec::new();
    let game_lower = game_text.to_ascii_lowercase();
    let combined = format!("{}\n{}\n{}", game_text, assets_text, playtest_text);
    let combined_lower = combined.to_ascii_lowercase();
    let rom_exists = project_path.join("out/rom.bin").is_file();

    if !rom_exists
        && game_lower.lines().any(|line| {
            line.contains("out/rom.bin")
                && (line.contains("built")
                    || line.contains("compiled")
                    || line.contains("ready")
                    || line.contains("produced")
                    || line.contains("fresh"))
        })
    {
        warnings.push(
            "GAME.md claims out/rom.bin is built, but out/rom.bin does not exist".to_string(),
        );
    }

    if gate != "pass"
        && game_lower.contains("known issues")
        && (game_lower.contains("none yet") || game_lower.contains("no known issues"))
    {
        warnings.push(
            "GAME.md claims there are no known issues while PLAYTEST.md does not pass".to_string(),
        );
    }

    if audio_self_omitted_without_user_request(&combined_lower) {
        warnings.push(
            "Project memory claims audio was omitted without an explicit user no-audio request"
                .to_string(),
        );
    }

    warnings
}

fn markdown_section(text: &str, heading: &str) -> String {
    let heading_marker = format!("## {}", heading).to_ascii_lowercase();
    let mut in_section = false;
    let mut section = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.to_ascii_lowercase() == heading_marker {
            in_section = true;
            continue;
        }
        if in_section && trimmed.starts_with("## ") {
            break;
        }
        if in_section {
            section.push(line);
        }
    }
    section.join("\n")
}

fn evidence_has_unfinished_marker(evidence_lower: &str) -> bool {
    evidence_lower.lines().any(|line| {
        let trimmed = line.trim();
        trimmed.contains("pending")
            || trimmed.contains("untested")
            || trimmed.contains("unverified")
            || trimmed.contains("inconclusive")
    })
}

fn missing_quality_review_fields(playtest_text: &str) -> Vec<&'static str> {
    let section = markdown_section(playtest_text, "Quality Review");
    let fields = [
        "Screen composition",
        "Player feedback",
        "Restart clarity",
        "Audio response",
        "Style coherence",
    ];

    fields
        .into_iter()
        .filter(|field| {
            let prefix = format!("{}:", field).to_ascii_lowercase();
            let observation = section.lines().find_map(|line| {
                let trimmed = line.trim().trim_start_matches(['-', '*', ' ']);
                let lower = trimmed.to_ascii_lowercase();
                lower
                    .starts_with(&prefix)
                    .then(|| trimmed[prefix.len()..].trim().to_ascii_lowercase())
            });
            let Some(observation) = observation else {
                return true;
            };
            observation.len() < 12
                || [
                    "pending",
                    "untested",
                    "unverified",
                    "todo",
                    "tbd",
                    "n/a",
                    "looks good",
                ]
                .iter()
                .any(|marker| observation.contains(marker))
                || matches!(observation.as_str(), "good" | "fine" | "nice")
        })
        .collect()
}

fn detected_game_genre(text: &str) -> &'static str {
    let lower = text.to_ascii_lowercase();
    for (needle, genre) in [
        ("snake", "snake"),
        ("pong", "pong"),
        ("tetris", "tetris"),
        ("asteroids", "asteroids"),
        ("asteroid", "asteroids"),
    ] {
        if lower.contains(needle) {
            return genre;
        }
    }
    "unknown"
}

fn has_captured_or_omitted_audio(assets_text: &str, playtest_text: &str) -> bool {
    let combined = format!("{}\n{}", assets_text, playtest_text).to_ascii_lowercase();
    let captured = combined.contains("audio evidence: captured")
        || combined.contains("audio: captured")
        || combined.contains("audio captured")
        || combined.contains("non-silent")
        || combined.contains("maxabssample")
        || combined.contains("max abs sample");
    let omitted = audio_disabled_by_user_request(&combined);
    captured || omitted
}

fn audio_disabled_by_user_request(text: &str) -> bool {
    text.contains("no audio by request")
        || text.contains("no sound by request")
        || text.contains("no music by request")
        || text.contains("without audio by request")
        || text.contains("without sound by request")
        || text.contains("without music by request")
        || text.contains("audio disabled by request")
        || text.contains("sound disabled by request")
        || text.contains("music disabled by request")
        || text.contains("audio omitted by request")
        || text.contains("sound omitted by request")
        || text.contains("music omitted by request")
        || text.contains("user asked for no audio")
        || text.contains("user asked for no sound")
        || text.contains("user asked for no music")
        || text.contains("user requested no audio")
        || text.contains("user requested no sound")
        || text.contains("user requested no music")
        || text.contains("silent by request")
}

fn audio_self_omitted_without_user_request(text: &str) -> bool {
    (text.contains("no music requested")
        || text.contains("no sound requested")
        || text.contains("no audio requested")
        || text.contains("audio intentionally omitted")
        || text.contains("music intentionally omitted")
        || text.contains("sound intentionally omitted")
        || text.contains("intentionally omitted for simple")
        || text.contains("omitted for simple")
        || text.contains("audio omitted"))
        && !audio_disabled_by_user_request(text)
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
    let active_project_path = paths.repo_root.join(ACTIVE_PROJECT_DIRECTORY);
    let project_path = if active_project_path.is_dir() {
        active_project_path
    } else {
        paths.project_path.clone()
    };
    let rom_path = if project_path.ends_with(ACTIVE_PROJECT_DIRECTORY) {
        project_path.join("out/rom.bin")
    } else {
        paths.rom_path.clone()
    };
    let rom_current = current_project_rom_exists(&project_path, &rom_path);
    let rom_status = if rom_current {
        "ready"
    } else if rom_path.is_file() {
        "stale"
    } else {
        "missing"
    };
    let rom_detail = if rom_status == "stale" {
        "Source changed after the last ROM build".to_string()
    } else {
        fs::metadata(&rom_path)
            .map(|metadata| format!("{} bytes", metadata.len()))
            .unwrap_or_else(|_| "Build starter ROM before export".to_string())
    };

    ProjectSummary {
        generated_at: unix_timestamp(),
        name: project_name_for_project(&project_path),
        project_path: repo_relative(&paths.repo_root, &project_path),
        rom_path: repo_relative(&paths.repo_root, &rom_path),
        export_directory: repo_relative(&paths.repo_root, &paths.export_directory),
        rom_status: rom_status.to_string(),
        rom_detail,
        asset_roles: asset_roles_for_project(&paths.repo_root, &project_path),
        files: vec![
            file_entry(&paths.repo_root, project_path.join("src/main.c"), "Main C"),
            file_entry(
                &paths.repo_root,
                project_path.join("res/resources.res"),
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
    if current_project_rom_exists(&paths.project_path, &paths.rom_path) {
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

fn current_project_rom_exists(project_path: &Path, rom_path: &Path) -> bool {
    let Ok(rom_metadata) = fs::metadata(rom_path) else {
        return false;
    };
    if !rom_metadata.is_file() || rom_metadata.len() == 0 {
        return false;
    }

    let Ok(rom_modified) = rom_metadata.modified() else {
        return true;
    };
    latest_project_input_modified(project_path)
        .map(|input_modified| input_modified <= rom_modified)
        .unwrap_or(true)
}

fn latest_project_input_modified(path: &Path) -> Option<SystemTime> {
    let mut latest = None;
    let entries = fs::read_dir(path).ok()?;
    for entry in entries.filter_map(Result::ok) {
        let entry_path = entry.path();
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if file_name == "out" || file_name.starts_with('.') {
            continue;
        }

        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let modified = if metadata.is_dir() {
            latest_project_input_modified(&entry_path)
        } else if metadata.is_file() && is_project_build_input(&entry_path) {
            metadata.modified().ok()
        } else {
            None
        };

        if let Some(modified) = modified {
            latest = Some(match latest {
                Some(current) if current >= modified => current,
                _ => modified,
            });
        }
    }
    latest
}

fn is_project_build_input(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if file_name == "Makefile" {
        return true;
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    matches!(
        extension.as_deref(),
        Some(
            "asm"
                | "bin"
                | "bmp"
                | "c"
                | "gif"
                | "h"
                | "inc"
                | "json"
                | "mml"
                | "pcm"
                | "png"
                | "res"
                | "s"
                | "tmx"
                | "tsx"
                | "vgm"
                | "wav"
        )
    )
}

fn remove_project_build_output(project_path: &Path) -> Result<(), String> {
    let out_path = project_path.join("out");
    if !out_path.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&out_path).map_err(|error| {
        format!(
            "Could not remove copied build output {}: {}",
            out_path.display(),
            error
        )
    })
}

fn looks_like_simple_snake_request(prompt: &str) -> bool {
    looks_like_simple_game_request(prompt, "snake")
}

fn looks_like_simple_pong_request(prompt: &str) -> bool {
    looks_like_simple_game_request(prompt, "pong")
}

fn looks_like_simple_tetris_request(prompt: &str) -> bool {
    looks_like_simple_game_request(prompt, "tetris")
}

fn looks_like_simple_asteroids_request(prompt: &str) -> bool {
    looks_like_simple_game_request(prompt, "asteroids")
        || looks_like_simple_game_request(prompt, "asteroid")
}

fn looks_like_simple_game_request(prompt: &str, genre: &str) -> bool {
    let text = prompt.to_lowercase();
    text.contains(genre)
        && (text.contains("simple")
            || text.contains("working")
            || text.contains("build")
            || text.contains("make")
            || text.contains("game"))
}

fn looks_like_blank_starter_main(source: &str) -> bool {
    source.lines().count() <= 40
        && source.contains("VDP_setScreenWidth320")
        && source.contains("VDP_clearPlane(BG_A")
        && source.contains("while (TRUE)")
        && !source.contains("JOY_readJoypad")
        && !source.contains("DRIVE16 SNAKE")
}

fn ensure_project_memory_files(
    starter_project: &Path,
    active_project: &Path,
) -> Result<(), String> {
    for file_name in PROJECT_MEMORY_FILES {
        let target_path = active_project.join(file_name);
        if target_path.is_file() {
            continue;
        }

        let starter_path = starter_project.join(file_name);
        if starter_path.is_file() {
            fs::copy(&starter_path, &target_path).map_err(|error| {
                format!(
                    "Could not copy project memory file {} to {}: {}",
                    starter_path.display(),
                    target_path.display(),
                    error
                )
            })?;
        } else {
            fs::write(&target_path, default_project_memory_file(file_name)).map_err(|error| {
                format!(
                    "Could not create project memory file {}: {}",
                    target_path.display(),
                    error
                )
            })?;
        }
    }
    Ok(())
}

fn default_project_memory_file(file_name: &str) -> &'static str {
    match file_name {
        "ASSETS.md" => {
            r#"# Asset Manifest

Use this file as the role ledger for the game. Every visible or audible game
role should have exactly one truthful row, even when the role uses primitive
tiles instead of a PNG.

## Asset Plan

- Pending: choose the gameplay roles before generating or wiring assets.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Game code primitives | None yet | `src/main.c` | Pending | Add rows as soon as a project uses primitive drawing, bundled assets, ComfyUI sprites, or MML music; notes must include prompt, crop/slice, and whether it was used when applicable. |

## Role Source Rules

- Simple geometric roles such as Pong paddles/balls, Snake body segments,
  Tetris blocks, borders, grids, and UI text should usually be SGDK
  primitives/tiles unless the user explicitly asks for styled generated art.
- Primitive rectangles and grid cells should be tilemap cells: load solid 8x8
  tiles with `VDP_loadTileData` and place them with `VDP_fillTileMapRect`.
  Do not use `VDP_drawRect`.
- ComfyUI currently generates one Genesis-safe 32x32 sprite PNG at a time.
  Treat each generated PNG as one role-specific SGDK `SPRITE`, not a reusable
  sprite sheet or generic decoration.
- If a generated image is cropped or sliced locally, record the source image,
  crop/slice output, and final SGDK symbol in the role table.
- Do not reuse one generated image for unrelated roles. A paddle is not a ball;
  a Snake head is not a wall; a Tetris block is not a title logo.
- Primitive text/tile rows should use the code path or drawing function in
  `Symbol / File`, such as `src/main.c draw_piece()`, not only a shared
  character like `#`. If one primitive glyph or helper is reused across
  multiple roles, say the shared primitive reuse is intentional in each
  affected row.
- Music and SFX rows must record compile status, the resource symbol/file, and
  audio evidence as captured, silent, or untested.

## Asset Source Decision Log

- Pending: no project-specific asset roles have been chosen yet.
"#
        }
        "PLAYTEST.md" => {
            r#"# Playtest Notes

## Latest Result

No game-specific playtest has run yet.

Playability gate: FAIL.

Reason: no game has been implemented, built, screen-checked, input-tested, or
audio-checked yet.

## Required Gate Before Calling A Build Done

- ROM builds successfully.
- The first screen is visible and readable.
- Player/object movement is visible when controls are pressed.
- Start and reset behavior are checked when the game uses them.
- Score or state counters start at the intended value.
- The game does not immediately fail or become unplayable.
- Asset usage is recorded in `ASSETS.md` as primitive tiles, bundled assets,
  ComfyUI, or MML.
- Passing games must record non-silent audio evidence, or explicitly say audio
  was disabled/omitted by request.

## Genre Acceptance Checklist

Use the relevant row for the game being built. Mark unrelated rows as N/A.
When `Playability gate: PASS`, the Evidence section must name each relevant
genre check that was tested; `Genre checks: pending` is never compatible with a
passing gate.

| Genre | Minimum checks before PASS |
| --- | --- |
| Snake | Score starts at 0; snake and food are visible; D-pad movement is visible; food can be approached/eaten without instant fail; wall/self collision reaches a clear fail state; Start restarts after game over when present. |
| Pong | Both paddles and ball are visible; at least one paddle responds to input; ball travels and bounces; scoring changes when the ball exits a side; serve/point restart is visible. |
| Tetris | Playfield and score/line state are readable; a piece spawns visibly; left/right/down movement works; rotation works; pieces lock into the grid; line clear/stacking behavior is present; game-over is possible at the top. |
| Asteroids | Ship, asteroids, and shots are visible; rotation/thrust changes the ship; firing creates a moving projectile; asteroids move or wrap; collisions/destruction affect score/state; restart works after death/game over. |

## Quality Review

- Screen composition: pending
- Player feedback: pending
- Restart clarity: pending
- Audio response: pending
- Style coherence: pending

## Evidence

- Build log: pending
- Screenshot/frame capture: pending
- Input test: pending
- Audio test: pending if the project includes music
- Genre checks: pending
"#
        }
        _ => {
            r#"# Game Notes

## Concept

Blank Drive16 project.

## SGDK Starter Notes

- `VDP_drawText`, `VDP_clearPlane`, `VDP_loadTileData`, and
  `VDP_fillTileMapRect` are safe starter APIs in this project.
- Do not use `VDP_drawRect`, `srand`, or C library `rand()`.

## First Build References

- For a simple Snake request, `examples/game-skeletons/snake-basic/` is a
  proven compact source and audio seed. Copy/adapt its `src/main.c` and `res/`
  files, then build and test before polishing docs or art.
- For a simple Pong request, `examples/game-skeletons/pong-basic/` is a
  proven compact source and audio seed. Copy/adapt its `src/main.c` and `res/`
  files, then build and test before polishing docs or art.
- For a simple Tetris request, `examples/game-skeletons/tetris-basic/` is a
  proven compact source and audio seed. Copy/adapt its `src/main.c` and `res/`
  files, then build and test before polishing docs or art.
- For a simple Asteroids request, `examples/game-skeletons/asteroids-basic/` is
  a proven compact source and audio seed. Copy/adapt its `src/main.c` and
  `res/` files, then build and test before polishing docs or art.

## Known Issues

- No game-specific behavior has been implemented yet.
"#
        }
    }
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
    fn active_project_reports_stale_rom_when_source_is_newer() {
        let temp_dir = temp_repo("active-stale");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        let rom_path = active_project.join("out/rom.bin");
        fs::create_dir_all(active_project.join("src")).unwrap();
        fs::create_dir_all(rom_path.parent().unwrap()).unwrap();
        fs::write(&rom_path, b"OLDROM").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(active_project.join("src/main.c"), "int changed(){}").unwrap();

        let result = ensure_active_project_for_repo(temp_dir.clone()).unwrap();
        assert_eq!(result.agent_project_path, active_project.to_string_lossy());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "stale");
        assert!(!result.rom_exists);
        assert_eq!(result.detail, "Source changed after the last ROM build");
    }

    #[test]
    fn active_project_ignores_notes_when_checking_rom_freshness() {
        let temp_dir = temp_repo("active-notes");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        let rom_path = active_project.join("out/rom.bin");
        fs::create_dir_all(active_project.join("src")).unwrap();
        fs::create_dir_all(rom_path.parent().unwrap()).unwrap();
        fs::write(active_project.join("src/main.c"), "int main(){}").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&rom_path, b"FRESHROM").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(active_project.join("GAME.md"), "# Notes").unwrap();

        let result = ensure_active_project_for_repo(temp_dir.clone()).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert!(result.rom_exists);
    }

    #[test]
    fn active_project_backfills_missing_memory_files_without_overwriting_notes() {
        let temp_dir = temp_repo("active-memory-backfill");
        let starter_project = temp_dir.join(STARTER_PROJECT);
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(starter_project.join("src")).unwrap();
        fs::create_dir_all(active_project.join("src")).unwrap();
        fs::write(starter_project.join("GAME.md"), "# Starter Game Notes").unwrap();
        fs::write(
            starter_project.join("ASSETS.md"),
            "# Starter Asset Manifest",
        )
        .unwrap();
        fs::write(
            starter_project.join("PLAYTEST.md"),
            "# Starter Playtest Notes",
        )
        .unwrap();
        fs::write(active_project.join("src/main.c"), "int main(){}").unwrap();
        fs::write(active_project.join("GAME.md"), "# Existing Game Notes").unwrap();

        let result = ensure_active_project_for_repo(temp_dir.clone()).unwrap();
        let game_notes = fs::read_to_string(active_project.join("GAME.md")).unwrap();
        let assets = fs::read_to_string(active_project.join("ASSETS.md")).unwrap();
        let playtest = fs::read_to_string(active_project.join("PLAYTEST.md")).unwrap();
        fs::remove_dir_all(temp_dir).unwrap();

        assert!(!result.created);
        assert_eq!(game_notes, "# Existing Game Notes");
        assert_eq!(assets, "# Starter Asset Manifest");
        assert_eq!(playtest, "# Starter Playtest Notes");
    }

    #[test]
    fn active_project_memory_defaults_start_with_failed_gate() {
        let temp_dir = temp_repo("active-memory-defaults");
        let starter_project = temp_dir.join(STARTER_PROJECT);
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(starter_project.join("src")).unwrap();
        fs::write(starter_project.join("src/main.c"), "int main(){}").unwrap();

        let result = ensure_active_project_for_repo(temp_dir.clone()).unwrap();
        let playtest = fs::read_to_string(active_project.join("PLAYTEST.md")).unwrap();
        let audit = audit_project_memory_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert!(result.created);
        assert!(playtest.contains("Playability gate: FAIL"));
        assert_eq!(audit.gate, "fail");
        assert_eq!(audit.status, "warning");
        assert!(audit.detail.contains("Playability gate: FAIL"));
    }

    #[test]
    fn project_memory_pass_rejects_pending_evidence() {
        let temp_dir = temp_repo("memory-pass-pending");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(&active_project).unwrap();
        fs::write(
            active_project.join("GAME.md"),
            "# Game Notes\n\n## Concept\n\nSimple Snake game.\n",
        )
        .unwrap();
        fs::write(
            active_project.join("ASSETS.md"),
            r#"# Asset Manifest

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Snake body | primitive tile | `src/main.c` | Used | primitive drawing used in ROM |
"#,
        )
        .unwrap();
        fs::write(
            active_project.join("PLAYTEST.md"),
            r#"# Playtest Notes

Playability gate: PASS.

## Quality Review

- Screen composition: pending
- Player feedback: pending
- Restart clarity: pending
- Audio response: pending
- Style coherence: pending

## Evidence

- Build log: pending
- Screenshot/frame capture: pending
- Input test: pending
- Audio test: pending
- Genre checks: pending
"#,
        )
        .unwrap();

        let audit = audit_project_memory_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(audit.gate, "pass");
        assert_eq!(audit.status, "warning");
        assert!(audit.detail.contains("pending or untested evidence"));
        assert!(audit.detail.contains("snake genre evidence"));
        assert!(audit.detail.contains("captured audio"));
    }

    #[test]
    fn project_memory_pass_accepts_complete_native_evidence() {
        let temp_dir = temp_repo("memory-pass-complete");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(&active_project).unwrap();
        fs::write(
            active_project.join("GAME.md"),
            "# Game Notes\n\n## Concept\n\nSimple Snake game.\n",
        )
        .unwrap();
        fs::write(
            active_project.join("ASSETS.md"),
            r#"# Asset Manifest

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Snake body | primitive tile | `src/main.c` | Used | primitive drawing used in ROM |
| Music | MML music | `res/theme.vgm` | Captured | audio evidence: captured; maxAbsSample=1200 |
"#,
        )
        .unwrap();
        fs::write(
            active_project.join("PLAYTEST.md"),
            r#"# Playtest Notes

Playability gate: PASS.

## Quality Review

- Screen composition: The bordered playfield, score, snake, and food remain readable without overlap.
- Player feedback: Snake movement and the game-over state visibly respond to input and collision.
- Restart clarity: Pressing Start after game over visibly returns to score zero and the initial snake.
- Audio response: Captured non-silent audio confirms the loop plays during active gameplay.
- Style coherence: The simple text-grid shapes and restrained palette form a consistent arcade style.

## Evidence

- Build log: build_rom completed after source edits.
- Screenshot/frame capture: visible snake, food, border, and score 0.
- Input test: D-pad movement moved the snake right and down.
- Audio test: non-silent audio captured with maxAbsSample=1200.
- Genre checks: Snake score starts at 0; snake and food are visible; movement works; wall collision reaches game over; Start restarts.
"#,
        )
        .unwrap();

        let audit = audit_project_memory_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(audit.gate, "pass");
        assert_eq!(audit.status, "ready");
        assert!(audit.detail.contains("Playability gate: PASS"));
    }

    #[test]
    fn project_memory_warns_on_premature_rom_and_self_omitted_audio_claims() {
        let temp_dir = temp_repo("memory-premature-claims");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(&active_project).unwrap();
        fs::write(
            active_project.join("GAME.md"),
            r#"# Game Notes

## Current Build

- ROM: `out/rom.bin` - Built ROM

## Known Issues

- None yet - initial implementation
"#,
        )
        .unwrap();
        fs::write(
            active_project.join("ASSETS.md"),
            r#"# Asset Manifest

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Audio | None | none | Intentionally omitted | Audio intentionally omitted for simple implementation. |
"#,
        )
        .unwrap();
        fs::write(
            active_project.join("PLAYTEST.md"),
            r#"# Playtest Notes

Playability gate: FAIL.

## Evidence

- Build log: pending
"#,
        )
        .unwrap();

        let audit = audit_project_memory_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(audit.gate, "fail");
        assert_eq!(audit.status, "warning");
        assert!(audit.detail.contains("out/rom.bin is built"));
        assert!(audit.detail.contains("no known issues"));
        assert!(audit
            .detail
            .contains("without an explicit user no-audio request"));
    }

    #[test]
    fn project_summary_reads_asset_role_ledger() {
        let temp_dir = temp_repo("asset-role-summary");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(active_project.join("src")).unwrap();
        fs::write(
            active_project.join("ASSETS.md"),
            r#"# Asset Manifest

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Player ship | ComfyUI sprite | `res/player_ship.png` | Used | prompt: blue ship; crop/slice: 32x32; used in ROM: yes |
| Music | MML music | `res/theme.vgm` | Captured | audio evidence: captured |
"#,
        )
        .unwrap();

        let summary = project_summary_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(summary.asset_roles.len(), 2);
        assert_eq!(summary.asset_roles[0].role, "Player ship");
        assert_eq!(summary.asset_roles[0].source, "ComfyUI sprite");
        assert!(summary.asset_roles[0].notes.contains("used in ROM: yes"));
        assert!(summary.asset_roles[0].preview_data_url.is_none());
        assert_eq!(summary.asset_roles[1].role, "Music");
    }

    #[test]
    fn project_summary_embeds_repo_local_png_asset_previews() {
        let temp_dir = temp_repo("asset-role-preview");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        let outside_png = temp_dir.with_extension("outside.png");
        let png_bytes = general_purpose::STANDARD
            .decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
            )
            .unwrap();
        fs::create_dir_all(active_project.join("res")).unwrap();
        fs::write(active_project.join("res/player_ship.png"), &png_bytes).unwrap();
        fs::write(&outside_png, &png_bytes).unwrap();
        fs::write(
            active_project.join("ASSETS.md"),
            format!(
                r#"# Asset Manifest

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Player ship | ComfyUI sprite | `res/player_ship.png` | Used | prompt: blue ship; crop/slice: 32x32; used in ROM: yes |
| Outside sprite | ComfyUI sprite | `{}` | Used | should not preview outside repo |
"#,
                outside_png.display()
            ),
        )
        .unwrap();

        let summary = project_summary_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();
        let _ = fs::remove_file(outside_png);

        assert_eq!(summary.asset_roles.len(), 2);
        assert!(summary.asset_roles[0]
            .preview_data_url
            .as_deref()
            .unwrap_or_default()
            .starts_with("data:image/png;base64,"));
        assert!(summary.asset_roles[1].preview_data_url.is_none());
    }

    #[test]
    fn project_summary_names_project_from_game_notes() {
        let temp_dir = temp_repo("summary-name");
        let active_project = temp_dir.join(ACTIVE_PROJECT_DIRECTORY);
        fs::create_dir_all(&active_project).unwrap();
        fs::write(
            active_project.join("GAME.md"),
            "# Game Notes\n\n## Concept\n\nA simple working Snake game for Genesis.\n",
        )
        .unwrap();

        let summary = project_summary_for_repo(temp_dir.clone());
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(summary.name, "Snake");
    }

    #[test]
    fn new_active_project_drops_copied_starter_rom_output() {
        let temp_dir = temp_repo("active-without-output");
        let starter_project = temp_dir.join(STARTER_PROJECT);
        fs::create_dir_all(starter_project.join("src")).unwrap();
        fs::create_dir_all(starter_project.join("out")).unwrap();
        fs::write(starter_project.join("src/main.c"), "int main(){}").unwrap();
        fs::write(starter_project.join("out/rom.bin"), b"TEMPLATE").unwrap();

        let result = ensure_active_project_for_repo(temp_dir.clone()).unwrap();
        let active_rom = temp_dir.join(ACTIVE_PROJECT_DIRECTORY).join("out/rom.bin");
        let active_rom_exists = active_rom.exists();
        fs::remove_dir_all(temp_dir).unwrap();

        assert_eq!(result.status, "ready");
        assert!(!result.rom_exists);
        assert!(!active_rom_exists);
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
