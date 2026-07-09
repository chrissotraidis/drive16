#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  goodOpenCodeGameTraceFixture,
  validateOpenCodeAudioTrace,
} from "./verify-opencode-audio-trace.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultReportPath = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "report.json");
const defaultReadinessPath = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "readiness.json");

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

const requiredChecks = [
  "compiled",
  "previewLoaded",
  "screenVisible",
  "inputResponded",
  "restartTested",
  "audioKnown",
  "assetLedgerUpdated",
  "gameplayRulesTested",
  "projectMemoryAudited",
];

const requiredEvidence = [
  "gamePath",
  "assetsPath",
  "playtestPath",
  "projectMemoryAuditPath",
  "buildLogPath",
  "runPlanPath",
  "screenshotPath",
];

function parseArgs(argv) {
  const args = {
    report: defaultReportPath,
    requireComplete: false,
    requireFiles: false,
    readiness: undefined,
    selfTest: false,
    writeTemplate: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--report") {
      args.report = path.resolve(argv[++index]);
    } else if (arg === "--readiness") {
      args.readiness = path.resolve(argv[++index]);
    } else if (arg === "--require-complete") {
      args.requireComplete = true;
    } else if (arg === "--require-files") {
      args.requireFiles = true;
    } else if (arg === "--self-test") {
      args.selfTest = true;
    } else if (arg === "--write-template") {
      args.writeTemplate = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: scripts/verify-live-game-audit.mjs [options]

Validates the next live Drive16 generated-game audit packet. This is the
pre-bakeoff proof that one model can build simple games through the app loop
without confusing "ROM exists" with "playable".

Options:
  --report <file>       JSON report path. Default: artifacts/phase9/live-game-audit/report.json
  --readiness <file>    Seed --write-template plumbing from a readiness report.
                        Default: latest readiness.json when it exists.
  --require-complete    Fail when the report is missing or has missing prompt runs.
  --require-files       Require every evidence path in the report to exist on disk.
  --write-template      Write a starter report template to --report.
  --self-test           Run temporary valid/invalid fixture checks.
`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function captureIssue(issues, fn) {
  try {
    fn();
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
}

function asArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
  return value;
}

function relativeOrAbsoluteExists(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
  return existsSync(resolved);
}

function resolveRelativeOrAbsolute(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

function listFilesRecursive(dirPath) {
  if (!existsSync(dirPath)) return [];
  const stat = statSync(dirPath);
  if (stat.isFile()) return [dirPath];
  if (!stat.isDirectory()) return [];
  return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return listFilesRecursive(entryPath);
    if (entry.isFile()) return [entryPath];
    return [];
  });
}

function projectProofFiles(run) {
  const projectPath = resolveRelativeOrAbsolute(run.projectPath);
  return ["src", "res"]
    .flatMap((dirName) => listFilesRecursive(path.join(projectPath, dirName)))
    .filter((filePath) => !filePath.includes(`${path.sep}out${path.sep}`));
}

function staleRomProofFiles(run) {
  const romPath = resolveRelativeOrAbsolute(run.romPath);
  if (!existsSync(romPath)) return [];
  const romMtimeMs = statSync(romPath).mtimeMs;
  return projectProofFiles(run).filter((filePath) => statSync(filePath).mtimeMs > romMtimeMs);
}

function validateEvidencePath(runLabel, evidence, field, { requireFiles }) {
  const value = evidence[field];
  assert(typeof value === "string" && value.trim(), `${runLabel} evidence.${field} is required.`);
  if (requireFiles) {
    assert(relativeOrAbsoluteExists(value), `${runLabel} evidence.${field} does not exist: ${value}`);
  }
}

function validateRun(run, report, promptIds, { requireFiles }) {
  const issues = [];
  const runLabel = `${run?.promptId ?? "unknown-prompt"}`;

  captureIssue(issues, () => assert(promptIds.has(run.promptId), `${runLabel} references an unknown prompt.`));
  captureIssue(issues, () =>
    assert(["pass", "needs-repair", "fail"].includes(run.status), `${runLabel} status must be pass, needs-repair, or fail.`),
  );
  captureIssue(issues, () =>
    assert(Number.isFinite(run.elapsedSeconds) && run.elapsedSeconds > 0, `${runLabel} needs elapsedSeconds.`),
  );
  captureIssue(issues, () => assert(typeof run.projectPath === "string" && run.projectPath, `${runLabel} needs projectPath.`));
  captureIssue(issues, () => assert(typeof run.romPath === "string" && run.romPath, `${runLabel} needs romPath.`));
  captureIssue(issues, () => assert(typeof run.sourceSeeded === "boolean", `${runLabel} sourceSeeded must be boolean.`));
  if (requireFiles) {
    captureIssue(issues, () => assert(relativeOrAbsoluteExists(run.projectPath), `${runLabel} projectPath does not exist: ${run.projectPath}`));
    captureIssue(issues, () => assert(relativeOrAbsoluteExists(run.romPath), `${runLabel} romPath does not exist: ${run.romPath}`));
  }

  const checks = run.checks ?? {};
  for (const field of requiredChecks) {
    captureIssue(issues, () => assert(typeof checks[field] === "boolean", `${runLabel} checks.${field} must be boolean.`));
  }

  const evidence = run.evidence ?? {};
  for (const field of requiredEvidence) {
    captureIssue(issues, () => validateEvidencePath(runLabel, evidence, field, { requireFiles }));
  }

  captureIssue(issues, () => {
    assert(run.enhancements && typeof run.enhancements === "object", `${runLabel} needs enhancements.`);
    assert(
      ["comfyui", "primitive", "bundled", "none", "unknown"].includes(run.enhancements.sprites),
      `${runLabel} enhancements.sprites must be comfyui, primitive, bundled, none, or unknown.`,
    );
    assert(
      ["captured", "silent", "disabled-by-request", "failed", "untested"].includes(run.enhancements.audio),
      `${runLabel} enhancements.audio must be captured, silent, disabled-by-request, failed, or untested.`,
    );
    assert(
      typeof run.enhancements.fallbackDisclosed === "boolean",
      `${runLabel} enhancements.fallbackDisclosed must be boolean.`,
    );
  });

  captureIssue(issues, () => assert(Array.isArray(run.issues), `${runLabel} issues must be an array.`));
  captureIssue(issues, () => {
    const prompt = report.prompts.find((candidate) => candidate.id === run.promptId);
    if (!prompt) return;
    assert(
      prompt.genre === run.genre,
      `${runLabel} genre must match prompt genre ${prompt.genre}; got ${run.genre}.`,
    );
  });

  if (run.status === "pass") {
    for (const field of requiredChecks) {
      captureIssue(issues, () => assert(checks[field] === true, `${runLabel} cannot pass until checks.${field} is true.`));
    }
    captureIssue(issues, () =>
      assert(
        ["captured", "disabled-by-request"].includes(run.enhancements.audio),
        `${runLabel} cannot pass with audio=${run.enhancements?.audio}; audio must be captured or disabled by request.`,
      ),
    );
    captureIssue(issues, () => assert(run.issues.length === 0, `${runLabel} cannot pass while issues are listed.`));
    if (requireFiles) {
      captureIssue(issues, () => {
        const newerFiles = staleRomProofFiles(run);
        const newestFile = newerFiles[0] ? path.relative(rootDir, newerFiles[0]) : "unknown";
        assert(
          newerFiles.length === 0,
          `${runLabel} romPath is stale; rebuild after newer source/resource file: ${newestFile}`,
        );
      });
    }
    if (requireFiles) {
      captureIssue(issues, () => {
        if (!run.sourceSeeded) return;
        const plan = JSON.parse(readFileSync(resolveRelativeOrAbsolute(evidence.runPlanPath), "utf8"));
        assert(plan.prompt?.id === run.promptId, `${runLabel} seeded run plan belongs to a different prompt.`);
        assert(
          typeof plan.firstBuildSeed?.source === "string" && plan.firstBuildSeed.source,
          `${runLabel} sourceSeeded requires firstBuildSeed.source in evidence.runPlanPath.`,
        );
      });
      captureIssue(issues, () => {
        const tracePath = resolveRelativeOrAbsolute(evidence.buildLogPath);
        const traceText = readFileSync(tracePath, "utf8");
        const traceResult = validateOpenCodeAudioTrace(traceText, {
          label: `${runLabel} evidence.buildLogPath`,
          expectAudio: run.enhancements?.audio === "captured",
          expectGameProgress: true,
          allowSeededSource: run.sourceSeeded,
        });
        assert(
          traceResult.issues.length === 0,
          `${runLabel} OpenCode trace is not valid:\n- ${traceResult.issues.join("\n- ")}`,
        );
      });
    }
  }

  return issues;
}

function validateReport(report, options = {}) {
  const issues = [];

  captureIssue(issues, () => {
    assert(report && typeof report === "object", "Report must be a JSON object.");
    assert(typeof report.generatedAt === "string" && report.generatedAt, "generatedAt is required.");
    assert(report.model && typeof report.model.id === "string" && report.model.id, "model.id is required.");
    assert(typeof report.model.label === "string" && report.model.label, "model.label is required.");
  });

  const plumbing = report.plumbing ?? {};
  for (const gate of ["appBaseline", "opencodeReachable", "audioSafety"]) {
    captureIssue(issues, () => assert(plumbing[gate] === "pass", `plumbing.${gate} must be pass before this audit is trusted.`));
  }
  captureIssue(issues, () =>
    assert(
      ["ready", "fallback-disclosed", "disabled"].includes(plumbing.comfyUiStatus),
      "plumbing.comfyUiStatus must be ready, fallback-disclosed, or disabled.",
    ),
  );

  const prompts = asArray(report.prompts ?? [], "prompts");
  const runs = asArray(report.runs ?? [], "runs");
  const promptIds = new Set(prompts.map((prompt) => prompt.id));
  const runPromptIds = new Set(runs.map((run) => run.promptId));

  for (const required of requiredPrompts) {
    captureIssue(issues, () => assert(promptIds.has(required.id), `Missing required prompt ${required.id}.`));
  }

  for (const prompt of prompts) {
    captureIssue(issues, () => assert(typeof prompt.id === "string" && prompt.id, "Every prompt needs an id."));
    captureIssue(issues, () =>
      assert(
        ["snake", "pong", "tetris", "asteroids"].includes(prompt.genre),
        `Prompt ${prompt.id} needs a supported genre.`,
      ),
    );
    captureIssue(issues, () =>
      assert(typeof prompt.text === "string" && prompt.text.length > 12, `Prompt ${prompt.id} needs text.`),
    );
  }

  const seenRuns = new Set();
  for (const run of runs) {
    captureIssue(issues, () => {
      assert(!seenRuns.has(run.promptId), `${run.promptId} is duplicated.`);
      seenRuns.add(run.promptId);
    });
    issues.push(...validateRun(run, report, promptIds, options));
  }

  if (options.requireComplete) {
    for (const required of requiredPrompts) {
      captureIssue(issues, () =>
        assert(runPromptIds.has(required.id), `Missing live audit run for ${required.id}.`),
      );
    }
  }

  captureIssue(issues, () => {
    assert(report.summary && typeof report.summary === "object", "summary is required.");
    assert(Array.isArray(report.summary.majorBlockers), "summary.majorBlockers must be an array.");
    assert(
      typeof report.summary.recommendedNext === "string" && report.summary.recommendedNext,
      "summary.recommendedNext is required.",
    );
  });

  return issues;
}

function readinessCheck(readiness, id) {
  return (readiness?.checks ?? []).find((check) => check.id === id);
}

function readinessPassed(readiness, id) {
  return readinessCheck(readiness, id)?.status === "pass";
}

function templatePlumbingFromReadiness(readiness) {
  if (!readiness) {
    return {
      appBaseline: "pending",
      opencodeReachable: "pending",
      comfyUiStatus: "pending",
      audioSafety: "pending",
    };
  }

  return {
    appBaseline: readinessPassed(readiness, "appPreview") ? "pass" : "fail",
    opencodeReachable:
      readinessPassed(readiness, "opencodeConfig") && readinessPassed(readiness, "openRouterCredential")
        ? "pass"
        : "fail",
    comfyUiStatus: readiness.readyForGeneratedSpriteAudit
      ? "ready"
      : readiness.comfyUiMode === "fallback-disclosed" || readiness.readyForPrimitiveAudit
        ? "fallback-disclosed"
        : "disabled",
    audioSafety: readinessPassed(readiness, "agentContract") ? "pass" : "fail",
  };
}

function templateSummaryFromReadiness(readiness) {
  if (!readiness) {
    return {
      majorBlockers: [],
      recommendedNext: "Run the four required prompts in the native app, then fill each run with evidence.",
    };
  }

  const requiredFailures = (readiness.checks ?? [])
    .filter((check) => check.requiredForLiveAudit && check.status === "fail")
    .map((check) => `${check.label}: ${check.detail}`);

  return {
    majorBlockers: requiredFailures,
    recommendedNext:
      readiness.nextAction ||
      "Run the four required prompts in the native app, then fill each run with evidence.",
  };
}

function templateReport(readiness) {
  return {
    generatedAt: new Date().toISOString(),
    model: {
      id: "openrouter/deepseek/deepseek-chat-v3.1",
      label: "DeepSeek V3.1",
    },
    plumbing: templatePlumbingFromReadiness(readiness),
    prompts: requiredPrompts,
    runs: [],
    summary: templateSummaryFromReadiness(readiness),
  };
}

function fixtureRun(prompt, root) {
  const evidence = {
    gamePath: path.join(root, prompt.id, "GAME.md"),
    assetsPath: path.join(root, prompt.id, "ASSETS.md"),
    playtestPath: path.join(root, prompt.id, "PLAYTEST.md"),
    projectMemoryAuditPath: path.join(root, prompt.id, "audit.json"),
    buildLogPath: path.join(root, prompt.id, "build-log.jsonl"),
    runPlanPath: path.join(root, prompt.id, "run-plan.json"),
    screenshotPath: path.join(root, prompt.id, "screen.png"),
  };
  return {
    promptId: prompt.id,
    genre: prompt.genre,
    status: "pass",
    elapsedSeconds: 420,
    sourceSeeded: false,
    projectPath: path.join(root, prompt.id),
    romPath: path.join(root, prompt.id, "out", "rom.bin"),
    checks: Object.fromEntries(requiredChecks.map((check) => [check, true])),
    enhancements: {
      sprites: "primitive",
      audio: "captured",
      fallbackDisclosed: true,
    },
    evidence,
    issues: [],
  };
}

async function writeFixtureEvidence(run) {
  for (const [field, evidencePath] of Object.entries(run.evidence)) {
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(
      evidencePath,
      field === "buildLogPath"
        ? `${goodOpenCodeGameTraceFixture()}\n`
        : field === "runPlanPath"
          ? `${JSON.stringify({ prompt: { id: run.promptId }, firstBuildSeed: null }, null, 2)}\n`
          : "fixture\n",
    );
  }
  await writeFixtureProjectFiles(run);
}

async function writeFixtureProjectFiles(run) {
  const sourcePath = path.join(run.projectPath, "src", "main.c");
  const resourcePath = path.join(run.projectPath, "res", "resources.res");
  const romPath = run.romPath;
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await mkdir(path.dirname(resourcePath), { recursive: true });
  await mkdir(path.dirname(romPath), { recursive: true });
  await writeFile(sourcePath, "int main(void) { return 0; }\n");
  await writeFile(resourcePath, 'XGM fixture_music "fixture.vgm"\n');
  await writeFile(romPath, "fixture rom\n");

  const sourceTime = new Date("2026-01-01T00:00:00.000Z");
  const romTime = new Date("2026-01-01T00:00:10.000Z");
  await utimes(sourcePath, sourceTime, sourceTime);
  await utimes(resourcePath, sourceTime, sourceTime);
  await utimes(romPath, romTime, romTime);
}

async function completeFixtureReport(root) {
  const report = templateReport();
  report.plumbing = {
    appBaseline: "pass",
    opencodeReachable: "pass",
    comfyUiStatus: "fallback-disclosed",
    audioSafety: "pass",
  };
  report.runs = report.prompts.map((prompt) => fixtureRun(prompt, root));
  report.summary = {
    majorBlockers: [],
    recommendedNext: "Fixture report is complete.",
  };
  for (const run of report.runs) {
    await writeFixtureEvidence(run);
  }
  return report;
}

async function readReadinessReport(readinessPath = defaultReadinessPath) {
  if (!readinessPath) return undefined;
  const text = await readFile(readinessPath, "utf8");
  return JSON.parse(text);
}

async function verifyReportFile(reportPath, options) {
  let text;
  try {
    text = await readFile(reportPath, "utf8");
  } catch (error) {
    if (!options.requireComplete && error?.code === "ENOENT") {
      console.log(
        `Live game audit report not found yet: ${path.relative(rootDir, reportPath)}. Run with --write-template before the next native prompt audit.`,
      );
      return;
    }
    throw error;
  }

  const report = JSON.parse(text);
  const issues = validateReport(report, options);
  if (issues.length > 0) {
    throw new Error(`Live game audit report failed:\n- ${issues.join("\n- ")}`);
  }
  if (!options.requireComplete && report.runs.length < requiredPrompts.length) {
    console.log(
      `Live game audit template verified: prompts=${report.prompts.length}, runs=${report.runs.length}. This is not a completed live audit; run with --require-complete --require-files after native runs are recorded.`,
    );
    return;
  }
  console.log(
    `Live game audit report verified: prompts=${report.prompts.length}, runs=${report.runs.length}`,
  );
}

async function runSelfTest() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "drive16-live-game-audit-"));
  try {
    const valid = await completeFixtureReport(tempDir);
    const validPath = path.join(tempDir, "valid.json");
    await writeFile(validPath, `${JSON.stringify(valid, null, 2)}\n`);
    await verifyReportFile(validPath, { requireComplete: true, requireFiles: true });

    const invalid = JSON.parse(JSON.stringify(valid));
    invalid.runs[1].checks.screenVisible = false;
    const invalidPath = path.join(tempDir, "invalid.json");
    await writeFile(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    let rejectedIncomplete = false;
    try {
      await verifyReportFile(invalidPath, { requireComplete: true, requireFiles: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("pong-basic cannot pass until checks.screenVisible is true")) {
        throw new Error(`Expected missing-screen failure. Saw:\n${message}`);
      }
      console.log("Live game audit self-test rejected incomplete pass evidence.");
      rejectedIncomplete = true;
    }
    if (!rejectedIncomplete) {
      throw new Error("Live game audit self-test unexpectedly accepted incomplete pass evidence.");
    }

    const readiness = {
      readyForPrimitiveAudit: true,
      readyForGeneratedSpriteAudit: false,
      comfyUiMode: "fallback-disclosed",
      nextAction: "Run the primitive/fallback live audit now.",
      checks: [
        { id: "appPreview", label: "Local app preview", status: "pass", requiredForLiveAudit: true, detail: "ok" },
        { id: "opencodeConfig", label: "OpenCode config", status: "pass", requiredForLiveAudit: true, detail: "ok" },
        { id: "openRouterCredential", label: "OpenRouter credential", status: "pass", requiredForLiveAudit: true, detail: "ok" },
        { id: "agentContract", label: "Agent/UI contract checks", status: "pass", requiredForLiveAudit: true, detail: "ok" },
        { id: "comfyUi", label: "ComfyUI sprite readiness", status: "warning", requiredForLiveAudit: false, detail: "not running" },
      ],
    };
    const seeded = templateReport(readiness);
    if (seeded.plumbing.comfyUiStatus !== "fallback-disclosed") {
      throw new Error("Readiness-seeded template should preserve fallback-disclosed ComfyUI status.");
    }
    if (seeded.plumbing.opencodeReachable !== "pass" || seeded.plumbing.audioSafety !== "pass") {
      throw new Error("Readiness-seeded template should carry passing plumbing checks.");
    }

    const stale = JSON.parse(JSON.stringify(valid));
    const staleSourcePath = path.join(stale.runs[0].projectPath, "src", "main.c");
    const staleSourceTime = new Date("2026-01-01T00:00:20.000Z");
    await utimes(staleSourcePath, staleSourceTime, staleSourceTime);
    const stalePath = path.join(tempDir, "stale-rom.json");
    await writeFile(stalePath, `${JSON.stringify(stale, null, 2)}\n`);
    try {
      await verifyReportFile(stalePath, { requireComplete: true, requireFiles: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("snake-basic romPath is stale")) {
        throw new Error(`Expected stale-ROM failure. Saw:\n${message}`);
      }
      console.log("Live game audit self-test rejected stale ROM evidence.");
      return;
    }
    throw new Error("Live game audit self-test unexpectedly accepted stale ROM evidence.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));

if (args.selfTest) {
  await runSelfTest();
} else if (args.writeTemplate) {
  const readinessPath =
    args.readiness ?? (existsSync(defaultReadinessPath) ? defaultReadinessPath : undefined);
  const readiness = readinessPath ? await readReadinessReport(readinessPath) : undefined;
  await mkdir(path.dirname(args.report), { recursive: true });
  await writeFile(args.report, `${JSON.stringify(templateReport(readiness), null, 2)}\n`);
  console.log(`Live game audit template written: ${path.relative(rootDir, args.report)}`);
} else {
  await verifyReportFile(args.report, {
    requireComplete: args.requireComplete,
    requireFiles: args.requireFiles,
  });
}
