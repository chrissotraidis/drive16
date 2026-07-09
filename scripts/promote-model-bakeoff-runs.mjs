#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { analyzeOpenCodeAudioTrace } from "./verify-opencode-audio-trace.mjs";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultSelection = path.join(rootDir, "artifacts", "phase9", "model-bakeoff", "selection.json");
const defaultReport = path.join(rootDir, "artifacts", "phase9", "model-bakeoff", "report.json");
const requiredPrompts = ["snake-basic", "pong-basic", "tetris-basic", "asteroids-basic"];

function parseArgs(argv) {
  const args = { selection: defaultSelection, report: defaultReport };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--selection") args.selection = path.resolve(argv[++index]);
    else if (arg === "--report") args.report = path.resolve(argv[++index]);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: scripts/promote-model-bakeoff-runs.mjs [--selection file] [--report file]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function resolveEvidence(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

function traceCost(traceText) {
  return traceText.split(/\r?\n/).reduce((total, line) => {
    if (!line.trim()) return total;
    try {
      const event = JSON.parse(line);
      return total + (event.type === "step_finish" ? Number(event.part?.cost ?? 0) : 0);
    } catch {
      return total;
    }
  }, 0);
}

function agentText(traceText) {
  return traceText.split(/\r?\n/).flatMap((line) => {
    if (!line.trim()) return [];
    try {
      const event = JSON.parse(line);
      return event.type === "text" && typeof event.part?.text === "string" ? [event.part.text] : [];
    } catch {
      return [];
    }
  }).join("\n");
}

function toolUseScore(summary) {
  return [
    (summary.buildRomSuccesses ?? 0) > 0,
    (summary.captureFrameCalls ?? 0) > 0,
    (summary.sendInputDirectionalCalls ?? 0) > 0,
    (summary.sendInputStartCalls ?? 0) > 0,
    (summary.verifyAudioSuccesses ?? 0) + (summary.captureAudioSuccesses ?? 0) > 0,
  ].filter(Boolean).length;
}

function assetUseScore(audit, assetsText) {
  let score = 0;
  if ((audit.assetRows ?? 0) >= 2) score += 1;
  if ((audit.assetRows ?? 0) >= 4) score += 1;
  if (/captured non-silent|audio evidence:\s*captured/i.test(assetsText)) score += 1;
  if (audit.status === "passed") score += 1;
  if (audit.gate === "pass") score += 1;
  return score;
}

function honestyScore(record, playtestText, traceText) {
  if (record.status === "pass") return 5;
  const textClaimsPass = /^playability gate\s*:\s*pass\b/im.test(playtestText)
    || /playability gate\s*:\s*pass|all required gates met|all docs (?:are )?updated|docs updated/i.test(traceText);
  if (textClaimsPass) return 1;
  if (/playability gate\s*:\s*fail/i.test(playtestText)) return 5;
  return 3;
}

function playability(record) {
  if (record.status === "pass") return "pass";
  if (record.checks?.compiled && record.checks?.screenVisible) return "needs-repair";
  return "fail";
}

async function buildRun(model, promptId) {
  const recordPath = resolveEvidence(model.runs[promptId]);
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  if (record.promptId !== promptId) {
    throw new Error(`${model.id} maps ${promptId} to a ${record.promptId} record.`);
  }
  if (record.modelId !== model.id) {
    throw new Error(`${recordPath} belongs to ${record.modelId}, not ${model.id}.`);
  }

  const playtestPath = resolveEvidence(record.evidence.playtestPath);
  const assetsPath = resolveEvidence(record.evidence.assetsPath);
  const auditPath = resolveEvidence(record.evidence.projectMemoryAuditPath);
  const tracePath = resolveEvidence(record.evidence.buildLogPath);
  const screenshotPath = resolveEvidence(record.evidence.screenshotPath);
  const screenQualityPath = path.join(path.dirname(recordPath), "screen-quality-v2.json");
  try {
    await execFileAsync(
      "python3",
      ["scripts/validate-game-screenshot.py", screenshotPath, "--out", screenQualityPath],
      { cwd: rootDir },
    );
  } catch (error) {
    if (error?.code !== 1) throw error;
  }
  const [playtestText, assetsText, auditText, traceText] = await Promise.all([
    readFile(playtestPath, "utf8"),
    readFile(assetsPath, "utf8"),
    readFile(auditPath, "utf8"),
    readFile(tracePath, "utf8"),
  ]);
  const audit = JSON.parse(auditText);
  const screenQuality = JSON.parse(await readFile(screenQualityPath, "utf8"));
  const trace = analyzeOpenCodeAudioTrace(traceText);
  const issues = record.issues ?? [];

  return {
    modelId: model.id,
    promptId,
    compileSuccess: record.checks?.compiled === true,
    toolUse: toolUseScore(trace),
    assetUse: assetUseScore(audit, assetsText),
    playability: playability(record),
    presentation: screenQuality.status === "passed" ? "pass" : "needs-repair",
    honesty: honestyScore(record, playtestText, agentText(traceText)),
    timeSeconds: record.elapsedSeconds,
    costUsd: Number(traceCost(traceText).toFixed(6)),
    evidence: {
      playtestPath: relative(playtestPath),
      auditReportPath: relative(auditPath),
      screenshotPath: relative(screenshotPath),
      screenQualityPath: relative(screenQualityPath),
      notes: `${
        issues.length > 0
          ? `${model.runMode}: ${issues.join(" ")}`
          : `${model.runMode}: all live-audit checks passed.`
      } Presentation v2: ${
        screenQuality.status === "passed" ? "passed." : screenQuality.issues.join(" ")
      }`,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await execFileAsync("node", ["scripts/verify-live-game-audit.mjs", "--require-complete", "--require-files"], {
    cwd: rootDir,
  });
  const selection = JSON.parse(await readFile(args.selection, "utf8"));
  if (!Array.isArray(selection.models) || selection.models.length < 3) {
    throw new Error("Selection needs at least three models.");
  }

  const runs = [];
  for (const model of selection.models) {
    for (const promptId of requiredPrompts) {
      if (!model.runs?.[promptId]) throw new Error(`${model.id} is missing ${promptId}.`);
      runs.push(await buildRun(model, promptId));
    }
  }
  const presentationPasses = runs.filter((run) => run.presentation === "pass").length;

  const report = {
    generatedAt: new Date().toISOString(),
    plumbing: {
      opencodePortRecovery: "pass",
      comfyUiManagedDependency: "pass",
      observableAgentLoop: "pass",
      playabilityMemoryGates: "pass",
      audioSafety: "pass",
    },
    models: selection.models.map(({ id, label }) => ({ id, label })),
    prompts: [
      { id: "snake-basic", text: "Build a simple working Genesis-style Snake game." },
      { id: "pong-basic", text: "Build a simple working Genesis-style Pong game." },
      { id: "tetris-basic", text: "Build a simple working Genesis-style Tetris game." },
      { id: "asteroids-basic", text: "Build a simple working Genesis-style Asteroids game." },
    ],
    runs,
    presentationSummary: {
      contractVersion: 2,
      passed: presentationPasses,
      needsRepair: runs.length - presentationPasses,
      note: "Existing model outputs were rescored without new model calls.",
    },
    methodology: {
      ...selection.methodology,
      presentationContract:
        "Every existing screenshot was rescored with screenshot-quality contract v2 after the deterministic genre skeletons were upgraded. This is a historical-output rescore, not a fresh generation run.",
    },
    operationalFallback: selection.operationalFallback,
    recommendedDefault: selection.recommendedDefault
      ? {
          ...selection.recommendedDefault,
          reason:
            presentationPasses === 0
              ? "DeepSeek remains the strongest tested model for functional completion, tool discipline, and documentation honesty. No historical model output passes presentation contract v2, so this recommendation is operational rather than a visual-quality sign-off."
              : selection.recommendedDefault.reason,
        }
      : null,
  };

  await mkdir(path.dirname(args.report), { recursive: true });
  const temporary = `${args.report}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
  try {
    await execFileAsync(
      "node",
      ["scripts/verify-model-bakeoff-report.mjs", "--report", temporary, "--require-complete", "--require-files"],
      { cwd: rootDir },
    );
    await rename(temporary, args.report);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  console.log(`Promoted model bakeoff report: ${relative(args.report)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
