#!/usr/bin/env node
import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { analyzeOpenCodeAudioTrace } from "./verify-opencode-audio-trace.mjs";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultRunsRoot = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "runs");
const readinessPath = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "readiness.json");
const emulatorInputScriptPath = path.join(rootDir, "artifacts", "phase1", "emulator", "input-script.csv");
const starterProjectPath = path.join(rootDir, "examples", "app-starter-blank");
const snakeBasicSkeletonPath = path.join(rootDir, "examples", "game-skeletons", "snake-basic");
const pongBasicSkeletonPath = path.join(rootDir, "examples", "game-skeletons", "pong-basic");
const tetrisBasicSkeletonPath = path.join(rootDir, "examples", "game-skeletons", "tetris-basic");
const asteroidsBasicSkeletonPath = path.join(rootDir, "examples", "game-skeletons", "asteroids-basic");

const requiredPrompts = [
  {
    id: "snake-basic",
    genre: "snake",
    text: "Build a simple working Genesis-style Snake game.",
  },
  {
    id: "pong-basic",
    genre: "pong",
    text: "Build a simple working Genesis-style Pong game.",
  },
  {
    id: "tetris-basic",
    genre: "tetris",
    text: "Build a simple working Genesis-style Tetris game.",
  },
  {
    id: "asteroids-basic",
    genre: "asteroids",
    text: "Build a simple working Genesis-style Asteroids game.",
  },
];

const firstBuildSkeletons = {
  "snake-basic": {
    label: "Snake",
    source: snakeBasicSkeletonPath,
    description: "compact first implementation and audio shape",
  },
  "pong-basic": {
    label: "Pong",
    source: pongBasicSkeletonPath,
    description: "compact first implementation and audio shape",
  },
  "tetris-basic": {
    label: "Tetris",
    source: tetrisBasicSkeletonPath,
    description: "compact first implementation and audio shape",
  },
  "asteroids-basic": {
    label: "Asteroids",
    source: asteroidsBasicSkeletonPath,
    description: "compact first implementation and audio shape",
  },
};

// Contract labels emitted by promptText: "Snake first-build reference",
// "Snake first-build seed", "Pong first-build reference", "Pong first-build seed".
// Contract paths: examples/game-skeletons/snake-basic and examples/game-skeletons/pong-basic.
// Extra seed paths: examples/game-skeletons/tetris-basic and examples/game-skeletons/asteroids-basic.

const genreEvidencePhrases = {
  snake: [
    "score starts at 0",
    "snake and food visible",
    "D-pad movement visible",
    "food can be approached or eaten",
    "collision fail state checked",
    "restart checked",
  ],
  pong: [
    "paddles and ball visible",
    "paddle input tested",
    "ball travels and bounces",
    "scoring changes",
    "serve or point restart visible",
  ],
  tetris: [
    "playfield and score/line state readable",
    "piece spawns visibly",
    "left/right/down movement works",
    "rotation works",
    "pieces lock into grid",
    "line clear or stacking present",
    "game-over possible",
  ],
  asteroids: [
    "ship, asteroids, and shots visible",
    "rotation or thrust changes ship",
    "firing creates moving projectile",
    "asteroids move or wrap",
    "collisions/destruction affect state",
    "restart after death/game-over works",
  ],
};

function parseArgs(argv) {
  const args = {
    prompt: "snake-basic",
    model: process.env.DRIVE16_LIVE_AUDIT_MODEL || "",
    agent: "",
    runAgent: false,
    evidenceOnly: false,
    resumeRun: "",
    runId: "",
    runsRoot: defaultRunsRoot,
    timeoutSeconds: 2400,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--prompt") {
      args.prompt = argv[++index];
    } else if (arg === "--model") {
      args.model = argv[++index];
    } else if (arg === "--agent") {
      args.agent = argv[++index];
    } else if (arg === "--run-agent") {
      args.runAgent = true;
    } else if (arg === "--evidence-only") {
      args.evidenceOnly = true;
    } else if (arg === "--resume-run") {
      args.resumeRun = argv[++index];
    } else if (arg === "--run-id") {
      args.runId = argv[++index];
    } else if (arg === "--runs-root") {
      args.runsRoot = path.resolve(argv[++index]);
    } else if (arg === "--timeout-seconds") {
      args.timeoutSeconds = Number(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.timeoutSeconds) || args.timeoutSeconds <= 0) {
    throw new Error("--timeout-seconds must be a positive number.");
  }
  if (args.evidenceOnly && !args.resumeRun) {
    throw new Error("--evidence-only requires --resume-run.");
  }
  return args;
}

function printHelp() {
  console.log(`Usage: scripts/run-live-game-audit-prompt.mjs [options]

Prepares one required Drive16 live-audit prompt packet, and optionally runs it
through OpenCode. This is the repeatable harness for the Snake/Pong/Tetris/
Asteroids audit; it does not mark the final report passed by itself.

Options:
  --prompt <id>           snake-basic, pong-basic, tetris-basic, or asteroids-basic.
  --run-agent             Actually run opencode after preparing the packet.
  --evidence-only         On a resume, forbid edits and refresh build/emulator evidence only.
  --resume-run <run-id>   Continue an existing failed run without deleting its project or trace.
  --model <model>         OpenCode model, for example openrouter/deepseek/deepseek-chat-v3.1.
                          Defaults to DRIVE16_LIVE_AUDIT_MODEL.
  --agent <agent>         Optional bounded OpenCode agent, for example bakeoff.
  --run-id <id>           Custom run folder suffix.
  --runs-root <dir>       Output root. Default: artifacts/phase9/live-game-audit/runs
  --timeout-seconds <n>   OpenCode run timeout. Default: 2400.
`);
}

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

function compact(text) {
  return text.replace(/\s+/g, " ").trim();
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

async function runCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: rootDir,
    timeout: options.timeout ?? 120000,
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 16,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
  });
}

async function refreshReadiness() {
  try {
    await runCommand("node", ["scripts/check-live-game-audit-readiness.mjs"], {
      timeout: 180000,
    });
  } catch (error) {
    const output = compact(`${error.stdout ?? ""}\n${error.stderr ?? ""}`) || String(error.message ?? error);
    throw new Error(`Live-audit readiness failed before prompt run: ${output}`);
  }
  const report = JSON.parse(await readFile(readinessPath, "utf8"));
  if (!report.readyForPrimitiveAudit) {
    throw new Error(
      `Live-audit primitive/fallback readiness is not ready. Fix readiness first: ${relative(readinessPath)}`,
    );
  }
  return report;
}

async function prepareProject(projectPath) {
  await rm(projectPath, { recursive: true, force: true });
  await cp(starterProjectPath, projectPath, {
    recursive: true,
    filter(source) {
      return !source.includes(`${path.sep}out${path.sep}`) && !source.endsWith(`${path.sep}out`);
    },
  });
  await rm(path.join(projectPath, "out"), { recursive: true, force: true });
}

async function applyFirstBuildSeed(prompt, projectPath) {
  const seed = firstBuildSkeletons[prompt.id];
  if (!seed) return null;
  if (!existsSync(seed.source)) {
    throw new Error(`${seed.label} first-build skeleton is missing: ${relative(seed.source)}`);
  }
  const target = projectPath;
  await cp(seed.source, target, { recursive: true, force: true });
  await rm(path.join(projectPath, "out"), { recursive: true, force: true });
  return {
    kind: prompt.id,
    label: seed.label,
    source: relative(seed.source),
    target: relative(target),
  };
}

function promptText({ prompt, projectPath, readiness, firstBuildSeed }) {
  const spriteFallback =
    readiness.readyForGeneratedSpriteAudit && readiness.comfyUiMode === "ready"
      ? [
          "AI sprite path:",
          "- ComfyUI readiness is ready. You may use role-specific generated sprites when they improve the game.",
          "- Every generated PNG must be cropped/normalized into Genesis-safe assets and recorded in ASSETS.md.",
        ]
      : [
          "AI sprite fallback:",
          "- ComfyUI is not ready for this run.",
          "- Do not claim ComfyUI-generated sprites were used.",
          "- Use primitive/manual Genesis-safe graphics and record the fallback in ASSETS.md.",
        ];
  const skeleton = firstBuildSkeletons[prompt.id];
  const firstBuildReference = firstBuildSeed
    ? [
        `${firstBuildSeed.label} first-build seed:`,
        `- The audit harness already copied ${firstBuildSeed.source} into ${firstBuildSeed.target}.`,
        "- The seed includes a small VGM loop in res/, so sound is expected and must be verified as non-silent.",
        "- Do not spend time copying it again; after reading the required project files, build_rom immediately unless you need a tiny source fix.",
      ]
    : skeleton
      ? [
          `${skeleton.label} first-build reference:`,
          `- Use ${relative(skeleton.source)}/ as the ${skeleton.description}.`,
          "- Copy/adapt its src/main.c and res/ files into the active project before any docs update, then build_rom.",
        ]
      : [];
  const evidencePhrases = genreEvidencePhrases[prompt.genre] ?? [];

  return [
    `Drive16 live generated-game audit prompt: ${prompt.id}`,
    "",
    `Active Drive16 project: ${projectPath}`,
    "",
    `User request: ${prompt.text}`,
    "",
    "Required audit flow:",
    "- Before editing, read GAME.md, ASSETS.md, and PLAYTEST.md in the project.",
    "- Do not spend the run polishing project docs before gameplay exists.",
    "- Early ASSETS.md planning rows are allowed, but they must say Planned/Pending until code, build, and verification evidence exist.",
    "- Never claim out/rom.bin is built, never write Known Issues: none, and never claim audio was omitted unless the user explicitly requested no audio.",
    "- For this simple generated-game audit, after reading GAME.md, ASSETS.md, PLAYTEST.md, and src/main.c, edit src/main.c before any more inspection only when the project is still blank; if a seeded starter is already present, build and test it first.",
    "- Do not use todo-list tools for this simple audit; make one compact first implementation, then build.",
    "- Keep the first implementation small: no decorative custom tile arrays, no generated-art wiring, and no extra systems before the first successful build_rom.",
    "- Do not read README.md, Makefile, src/boot/*, or res/resources.* unless the build fails or you are actually adding resource assets/music.",
    "- When reading or globbing active project files, use absolute paths under the Active Drive16 project; do not use repo-root relative globs like res/* for audit projects.",
    "- Build the core playable game before optional music unless the request specifically asks for music first.",
    "- Use only SGDK APIs that are present in the starter or local examples, or query drive16-rag before using them.",
    "- Do not use VDP_drawRect, srand, or C library rand(); for blocky graphics, load solid 8x8 tiles and draw cells with VDP_fillTileMapRect.",
    "- Build after the final code/resource edit; an older out/rom.bin is stale evidence.",
    "- Immediately after a successful build_rom, do not inspect or rewrite docs; run_rom, capture_frame, send_input with reset true and lowercase p1_buttons such as [\"right\"], then make a separate send_input call with p1_buttons [\"start\"] when restart applies, run_rom with use_input_script true, capture_frame again, then verify_audio if sound is expected.",
    "- Every final gameplay capture must come from a run_rom call of at least 180 frames; short reset captures can catch an unfinished tile queue and are not valid visual evidence.",
    "- Valid send_input button names are lowercase: left, right, up, down, start, a, b, c, x, y, z, mode. Do not use SGDK constants like BUTTON_RIGHT.",
    "- Run the ROM, capture a frame, test input, test restart/start behavior when relevant, and verify audio or record why audio was explicitly disabled.",
    "- Use drive16-emulator.verify_audio for audio proof when sound is expected.",
    "- For audio checks after movement tests, call verify_audio with use_input_script false unless the sound specifically requires held input.",
    "- If MML compilation fails twice, stop trying music for this turn, record audio as failed, and finish gameplay verification.",
    "- Update GAME.md, ASSETS.md, and PLAYTEST.md with evidence and remaining issues.",
    "- In PLAYTEST.md, complete an exact ## Quality Review section with specific observations for Screen composition, Player feedback, Restart clarity, Audio response, and Style coherence. Pending or generic praise cannot pass.",
    evidencePhrases.length
      ? `- In PLAYTEST.md, use an exact ## Evidence section and include the exact ${prompt.genre} evidence phrases when passing: ${evidencePhrases.join(", ")}.`
      : "- In PLAYTEST.md, use an exact ## Evidence section and include the relevant genre evidence phrases when passing.",
    "- In ASSETS.md, primitive text/tile rows should use the code path or drawing function in Symbol / File, such as `src/main.c draw_piece()`, not only a shared character like `#`.",
    "- If one primitive glyph or helper is reused across multiple roles, explicitly say the shared primitive reuse is intentional in each affected row.",
    "- In ASSETS.md, every music/sound row must record the resource symbol/file and the phrase captured non-silent audio evidence when verify_audio succeeds.",
    "- After updating all three project-memory files, call drive16-sgdk-build.audit_project_memory with expect_gate pass. Repair its exact issues and audit once more before finishing; if it still fails, keep the gate failed.",
    "- If Known Issues lists limitations, do not write Next Intended Change: none.",
    "- Do not call the game done or playable unless compile, screen, input, restart/basic gameplay, asset ledger, and audio evidence pass.",
    "",
    `Genre for this run: ${prompt.genre}`,
    "",
    ...firstBuildReference,
    firstBuildReference.length ? "" : "",
    ...spriteFallback,
    "",
    "Final response requirements:",
    "- State whether Playability gate is PASS or FAIL.",
    "- Name the exact missing blocker if the gate is not PASS.",
  ].join("\n");
}

function resumePromptText({ prompt, projectPath, runPath, readiness, firstBuildSeed, evidenceOnly }) {
  const evidenceOnlyRequirements = evidenceOnly
    ? [
        "Evidence-only continuation:",
        "- The project and project-memory files are already repaired. Do not edit source, resources, or documentation.",
        "- Build the current project exactly as it is, then refresh run_rom, capture_frame, directional input, Start/restart, and verify_audio evidence.",
        "- If a check fails, report that failure without changing project files.",
      ]
    : [];
  return [
    promptText({ prompt, projectPath, readiness, firstBuildSeed }),
    "",
    "Continuation requirements:",
    `- This is a repair continuation for the existing run at ${runPath}. Do not replace the project or discard working gameplay.`,
    `- Read ${path.join(runPath, "run-record.json")} and repair every recorded issue before finishing.`,
    "- Preserve the existing ROM functionality, then rerun the missing emulator evidence calls.",
    "- Audio is required for this audit. Do not claim the user requested no audio; add a small Genesis-safe music or SFX resource when needed, rebuild, and capture non-silent audio evidence.",
    "- Update GAME.md, ASSETS.md, and PLAYTEST.md so their claims match the fresh build and evidence.",
    ...evidenceOnlyRequirements,
  ].join("\n");
}

async function runScreenshotAudit(runPath, screenshotPath) {
  const out = path.join(runPath, "screen-quality.json");
  if (!screenshotPath) {
    await writeFile(out, `${JSON.stringify({ status: "failed", issues: ["No gameplay screenshot was captured."] }, null, 2)}\n`);
    return out;
  }
  try {
    await runCommand(
      "python3",
      ["scripts/validate-game-screenshot.py", screenshotPath, "--out", out],
      { timeout: 120000 },
    );
  } catch (error) {
    if (!existsSync(out)) {
      await writeFile(
        out,
        `${JSON.stringify({ status: "failed", issues: [compact(`${error.stdout ?? ""}\n${error.stderr ?? ""}`) || String(error.message ?? error)] }, null, 2)}\n`,
      );
    }
  }
  return out;
}

async function captureStableFrame(projectPath, runPath) {
  const romPath = path.join(projectPath, "out", "rom.bin");
  const screenshotPath = path.join(runPath, "evidence", "last-frame.png");
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  try {
    const result = await runCommand(
      "python3",
      ["scripts/capture-game-screenshot.py", romPath, screenshotPath, "--frames", "180"],
      { timeout: 180000 },
    );
    await writeFile(path.join(runPath, "stable-capture.stdout"), result.stdout ?? "");
    await writeFile(path.join(runPath, "stable-capture.stderr"), result.stderr ?? "");
    return screenshotPath;
  } catch (error) {
    await writeFile(path.join(runPath, "stable-capture.stdout"), error.stdout ?? "");
    await writeFile(
      path.join(runPath, "stable-capture.stderr"),
      error.stderr ?? String(error.message ?? error),
    );
    return "";
  }
}

async function runProjectMemoryAudit(projectPath, runPath) {
  const out = path.join(runPath, "project-memory-audit.json");
  try {
    const result = await runCommand(
      "node",
      ["scripts/verify-project-memory.mjs", "--project", projectPath, "--out", out],
      { timeout: 120000 },
    );
    await writeFile(path.join(runPath, "project-memory-audit.stdout"), result.stdout ?? "");
    await writeFile(path.join(runPath, "project-memory-audit.stderr"), result.stderr ?? "");
  } catch (error) {
    await writeFile(path.join(runPath, "project-memory-audit.stdout"), error.stdout ?? "");
    await writeFile(path.join(runPath, "project-memory-audit.stderr"), error.stderr ?? String(error.message ?? error));
  }
  return out;
}

async function runTraceAudit(runPath, options = {}) {
  const logPath = path.join(runPath, "opencode-run.jsonl");
  const out = path.join(runPath, "opencode-trace-audit.txt");
  if (!existsSync(logPath)) return out;
  try {
    const args = [
      "scripts/verify-opencode-audio-trace.mjs",
      "--log",
      logPath,
      "--expect-audio",
      "--expect-game-progress",
    ];
    if (options.allowSeededSource) args.push("--allow-seeded-source");
    const result = await runCommand(
      "node",
      args,
      { timeout: 120000 },
    );
    await writeFile(out, `${result.stdout ?? ""}${result.stderr ?? ""}`);
  } catch (error) {
    await writeFile(out, `${error.stdout ?? ""}${error.stderr ?? ""}${String(error.message ?? error)}`);
  }
  return out;
}

async function readTraceSummary(runPath) {
  const logPath = path.join(runPath, "opencode-run.jsonl");
  if (!existsSync(logPath)) return {};
  try {
    return analyzeOpenCodeAudioTrace(await readFile(logPath, "utf8"));
  } catch {
    return {};
  }
}

async function writeAgentRunStatus(runPath, status) {
  await writeFile(
    path.join(runPath, "opencode-run.status.json"),
    `${JSON.stringify({ updatedAt: new Date().toISOString(), ...status }, null, 2)}\n`,
  );
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function readTraceIssues(traceAuditPath) {
  if (!existsSync(traceAuditPath)) return [];
  const text = await readFile(traceAuditPath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s*/, ""))
    .filter(Boolean);
}

async function agentStatusIssues(statusPath) {
  if (!existsSync(statusPath)) {
    return ["OpenCode run has not been executed."];
  }
  const status = await readJsonIfExists(statusPath);
  if (!status.status || status.status === "finished") return [];
  if (status.timedOut) {
    return [`OpenCode run timed out after ${status.timeoutSeconds} seconds.`];
  }
  if (status.error) {
    return [`OpenCode run failed: ${status.error}`];
  }
  if (status.signal) {
    return [`OpenCode run exited with signal ${status.signal}.`];
  }
  if (Number.isFinite(status.exitCode) && status.exitCode !== 0) {
    return [`OpenCode run exited with code ${status.exitCode}.`];
  }
  return [`OpenCode run status is ${status.status}.`];
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function newestFileMtime(filePath) {
  if (!existsSync(filePath)) return 0;
  const info = await stat(filePath);
  if (info.isFile()) return info.mtimeMs;
  if (!info.isDirectory()) return 0;
  const entries = await readdir(filePath);
  const childTimes = await Promise.all(entries.map((entry) => newestFileMtime(path.join(filePath, entry))));
  return Math.max(0, ...childTimes);
}

async function romIsFresh(projectPath, romPath) {
  if (!(await fileExists(romPath))) return false;
  const romTime = (await stat(romPath)).mtimeMs;
  const sourceTime = Math.max(
    await newestFileMtime(path.join(projectPath, "src")),
    await newestFileMtime(path.join(projectPath, "res")),
  );
  return romTime >= sourceTime;
}

async function writeRunRecord({
  prompt,
  projectPath,
  runPath,
  model,
  readiness,
  screenshotPath,
  auditPath,
  traceAuditPath,
  screenshotAuditPath,
  elapsedSeconds,
  firstBuildSeed,
}) {
  const romPath = path.join(projectPath, "out", "rom.bin");
  const playtestPath = path.join(projectPath, "PLAYTEST.md");
  const gamePath = path.join(projectPath, "GAME.md");
  const assetsPath = path.join(projectPath, "ASSETS.md");
  const buildLogPath = path.join(runPath, "opencode-run.jsonl");
  const agentStatusPath = path.join(runPath, "opencode-run.status.json");
  const audit = await readJsonIfExists(auditPath);
  const agentStatus = await readJsonIfExists(agentStatusPath);
  const traceSummary = await readTraceSummary(runPath);
  const traceIssues = await readTraceIssues(traceAuditPath);
  const screenshotAudit = await readJsonIfExists(screenshotAuditPath);
  const screenshotIssues = screenshotAudit.status === "passed"
    ? []
    : (screenshotAudit.issues ?? ["Gameplay screenshot quality audit did not pass."]);
  const runIssues = [
    ...(await agentStatusIssues(agentStatusPath)),
    ...(audit.issues ?? []),
    ...traceIssues,
    ...screenshotIssues,
  ];
  const auditPassed = audit.status === "passed" && audit.gate === "pass";
  const agentCompleted = agentStatus.status === "finished";
  const tracePassed = (await fileExists(traceAuditPath)) && traceIssues.length === 0;
  const audioProofs =
    (traceSummary.captureAudioSuccesses ?? 0) + (traceSummary.verifyAudioSuccesses ?? 0);
  const inputResponded =
    (traceSummary.sendInputSuccesses ?? 0) > 0 &&
    (traceSummary.sendInputDirectionalCalls ?? 0) > 0 &&
    ((traceSummary.captureFrameCalls ?? 0) >= 2 || (traceSummary.runRomWithInputScript ?? 0) > 0);
  const restartTested = (traceSummary.sendInputStartCalls ?? 0) > 0;
  const audioKnown = audioProofs > 0;
  const romExists = await fileExists(romPath);
  const freshRom = await romIsFresh(projectPath, romPath);
  if (romExists && !freshRom) {
    runIssues.push("ROM is stale; rebuild after the latest source or resource edit.");
  }
  const checks = {
    compiled: romExists && freshRom,
    previewLoaded: Boolean(screenshotPath),
    screenVisible: Boolean(screenshotPath) && screenshotAudit.status === "passed",
    inputResponded,
    restartTested,
    audioKnown,
    assetLedgerUpdated: await fileExists(assetsPath),
    gameplayRulesTested: auditPassed,
    projectMemoryAudited: audit.status === "passed",
    traceAudited: tracePassed,
    agentCompleted,
  };
  const missingChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `Missing evidence: ${name}.`);
  const runPassed = auditPassed && agentCompleted && tracePassed && missingChecks.length === 0;
  const record = {
    promptId: prompt.id,
    genre: prompt.genre,
    status: runPassed ? "pass" : "fail",
    elapsedSeconds,
    modelId: model || null,
    sourceSeeded: Boolean(firstBuildSeed),
    projectPath: relative(projectPath),
    romPath: relative(romPath),
    checks,
    enhancements: {
      sprites: readiness.readyForGeneratedSpriteAudit ? "comfyui" : "primitive",
      audio: audioKnown
        ? "captured"
        : (traceSummary.captureAudioFailures ?? 0) + (traceSummary.verifyAudioFailures ?? 0) > 0
          ? "silent"
          : "untested",
      fallbackDisclosed: !readiness.readyForGeneratedSpriteAudit,
    },
    evidence: {
      gamePath: relative(gamePath),
      assetsPath: relative(assetsPath),
      playtestPath: relative(playtestPath),
      projectMemoryAuditPath: relative(auditPath),
      buildLogPath: relative(buildLogPath),
      traceAuditPath: relative(traceAuditPath),
      agentStatusPath: relative(agentStatusPath),
      runPlanPath: relative(path.join(runPath, "run-plan.json")),
      screenQualityPath: relative(screenshotAuditPath),
      screenshotPath: screenshotPath ? relative(screenshotPath) : relative(path.join(runPath, "evidence", "last-frame.png")),
    },
    issues: runPassed
      ? runIssues
      : [...runIssues, ...missingChecks].length
        ? [...runIssues, ...missingChecks]
        : ["Live audit run has not passed the full evidence gate yet."],
  };
  const out = path.join(runPath, "run-record.json");
  await writeFile(out, `${JSON.stringify(record, null, 2)}\n`);
  return out;
}

async function runAgent({ promptPath, runPath, model, agent, timeoutSeconds, appendTrace = false }) {
  if (!model) {
    throw new Error(
      "No model configured. Pass --model openrouter/<model> or set DRIVE16_LIVE_AUDIT_MODEL.",
    );
  }
  if (!model.includes("/")) {
    throw new Error("--model must use the OpenCode provider/model format, for example openrouter/deepseek/deepseek-chat-v3.1 or ollama/gpt-oss:120b.");
  }
  const prompt = await readFile(promptPath, "utf8");
  const command = [
    "run",
    ...(agent ? ["--agent", agent] : []),
    "--model",
    model,
    "--format",
    "json",
    "--title",
    `Drive16 live game audit ${path.basename(runPath)}`,
    "--dangerously-skip-permissions",
    prompt,
  ];
  const stdoutPath = path.join(runPath, "opencode-run.jsonl");
  const stderrPath = path.join(runPath, "opencode-run.stderr");
  const traceStartBytes = appendTrace && existsSync(stdoutPath) ? (await stat(stdoutPath)).size : 0;
  const flags = appendTrace ? "a" : "w";
  const stdoutStream = createWriteStream(stdoutPath, { flags });
  const stderrStream = createWriteStream(stderrPath, { flags });
  const child = spawn("opencode", command, {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  await writeAgentRunStatus(runPath, {
    status: "running",
    pid: child.pid ?? null,
    model,
    agent: agent || null,
    stdoutPath: relative(stdoutPath),
    stderrPath: relative(stderrPath),
    timeoutSeconds,
  });

  child.stdout.pipe(stdoutStream);
  child.stderr.pipe(stderrStream);

  return await new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const killTimer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      stderrStream.write(`\nDrive16 live-audit harness timed out after ${timeoutSeconds} seconds.\n`);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 5_000).unref();
    }, timeoutSeconds * 1000);

    child.on("error", async (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      stderrStream.write(`\n${String(error.message ?? error)}\n`);
      stdoutStream.end();
      stderrStream.end();
      await writeAgentRunStatus(runPath, {
        status: "failed",
        pid: child.pid ?? null,
        model,
        agent: agent || null,
        error: String(error.message ?? error),
        stdoutPath: relative(stdoutPath),
        stderrPath: relative(stderrPath),
      });
      resolve(1);
    });

    child.on("close", async (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      await Promise.all([
        stdoutStream.writableFinished
          ? Promise.resolve()
          : new Promise((finish) => stdoutStream.once("finish", finish)),
        stderrStream.writableFinished
          ? Promise.resolve()
          : new Promise((finish) => stderrStream.once("finish", finish)),
      ]);
      const exitCode = typeof code === "number" ? code : signal ? 1 : 0;
      const traceBuffer = existsSync(stdoutPath) ? await readFile(stdoutPath) : Buffer.alloc(0);
      const appendedTrace = traceBuffer.subarray(traceStartBytes).toString("utf8");
      const apiErrors = appendedTrace
        .split(/\r?\n/)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            const event = JSON.parse(line);
            if (event.type !== "error") return [];
            return [event.error?.data?.message || event.error?.message || "OpenCode emitted an API error."];
          } catch {
            return [];
          }
        });
      const effectiveExitCode = apiErrors.length > 0 ? 1 : exitCode;
      await writeAgentRunStatus(runPath, {
        status: effectiveExitCode === 0 ? "finished" : "failed",
        pid: child.pid ?? null,
        model,
        agent: agent || null,
        exitCode: effectiveExitCode,
        error: apiErrors[0] || undefined,
        signal,
        timedOut,
        timeoutSeconds,
        stdoutPath: relative(stdoutPath),
        stderrPath: relative(stderrPath),
      });
      resolve(effectiveExitCode);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = requiredPrompts.find((candidate) => candidate.id === args.prompt);
  if (!prompt) {
    throw new Error(`Unknown prompt ${args.prompt}. Expected one of: ${requiredPrompts.map((item) => item.id).join(", ")}`);
  }

  const readiness = await refreshReadiness();
  const mode = readiness.readyForGeneratedSpriteAudit ? "generated-sprite" : "primitive";
  const runId = args.resumeRun || args.runId || `${prompt.id}-${mode}-${timestamp()}`;
  const runPath = path.join(args.runsRoot, runId);
  const projectPath = path.join(runPath, "project");
  const startedAtMs = Date.now();
  const resuming = Boolean(args.resumeRun);
  let firstBuildSeed = null;
  if (resuming) {
    if (!existsSync(projectPath)) {
      throw new Error(`Cannot resume missing run project: ${relative(projectPath)}`);
    }
    const existingPlan = await readJsonIfExists(path.join(runPath, "run-plan.json"));
    firstBuildSeed = existingPlan.firstBuildSeed ?? null;
  } else {
    await mkdir(runPath, { recursive: true });
    await prepareProject(projectPath);
    firstBuildSeed = await applyFirstBuildSeed(prompt, projectPath);
  }

  const runTimestamp = timestamp();
  const promptPath = path.join(runPath, resuming ? `resume-prompt-${runTimestamp}.md` : "prompt.md");
  const preparedPrompt = resuming
    ? resumePromptText({ prompt, projectPath, runPath, readiness, firstBuildSeed, evidenceOnly: args.evidenceOnly })
    : promptText({ prompt, projectPath, readiness, firstBuildSeed });
  await writeFile(promptPath, preparedPrompt);
  const planPath = path.join(runPath, resuming ? `resume-plan-${runTimestamp}.json` : "run-plan.json");
  await writeFile(
    planPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        prompt,
        model: args.model || null,
        agent: args.agent || null,
        runAgent: args.runAgent,
        mode,
        runPath: relative(runPath),
        projectPath: relative(projectPath),
        promptPath: relative(promptPath),
        readinessPath: relative(readinessPath),
        firstBuildSeed,
        resuming,
        evidenceOnly: args.evidenceOnly,
      },
      null,
      2,
    )}\n`,
  );

  let agentExit = 0;
  if (args.runAgent) {
    // Emulator input is global to the local MCP process. Start every audit with
    // a clean sequence so a prior game's Start press cannot become new evidence.
    await rm(emulatorInputScriptPath, { force: true });
    agentExit = await runAgent({
      promptPath,
      runPath,
      model: args.model,
      agent: args.agent,
      timeoutSeconds: args.timeoutSeconds,
      appendTrace: resuming,
    });
  }

  const existingScreenshotPath = path.join(runPath, "evidence", "last-frame.png");
  const freshScreenshotPath = args.runAgent ? await captureStableFrame(projectPath, runPath) : "";
  const screenshotPath = freshScreenshotPath || (existsSync(existingScreenshotPath) ? existingScreenshotPath : "");
  const screenshotAuditPath = await runScreenshotAudit(runPath, screenshotPath);
  const auditPath = await runProjectMemoryAudit(projectPath, runPath);
  const traceAuditPath = await runTraceAudit(runPath, {
    allowSeededSource: Boolean(firstBuildSeed),
  });
  const previousRecord = resuming
    ? await readJsonIfExists(path.join(runPath, "run-record.json"))
    : {};
  const elapsedSeconds =
    (Number(previousRecord.elapsedSeconds) || 0) +
    Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));
  const recordPath = await writeRunRecord({
    prompt,
    projectPath,
    runPath,
    model: args.model,
    readiness,
    screenshotPath,
    auditPath,
    traceAuditPath,
    screenshotAuditPath,
    elapsedSeconds,
    firstBuildSeed,
  });

  console.log(`Live audit prompt packet: ${relative(runPath)}`);
  console.log(`Prompt: ${relative(promptPath)}`);
  console.log(`Run record template: ${relative(recordPath)}`);
  if (!args.runAgent) {
    console.log(`Prepared only. To run: node scripts/run-live-game-audit-prompt.mjs --prompt ${prompt.id} --run-agent --model <openrouter/model>`);
  }
  if (agentExit !== 0) {
    throw new Error(`OpenCode run exited with ${agentExit}. See ${relative(path.join(runPath, "opencode-run.stderr"))}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
