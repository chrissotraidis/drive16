#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const requireFromApp = createRequire(path.join(rootDir, "app", "package.json"));
const ts = requireFromApp("typescript");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizedText(text) {
  return text.replace(/\s+/g, " ");
}

async function loadAgentModule() {
  const sourcePath = path.join(rootDir, "app", "src", "agent", "opencodeSession.ts");
  const source = await readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    exports: module.exports,
    module,
    require(specifier) {
      if (specifier === "@tauri-apps/api/core") {
        return {
          invoke() {
            throw new Error("Tauri invoke is not available in the agent contract verifier.");
          },
        };
      }
      return requireFromApp(specifier);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: sourcePath });
  return module.exports;
}

function toolEvent(tool, status = "running", title = tool) {
  return JSON.stringify({
    payload: {
      type: "message.part.updated",
      properties: {
        sessionID: "ses_drive16_contract",
        part: {
          type: "tool",
          tool,
          state: {
            status,
            title,
          },
        },
      },
    },
  });
}

function statusEvent(status) {
  return JSON.stringify({
    payload: {
      type: "session.status",
      properties: {
        sessionID: "ses_drive16_contract",
        status: { type: status },
      },
    },
  });
}

function expectActivity(module, raw, expected) {
  const actual = module.agentActivityFromEvent(raw);
  assert(actual, `Expected an activity for ${raw}`);
  for (const [key, value] of Object.entries(expected)) {
    assert(
      actual[key] === value,
      `Expected ${key}=${value}, got ${actual[key]} for ${raw}`,
    );
  }
}

const agent = await loadAgentModule();
const repairState = agent.createAgentActivityRepairState();
const appSource = await readFile(path.join(rootDir, "app", "src", "App.tsx"), "utf8");
const playerPaneSource = await readFile(
  path.join(rootDir, "app", "src", "components", "PlayerPane.tsx"),
  "utf8",
);
const chatRailSource = await readFile(
  path.join(rootDir, "app", "src", "components", "ChatRail.tsx"),
  "utf8",
);
const stylesSource = await readFile(path.join(rootDir, "app", "src", "styles.css"), "utf8");
const starterRomSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "starter_rom.rs"),
  "utf8",
);
const projectSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "project.rs"),
  "utf8",
);
const starterAssetsTemplate = await readFile(
  path.join(rootDir, "examples", "app-starter-blank", "ASSETS.md"),
  "utf8",
);
const starterPlaytestTemplate = await readFile(
  path.join(rootDir, "examples", "app-starter-blank", "PLAYTEST.md"),
  "utf8",
);
const nativeMainSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "main.rs"),
  "utf8",
);
const builderSkill = await readFile(
  path.join(rootDir, "agent", "skills", "drive16-app-builder.md"),
  "utf8",
);
const normalizedBuilderSkill = normalizedText(builderSkill);

for (const expected of [
  "dump_audio: true",
  "capture_audio",
  "only a non-silent audio capture proves that it plays",
  "asset source and path was used for each game role",
  "prefer deterministic SGDK primitives or tiles",
  "Reserve ComfyUI for semantic or styled artwork",
  "Treat `ASSETS.md` as the role ledger",
  "record the role-specific prompt",
  "Drive16 can generate one Genesis-safe sprite PNG at a time",
  "Do not assume ComfyUI can produce a complete sprite sheet",
  "generate and validate separate role-specific sprites",
  "Playability gate: PASS",
  "Playability gate: FAIL",
  "Treat the active project folder, not the chat session, as the source of continuity",
  "modify the current game after reading",
  "Do not restart from a blank project unless the user explicitly asks",
]) {
  assert(
    normalizedBuilderSkill.includes(expected),
    `Builder skill is missing contract text: ${expected}`,
  );
}

for (const expected of [
  "Use this file as the role ledger for the game.",
  "ComfyUI currently generates one Genesis-safe 32x32 sprite PNG at a time.",
  "Do not reuse one generated image for unrelated roles.",
  "Asset Source Decision Log",
]) {
  assert(
    starterAssetsTemplate.includes(expected),
    `Starter ASSETS.md template is missing: ${expected}`,
  );
  assert(projectSource.includes(expected), `Native ASSETS.md fallback is missing: ${expected}`);
}

for (const expected of [
  "Playability gate: FAIL",
  "no game has been implemented",
  "audio-checked",
]) {
  assert(
    starterPlaytestTemplate.includes(expected),
    `Starter PLAYTEST.md template is missing: ${expected}`,
  );
  assert(projectSource.includes(expected), `Native PLAYTEST.md fallback is missing: ${expected}`);
}

for (const expected of [
  'const openRouterKeyStorageKey = "drive16.openrouter.key.v1"',
  'const openRouterAcceptedKeyStorageKey = "drive16.openrouter.acceptedKey.v1"',
  "window.localStorage.getItem(openRouterKeyStorageKey)",
  "window.localStorage.setItem(openRouterKeyStorageKey, trimmed)",
  "window.localStorage.removeItem(openRouterKeyStorageKey)",
  "function openRouterKeyMarker",
  "function saveOpenRouterAcceptedKey",
  "function clearOpenRouterAcceptedKey",
  "function openRouterKeyWasAccepted",
  "openRouterKeyWasAccepted(openRouterKey)",
  "clearOpenRouterAcceptedKey()",
  "saveOpenRouterAcceptedKey(trimmedKey)",
  "legacyOpenRouterSessionKeyStorageKey",
  'const activeProjectNameStorageKey = "drive16.activeProject.name.v1"',
  "function loadActiveProjectName",
  "function saveActiveProjectName",
  "function resetActiveProjectName",
  "if (isTauriRuntime())",
  "loadActiveProjectName(project.romExists ?",
  "} else {\n      void loadProjectSummary();\n    }",
  "saveActiveProjectName(projectName)",
  "resetActiveProjectName()",
  "useState(false)",
  "function handleOpenRouterModelChange",
  "activeModel: value",
  "function handleProviderChange",
  "modelProvider: value",
  "function handleOllamaEndpointChange",
  "ollamaEndpoint: value",
  "function handleOllamaModelChange",
  "ollamaModel: value",
  "function canPlayActiveRom",
  'return projectSummary.romStatus === "ready"',
  "function appPlayabilityGateState",
  'return { state: "warning", label: checking ? "Checking" : "Needs Check" }',
  'return { state: "error", label: "Gate Failed" }',
  'starterBusy || buildState === "building" || !activeRomPlayable',
  "const recentDuplicate = current",
  ".slice(-8)",
  "event.type === type && event.detail === detail",
  'type.toLowerCase().endsWith("updated")',
  "function resetBuildActivityLog",
  "const openCodeHeartbeatTimeoutMs = 15_000",
  "function clearOpenCodeHeartbeatTimer",
  "openCodeHeartbeatTimerRef.current = window.setTimeout",
  "type ProjectMemoryAuditResult",
  'invoke<ProjectMemoryAuditResult>("audit_active_project_memory")',
  '"project.memory.ready"',
  '"project.memory.warning"',
  '"project.memory.missing"',
  '"project.memory.failed"',
  "setOpenCodeEvents([])",
  "setOpenCodeRawEvents([])",
  'setOpenCodeHeartbeat({ active: false, time: "" })',
  "function staleAgentActivityDisposition",
  '"accept" | "raw" | "drop"',
  "only session-scoped OpenCode activity can",
  'return pending ? "raw" : "accept"',
  "agent.ignored.stale",
  "return pending.sessionId === sessionId ?",
  '"project.reset.failed"',
  '"verify.no_rom"',
  'label: "No ROM to verify"',
  "Verifying the active project ROM.",
  "Active project ROM preview captured.",
  "const [openCodeRawEvents, setOpenCodeRawEvents]",
  "function appendOpenCodeRawEvent",
  "setOpenCodeRawEvents((current)",
  ".slice(-200)",
  'appendOpenCodeRawEvent("heartbeat", "OpenCode event received")',
  "setLoadedPlayerRom(undefined)",
  "setLastPlayerInput(undefined)",
  'setLastInputAction("No local input yet")',
  "function resetActiveRomSession",
  "disposeInteractivePlayer()",
  "agentActivityRepairRef.current = createAgentActivityRepairState()",
  'const [playerScreenEvidence, setPlayerScreenEvidence]',
  'useState<PlayerScreenEvidence>("none")',
  "type PlayerInputEvidence",
  'const [playerInputEvidence, setPlayerInputEvidence]',
  'useState<PlayerInputEvidence>("none")',
  "type PlayerAudioEvidence",
  'const [playerAudioEvidence, setPlayerAudioEvidence]',
  'useState<PlayerAudioEvidence>("none")',
  "function applyAgentEvidenceEvent",
  '"agent.screenshot.checking"',
  '"agent.screenshot.checked"',
  '"agent.screenshot.failed"',
  '"agent.input.testing"',
  '"agent.input.tested"',
  '"agent.input.failed"',
  'setPlayerInputEvidence("testing")',
  'setPlayerInputEvidence("tested")',
  'setPlayerInputEvidence("failed")',
  'setPlayerAudioEvidence("checking")',
  'setPlayerAudioEvidence("captured")',
  'setPlayerAudioEvidence("failed")',
  'setPlayerAudioEvidence(result.audioMaxAbs > 0 ? "captured" : "silent")',
  'setPlayerAudioEvidence("none")',
  'playerAudio === "unavailable" || playerAudio === "needs-gesture"',
  '"Sound needs a click"',
  '"player.audio.needs_gesture"',
  "preview.audioMaxAbs > 0",
  "playerInputEvidence={playerInputEvidence}",
  "playerAudioEvidence={playerAudioEvidence}",
  "const playerSetupTimeoutMs = 20_000",
  "withTimeout(",
  "Interactive Play setup timed out after",
  'setPlayerScreenEvidence("none")',
  'setPlayerScreenEvidence("checking")',
  "setPlayerScreenEvidence((current) =>",
  '"captured"',
  'setPlayerScreenEvidence("visible")',
  'setPlayerScreenEvidence(mostlyUnknown ? "inconclusive" : "unverified")',
  "playerScreenEvidence={playerScreenEvidence}",
  "romUnavailable={!activeRomPlayable}",
  "guardUnverifiedModelReply(reply.content)",
  "message.model.guarded",
  "looksLikeFollowUpPrompt(trimmed)",
  'projectSummary.name || loadActiveProjectName("Untitled Project")',
  '["tetris", "Tetris"]',
  "The agent produced a ROM file. I’m loading it now, but it is not marked playable until Drive16 has screen, input, and audio evidence.",
  'label: "ROM built, checking"',
  "Agent ROM preview captured. Playability still needs input/audio evidence.",
  "audioMaxAbs",
  "preview.audio.captured",
  "preview.audio.silent",
  '"agent.rom.built"',
  'label: "Player started muted"',
  "App volume is 0%",
  "setNostalgistVolume",
  "defaultPlayerVolume",
  'label: "Screen visible, playtest incomplete"',
  'label: mostlyUnknown ? "Screen check inconclusive" : "Screen not verified"',
  '"The player is rendering visible frames. Controls and audio still need evidence before calling this game playable."',
]) {
  assert(appSource.includes(expected), `App lifecycle source is missing: ${expected}`);
}
assert(
  !appSource.includes("window.sessionStorage.setItem(openRouter"),
  "OpenRouter key must not be saved to sessionStorage; refresh should keep it.",
);

for (const expected of [
  "romUnavailable",
  "playerScreenEvidence",
  "playerInputEvidence",
  'data-testid="playtest-evidence"',
  "ShieldCheck",
  "EvidencePill",
  "type EvidenceState",
  "playabilityGateState",
  "playabilityGateLabel",
  "Gate: no ROM",
  "Gate: incomplete",
  "Gate: failed",
  "Gate: verified",
  "Screen: no ROM",
  "Screen: frame captured",
  "Screen: visible",
  "Screen: unverified",
  "Input: no ROM",
  "Input: untested",
  "Input: testing",
  "Input: tested",
  "Input: failed",
  "sessionActive",
  "inputEvidenceState",
  "Audio: no ROM",
  "Audio: checking",
  "Audio: captured",
  "Audio: silent",
  "Audio: failed",
  "Audio: enable sound",
  "Audio: unverified",
  "audioEvidenceState",
  "playerAudioEvidence",
  "playerVolume",
  'data-testid="player-volume-slider"',
  'aria-label="Player volume"',
  "Volume starts at 0%",
  'disabled={playerAudio === "unavailable" && !sessionActive}',
  "Enable sound",
  "Enable player audio",
  "needs-gesture",
  "Start a ROM before changing audio",
  "Try to enable audio for this player session",
  '"NO ROM"',
  '"No ROM"',
]) {
  assert(playerPaneSource.includes(expected), `Player pane source is missing: ${expected}`);
}

for (const expected of [
  '"agent.rom.built": "ROM"',
  '"project.memory.ready": "Memory"',
  '"project.memory.warning": "Memory"',
  '"project.memory.missing": "Memory"',
  '"project.memory.failed": "Memory"',
  '"player.screen.visible": "Screen"',
  '"player.screen.inconclusive": "Screen"',
  '"player.screen.unverified": "Screen"',
  '"player.audio.needs_gesture": "Audio"',
  '"message.model.guarded": "Guarded"',
  '"preview.audio.captured": "Audio"',
  '"preview.audio.silent": "Audio"',
  "rawBuildEvents",
  'data-testid="chat-raw-log"',
  'data-testid="opencode-heartbeat-status"',
  "visibleRawEvents",
  ".filter((event) => !isHeartbeatEvent(event))",
  "OpenCode heartbeat active",
  "OpenCode is still connected and sending heartbeat events",
  "Raw log",
  "buildLogItemsRef",
  "latestVisibleBuildEventId",
  "element.scrollTop = element.scrollHeight",
]) {
  assert(chatRailSource.includes(expected), `Chat rail source is missing: ${expected}`);
}

for (const expected of [
  ".chat-raw-log",
  ".chat-raw-log-items",
  ".playtest-evidence",
  ".evidence-pill",
  ".player-volume-control",
  ".player-volume-slider",
  ".player-audio-toggle.needs-gesture",
  ".status-dot.warning",
]) {
  assert(stylesSource.includes(expected), `Styles are missing raw log support: ${expected}`);
}

for (const expected of [
  "pub struct ProjectMemoryAuditResult",
  "pub struct ProjectMemoryFileStatus",
  "pub fn audit_active_project_memory",
  "fn audit_project_memory_for_repo",
  "fn playability_gate_status",
  "fn looks_like_asset_role_ledger",
  "active_project_memory_defaults_start_with_failed_gate",
]) {
  assert(projectSource.includes(expected), `Project memory audit source is missing: ${expected}`);
}

for (const expected of [
  "async fn audit_active_project_memory",
  "project::audit_active_project_memory",
  "audit_active_project_memory,",
]) {
  assert(nativeMainSource.includes(expected), `Native command wiring is missing: ${expected}`);
}

for (const expected of [
  "pub audio_dump_path: String",
  "pub audio_max_abs: i16",
  "audio_dump_path: PathBuf",
  '.arg("--dump-audio")',
  "wav_max_abs(&paths.audio_dump_path)",
  "starter-audio.wav",
  "fn wav_max_abs",
  "Starter ROM audio dump was not created",
]) {
  assert(starterRomSource.includes(expected), `Starter ROM preview source is missing: ${expected}`);
}

const prompt = agent.agentPromptWithProject(
  "artifacts/phase3/active-project",
  "make snake",
  {
    spriteGeneration: true,
    musicGeneration: false,
    comfyUiEndpoint: "http://127.0.0.1:8188",
    comfyUiCheckpoint: "sd_xl_base_1.0.safetensors",
    comfyUiLora: "pixel-art-xl.safetensors",
  },
);

for (const expected of [
  "Active Drive16 project: artifacts/phase3/active-project",
  "Session continuity:",
  "OpenCode is receiving this as a fresh session to avoid stale prior-agent context.",
  "Treat the active project folder as the durable conversation state.",
  "Before editing, read GAME.md, ASSETS.md, and PLAYTEST.md when present.",
  "modify the current game instead of starting over",
  "After the turn, update GAME.md, ASSETS.md, and PLAYTEST.md",
  "Verification contract:",
  "Do not call the game done or playable just because out/rom.bin exists.",
  "Build the ROM, run it, capture a frame, test input, and capture audio when sound is expected.",
  "If audio is expected, run the emulator with dump_audio enabled",
  "If any screen, input, or audio check is missing or failed",
  "Drive16 settings:",
  "AI sprites: enabled",
  "MML music: disabled",
  "ComfyUI endpoint: http://127.0.0.1:8188",
  "ComfyUI checkpoint: sd_xl_base_1.0.safetensors",
  "ComfyUI LoRA: pixel-art-xl.safetensors",
  "make snake",
]) {
  assert(prompt.includes(expected), `Prompt context is missing: ${expected}`);
}

const appFollowUpContract = [
  "function looksLikeFollowUpPrompt",
  "I’ll treat this as a follow-up on the current project",
  "read the game notes",
  "make the requested change in the active folder",
  "rebuild, and check the screen/input/audio evidence",
];
for (const expected of appFollowUpContract) {
  assert(appSource.includes(expected), `App follow-up contract is missing: ${expected}`);
}

expectActivity(agent, toolEvent("read", "completed", "GAME.md"), {
  eventType: "agent.files.read",
  label: "File read",
});
expectActivity(agent, toolEvent("edit", "running", "src/main.c"), {
  eventType: "agent.files.editing",
  label: "Editing file",
});
expectActivity(agent, toolEvent("drive16-sgdk-build.build_rom", "running", "active project"), {
  eventType: "agent.build.started",
  label: "Building the ROM",
});
expectActivity(agent, toolEvent("drive16-sgdk-build.build_rom", "failed", "active project"), {
  eventType: "agent.build.failed",
  label: "Build failed",
});
expectActivity(agent, toolEvent("drive16-sgdk-build.read_build_log", "completed", "last-build.log"), {
  eventType: "agent.build.log",
  label: "Reading build failure",
});

const failedBuild = agent.agentActivityFromEvent(
  toolEvent("drive16-sgdk-build.build_rom", "failed", "active project"),
);
const buildEdit = agent.agentActivityFromEvent(toolEvent("edit", "running", "src/main.c"));
const retryBuild = agent.agentActivityFromEvent(
  toolEvent("drive16-sgdk-build.build_rom", "running", "active project"),
);
const fixedBuild = agent.agentActivityFromEvent(
  toolEvent("drive16-sgdk-build.build_rom", "completed", "active project"),
);
assert(failedBuild && buildEdit && retryBuild && fixedBuild, "Repair sequence setup failed.");
assert(
  agent.visibleAgentActivityEvents(failedBuild, repairState)[0].eventType ===
    "agent.build.failed",
  "Failed build should remain visible.",
);
const repairEditEvents = agent.visibleAgentActivityEvents(buildEdit, repairState);
assert(
  repairEditEvents.map((event) => event.eventType).join(",") ===
    "agent.build.fixing,agent.files.editing",
  "First edit after a failed build should show build fixing.",
);
assert(
  agent.visibleAgentActivityEvents(retryBuild, repairState)[0].eventType ===
    "agent.build.retrying",
  "Retry build should be labelled as retrying.",
);
assert(
  agent.visibleAgentActivityEvents(fixedBuild, repairState)[0].eventType ===
    "agent.build.fixed",
  "Successful retry should be labelled as fixed.",
);
expectActivity(agent, toolEvent("drive16-emulator.run_rom", "completed", "out/rom.bin"), {
  eventType: "agent.rom.ran",
  label: "ROM run finished",
});
expectActivity(agent, toolEvent("drive16-emulator.send_input", "completed", "D-pad test"), {
  eventType: "agent.input.tested",
  label: "Input tested",
});
expectActivity(agent, toolEvent("drive16-emulator.capture_frame", "completed", "last-frame.png"), {
  eventType: "agent.screenshot.checked",
  label: "Screenshot checked",
});
expectActivity(agent, toolEvent("drive16-emulator.capture_audio", "completed", "last-audio.wav"), {
  eventType: "agent.audio.checked",
  label: "Audio checked",
});
expectActivity(
  agent,
  toolEvent(
    "drive16-emulator.capture_audio",
    "completed",
    "No audio dump is available. Run run_rom with dump_audio=true first.",
  ),
  {
    eventType: "agent.audio.failed",
    label: "Audio check failed",
  },
);
expectActivity(
  agent,
  toolEvent(
    "drive16-emulator.capture_audio",
    "completed",
    '{"ok":false,"audioDumpPath":"/tmp/last-audio.wav","maxAbsSample":0,"nonSilent":false}',
  ),
  {
    eventType: "agent.audio.failed",
    label: "Audio check failed",
  },
);
expectActivity(agent, toolEvent("drive16-mml-music.compile_music", "completed", "snake_theme"), {
  eventType: "agent.assets.music.finished",
  label: "Music compile finished",
});
expectActivity(agent, toolEvent("drive16-comfyui.sprite_workflow", "running", "snake_head"), {
  eventType: "agent.assets.sprite.started",
  label: "Generating sprites",
});
expectActivity(agent, statusEvent("idle"), {
  eventType: "agent.finished",
  label: "Agent finished",
});

assert(agent.agentActivityFromEvent("not json") === undefined, "Invalid JSON should be ignored.");

const liveLogPath = path.join(rootDir, "artifacts", "phase9", "live-agent-proof", "opencode-run.jsonl");
if (existsSync(liveLogPath)) {
  const liveEvents = (await readFile(liveLogPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => agent.agentActivityFromEvent(line))
    .filter(Boolean);
  const liveTypes = new Set(liveEvents.map((event) => event.eventType));
  for (const expected of [
    "agent.files.read",
    "agent.build.finished",
    "agent.input.tested",
    "agent.rom.ran",
    "agent.screenshot.checked",
    "agent.files.edited",
  ]) {
    assert(liveTypes.has(expected), `Live proof log is missing event type: ${expected}`);
  }
}

console.log("Agent prompt and event contract verified.");
