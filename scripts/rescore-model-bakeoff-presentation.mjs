#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const reportPath = path.join(rootDir, "artifacts", "phase9", "model-bakeoff", "report.json");
const validatorPath = path.join(rootDir, "scripts", "validate-game-screenshot.py");

function relative(filePath) {
  return path.relative(rootDir, filePath);
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
let passed = 0;
let needsRepair = 0;

for (const run of report.runs) {
  const playtestPath = path.resolve(rootDir, run.evidence.playtestPath);
  const runRoot = path.dirname(path.dirname(playtestPath));
  const screenshotPath = path.join(runRoot, "evidence", "last-frame.png");
  const screenQualityPath = path.join(runRoot, "screen-quality-v2.json");
  const result = spawnSync(
    "python3",
    [validatorPath, screenshotPath, "--out", screenQualityPath],
    { cwd: rootDir, encoding: "utf8" },
  );
  if (![0, 1].includes(result.status)) {
    throw new Error(
      `Could not rescore ${run.modelId} / ${run.promptId}: ${result.stderr || result.stdout}`,
    );
  }

  const quality = JSON.parse(await readFile(screenQualityPath, "utf8"));
  run.presentation = quality.status === "passed" ? "pass" : "needs-repair";
  run.evidence.screenshotPath = relative(screenshotPath);
  run.evidence.screenQualityPath = relative(screenQualityPath);
  const previousNotes = String(run.evidence.notes ?? "")
    .replace(/\s*Presentation v2:.*$/s, "")
    .trim();
  const presentationNote =
    quality.status === "passed"
      ? "Presentation v2: passed."
      : `Presentation v2: ${quality.issues.join(" ")}`;
  run.evidence.notes = `${previousNotes} ${presentationNote}`.trim();

  if (run.presentation === "pass") passed += 1;
  else needsRepair += 1;
}

report.generatedAt = new Date().toISOString();
report.presentationSummary = {
  contractVersion: 2,
  passed,
  needsRepair,
  note: "Existing model outputs were rescored without new model calls.",
};
report.methodology.presentationContract =
  "Every existing screenshot was rescored with screenshot-quality contract v2 after the deterministic genre skeletons were upgraded. This is a historical-output rescore, not a fresh generation run.";
if (report.recommendedDefault) {
  report.recommendedDefault.reason =
    "DeepSeek remains the strongest tested model for functional completion, tool discipline, and documentation honesty. No historical model output passes presentation contract v2, so this recommendation is operational rather than a visual-quality sign-off.";
}

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Model bakeoff presentation rescore complete: passed=${passed}, needs-repair=${needsRepair}`,
);
