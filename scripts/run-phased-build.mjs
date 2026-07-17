#!/usr/bin/env node
// Phased Drive16 build runner: implement → art → music → polish.
//
// The P1-G0 benchmark proved that gameplay, art, and music cannot share one
// bounded agent pass: assets get generated and the game never gets built.
// This runner gives each concern its own bounded OpenCode session over the
// same project folder, verifies every pass DETERMINISTICALLY (fresh ROM,
// screen, audio — never trusting model claims), stamps mechanical evidence
// between passes, and records a per-pass ledger.
//
// Usage:
//   node scripts/run-phased-build.mjs \
//     --project <path> [--seed <skeleton-dir>] --request "<user text>" \
//     --model ollama/<model> [--passes implement,art,music,polish] \
//     [--out <runDir>] [--pass-timeout-seconds 1500]

import { execFile, spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const starterProjectPath = path.join(rootDir, "examples", "app-starter-blank");

function parseArgs(argv) {
  const args = {
    project: "",
    seed: "",
    request: "",
    model: process.env.DRIVE16_LIVE_AUDIT_MODEL || "",
    passes: ["implement", "art", "music", "polish"],
    out: "",
    passTimeoutSeconds: 1500,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") args.project = path.resolve(argv[++index]);
    else if (arg === "--seed") args.seed = path.resolve(argv[++index]);
    else if (arg === "--request") args.request = argv[++index];
    else if (arg === "--model") args.model = argv[++index];
    else if (arg === "--passes") args.passes = argv[++index].split(",").map((p) => p.trim());
    else if (arg === "--out") args.out = path.resolve(argv[++index]);
    else if (arg === "--pass-timeout-seconds") args.passTimeoutSeconds = Number(argv[++index]);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: run-phased-build.mjs --project <path> --request <text> --model <provider/model> [--seed <dir>] [--passes a,b,c] [--out <dir>]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.project || !args.request || !args.model) {
    throw new Error("--project, --request, and --model are required.");
  }
  args.out ||= path.join(path.dirname(args.project), "phased-run");
  return args;
}

async function newestMtime(target) {
  if (!existsSync(target)) return 0;
  const info = await stat(target);
  if (info.isFile()) return info.mtimeMs;
  const { readdir } = await import("node:fs/promises");
  let latest = 0;
  for (const entry of await readdir(target)) {
    latest = Math.max(latest, await newestMtime(path.join(target, entry)));
  }
  return latest;
}

async function romIsFresh(projectPath) {
  const romPath = path.join(projectPath, "out", "rom.bin");
  if (!existsSync(romPath)) return false;
  const romTime = (await stat(romPath)).mtimeMs;
  const sourceTime = Math.max(
    await newestMtime(path.join(projectPath, "src")),
    await newestMtime(path.join(projectPath, "res")),
  );
  return romTime >= sourceTime;
}

async function runCommand(command, commandArgs, options = {}) {
  return execFileAsync(command, commandArgs, {
    cwd: rootDir,
    timeout: options.timeout ?? 180000,
    maxBuffer: 1024 * 1024 * 16,
    env: { ...process.env, ...(options.env ?? {}) },
  });
}

// Deterministic gates: the runner never trusts model claims. Pass gates use
// a LIVENESS screen check; the full presentation contract false-positives on
// dense patterned backgrounds and is recorded as information, not a blocker.
async function verifyScreen(projectPath, out) {
  const shot = path.join(out, "gate-frame.png");
  try {
    await runCommand("python3", [
      "scripts/capture-game-screenshot.py",
      path.join(projectPath, "out", "rom.bin"),
      shot,
      "--frames", "240",
    ], { timeout: 240000 });
    await runCommand("python3", ["scripts/validate-screen-alive.py", shot], { timeout: 60000 });
  } catch (error) {
    return { ok: false, detail: String(error.stdout || error.message).slice(-400) };
  }
  // Informational: does the frame already clear the final presentation bar?
  let presentation = "fail";
  try {
    await runCommand("python3", ["scripts/validate-game-screenshot.py", shot], { timeout: 60000 });
    presentation = "pass";
  } catch { /* recorded, not blocking */ }
  return { ok: true, presentation };
}

async function verifyAudio(projectPath) {
  try {
    const result = await runCommand("python3", [
      "scripts/validate-emulator-audio-mcp.py",
      "--rom", path.join(projectPath, "out", "rom.bin"),
    ], { timeout: 240000 });
    const maxAbs = Number(String(result.stdout).match(/max_abs=(\d+)/)?.[1] ?? 0);
    return { ok: maxAbs > 0, maxAbs };
  } catch (error) {
    return { ok: false, detail: String(error.stdout || error.message).slice(-400) };
  }
}

async function resourceLines(projectPath) {
  const resPath = path.join(projectPath, "res", "resources.res");
  if (!existsSync(resPath)) return "";
  return readFile(resPath, "utf8");
}

const PASS_PROMPTS = {
  implement: ({ projectPath, request }) => [
    `Active Drive16 project: ${projectPath}`,
    "",
    "PASS 1 of a phased build: GAMEPLAY ONLY. Art and music have their own later passes — do not call sprite or music tools, do not add resource assets, do not polish docs.",
    "- Read GAME.md, ASSETS.md, PLAYTEST.md, and src/main.c once, then edit src/main.c to implement the requested gameplay. A seeded skeleton is scaffolding: adapt it to the request, do not rebuild it unchanged.",
    "- Keep the first implementation COMPACT: the smallest complete version of the requested gameplay. Depth and extras belong to the polish pass. Call build_rom no later than your 12th step even if imperfect, then iterate from real errors.",
    "- Keep responses short; write large files across multiple smaller edit calls.",
    "- After the final edit: build_rom, run_rom (>=180 frames), capture_frame, send_input with reset true and a representative direction, send_input with start when restart applies, run_rom with use_input_script true, capture_frame again.",
    "- Finish by stating what gameplay works and what remains. Never write Playability gate: PASS.",
    "",
    `User request: ${request}`,
  ].join("\n"),
  art: ({ projectPath, request }) => [
    `Active Drive16 project: ${projectPath}`,
    "",
    "PASS 2 of a phased build: ART ONLY. Gameplay already works; music comes later. Do not redesign gameplay or call music tools.",
    "- Identify the 2-3 primary visual roles from src/main.c and GAME.md (for example: attacker, explosion, player base).",
    "- For each role: drive16-comfyui generate_sprite with a role-appropriate prompt and a symbol that names the role. Copy each SGDK-ready PNG into res/, add its SPRITE line to res/resources.res (path relative to res/), declare it in res/resources.h, and wire it in src/main.c with the sprite engine (SPR_init once, SPR_addSprite, SPR_setPosition, SPR_update in the loop).",
    "- Exact sprite-engine API (do not use anything else): SPR_init(); Sprite *s = SPR_addSprite(&resource, x, y, TILE_ATTR(PAL2, TRUE, FALSE, FALSE)); SPR_setPosition(s, x, y); SPR_setVisibility(s, VISIBLE) or SPR_setVisibility(s, HIDDEN); SPR_update() every frame before SYS_doVBlankProcess(). There is no V_ON/V_OFF, no priority field, no xExtent/yExtent.",
    "- The role and the sprite must match: never wire an image under a symbol that names a different object.",
    "- After wiring: build_rom, run_rom (>=180 frames), capture_frame, verify_screen. If a sprite fails validation or looks wrong, record it as Rejected in ASSETS.md and keep the primitive for that role.",
    "- Update ASSETS.md rows for each role (file, symbol, Used/Rejected).",
    "",
    `User request: ${request}`,
  ].join("\n"),
  music: ({ projectPath, request }) => [
    `Active Drive16 project: ${projectPath}`,
    "",
    "PASS 3 of a phased build: MUSIC ONLY. Gameplay and art are done. Do not touch gameplay code beyond audio wiring, do not call sprite tools.",
    "- Read corpus/mml/ctrmml-megadrive.md and assets/enhancements/mml/fm-presets.mml first; copy the instrument blocks you use.",
    "- Compose a genre-appropriate arrangement: at least five active parts (bass, lead, harmony/pad, counterline or arpeggio, percussion), at least four instruments, a recognizable A/B phrase, repeating section at least sixteen seconds.",
    "- Call compile_music with the COMPLETE MML text each attempt (never edit scratch files). You have up to 4 compile attempts; address the exact compiler or quality issue between attempts.",
    "- Once quality.pass is true: copy the VGM into res/, add the XGM line to res/resources.res, declare it in res/resources.h, start it with XGM_startPlay in src/main.c, then build_rom and verify_audio (expect non-silent).",
    "- Update the ASSETS.md music row. If all compile attempts fail, keep the seeded music, record the exact compiler error, and say so plainly.",
    "",
    `User request: ${request}`,
  ].join("\n"),
  polish: ({ projectPath, request }) => [
    `Active Drive16 project: ${projectPath}`,
    "",
    "PASS 4 of a phased build: POLISH AND TRUTH. Fix concrete defects from earlier passes; do not add new systems or assets.",
    "- Read PLAYTEST.md, ASSETS.md, GAME.md, and src/main.c. Fix any recorded defect you can fix in this bounded pass (visual glitches, wrong palette entries, missing restart, HUD text).",
    "- After any edit: build_rom, run_rom (>=180 frames), capture_frame, send_input direction, send_input start, verify_audio when the game has music.",
    "- Rewrite GAME.md concept prose and PLAYTEST.md Quality Review (Screen composition, Player feedback, Restart clarity, Audio response, Style coherence) with specific observations. Keep Playability gate: FAIL — Drive16 owns PASS.",
    "",
    `User request: ${request}`,
  ].join("\n"),
};

// Gates run after each pass; failing the pass's own gate stops the run.
const PASS_GATES = {
  implement: async (projectPath, gateOut) => {
    if (!(await romIsFresh(projectPath))) return { ok: false, blocker: "No fresh agent-built ROM after the implement pass." };
    const screen = await verifyScreen(projectPath, gateOut);
    if (!screen.ok) return { ok: false, blocker: `Screen verification failed: ${screen.detail ?? ""}` };
    return { ok: true, presentation: screen.presentation };
  },
  art: async (projectPath, gateOut) => {
    if (!(await romIsFresh(projectPath))) return { ok: false, blocker: "ROM is stale after the art pass." };
    const res = await resourceLines(projectPath);
    if (!/^\s*SPRITE\s+\w+/m.test(res)) return { ok: false, blocker: "No SPRITE resource wired after the art pass." };
    const screen = await verifyScreen(projectPath, gateOut);
    if (!screen.ok) return { ok: false, blocker: `Screen verification failed after art: ${screen.detail ?? ""}` };
    return { ok: true, presentation: screen.presentation };
  },
  music: async (projectPath, gateOut) => {
    if (!(await romIsFresh(projectPath))) return { ok: false, blocker: "ROM is stale after the music pass." };
    const res = await resourceLines(projectPath);
    if (!/^\s*XGM\s+\w+/m.test(res)) return { ok: false, blocker: "No XGM resource wired after the music pass." };
    const audio = await verifyAudio(projectPath);
    if (!audio.ok) return { ok: false, blocker: "Audio is silent or unverifiable after the music pass." };
    return { ok: true, maxAbs: audio.maxAbs };
  },
  polish: async (projectPath, gateOut) => {
    if (!(await romIsFresh(projectPath))) return { ok: false, blocker: "ROM is stale after the polish pass." };
    const screen = await verifyScreen(projectPath, gateOut);
    if (!screen.ok) return { ok: false, blocker: `Screen verification failed after polish: ${screen.detail ?? ""}` };
    return { ok: true, presentation: screen.presentation };
  },
};

async function runPass({ passName, projectPath, request, model, out, timeoutSeconds, traceSuffix = "" }) {
  const prompt =
    traceSuffix === ""
      ? PASS_PROMPTS[passName]({ projectPath, request })
      : [`Active Drive16 project: ${projectPath}`, "", request].join("\n");
  const tracePath = path.join(out, `pass-${passName}${traceSuffix}.jsonl`);
  const stderrPath = path.join(out, `pass-${passName}${traceSuffix}.stderr`);
  await writeFile(path.join(out, `pass-${passName}${traceSuffix}.prompt.md`), prompt);

  const startedAt = Date.now();
  const exitCode = await new Promise((resolve) => {
    const child = spawn(
      "opencode",
      ["run", "--agent", `drive16-${passName}`, "--model", model, "--format", "json", "--title", `phased ${passName}`, prompt],
      { cwd: rootDir, env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const traceStream = createWriteStreamSafe(tracePath);
    const errStream = createWriteStreamSafe(stderrPath);
    child.stdout.pipe(traceStream);
    child.stderr.pipe(errStream);
    const killTimer = setTimeout(() => child.kill("SIGTERM"), timeoutSeconds * 1000);
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve(typeof code === "number" ? code : 1);
    });
    child.on("error", () => {
      clearTimeout(killTimer);
      resolve(1);
    });
  });

  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  if (existsSync(tracePath)) {
    for (const line of (await readFile(tracePath, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "step_finish") {
          steps += 1;
          inputTokens += event.part?.tokens?.input ?? 0;
          outputTokens += event.part?.tokens?.output ?? 0;
        }
      } catch { /* tolerate partial lines */ }
    }
  }
  return {
    pass: passName,
    exitCode,
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    steps,
    inputTokens,
    outputTokens,
  };
}

import { createWriteStream } from "node:fs";
function createWriteStreamSafe(target) {
  return createWriteStream(target, { flags: "w" });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });

  if (args.seed) {
    await rm(args.project, { recursive: true, force: true });
    await cp(starterProjectPath, args.project, { recursive: true });
    await cp(args.seed, args.project, { recursive: true, force: true });
    await rm(path.join(args.project, "out"), { recursive: true, force: true });
    await runCommand(path.join(rootDir, "scripts", "build-sgdk.sh"), [args.project], { timeout: 600000 });
    console.log(`Seeded and baseline-built: ${args.project}`);
  }

  const ledger = { startedAt: new Date().toISOString(), project: args.project, model: args.model, request: args.request, passes: [] };
  let stopped = "";

  for (const passName of args.passes) {
    if (!PASS_PROMPTS[passName]) throw new Error(`Unknown pass: ${passName}`);
    console.log(`--- pass: ${passName} ---`);
    const result = await runPass({
      passName,
      projectPath: args.project,
      request: args.request,
      model: args.model,
      out: args.out,
      timeoutSeconds: args.passTimeoutSeconds,
    });

    // Stamp trace-proven evidence so later passes and audits see honest state.
    try {
      await runCommand("node", [
        "scripts/generate-project-memory.mjs",
        "--project", args.project,
        "--trace", path.join(args.out, `pass-${passName}.jsonl`),
        "--write",
      ], { timeout: 60000 });
    } catch { /* generator failures never block the pipeline */ }

    let gate = await PASS_GATES[passName](args.project, args.out);
    ledger.passes.push({ ...result, gate });
    console.log(`${passName}: exit=${result.exitCode} steps=${result.steps} ${result.durationSeconds}s gate=${gate.ok ? "ok" : `FAIL (${gate.blocker})`}`);

    if (!gate.ok) {
      // One bounded continuation: a pass that fails its gate usually died
      // mid-fix at the step cap (P1-G1 acceptance run: two V_ON uses left).
      console.log(`--- pass: ${passName} (continuation) ---`);
      const continuation = await runPass({
        passName,
        projectPath: args.project,
        request: [
          `FINISH THE PREVIOUS ${passName.toUpperCase()} PASS. It ended at its step budget with this gate failure: ${gate.blocker}`,
          "Start with drive16-sgdk-build read_build_log if a build failed. Make the minimal fixes only, then build_rom and re-verify. Do not start new work.",
          "",
          `Original request: ${args.request}`,
        ].join("\n"),
        model: args.model,
        out: args.out,
        timeoutSeconds: args.passTimeoutSeconds,
        traceSuffix: "-continuation",
      });
      gate = await PASS_GATES[passName](args.project, args.out);
      ledger.passes.push({ ...continuation, pass: `${passName}-continuation`, gate });
      console.log(`${passName}-continuation: exit=${continuation.exitCode} steps=${continuation.steps} ${continuation.durationSeconds}s gate=${gate.ok ? "ok" : `FAIL (${gate.blocker})`}`);
    }

    if (!gate.ok) {
      stopped = `${passName}: ${gate.blocker}`;
      break;
    }
  }

  ledger.finishedAt = new Date().toISOString();
  ledger.stopped = stopped || null;
  ledger.ok = !stopped;
  const ledgerPath = path.join(args.out, "phased-ledger.json");
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`Ledger: ${path.relative(rootDir, ledgerPath)}`);
  if (stopped) {
    console.error(`Phased build stopped at ${stopped}`);
    process.exitCode = 1;
  } else {
    console.log("Phased build completed: all pass gates green.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
