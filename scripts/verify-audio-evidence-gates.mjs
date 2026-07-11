#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const verifierPath = path.join(rootDir, "scripts", "verify-project-memory.mjs");

const baseGame = `# Game Notes

## Concept

A simple working demo game with a visible player, controls, and optional sound.

## Current State

Completion is defined by GAME.md, ASSETS.md, and PLAYTEST.md agreeing on the
latest verified build.
`;

const basePlaytest = `# Playtest Notes

Playability gate: PASS.

## Latest Result

The ROM compiled, loaded, accepted input, and passed its simple gameplay checks.

## Quality Review

- Screen composition: Captured frame keeps the playfield, score, and controls readable without overlap.
- Player feedback: Movement and state changes are visible immediately after input.
- Restart clarity: The tested Start action returns the game to a clear initial state.
- Audio response: Captured non-silent audio matches the active gameplay loop.
- Style coherence: The primitive shapes and limited palette consistently fit the arcade presentation.

## Evidence

- Build: compiled \`out/rom.bin\`.
- Screen: captured visible gameplay frame.
- Input: D-pad movement was sent and observed.
- Restart: reset/start path was tested.
`;

const assetsWithoutAudio = `# Asset Manifest

## Asset Plan

- Use SGDK primitives for visual gameplay.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Gameplay primitives | SGDK primitives | \`src/main.c\` | Used | Primitive drawing used for gameplay objects. |
`;

const assetsWithGoodAudio = `# Asset Manifest

## Asset Plan

- Use SGDK primitives and a short generated music loop.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Gameplay primitives | SGDK primitives | \`src/main.c\` | Used | Primitive drawing used for gameplay objects. |
| Music loop | MML music | \`res/theme.vgm\` | Captured | Compiled MML to VGM resource THEME_LOOP; audio evidence: captured non-silent maxAbsSample=1200. |
`;

const assetsWithUncapturedAudio = `# Asset Manifest

## Asset Plan

- Use SGDK primitives and a short generated music loop.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Gameplay primitives | SGDK primitives | \`src/main.c\` | Used | Primitive drawing used for gameplay objects. |
| Music loop | MML music | \`res/theme.vgm\` | Used | Compiled MML to VGM resource THEME_LOOP, but no audio evidence was captured yet. |
`;

const assetsWithExplicitNoAudio = `# Asset Manifest

## Asset Plan

- Use SGDK primitives only because the user asked for no audio.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Gameplay primitives | SGDK primitives | \`src/main.c\` | Used | Primitive drawing used for gameplay objects. |
| Audio | None by request | none | Intentionally omitted | No audio by request; user asked for no sound. |
`;

const playtestWithGoodAudio = `${basePlaytest}- Audio: captured non-silent maxAbsSample=1200 from THEME_LOOP.
`;

const playtestWithNoErrorsBeforeGoodAudio = `${basePlaytest}- Build log: successful compilation, no errors.
- Screenshot/frame capture: captured visible gameplay.
- Audio test: non-silent background music verified via verify_audio.
`;

const playtestWithCamelCaseAudio = `${basePlaytest}- Audio test: verify_audio returned nonSilent=true with maxAbsSample=10922.
`;

const playtestWithoutAudio = `${basePlaytest}- Audio: untested.
`;

const playtestWithExplicitNoAudio = `${basePlaytest}- Audio intentionally omitted by request; no sound was expected.
`;

const playtestWithSelfOmittedAudio = `${basePlaytest}- Audio intentionally omitted for simple implementation.
`;

const scenarios = [
  {
    id: "missing-audio",
    shouldPass: false,
    expectedError: "without active music/SFX evidence",
    game: baseGame,
    assets: assetsWithoutAudio,
    playtest: playtestWithoutAudio,
  },
  {
    id: "good-audio",
    shouldPass: true,
    game: baseGame,
    assets: assetsWithGoodAudio,
    playtest: playtestWithGoodAudio,
  },
  {
    id: "good-audio-after-no-errors",
    shouldPass: true,
    game: baseGame,
    assets: assetsWithGoodAudio,
    playtest: playtestWithNoErrorsBeforeGoodAudio,
  },
  {
    id: "good-camel-case-audio",
    shouldPass: true,
    game: baseGame,
    assets: assetsWithGoodAudio,
    playtest: playtestWithCamelCaseAudio,
  },
  {
    id: "uncaptured-audio",
    shouldPass: false,
    expectedError: "does not record captured audio evidence",
    game: baseGame,
    assets: assetsWithUncapturedAudio,
    playtest: playtestWithGoodAudio,
  },
  {
    id: "explicit-no-audio",
    shouldPass: true,
    game: `${baseGame}\nAudio intentionally omitted because the user requested no sound.\n`,
    assets: assetsWithExplicitNoAudio,
    playtest: playtestWithExplicitNoAudio,
  },
  {
    id: "self-omitted-audio",
    shouldPass: false,
    expectedError: "without an explicit user no-audio request",
    game: `${baseGame}\nAudio intentionally omitted for this simple implementation.\n`,
    assets: assetsWithExplicitNoAudio.replace("No audio by request; user asked for no sound.", "Audio intentionally omitted for simple implementation."),
    playtest: playtestWithSelfOmittedAudio,
  },
];

async function writeProject(projectPath, scenario) {
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await writeFile(path.join(projectPath, "GAME.md"), scenario.game);
  await writeFile(path.join(projectPath, "ASSETS.md"), scenario.assets);
  await writeFile(path.join(projectPath, "PLAYTEST.md"), scenario.playtest);
  await writeFile(
    path.join(projectPath, "src", "main.c"),
    "/* Audio-gate fixture source. */\nint main(void) { return 0; }\n",
  );
}

async function runVerifier(projectPath) {
  return execFileAsync(
    process.execPath,
    [
      verifierPath,
      "--project",
      projectPath,
      "--require-pass",
      "--out",
      path.join(projectPath, "audit.json"),
    ],
    { cwd: rootDir, maxBuffer: 1024 * 1024 },
  );
}

async function runScenario(scenario) {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), `drive16-audio-${scenario.id}-`));
  try {
    await writeProject(projectPath, scenario);
    try {
      await runVerifier(projectPath);
    } catch (error) {
      if (scenario.shouldPass) {
        const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        throw new Error(`${scenario.id} should have passed. Saw:\n${output}`);
      }
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      if (!output.includes(scenario.expectedError)) {
        throw new Error(
          `${scenario.id} failed for the wrong reason. Expected ${scenario.expectedError}. Saw:\n${output}`,
        );
      }
      return;
    }
    if (!scenario.shouldPass) {
      throw new Error(`${scenario.id} unexpectedly passed without required audio proof.`);
    }
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

for (const scenario of scenarios) {
  await runScenario(scenario);
}

console.log("Audio evidence fixture gates verified: missing audio, captured audio, uncaptured audio, explicit no-audio");
