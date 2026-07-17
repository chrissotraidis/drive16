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

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert(start >= 0, `Could not find function ${functionName}`);
  const bodyStart = source.indexOf("{", start);
  assert(bodyStart >= 0, `Could not find body for function ${functionName}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, index + 1);
    }
  }
  throw new Error(`Could not parse body for function ${functionName}`);
}

const agent = await loadAgentModule();
const repairState = agent.createAgentActivityRepairState();
const appSource = await readFile(path.join(rootDir, "app", "src", "App.tsx"), "utf8");
const promptIntentSource = await readFile(
  path.join(rootDir, "app", "src", "agent", "promptIntent.ts"),
  "utf8",
);
const startNewProjectSource = extractFunctionBody(appSource, "startNewProject");
const runAgentPromptSource = extractFunctionBody(appSource, "runAgentPrompt");
const buildEditedProjectIfNeededSource = extractFunctionBody(
  appSource,
  "buildEditedProjectIfNeeded",
);
const failPendingAgentRunSource = extractFunctionBody(appSource, "failPendingAgentRun");
const finishPendingAgentRunSource = extractFunctionBody(appSource, "finishPendingAgentRun");
const appPackageSource = await readFile(path.join(rootDir, "app", "package.json"), "utf8");
const tauriConfig = JSON.parse(
  await readFile(path.join(rootDir, "app", "src-tauri", "tauri.conf.json"), "utf8"),
);
const openCodeConfig = JSON.parse(
  await readFile(path.join(rootDir, "opencode.json"), "utf8"),
);
const playerPaneSource = await readFile(
  path.join(rootDir, "app", "src", "components", "PlayerPane.tsx"),
  "utf8",
);
const chatRailSource = await readFile(
  path.join(rootDir, "app", "src", "components", "ChatRail.tsx"),
  "utf8",
);
const projectMenuSource = await readFile(
  path.join(rootDir, "app", "src", "components", "ProjectMenu.tsx"),
  "utf8",
);
const settingsPanelSource = await readFile(
  path.join(rootDir, "app", "src", "components", "SettingsPanel.tsx"),
  "utf8",
);
const stylesSource = await readFile(path.join(rootDir, "app", "src", "styles.css"), "utf8");
const starterRomSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "starter_rom.rs"),
  "utf8",
);
const nostalgistPlayerSource = await readFile(
  path.join(rootDir, "app", "src", "player", "nostalgist.ts"),
  "utf8",
);
const nostalgistPatchSource = await readFile(
  path.join(rootDir, "app", "patches", "nostalgist@0.21.1.patch"),
  "utf8",
);

assert(
  openCodeConfig.agent["drive16-build"].max_tokens === 3500,
  "Drive16 implementation steps must stay under ~3,500 completion tokens: a longer single response cannot finish inside OpenCode's request ceiling at local-model speeds and stalls the session silently.",
);
assert(
  openCodeConfig.agent["drive16-repair"].max_tokens === 3500,
  "Drive16 repair steps must stay under ~3,500 completion tokens for the same request-ceiling reason.",
);
assert(
  openCodeConfig.agent["drive16-repair"].steps === 16,
  "Drive16 repair needs enough bounded tool steps for read, edit, build, and verification.",
);
assert(
  runAgentPromptSource.includes(
    'const useOllamaBuild = modelProvider === "ollama" && modelConnection.state === "ready"',
  ),
  "Local Ollama builds require a tested (ready) model connection.",
);
assert(
  runAgentPromptSource.includes(
    'const agentProviderId: ModelProvider = useOllamaBuild ? "ollama" : "openrouter"',
  ) && runAgentPromptSource.includes("useOllamaBuild ? ollamaModel : defaultOpenRouterModel"),
  "ROM-changing work must route through the selected provider: tested Ollama locally, OpenRouter otherwise.",
);
assert(
  runAgentPromptSource.includes("const intent = classifyAgentIntent(trimmed"),
  "Prompt routing must go through the unit-tested intent classifier (scripts/verify-prompt-intent.mjs).",
);
assert(
  runAgentPromptSource.includes("const followUp = intent.preserveProject") &&
    runAgentPromptSource.includes("const agentName = intent.agentName"),
  "Preserve-vs-reset and the repair budget must come from the intent classifier: repairs get drive16-repair, feature follow-ups get drive16-build.",
);
assert(
  (runAgentPromptSource.match(/await sendAgentPrompt\(\{/g) ?? []).length === 1,
  "A user ROM-changing prompt must start exactly one model call; repairs require a separate targeted prompt.",
);
assert(
  !runAgentPromptSource.includes("sendOllamaFreeformReply"),
  "Ollama must never appear in the ROM-changing execution path.",
);
assert(
  runAgentPromptSource.includes("let seededPrototypeBuilt = false") &&
    runAgentPromptSource.includes("seededPrototypeBuilt = true"),
  "The build flow must track when Drive16 already built the seeded prototype.",
);
assert(
  runAgentPromptSource.includes("seededPrototypeBuilt,") &&
    runAgentPromptSource.includes('repairMode: agentName === "drive16-repair"'),
  "Implementation and repair prompts must receive the seeded-prototype and repair-pass context.",
);
assert(
  appSource.includes("a developed multi-part MML arrangement unless you asked for no music"),
  "The visible build plan must promise a developed arrangement rather than a disposable short loop.",
);
assert(
  buildEditedProjectIfNeededSource.includes('project.status !== "stale"') &&
    buildEditedProjectIfNeededSource.includes("pending.sawSourceOrResourceEdit") &&
    buildEditedProjectIfNeededSource.includes("await buildActiveProject()"),
  "Drive16 must deterministically build edited source when a model stops before the mechanical build step.",
);
assert(
  failPendingAgentRunSource.includes("await buildEditedProjectIfNeeded(after, pending)") &&
    finishPendingAgentRunSource.includes("await buildEditedProjectIfNeeded(after, pending)"),
  "Both stalled and normally-finished agent runs must recover edited-but-unbuilt projects.",
);
assert(
  appSource.includes('if (projectSummary.romStatus === "warning")') &&
    appSource.includes('label: "Build incomplete"'),
  "A stale source tree must surface as Build incomplete rather than generic Ready.",
);
const viteConfigSource = await readFile(
  path.join(rootDir, "app", "vite.config.ts"),
  "utf8",
);
const projectSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "project.rs"),
  "utf8",
);
const starterGameTemplate = await readFile(
  path.join(rootDir, "examples", "app-starter-blank", "GAME.md"),
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
const projectMemoryVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-project-memory.mjs"),
  "utf8",
);
const genreGateVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-genre-playability-gates.mjs"),
  "utf8",
);
const audioGateVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-audio-evidence-gates.mjs"),
  "utf8",
);
const assetRoleGateVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-asset-role-gates.mjs"),
  "utf8",
);
const liveGameAuditReadinessSource = await readFile(
  path.join(rootDir, "scripts", "check-live-game-audit-readiness.mjs"),
  "utf8",
);
const openCodeAudioTraceVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-opencode-audio-trace.mjs"),
  "utf8",
);
const liveGameAuditVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-live-game-audit.mjs"),
  "utf8",
);
const referenceRunCaptureSource = await readFile(
  path.join(rootDir, "scripts", "capture-reference-run.py"),
  "utf8",
);
const referenceRunVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-reference-run.mjs"),
  "utf8",
);
const liveGameAuditPromptRunnerSource = await readFile(
  path.join(rootDir, "scripts", "run-live-game-audit-prompt.mjs"),
  "utf8",
);
const modelBakeoffVerifierSource = await readFile(
  path.join(rootDir, "scripts", "verify-model-bakeoff-report.mjs"),
  "utf8",
);
const emulatorServerSource = await readFile(
  path.join(rootDir, "mcp-servers", "emulator", "server.py"),
  "utf8",
);
const sgdkBuildServerSource = await readFile(
  path.join(rootDir, "mcp-servers", "sgdk-build", "server.py"),
  "utf8",
);
const comfyUiSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "comfyui.rs"),
  "utf8",
);
const opencodeSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "opencode.rs"),
  "utf8",
);
const nativeMainSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "main.rs"),
  "utf8",
);
const runtimeSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "src", "runtime.rs"),
  "utf8",
);
const tauriBuildPreparationSource = await readFile(
  path.join(rootDir, "scripts", "prepare-drive16-tauri-build.sh"),
  "utf8",
);
const nativeBuildSource = await readFile(
  path.join(rootDir, "app", "src-tauri", "build.rs"),
  "utf8",
);
const screenshotQualitySource = await readFile(
  path.join(rootDir, "scripts", "validate-game-screenshot.py"),
  "utf8",
);
const presentationBaselineSource = await readFile(
  path.join(rootDir, "scripts", "verify-presentation-quality-baseline.sh"),
  "utf8",
);
const skeletonInteractionSource = await readFile(
  path.join(rootDir, "scripts", "verify-skeleton-interaction.py"),
  "utf8",
);
const builderSkill = await readFile(
  path.join(rootDir, "agent", "skills", "drive16-app-builder.md"),
  "utf8",
);
const normalizedBuilderSkill = normalizedText(builderSkill);

for (const expected of [
  "drive16-emulator.verify_audio",
  "dump_audio: true",
  "capture_audio",
  "Build again after your final",
  "an older `out/rom.bin` is stale evidence",
  "verify_audio` returning non-silent audio proves that it plays",
  "boolean argument `dump_audio` set to `true`",
  "retry `run_rom` once with the",
  "mark `PLAYTEST.md` as",
  "only `verify_audio` returning non-silent audio proves that it plays",
  "asset source and path was used for each game role",
  "prefer deterministic SGDK primitives or tiles",
  "Reserve ComfyUI for semantic or styled artwork",
  "Treat `ASSETS.md` as the role ledger",
  "Before generating or wiring assets for a new game, create an `## Asset Plan`",
  "the row notes must include the prompt, crop/slice source and output",
  "audio evidence as captured, silent, or untested",
  "record the role-specific prompt",
  "Drive16 can generate one Genesis-safe sprite PNG at a time",
  "Do not assume ComfyUI can produce a complete sprite sheet",
  "generate and validate separate role-specific sprites",
  "Complete generated games include simple music or SFX",
  "drive16-sgdk-build.audit_project_memory",
  'expect_gate: "fail"',
  "repair them once",
  "send_input` with `reset: true`",
  "a separate `send_input` with `start`",
  "Build the core playable game before optional music",
  "Music is a bounded enhancement, not a",
  "Before the first `compile_music` call",
  "corpus/mml/ctrmml-megadrive.md",
  "at least four active parts",
  "make the repeating section at least sixteen",
  "`quality.pass` is true",
  "Human listening remains the final taste check",
  "do not invent",
  "If two MML compile attempts fail",
  "after the second failed",
  "do not call `compile_music` again",
  "continue building/verifying the gameplay",
  "Playability gate: PASS",
  "Playability gate: FAIL",
  "Snake: score starts at 0",
  "Pong: both paddles and the ball are visible",
  "Tetris: the playfield and next/score/line state are readable",
  "Asteroids-style games: ship, asteroids, and shots are visible",
  "Evidence section must",
  "`Genre checks: pending`",
  "Treat the active project folder, not the chat session, as the source of continuity",
  "modify the current game after reading",
  "Do not restart from a blank project unless the user explicitly asks",
  "Do not rewrite `GAME.md` as if the game already exists before source/resource work has happened",
  "Early project-memory edits are allowed only for an `## Asset Plan`",
  "Never claim `out/rom.bin` is built",
  "Never write `Known Issues: none`",
  "Documentation truth and order",
  "Project memory is evidence, not marketing copy",
  "every early row must say `Planned` or `Pending`",
  "If audio is skipped because the user explicitly asked for no audio, write \"by user request\"",
  "If audio is skipped because a tool failed, timed out, or you ran out of time",
  "examples/game-skeletons/snake-basic/",
  "examples/game-skeletons/asteroids-basic/",
  "examples/game-skeletons/missile-command-basic/",
  "at most two repair builds in one turn",
  "low-level diagnostic",
  "must not award `Playability gate: PASS`",
  "exact `## Quality Review` section",
  "A sparse text-glyph prototype is not the default presentation bar",
  "Run the screenshot quality audit after the final visual edit",
]) {
  assert(
    normalizedBuilderSkill.includes(expected),
    `Builder skill is missing contract text: ${expected}`,
  );
}
assert(
  nostalgistPlayerSource.includes("const fileContent = rom.blob") &&
    !nostalgistPlayerSource.includes("fetch(rom.objectUrl)"),
  "Interactive Play must pass the ROM Blob directly in Tauri WebKit.",
);
for (const expected of [
  'classicJsContent = jsContent.replace("export function getEmscripten"',
  "if (!raArgs.includes(contentPath)) raArgs.push(contentPath)",
  "RWA: typeof RWA === 'undefined' ? null: RWA",
]) {
  assert(
    nostalgistPatchSource.includes(expected),
    `Nostalgist WebKit/content patch is missing: ${expected}`,
  );
}
assert(
  viteConfigSource.includes("/__drive16_test_rom.bin") &&
    appSource.includes('fetch("/__drive16_test_rom.bin")'),
  "Browser development must expose and load the real recovered ROM for shared player tests.",
);

for (const expected of [
  "ensure_generated_genteel_placeholder",
  "Run the Drive16 Tauri build preparation step.",
]) {
  assert(
    nativeBuildSource.includes(expected),
    `Tauri build script is missing generated verifier fallback: ${expected}`,
  );
}

for (const expected of [
  '"kind": "drive16-reference-run"',
  '"referenceOnly": True',
  '("action-baseline", 110, start, False)',
  '("action", 110, action, False)',
  '("idle15", 960, start, False)',
  '"notAllowed": "Claiming model training, copying source, or reusing extracted art/audio."',
]) {
  assert(
    referenceRunCaptureSource.includes(expected),
    `Reference-run capture is missing contract: ${expected}`,
  );
}
for (const expected of [
  'report.kind === "drive16-reference-run"',
  'report.referenceOnly === true',
  '"action-baseline"',
  'captures.get("idle15").frames >= 900',
  'includes("copying source")',
  "Reference run verified:",
]) {
  assert(
    referenceRunVerifierSource.includes(expected),
    `Reference-run verifier is missing contract: ${expected}`,
  );
}

for (const expected of [
  "scripts/build-genteel.sh",
  "app/src-tauri/generated",
  'chmod +x "$GENERATED_DIR/genteel"',
]) {
  assert(
    tauriBuildPreparationSource.includes(expected),
    `Tauri build preparation is missing bundled verifier guard: ${expected}`,
  );
}

for (const expected of [
  'bundled_genteel_bin: repo_root.join("bin/genteel")',
  "if paths.bundled_genteel_bin.is_file()",
  'arg("--script")',
  "input_changed: input_change_ratio > 0.0001",
]) {
  assert(
    starterRomSource.includes(expected),
    `Starter ROM runtime is missing bundled Genteel support: ${expected}`,
  );
}

for (const expected of [
  'setPlayerInputEvidence(preview.inputChanged ? "tested" : "failed")',
  '"baseline.diagnostics"',
  'idle15=${evidence.idleSurvives15Seconds}',
  "Low-level ROM diagnostics completed; semantic review is still required.",
]) {
  assert(
    appSource.includes(expected),
    `App Verify flow is missing deterministic evidence handling: ${expected}`,
  );
}

for (const expected of [
  '"name": "audit_project_memory"',
  '"expect_gate"',
  "PROJECT_MEMORY_AUDIT_SCRIPT",
  '"--expect-gate"',
  '"ok": report.get("status") == "passed"',
]) {
  assert(
    sgdkBuildServerSource.includes(expected),
    `SGDK build MCP is missing project-memory audit support: ${expected}`,
  );
}

for (const expected of [
  "First Build References",
  "examples/game-skeletons/snake-basic/",
  "examples/game-skeletons/asteroids-basic/",
  "proven compact source and audio seed",
]) {
  assert(
    starterGameTemplate.includes(expected),
    `Starter GAME.md template is missing: ${expected}`,
  );
  assert(projectSource.includes(expected), `Native GAME.md fallback is missing: ${expected}`);
}

for (const expected of [
  "Use this file as the role ledger for the game.",
  "Asset Plan",
  "ComfyUI currently generates one Genesis-safe 32x32 sprite PNG at a time.",
  "notes must include prompt, crop/slice, and whether it was used",
  "audio evidence as captured, silent, or untested",
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
  "Genre Acceptance Checklist",
  "When `Playability gate: PASS`, the Evidence section must name each relevant",
  "Passing games must record non-silent audio evidence",
  "Genre checks: pending",
  "Snake | Score starts at 0",
  "Pong | Both paddles and ball are visible",
  "Tetris | Playfield and score/line state are readable",
  "Asteroids | Ship, asteroids, and shots are visible",
  "Quality Review",
  "Screen composition: pending",
  "Style coherence: pending",
]) {
  assert(
    starterPlaytestTemplate.includes(expected),
    `Starter PLAYTEST.md template is missing: ${expected}`,
  );
  assert(projectSource.includes(expected), `Native PLAYTEST.md fallback is missing: ${expected}`);
}

for (const expected of [
  "const genreAuditRules",
  "function latestPlaytestText",
  "function detectedGenre",
  "function missingGenreEvidence",
  "PLAYTEST.md passes",
  "without evidence for",
  "without active music/SFX evidence",
  "does not record compiled music/resource wiring",
  "does not record captured audio evidence",
  "function hasCapturedAudioEvidence",
  "function audioEvidenceIsNegated",
  'replace(/\\bnonSilent\\b/gi, "non-silent")',
  "function hasAssetPlan",
  "function assetRoleIsVague",
  "function generatedAssetRecordsPrompt",
  "does not record crop/slice normalization",
  "GAME.md claims out/rom.bin is built",
  "without an explicit user no-audio request",
  "genre=${report.genre}",
]) {
  assert(
    projectMemoryVerifierSource.includes(expected),
    `Project memory verifier is missing genre audit support: ${expected}`,
  );
}

for (const expected of [
  "verify-genre-playability-gates.mjs",
  "verify-audio-evidence-gates.mjs",
  "verify-asset-role-gates.mjs",
  "check:live-game-audit-readiness",
  "check-live-game-audit-readiness.mjs",
  "prepare:live-game-audit",
  "pnpm check:live-game-audit-readiness && node ../scripts/verify-live-game-audit.mjs --write-template",
  "prepare:live-game-audit:prompt",
  "run-live-game-audit-prompt.mjs",
  "run:live-game-audit:prompt",
  "run-live-game-audit-prompt.mjs --run-agent",
  "verify:opencode-audio-trace",
  "verify-opencode-audio-trace.mjs --self-test",
  "verify:live-game-audit",
  "verify-live-game-audit.mjs --self-test",
  "verify:live-game-audit:report",
  "verify-live-game-audit.mjs --require-complete --require-files",
  "prepare:model-bakeoff",
  "pnpm verify:live-game-audit:report && node ../scripts/verify-model-bakeoff-report.mjs --write-template",
  "verify-project-memory.mjs && node ../scripts/verify-genre-playability-gates.mjs && node ../scripts/verify-audio-evidence-gates.mjs && node ../scripts/verify-asset-role-gates.mjs",
  "verify:model-bakeoff",
  "verify-model-bakeoff-report.mjs --self-test",
  "verify:model-bakeoff:report",
  "verify-model-bakeoff-report.mjs --require-complete --require-files",
]) {
  assert(appPackageSource.includes(expected), `Package scripts are missing verification support: ${expected}`);
}

for (const expected of [
  "promote:model-bakeoff",
  "promote-model-bakeoff-runs.mjs",
]) {
  assert(appPackageSource.includes(expected), `App package scripts are missing: ${expected}`);
}

for (const expected of [
  "Snake",
  "Pong",
  "Tetris",
  "Asteroids",
  "Genre checks: pending.",
  "PLAYTEST.md passes ${genre.label} without evidence for",
  "Genre playability fixture gates verified",
]) {
  assert(
    genreGateVerifierSource.includes(expected),
    `Genre playability fixture verifier is missing: ${expected}`,
  );
}

for (const expected of [
  "missing-audio",
  "good-audio",
  "good-camel-case-audio",
  "uncaptured-audio",
  "explicit-no-audio",
  "self-omitted-audio",
  "without active music/SFX evidence",
  "without an explicit user no-audio request",
  "does not record captured audio evidence",
  "Audio evidence fixture gates verified",
]) {
  assert(
    audioGateVerifierSource.includes(expected),
    `Audio evidence fixture verifier is missing: ${expected}`,
  );
}

for (const expected of [
  "good-generated-role",
  "missing-asset-plan",
  "vague-generated-role",
  "missing-generated-crop",
  "missing-generated-use",
  "uses a vague role",
  "does not record crop/slice normalization",
  "Asset role fixture gates verified",
]) {
  assert(
    assetRoleGateVerifierSource.includes(expected),
    `Asset role fixture verifier is missing: ${expected}`,
  );
}

for (const expected of [
  "readyForLiveAudit",
  "readyForPrimitiveAudit",
  "readyForGeneratedSpriteAudit",
  "Primitive/fallback audit readiness",
  "Generated-sprite audit readiness",
  "Docker daemon for SGDK builds",
  "OpenCode config and MCP tools",
  "OpenRouter credential",
  "ComfyUI sprite readiness",
  "Agent/UI contract checks",
  "Project memory gates",
  "Live audit verifier self-test",
  "Fix required blocker",
  "Run the primitive/fallback live audit now",
  "fallback-disclosed",
]) {
  assert(
    liveGameAuditReadinessSource.includes(expected),
    `Live game audit readiness checker is missing guard: ${expected}`,
  );
}

for (const expected of [
  "const requiredPrompts",
  "snake-basic",
  "pong-basic",
  "tetris-basic",
  "asteroids-basic",
  'arg === "--"',
  "--run-agent",
  "--agent",
  "DRIVE16_LIVE_AUDIT_MODEL",
  "readyForPrimitiveAudit",
  "readyForGeneratedSpriteAudit",
  "examples",
  "app-starter-blank",
  "opencode-run.jsonl",
  "opencode-run.status.json",
  "OpenCode emitted an API error.",
  "createWriteStream",
  "spawn(\"opencode\"",
  "run-record.json",
  "verify-project-memory.mjs",
  "verify-opencode-audio-trace.mjs",
  "Do not claim ComfyUI-generated sprites were used",
  "generate-project-memory.mjs",
  "stamps the mechanical evidence rows",
  "Date.now()",
  "captureStableFrame",
  "scripts/capture-game-screenshot.py",
  '"--frames", "180"',
  "--evidence-only",
  "Snake first-build reference",
  "Snake first-build seed",
  "firstBuildSeed",
  "--allow-seeded-source",
  "examples/game-skeletons/snake-basic",
  "emulatorInputScriptPath",
  "run_rom call of at least 180 frames",
  "await rm(emulatorInputScriptPath, { force: true })",
]) {
  assert(
    liveGameAuditPromptRunnerSource.includes(expected),
    `Live game audit prompt runner is missing guard: ${expected}`,
  );
}

for (const expected of [
  "fn managed_child_is_running",
  "fn reserve_owned_endpoint",
  "fn reserve_ephemeral_endpoint",
  "Never attach the desktop app to an arbitrary healthy OpenCode server",
  "Drive16 launched its own build agent",
  "Stop only the child we own",
  "move Drive16 to a fresh local port",
  "OpenCode restart needs a free owned port",
  "pub fn abort_opencode_session",
  'format!("/session/{}/abort", session_id)',
  "set_current_endpoint(endpoint)",
]) {
  assert(opencodeSource.includes(expected), `OpenCode startup ownership is missing: ${expected}`);
}
assert(
  !opencodeSource.includes("pkill"),
  "OpenCode startup ownership regressed: source must not use global pkill",
);

for (const expected of [
  '"name": "verify_audio"',
  "def verify_audio",
  '"action": "verify_audio"',
  '"dump_audio": True',
  "capture_audio()",
]) {
  assert(emulatorServerSource.includes(expected), `Emulator MCP server is missing verify_audio support: ${expected}`);
}

for (const expected of [
  '"name": "verify_screen"',
  "def verify_screen",
  '"action": "verify_screen"',
  "validate-game-screenshot.py",
]) {
  assert(
    emulatorServerSource.includes(expected),
    `Emulator MCP server is missing verify_screen support: ${expected}`,
  );
}

for (const expected of [
  "analyzeOpenCodeAudioTrace",
  "validateOpenCodeAudioTrace",
  "goodOpenCodeAudioTraceFixture",
  "goodOpenCodeGameTraceFixture",
  "expectGameProgress",
  "allowSeededSource",
  "--allow-seeded-source",
  "sourceOrResourceEditCalls",
  "buildRomAfterLastSourceOrResourceEdit",
  "verifyAudioCalls",
  "verifyAudioSuccesses",
  "compileMusicFailures",
  "no drive16-sgdk-build.build_rom call",
  "edited source/resources but never rebuilt afterward",
  "sourceEditWithoutBuildTrace",
  "drive16-emulator_verify_audio",
  "no run_rom call with dump_audio=true",
  "no drive16-emulator.capture_audio call",
  "repeated run_rom calls omitted dump_audio=true",
  "repeated failed compile_music calls after the two-attempt cap",
  "badMmlLoopTrace",
  "compile_music=${result.summary.compileMusicCalls}",
  "OpenCode audio trace verifier self-test passed",
]) {
  assert(
    openCodeAudioTraceVerifierSource.includes(expected),
    `OpenCode audio trace verifier is missing guard: ${expected}`,
  );
}

for (const expected of [
  "const requiredPrompts",
  "snake-basic",
  "pong-basic",
  "tetris-basic",
  "asteroids-basic",
  "previewLoaded",
  "screenVisible",
  "inputResponded",
  "restartTested",
  "audioKnown",
  "assetLedgerUpdated",
  "gameplayRulesTested",
  "projectMemoryAudited",
  "plumbing.comfyUiStatus must be ready, fallback-disclosed, or disabled.",
  "--readiness <file>",
  "function templatePlumbingFromReadiness",
  "function templateSummaryFromReadiness",
  "readyForGeneratedSpriteAudit",
  "Live game audit template verified",
  "This is not a completed live audit",
  "--require-complete --require-files",
  "cannot pass until checks.${field} is true.",
  "audio must be captured or disabled by request.",
  "validateOpenCodeAudioTrace",
  "goodOpenCodeGameTraceFixture",
  "expectGameProgress: true",
  "function projectProofFiles",
  "function staleRomProofFiles",
  "romPath is stale",
  "rebuild after newer source/resource file",
  "Live game audit self-test rejected stale ROM evidence.",
  "OpenCode trace is not valid",
  "Live game audit self-test rejected incomplete pass evidence.",
]) {
  assert(
    liveGameAuditVerifierSource.includes(expected),
    `Live game audit verifier is missing evidence guard: ${expected}`,
  );
}

for (const expected of [
  "requiredPromptIds",
  "snake-basic",
  "pong-basic",
  "tetris-basic",
  "asteroids-basic",
  "Bakeoff must include DeepSeek V3.1.",
  "plumbing.${gate} must be pass before running model bakeoff.",
  "--require-files",
  "function relativeOrAbsoluteExists",
  "evidence.playtestPath does not exist",
  "evidence.auditReportPath does not exist",
  "evidence.screenshotPath does not exist",
  "evidence.screenQualityPath does not exist",
  "screenshot-quality contract version 2",
  "presentation score contradicts its screenshot-quality report",
  "Model bakeoff report is missing",
  "prepare:model-bakeoff only after the completed live audit passes",
  "Missing run for ${model.id} / ${prompt.id}; all models must use the same required prompts.",
  "recommendedDefault.modelId must reference a tested model.",
  "Model bakeoff report self-test rejected incomplete fixture.",
]) {
  assert(
    modelBakeoffVerifierSource.includes(expected),
    `Model bakeoff verifier is missing evidence guard: ${expected}`,
  );
}

for (const expected of [
  '"contractVersion": 2',
  "flat prototype palette",
  "more than 84% of the frame",
  "Sparse prototype screenshot fixture was not rejected",
]) {
  assert(
    screenshotQualitySource.includes(expected),
    `Screenshot quality validator is missing presentation-v2 guard: ${expected}`,
  );
}

for (const expected of [
  "artifacts/phase9/presentation-baseline",
  "--audio-report",
  "Presentation baseline passed for Snake, Pong, Tetris, and Asteroids.",
]) {
  assert(
    presentationBaselineSource.includes(expected),
    `Presentation baseline verifier is missing: ${expected}`,
  );
}

for (const expected of [
  '"inputChangedFrame"',
  '"restartMatchedFreshState"',
  '"idleSurvives15Seconds"',
  '"visibleRestartPathTested"',
  '"gameOverRestartMatchedFreshState"',
  '"gameOverRestartDifferenceRatio"',
  'report["gameOverRestartMatchedFreshState"] is not False',
  'reset_button = "c" if args.game == "missile-command" else "start"',
  "(reset_frame, [reset_button])",
]) {
  assert(
    skeletonInteractionSource.includes(expected),
    `Skeleton interaction verifier is missing: ${expected}`,
  );
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
  'const conversationStorageKey = "drive16.conversation.v2"',
  "parsed.projectName !== loadActiveProjectName()",
  "projectName: projectSummary.name",
  "const projectName = loadActiveProjectName(",
  'setProjectSource(isTauriRuntime() ? "tauri" : "browser-local")',
  'setAgentRom({ path: project.romPath, stamp: Date.now() })',
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
  "function refreshOllamaModels",
  "function loadOllamaModels",
  'fetch(`${baseUrl}/api/tags`',
  "function canPlayActiveRom",
  'return projectSummary.romStatus === "ready"',
  "type ProjectAssetRole",
  "assetRoles: ProjectAssetRole[]",
  "previewDataUrl?: string",
  'type AgentPhase = "idle" | "planning" | "editing" | "building" | "testing" | "done" | "failed"',
  "function agentPhaseFromEvent",
  "function agentPhaseLabel",
  'setAgentPhase("planning")',
  'setAgentPhase("failed")',
  'agentPhaseLabel={agentPhase === "idle" ? "" : agentPhaseLabel(agentPhase)}',
  'if (eventType === "agent.verification.passed") return "done"',
  'if (eventType === "agent.finished") return "testing"',
  "type ProjectTrustStage",
  'projectSummary.trustStage === "reviewed"',
  'label: "Failed Review"',
  'label: "Built"',
  'starterBusy || buildState === "building" || !activeRomPlayable',
  "const recentDuplicate = current",
  ".slice(-8)",
  "event.type === type && event.detail === detail",
  'type.toLowerCase().endsWith("updated")',
  "function resetBuildActivityLog",
  "const openCodeHeartbeatTimeoutMs = 15_000",
  "function clearOpenCodeHeartbeatTimer",
  "openCodeHeartbeatTimerRef.current = window.setTimeout",
  '"project.active.rom.restored"',
  "Active project ROM restored and loading in the player.",
  "type ProjectMemoryAuditResult",
  'invoke<ProjectMemoryAuditResult>("audit_active_project_memory")',
  "function surfaceAgentCompletionAudit",
  "The ROM exists, but I’m not marking this game done.",
  "Playability gate: FAIL",
  "Playability unverified",
  "Review still required",
  '"agent.verification.claim_rejected"',
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
  "function recordPendingAgentMilestone",
  "function pendingAgentStallDetail",
  "function sourceOrResourcePathWasEdited",
  "function pendingAgentProducedFreshRom",
  "pending.sawSourceOrResourceEdit && pending.sawBuildFinished",
  "const canBeFresh = pendingAgentProducedFreshRom(pending)",
  "const producedFreshRom = pendingAgentProducedFreshRom(pending)",
  "label: projectSummary.name",
  'return "Assets: custom tile art"',
  "sawSourceOrResourceEdit",
  "sawBuildStarted",
  "sawBuildFinished",
  "sawScreenCheck",
  "sawInputTest",
  "sawAudioCheck",
  "agentWatchdogVerdict(",
  "pending.lastActivityAt = Date.now()",
  "abortAgentSession(sessionId)",
  "agent.stalled.rom_recovered",
  "musicCompileAttempts",
  "exceeded the two-attempt music compile limit",
  "project.agentProjectPath || project.projectPath",
  "edited game source/resources but did not rebuild the ROM afterward",
  "hit a build failure and did not complete the repair/rebuild loop",
  "built a ROM but did not capture a screen check afterward",
  "checked the screen but did not run an input test afterward",
  "tested input but did not verify audio or record why audio was skipped",
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
  'current === "visible" || current === "captured"',
  "playerScreenEvidence={playerScreenEvidence}",
  "romUnavailable={!activeRomPlayable}",
  "guardUnverifiedModelReply(reply.content)",
  "message.model.guarded",
  "classifyAgentIntent(trimmed",
  "pendingAgentRunStorageKey",
  "loadPersistedPendingAgentRun",
  "clearPersistedPendingAgentRun",
  "Builds default to DeepSeek V3.1 through OpenRouter.",
  'label: "No fresh ROM produced"',
  "followUp ? await ensureActiveProject() : await resetActiveProject()",
  'projectSummary.name || loadActiveProjectName("Untitled Project")',
  '["tetris", "Tetris"]',
  "The agent produced a ROM file. I’m loading it now, but it is not marked playable until Drive16 has screen, input, and audio evidence.",
  'label: "ROM built, checking"',
  "type RomPreviewLoadResult",
  "function reconcilePendingAgentRom",
  "function adoptFreshAgentRom",
  "projectRefreshTimer",
  'appendOpenCodeEvent("agent.rom.adopted", project.romPath)',
  "surfaceAgentCompletionAudit(memoryAudit)",
  "ROM preview failed: ${previewResult.detail}",
  'label: "Preview failed"',
  '"preview.failed"',
  '"agent.verification.failed"',
  '"agent.verification.passed"',
  "Agent ROM preview captured. Playability still needs input/audio evidence.",
  'setBuildState("running")',
  "audioMaxAbs",
  "preview.audio.captured",
  "preview.audio.silent",
  '"agent.rom.built"',
  '"Built; not playable"',
  'label: "Visible review failed"',
  'label: "Player ready — muted"',
  "Sound starts muted as a safety precaution.",
  "Sound is enabled at",
  "setNostalgistVolume",
  "setNostalgistMuted",
  "detectNostalgistAudioSignal",
  "defaultPlayerVolume",
  "seedActiveProjectForPrompt",
  "buildActiveProject",
  'const agentProviderId: ModelProvider = useOllamaBuild ? "ollama" : "openrouter"',
  "const agentName = intent.agentName",
  "agent.seeded",
  "agent.seed.built",
  'label: "Prototype built"',
  "Starter code seeded; no ROM built yet",
  'label: "Screen visible"',
  'label: mostlyUnknown ? "Live screen check unavailable" : "Screen not verified"',
  '"The game screen is visible and updating."',
]) {
  assert(appSource.includes(expected), `App lifecycle source is missing: ${expected}`);
}
assert(
  appSource.includes('setAgentRom({ path: project.romPath, stamp: Date.now() })'),
  "App startup must restore an existing active-project ROM into the player.",
);
for (const expected of [
  "active-project.previous",
  "renameSync(activeProject, previousActiveProject)",
  "examples/game-skeletons/missile-command-basic",
  'request.url === "/build"',
  "buildBrowserProject",
]) {
  assert(viteConfigSource.includes(expected), `Browser project reset is missing backup behavior: ${expected}`);
}
for (const expected of [
  "PREVIOUS_ACTIVE_PROJECT_DIRECTORY",
  "fs::rename(&active, &previous)",
  "fs::rename(&previous, &active)",
]) {
  assert(projectSource.includes(expected), `Native project reset is missing backup behavior: ${expected}`);
}
assert(
  !appSource.includes("window.sessionStorage.setItem(openRouter"),
  "OpenRouter key must not be saved to sessionStorage; refresh should keep it.",
);
assert(tauriConfig.bundle?.active === true, "Tauri release bundling must stay enabled.");
assert(
  typeof tauriConfig.app?.security?.csp === "string" && tauriConfig.app.security.csp.length > 0,
  "Tauri release CSP must be explicit.",
);
assert(
  Object.keys(tauriConfig.bundle?.resources ?? {}).length >= 8,
  "Tauri bundle must include the Drive16 support runtime.",
);
for (const expected of [
  "install_packaged_runtime",
  ".resource_dir()",
  'resource_dir.join("drive16-support")',
  ".app_data_dir()",
  'app_data_dir.join("runtime")',
  'env::var_os("DRIVE16_REPO_ROOT")',
  '"opencode.json"',
]) {
  assert(runtimeSource.includes(expected), `Packaged runtime source is missing: ${expected}`);
}
assert(
  nativeMainSource.includes("runtime::initialize(app)?"),
  "Native startup must initialize the packaged runtime before commands run.",
);
assert(
  appSource.includes("import.meta.env.VITE_DRIVE16_ALLOW_STREAMED_CORE") &&
    appSource.includes("downloadStreamedInteractiveCore()") &&
    appSource.includes("unzipSync(new Uint8Array(await response.arrayBuffer()))") &&
    tauriBuildPreparationSource.includes("VITE_DRIVE16_ALLOW_STREAMED_CORE=1") &&
    String(tauriConfig.app?.security?.csp ?? "").includes("https://cdn.jsdelivr.net") &&
    String(tauriConfig.app?.security?.csp ?? "").includes("'wasm-unsafe-eval'"),
  "Direct-download releases must explicitly enable and permit the streamed Play core.",
);
for (const expected of [
  "disposeInteractivePlayer();",
  'setPlayerState("stopped")',
  'setPlayerAudio("unavailable")',
  "setLoadedPlayerRom(undefined)",
  "setAgentRom(undefined)",
  "resetBuildActivityLog()",
]) {
  assert(startNewProjectSource.includes(expected), `New project reset is missing: ${expected}`);
}
assert(
  !startNewProjectSource.includes("setPlayerVolume(defaultPlayerVolume)"),
  "New project reset must preserve the saved player volume while starting muted.",
);

for (const expected of [
  "export const defaultPlayerVolume = 60",
  "const retroarchVolumeStepDb = 0.5",
  "const retroarchMaxAttenuationDb = 60",
  "const playerVolumeCurveExponent = 2",
  "audio_mute_enable: true",
  "audio_mixer_mute_enable: false",
  "audio_volume: 0",
  "audio_mixer_volume: 0",
  "emscripten?.RWA?.context",
  "installAudioProbe(runtime)",
  "runtime.audioSignalDetected ? \"signal\" : \"enabled\"",
  "Cannot push NULL or empty core path into the playlist",
  'if (!runtime.muted) runtime.instance.sendCommand("MUTE")',
  'runtime.instance.sendCommand("MUTE")',
  "playerVolumeToAttenuationSteps(nextVolume)",
  "const amplitude = normalized ** playerVolumeCurveExponent",
  "-20 * Math.log10(amplitude)",
]) {
  assert(
    nostalgistPlayerSource.includes(expected),
    `Nostalgist player source is missing audio safety guard: ${expected}`,
  );
}

function expectedVolumeSteps(percent) {
  if (percent <= 0) return 120;
  const amplitude = (percent / 100) ** 2;
  return Math.round(Math.min(60, Math.max(0, -20 * Math.log10(amplitude))) / 0.5);
}

assert(expectedVolumeSteps(5) === 104, "5% player volume must map to -52 dB.");
assert(expectedVolumeSteps(10) === 80, "10% player volume must map to -40 dB.");
assert(expectedVolumeSteps(60) === 18, "60% player volume must map to about -9 dB.");
assert(
  expectedVolumeSteps(5) - expectedVolumeSteps(10) === 24,
  "5% and 10% must differ by 12 dB, not one or two RetroArch steps.",
);

for (const expected of [
  'aria-label="Ollama model"',
  'aria-label="Refresh Ollama models"',
  "ollamaModelOptions.map",
  'data-testid="advanced-ollama-setup"',
  "Advanced Ollama setup",
  "Local endpoint",
  "function spriteEnhancementReadiness",
  "function missingComfyUiChecks",
  "Missing model + LoRA",
  "Missing model",
  "Missing LoRA",
  "Not running",
  "Starts local pixel-art tools automatically",
  "The browser can use a running ComfyUI service, but cannot start it automatically.",
  "Drive16 could not auto-start sprite tools. Try Start sprite tools again.",
  "Open Advanced sprite setup for technical details.",
]) {
  assert(
    settingsPanelSource.includes(expected),
    `Settings panel is missing specific ComfyUI readiness labeling: ${expected}`,
  );
}

for (const expected of [
  "function comfyUiActivityDetail",
  "comfyUiAutoLaunchAttemptedRef",
  "void launchComfyUiConnection();",
  "Sprite tools are not running. AI sprites remain optional.",
  "Sprite tools need model setup. Open Advanced sprite setup.",
]) {
  assert(appSource.includes(expected), `App is missing concise sprite activity copy: ${expected}`);
}

for (const expected of [
  "const LAUNCH_LOG_RELATIVE",
  "struct ManagedComfyUiProcess",
  "endpoint: LocalEndpoint",
  "fn start_comfyui",
  "fn comfyui_launch_exit_detail",
  "fn launch_log_tail",
  "ComfyUI launch exited before the API became ready",
  "Launch log tail",
  "drive16-comfyui-launch.log",
  "stdout(Stdio::from(launch_log))",
  "stderr(Stdio::from(launch_log_for_stderr))",
  "launch_log_tail_reports_recent_lines",
  "start_comfyui_reports_missing_launch_script",
  "start_comfyui_relaunches_when_endpoint_changes",
]) {
  assert(
    comfyUiSource.includes(expected),
    `ComfyUI native launch diagnostics are missing: ${expected}`,
  );
}

for (const expected of [
  'data-testid="project-asset-roles"',
  "Asset roles",
  "ASSETS.md has no role rows yet.",
  "previewDataUrl",
  "asset-role-thumb",
  "assetHealthState",
  "shortAssetSymbol",
]) {
  assert(projectMenuSource.includes(expected), `Project menu is missing asset ledger UI: ${expected}`);
}

for (const expected of [
  ".asset-role-list",
  ".asset-role-row",
  ".asset-role-state",
  ".asset-role-thumb",
  ".asset-role-empty",
]) {
  assert(stylesSource.includes(expected), `Styles are missing asset ledger UI: ${expected}`);
}

for (const expected of [
  "preview_data_url",
  "MAX_ASSET_PREVIEW_BYTES",
  "clean_asset_symbol_path",
  "data:image/png;base64,",
]) {
  assert(projectSource.includes(expected), `Native project summary is missing asset preview support: ${expected}`);
}

for (const expected of [
  "romUnavailable",
  "playerScreenEvidence",
  "playerInputEvidence",
  'data-testid="playtest-evidence"',
  "ShieldCheck",
  "EvidencePill",
  "type EvidenceState",
  "type ProjectTrustStage",
  "playabilityGateLabel",
  "Overall: no ROM",
  "Stage: Prototype",
  "Stage: Built",
  "Stage: Playable",
  "Stage: Reviewed",
  "Stage: Failed review",
  "Screen: no ROM",
  "Screen: frame captured",
  "Screen: visible",
  "Screen: auto-check unavailable",
  "Screen: not checked",
  "Input: no ROM",
  "Input: untested",
  "Input: testing",
  "Input: tested",
  "Input: failed",
  "sessionActive",
  "inputEvidenceState",
  "Audio: no ROM",
  "Audio file: checking",
  "Audio file: signal found",
  "Audio: silent",
  "Audio: not included",
  "Audio: failed",
  "Audio: muted",
  "Audio: unverified",
  "audioEvidenceState",
  "playerAudioEvidence",
  "playerVolume",
  'data-testid="player-volume-slider"',
  'aria-label="Player volume"',
  'return "Muted"',
  'if (state === "needs-gesture") return "Unavailable"',
  'return "On"',
  'return "Unavailable"',
  "ROM READY",
  'romUnavailable || playerScreenEvidence === "none"',
  'disabled={!sessionActive || romAudioAvailable === false}',
  "Retry sound",
  "needs-gesture",
  "Start a ROM before changing audio",
  "Try to enable audio for this player session",
  '"NO ROM"',
  '"No ROM"',
  'playerState === "paused"',
  '? "Paused"',
  'playerState === "paused" ? "Resume" : "Pause"',
  'playerState === "paused" ? <Play size={15} /> : <Pause size={15} />',
]) {
  assert(playerPaneSource.includes(expected), `Player pane source is missing: ${expected}`);
}

for (const expected of [
  "restartNostalgistPlayer(runtime, restartAction)",
  'playerInputActionForId(projectSummary.restartAction, "controller", "Restart")',
  "Drive16 will not substitute an emulator reset.",
  'label: "Restart unavailable"',
  '"player.restart.failed"',
  '`${sourcePath}; path=${restartAction.id}`',
]) {
  assert(appSource.includes(expected), `Game recovery restart is missing: ${expected}`);
}

for (const expected of [
  "This project does not document a game recovery control.",
  "runtime.instance.press({ button, player: 1, time: 220 })",
  "function browserAudioOutputSupported()",
  'typeof browserGlobal.AudioContext === "function"',
  "ctx.createBufferSource()",
  "ctx.createBuffer(1, 1, 22_050)",
]) {
  assert(
    nostalgistPlayerSource.includes(expected),
    `Nostalgist recovery input is missing: ${expected}`,
  );
}

for (const expected of [
  '"agent.rom.built": "ROM"',
  '"agent.finished": "Testing"',
  '"agent.verification.passed": "Verified"',
  '"agent.verification.failed": "Verify"',
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
  "Connected {heartbeat.time}",
  "OpenCode is still connected and sending heartbeat events",
  'aria-label={buildLogExpanded ? "Make build log smaller" : "Make build log larger"}',
  'aria-label={buildLogOpen ? "Hide build log" : "Show build log"}',
  "isLowSignalPlayerEvent",
  "agentPhaseLabel",
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
  ".agent-activity b",
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
  "fn project_memory_pass_warnings",
  "fn project_memory_truth_warnings",
  "fn markdown_section",
  "fn evidence_has_unfinished_marker",
  "pub struct PromptSeedResult",
  "pub fn seed_active_project_for_prompt",
  "fn seed_active_project_for_prompt_in_repo",
  "fn looks_like_simple_snake_request",
  "fn looks_like_simple_missile_command_request",
  "fn looks_like_blank_starter_main",
  "SNAKE_BASIC_SKELETON",
  "MISSILE_COMMAND_BASIC_SKELETON",
  "pub fn build_active_project",
  "fn build_active_project_for_repo",
  "fn detected_game_genre",
  "fn has_captured_or_omitted_audio",
  "fn audio_disabled_by_user_request",
  "fn audio_self_omitted_without_user_request",
  "GAME.md claims out/rom.bin is built",
  "without an explicit user no-audio request",
  "PLAYTEST.md pass still has pending or untested evidence",
  "PLAYTEST.md pass is missing {} genre evidence",
  "PLAYTEST.md pass does not record captured audio or an explicit no-audio request",
  "active_project_memory_defaults_start_with_failed_gate",
  "project_memory_pass_rejects_pending_evidence",
  "project_memory_pass_accepts_complete_native_evidence",
  "project_memory_warns_on_premature_rom_and_self_omitted_audio_claims",
]) {
  assert(projectSource.includes(expected), `Project memory audit source is missing: ${expected}`);
}

for (const expected of [
  "async fn audit_active_project_memory",
  "project::audit_active_project_memory",
  "audit_active_project_memory,",
  "async fn seed_active_project_for_prompt",
  "project::seed_active_project_for_prompt",
  "seed_active_project_for_prompt,",
  "async fn build_active_project",
  "project::build_active_project",
  "build_active_project,",
]) {
  assert(nativeMainSource.includes(expected), `Native command wiring is missing: ${expected}`);
}

for (const relativePath of [
  "examples/game-skeletons/missile-command-basic/src/main.c",
  "examples/game-skeletons/missile-command-basic/res/resources.res",
  "examples/game-skeletons/missile-command-basic/res/missile_cursor.png",
  "examples/game-skeletons/missile-command-basic/res/defense_city.png",
  "examples/game-skeletons/missile-command-basic/res/missile_theme.mml",
  "examples/game-skeletons/missile-command-basic/res/missile_theme.vgm",
  "examples/game-skeletons/missile-command-basic/GAME.md",
  "examples/game-skeletons/missile-command-basic/ASSETS.md",
  "examples/game-skeletons/missile-command-basic/PLAYTEST.md",
]) {
  assert(existsSync(path.join(rootDir, relativePath)), `Missile Command seed is missing: ${relativePath}`);
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
    seededPrototypeBuilt: true,
    repairMode: false,
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
  "Do not polish project docs before gameplay exists",
  "Early ASSETS.md planning rows are okay only when marked Planned or Pending",
  "After source/resource edits, build, emulator checks, input checks, and audio checks",
  "Verification contract:",
  "Do not call the game done or playable just because out/rom.bin exists.",
  "Never claim out/rom.bin is built unless build_rom succeeded after the final source/resource edit.",
  "Never write Known Issues: none unless PLAYTEST.md passes with evidence.",
  "Never claim audio was omitted unless the user explicitly requested no audio",
  "follow the Seeded prototype boundary below",
  "Do not use todo-list tools for simple generated games",
  "Keep the first implementation small",
  "Do not read README.md, Makefile, src/boot/*, or res/resources.*",
  "Build after the final code/resource edit; an older out/rom.bin is stale evidence.",
  "Build the core playable game before optional music unless the user specifically asked for music first.",
  "Seeded prototype already built: yes",
  "Pass kind: implementation",
  "Drive16 already built and tested the seeded scaffold before this model call",
  "Do not copy a Makefile, rebuild the unchanged seed",
  "make a concrete source or resource edit before the first build_rom call",
  "Use only SGDK APIs that are present in the starter or local examples",
  "Do not use VDP_drawRect, srand, or C library rand()",
  "VDP_fillTileMapRect",
  "examples/game-skeletons/snake-basic/",
  "Build the ROM, run it, call verify_screen, test input, and capture audio when sound is expected.",
  "verify_screen is a low-level diagnostic, not authority to write Playability gate: PASS",
  "Never write Project stage: PLAYABLE or Project stage: REVIEWED",
  "Never use raw VRAM tile numbers as art",
  "Pause checks must prove both pause and resume",
  "Immediately after build_rom succeeds, do not inspect or rewrite docs",
  "verify_audio with use_input_script false",
  "If audio is expected, use drive16-emulator.verify_audio",
  "Before compiling MML music, read or query corpus/mml/ctrmml-megadrive.md",
  "if two compile attempts fail, record audio as failed",
  "The two-attempt MML cap is strict",
  "do not call compile_music a third time",
  "Original music is disabled: reuse a verified seeded VGM/XGM resource",
  "If any screen, input, or audio check is missing or failed",
  "Drive16 settings:",
  "AI sprites: enabled",
  "MML music: disabled",
  "ComfyUI endpoint: http://127.0.0.1:8188",
  "ComfyUI checkpoint: sd_xl_base_1.0.safetensors",
  "ComfyUI LoRA: pixel-art-xl.safetensors",
  "test the drive16-comfyui tool itself",
  "final game must not remain a primitive-only prototype",
  "make snake",
]) {
  assert(prompt.includes(expected), `Prompt context is missing: ${expected}`);
}

const targetedRepairPrompt = agent.agentPromptWithProject(
  "artifacts/phase3/active-project",
  "fix the unchanged seeded build",
  {
    spriteGeneration: true,
    musicGeneration: true,
    seededPrototypeBuilt: true,
    repairMode: true,
    comfyUiEndpoint: "http://127.0.0.1:8188",
    comfyUiCheckpoint: "sd_xl_base_1.0.safetensors",
    comfyUiLora: "pixel-art-xl.safetensors",
    comfyUiState: "ready",
    comfyUiDetail: "Local sprite generation is ready.",
  },
);

for (const expected of [
  "Pass kind: targeted repair",
  "This is the single permitted repair pass after a specific failed check",
  "Fix the failure named in the user request without broad discovery or unchanged rebuilds",
  "If the fix cannot be completed in this pass, stop and report the exact blocker",
  "Original music is enabled. A seeded VGM is baseline scaffolding",
  "Use at least five active parts",
  "recognizable A/B phrase with rhythmic and melodic variation",
  "repeating section at least sixteen seconds long",
  "Require compile_music quality.pass",
]) {
  assert(targetedRepairPrompt.includes(expected), `Targeted repair prompt is missing: ${expected}`);
}

for (const expected of [
  "VDP_loadTileData",
  "VDP_fillTileMapRect",
  "Do not use `VDP_drawRect`",
]) {
  assert(starterAssetsTemplate.includes(expected), `Starter asset guidance is missing: ${expected}`);
}

const appFollowUpContract = [
  "I’ll treat this as a follow-up on the current project",
  "read the game notes",
  "make the requested change in the active folder",
  "rebuild, and check the screen/input/audio evidence",
];
for (const expected of appFollowUpContract) {
  assert(appSource.includes(expected), `App follow-up contract is missing: ${expected}`);
}
const promptIntentContract = [
  "export function looksLikeFollowUpPrompt",
  "export function classifyAgentIntent",
  "export function explicitNewGamePhrase",
  "preserveProject = context.projectHasGame",
];
for (const expected of promptIntentContract) {
  assert(
    promptIntentSource.includes(expected),
    `Prompt intent classifier contract is missing: ${expected}`,
  );
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
  eventType: "agent.screenshot.captured",
  label: "Screenshot captured",
});
expectActivity(agent, toolEvent("drive16-emulator.verify_screen", "completed", "quality pass"), {
  eventType: "agent.screenshot.checked",
  label: "Screen quality passed",
});
expectActivity(agent, toolEvent("drive16-emulator.capture_audio", "completed", "last-audio.wav"), {
  eventType: "agent.audio.checked",
  label: "Audio checked",
});
expectActivity(agent, toolEvent("drive16-emulator.verify_audio", "completed", "last-audio.wav"), {
  eventType: "agent.audio.checked",
  label: "Audio verified",
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
    "agent.screenshot.captured",
    "agent.files.edited",
  ]) {
    assert(liveTypes.has(expected), `Live proof log is missing event type: ${expected}`);
  }
}

console.log("Agent prompt and event contract verified.");
