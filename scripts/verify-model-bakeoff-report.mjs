#!/usr/bin/env node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const defaultReportPath = path.join(rootDir, "artifacts", "phase9", "model-bakeoff", "report.json");
const requiredPromptIds = ["snake-basic", "pong-basic", "tetris-basic", "asteroids-basic"];
const requiredScoreFields = [
  "compileSuccess",
  "toolUse",
  "assetUse",
  "playability",
  "presentation",
  "honesty",
];
const requiredPlumbingGates = [
  "opencodePortRecovery",
  "comfyUiManagedDependency",
  "observableAgentLoop",
  "playabilityMemoryGates",
  "audioSafety",
];

function parseArgs(argv) {
  const args = {
    report: defaultReportPath,
    selfTest: false,
    requireComplete: false,
    requireFiles: false,
    writeTemplate: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--report") {
      args.report = path.resolve(argv[++index]);
    } else if (arg === "--self-test") {
      args.selfTest = true;
    } else if (arg === "--require-complete") {
      args.requireComplete = true;
    } else if (arg === "--require-files") {
      args.requireFiles = true;
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
  console.log(`Usage: scripts/verify-model-bakeoff-report.mjs [options]

Validates the eventual Drive16 model bakeoff report without claiming a bakeoff
has already happened.

Options:
  --report <file>       JSON report path. Default: artifacts/phase9/model-bakeoff/report.json
  --require-complete    Fail when the report file is missing.
  --require-files       Require every run evidence path to exist on disk.
  --write-template      Write a starter report template to --report.
  --self-test           Run temporary valid/invalid fixture checks.
`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
  return value;
}

function modelLooksLikeDeepSeekV31(modelId) {
  return /deepseek/i.test(modelId) && /(v?3\.?1|chat-v3\.?1|deepseek-chat)/i.test(modelId);
}

function validateScore(value, field, runLabel) {
  if (field === "compileSuccess") {
    assert(typeof value === "boolean", `${runLabel} compileSuccess must be boolean.`);
    return;
  }
  if (field === "playability") {
    assert(
      ["pass", "needs-repair", "fail"].includes(value),
      `${runLabel} playability must be pass, needs-repair, or fail.`,
    );
    return;
  }
  if (field === "presentation") {
    assert(
      ["pass", "needs-repair", "fail"].includes(value),
      `${runLabel} presentation must be pass, needs-repair, or fail.`,
    );
    return;
  }
  assert(
    Number.isInteger(value) && value >= 0 && value <= 5,
    `${runLabel} ${field} must be an integer score from 0 to 5.`,
  );
}

function relativeOrAbsoluteExists(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
  return existsSync(resolved);
}

function resolveRelativeOrAbsolute(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

function validateReport(report, options = {}) {
  const issues = [];
  const capture = (fn) => {
    try {
      fn();
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  };

  capture(() => {
    assert(report && typeof report === "object", "Report must be a JSON object.");
    assert(typeof report.generatedAt === "string" && report.generatedAt, "generatedAt is required.");
  });

  const plumbing = report.plumbing ?? {};
  for (const gate of requiredPlumbingGates) {
    capture(() => {
      assert(plumbing[gate] === "pass", `plumbing.${gate} must be pass before running model bakeoff.`);
    });
  }

  const models = asArray(report.models ?? [], "models");
  const prompts = asArray(report.prompts ?? [], "prompts");
  const runs = asArray(report.runs ?? [], "runs");
  const modelIds = new Set(models.map((model) => model.id));
  const promptIds = new Set(prompts.map((prompt) => prompt.id));

  capture(() => assert(models.length >= 3, "Bakeoff needs DeepSeek V3.1 plus at least two alternatives."));
  capture(() =>
    assert(
      models.some((model) => modelLooksLikeDeepSeekV31(String(model.id ?? ""))),
      "Bakeoff must include DeepSeek V3.1.",
    ),
  );

  for (const model of models) {
    capture(() => {
      assert(typeof model.id === "string" && model.id, "Every model needs an id.");
      assert(typeof model.label === "string" && model.label, `Model ${model.id} needs a label.`);
    });
  }

  for (const promptId of requiredPromptIds) {
    capture(() => assert(promptIds.has(promptId), `Missing required prompt ${promptId}.`));
  }

  for (const prompt of prompts) {
    capture(() => {
      assert(typeof prompt.id === "string" && prompt.id, "Every prompt needs an id.");
      assert(typeof prompt.text === "string" && prompt.text.length > 12, `Prompt ${prompt.id} needs text.`);
    });
  }

  const runKeys = new Set();
  for (const run of runs) {
    const runLabel = `${run.modelId ?? "unknown-model"} / ${run.promptId ?? "unknown-prompt"}`;
    capture(() => assert(modelIds.has(run.modelId), `${runLabel} references an unknown model.`));
    capture(() => assert(promptIds.has(run.promptId), `${runLabel} references an unknown prompt.`));
    capture(() => {
      const key = `${run.modelId}::${run.promptId}`;
      assert(!runKeys.has(key), `${runLabel} is duplicated.`);
      runKeys.add(key);
    });
    for (const field of requiredScoreFields) {
      capture(() => validateScore(run[field], field, runLabel));
    }
    capture(() => assert(Number.isFinite(run.timeSeconds) && run.timeSeconds > 0, `${runLabel} needs timeSeconds.`));
    capture(() => assert(Number.isFinite(run.costUsd) && run.costUsd >= 0, `${runLabel} needs costUsd.`));
    capture(() => {
      assert(run.evidence && typeof run.evidence === "object", `${runLabel} needs evidence.`);
      assert(
        typeof run.evidence.playtestPath === "string" && run.evidence.playtestPath,
        `${runLabel} needs evidence.playtestPath.`,
      );
      assert(
        typeof run.evidence.auditReportPath === "string" && run.evidence.auditReportPath,
        `${runLabel} needs evidence.auditReportPath.`,
      );
      assert(
        typeof run.evidence.screenshotPath === "string" && run.evidence.screenshotPath,
        `${runLabel} needs evidence.screenshotPath.`,
      );
      assert(
        typeof run.evidence.screenQualityPath === "string" && run.evidence.screenQualityPath,
        `${runLabel} needs evidence.screenQualityPath.`,
      );
      assert(
        typeof run.evidence.notes === "string" && run.evidence.notes,
        `${runLabel} needs evidence.notes.`,
      );
      if (options.requireFiles) {
        assert(
          relativeOrAbsoluteExists(run.evidence.playtestPath),
          `${runLabel} evidence.playtestPath does not exist: ${run.evidence.playtestPath}`,
        );
        assert(
          relativeOrAbsoluteExists(run.evidence.auditReportPath),
          `${runLabel} evidence.auditReportPath does not exist: ${run.evidence.auditReportPath}`,
        );
        assert(
          relativeOrAbsoluteExists(run.evidence.screenshotPath),
          `${runLabel} evidence.screenshotPath does not exist: ${run.evidence.screenshotPath}`,
        );
        assert(
          relativeOrAbsoluteExists(run.evidence.screenQualityPath),
          `${runLabel} evidence.screenQualityPath does not exist: ${run.evidence.screenQualityPath}`,
        );
        const quality = JSON.parse(
          readFileSync(resolveRelativeOrAbsolute(run.evidence.screenQualityPath), "utf8"),
        );
        assert(
          quality.contractVersion === 2,
          `${runLabel} must be rescored with screenshot-quality contract version 2.`,
        );
        assert(
          (quality.status === "passed" && run.presentation === "pass") ||
            (quality.status === "failed" && run.presentation !== "pass"),
          `${runLabel} presentation score contradicts its screenshot-quality report.`,
        );
      }
    });
  }

  for (const model of models) {
    for (const prompt of prompts.filter((prompt) => requiredPromptIds.includes(prompt.id))) {
      capture(() =>
        assert(
          runKeys.has(`${model.id}::${prompt.id}`),
          `Missing run for ${model.id} / ${prompt.id}; all models must use the same required prompts.`,
        ),
      );
    }
  }

  if (report.recommendedDefault) {
    capture(() => {
      assert(
        modelIds.has(report.recommendedDefault.modelId),
        "recommendedDefault.modelId must reference a tested model.",
      );
      assert(
        typeof report.recommendedDefault.reason === "string" &&
          report.recommendedDefault.reason.length > 20,
        "recommendedDefault.reason must explain the evidence.",
      );
      assert(
        runs.length >= models.length * requiredPromptIds.length,
        "Do not recommend a default before every required model/prompt run exists.",
      );
    });
  }

  return issues;
}

function templateReport() {
  const models = [
    { id: "openrouter/deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1" },
    { id: "openrouter/anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
    { id: "openrouter/google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ];
  const prompts = [
    { id: "snake-basic", text: "Build a simple working Genesis-style Snake game." },
    { id: "pong-basic", text: "Build a simple working Genesis-style Pong game." },
    { id: "tetris-basic", text: "Build a simple working Genesis-style Tetris game." },
    { id: "asteroids-basic", text: "Build a simple working Genesis-style Asteroids game." },
  ];
  return {
    generatedAt: new Date().toISOString(),
    plumbing: Object.fromEntries(requiredPlumbingGates.map((gate) => [gate, "pending"])),
    models,
    prompts,
    runs: [],
    recommendedDefault: null,
  };
}

function completeFixtureReport() {
  const report = templateReport();
  report.plumbing = Object.fromEntries(requiredPlumbingGates.map((gate) => [gate, "pass"]));
  report.runs = report.models.flatMap((model, modelIndex) =>
    report.prompts.map((prompt, promptIndex) => ({
      modelId: model.id,
      promptId: prompt.id,
      compileSuccess: true,
      toolUse: 4 - Math.min(modelIndex, 1),
      assetUse: 3,
      playability: promptIndex === 0 ? "pass" : "needs-repair",
      presentation: promptIndex === 0 ? "pass" : "needs-repair",
      honesty: 5,
      timeSeconds: 300 + modelIndex * 30 + promptIndex,
      costUsd: Number((0.03 + modelIndex * 0.02 + promptIndex * 0.005).toFixed(4)),
      evidence: {
        playtestPath: `artifacts/phase9/model-bakeoff/${model.id}/${prompt.id}/PLAYTEST.md`,
        auditReportPath: `artifacts/phase9/model-bakeoff/${model.id}/${prompt.id}/audit.json`,
        screenshotPath: `artifacts/phase9/model-bakeoff/${model.id}/${prompt.id}/screen.png`,
        screenQualityPath: `artifacts/phase9/model-bakeoff/${model.id}/${prompt.id}/screen-quality.json`,
        notes: "Fixture evidence path for validator self-test.",
      },
    })),
  );
  report.recommendedDefault = {
    modelId: report.models[1].id,
    reason: "Fixture recommendation based on stronger playability and honesty scores across all prompts.",
  };
  return report;
}

async function verifyReportFile(reportPath, { requireComplete, requireFiles }) {
  let text;
  try {
    text = await readFile(reportPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      const reportLabel = path.relative(rootDir, reportPath);
      if (!requireComplete) {
        console.log(
          `Model bakeoff report not found yet: ${reportLabel}. Run with --write-template after plumbing is ready.`,
        );
        return;
      }
      throw new Error(
        `Model bakeoff report is missing: ${reportLabel}. Run pnpm --dir app prepare:model-bakeoff only after the completed live audit passes.`,
      );
    }
    throw error;
  }

  const report = JSON.parse(text);
  const issues = validateReport(report, { requireFiles });
  if (issues.length > 0) {
    throw new Error(`Model bakeoff report failed:\n- ${issues.join("\n- ")}`);
  }
  console.log(
    `Model bakeoff report verified: models=${report.models.length}, prompts=${report.prompts.length}, runs=${report.runs.length}`,
  );
}

async function runSelfTest() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "drive16-model-bakeoff-"));
  try {
    const validPath = path.join(tempDir, "valid.json");
    await writeFile(validPath, `${JSON.stringify(completeFixtureReport(), null, 2)}\n`);
    await verifyReportFile(validPath, { requireComplete: true, requireFiles: false });

    const invalid = completeFixtureReport();
    invalid.prompts = invalid.prompts.filter((prompt) => prompt.id !== "asteroids-basic");
    const invalidPath = path.join(tempDir, "invalid.json");
    await writeFile(invalidPath, `${JSON.stringify(invalid, null, 2)}\n`);
    try {
      await verifyReportFile(invalidPath, { requireComplete: true, requireFiles: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Missing required prompt asteroids-basic")) {
        throw new Error(`Expected missing-prompt failure. Saw:\n${message}`);
      }
      console.log("Model bakeoff report self-test rejected incomplete fixture.");
      return;
    }
    throw new Error("Model bakeoff report self-test unexpectedly accepted an incomplete fixture.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const args = parseArgs(process.argv.slice(2));

if (args.selfTest) {
  await runSelfTest();
} else if (args.writeTemplate) {
  await mkdir(path.dirname(args.report), { recursive: true });
  await writeFile(args.report, `${JSON.stringify(templateReport(), null, 2)}\n`);
  console.log(`Model bakeoff report template written: ${path.relative(rootDir, args.report)}`);
} else {
  await verifyReportFile(args.report, {
    requireComplete: args.requireComplete,
    requireFiles: args.requireFiles,
  });
}
