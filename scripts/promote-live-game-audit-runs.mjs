#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultReportPath = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "report.json");
const defaultRunsRoot = path.join(rootDir, "artifacts", "phase9", "live-game-audit", "runs");
const verifierPath = path.join(scriptDir, "verify-live-game-audit.mjs");
const requiredPromptIds = ["snake-basic", "pong-basic", "tetris-basic", "asteroids-basic"];

function parseArgs(argv) {
  const options = {
    reportPath: defaultReportPath,
    runsRoot: defaultRunsRoot,
    selections: new Map(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--report") {
      options.reportPath = path.resolve(argv[++index]);
    } else if (arg === "--runs-root") {
      options.runsRoot = path.resolve(argv[++index]);
    } else if (arg === "--run") {
      const selection = argv[++index] ?? "";
      const separator = selection.indexOf("=");
      if (separator <= 0 || separator === selection.length - 1) {
        throw new Error(`Invalid --run ${selection}. Expected prompt-id=run-id.`);
      }
      options.selections.set(selection.slice(0, separator), selection.slice(separator + 1));
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: scripts/promote-live-game-audit-runs.mjs --run prompt-id=run-id [--run ...]

Promotes exactly one passing run for each required prompt into report.json,
verifies the complete report and evidence files, then replaces the template.

Options:
  --run <prompt=run>  Repeat for snake-basic, pong-basic, tetris-basic, asteroids-basic.
  --report <file>     Report path. Default: artifacts/phase9/live-game-audit/report.json
  --runs-root <dir>   Run folders root. Default: artifacts/phase9/live-game-audit/runs
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function runDirectory(runsRoot, selection) {
  return path.isAbsolute(selection) ? selection : path.join(runsRoot, selection);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const missing = requiredPromptIds.filter((promptId) => !options.selections.has(promptId));
  const unexpected = [...options.selections.keys()].filter((promptId) => !requiredPromptIds.includes(promptId));
  if (missing.length || unexpected.length) {
    throw new Error([
      missing.length ? `Missing selections: ${missing.join(", ")}.` : "",
      unexpected.length ? `Unexpected selections: ${unexpected.join(", ")}.` : "",
    ].filter(Boolean).join(" "));
  }

  const report = await readJson(options.reportPath);
  const runs = [];
  for (const promptId of requiredPromptIds) {
    const selected = options.selections.get(promptId);
    const recordPath = path.join(runDirectory(options.runsRoot, selected), "run-record.json");
    const run = await readJson(recordPath);
    if (run.promptId !== promptId) {
      throw new Error(`${recordPath} belongs to ${run.promptId ?? "an unknown prompt"}, not ${promptId}.`);
    }
    if (run.status !== "pass" || (run.issues ?? []).length > 0) {
      throw new Error(`${recordPath} is not a clean passing run.`);
    }
    if (run.modelId && run.modelId !== report.model?.id) {
      throw new Error(`${recordPath} uses ${run.modelId}, but the report model is ${report.model?.id}.`);
    }
    runs.push(run);
  }

  const promoted = {
    ...report,
    generatedAt: new Date().toISOString(),
    runs,
    summary: {
      majorBlockers: [],
      recommendedNext: "Four-prompt live audit is complete. Review generated-game quality before preparing the model bakeoff.",
    },
  };
  const nextPath = `${options.reportPath}.next`;
  await writeFile(nextPath, `${JSON.stringify(promoted, null, 2)}\n`);
  try {
    await execFileAsync(
      process.execPath,
      [verifierPath, "--report", nextPath, "--require-complete", "--require-files"],
      { cwd: rootDir, maxBuffer: 1024 * 1024 * 8 },
    );
    await rename(nextPath, options.reportPath);
  } catch (error) {
    await rm(nextPath, { force: true });
    throw error;
  }

  for (const [promptId, selected] of options.selections) {
    console.log(`${promptId}: ${selected}`);
  }
  console.log(`Promoted report: ${path.relative(rootDir, options.reportPath)}`);
}

main().catch((error) => {
  const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`.trim();
  console.error(output || (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
