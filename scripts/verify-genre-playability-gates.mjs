#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const verifierPath = path.join(rootDir, "scripts", "verify-project-memory.mjs");

const genres = [
  {
    id: "snake",
    label: "Snake",
    concept: "A simple working Snake game for Sega Genesis.",
    evidence: [
      "Score starts at 0 on a fresh run.",
      "Snake and food are visible inside the bordered playfield.",
      "D-pad movement responds when pressing left, right, up, and down.",
      "Food can be approached and eaten without instant fail.",
      "Wall collision reaches game over, and self collision fail state was checked.",
      "Restart checked after game over and works.",
    ],
  },
  {
    id: "pong",
    label: "Pong",
    concept: "A simple working Pong game for Sega Genesis.",
    evidence: [
      "Both paddles and ball are visible.",
      "Paddle input tested: P1 paddle controls move and respond.",
      "The ball travels and bounces off paddles and walls.",
      "Scoring changes and side point updates are visible.",
      "Serve restart visible and tested after a point.",
    ],
  },
  {
    id: "tetris",
    label: "Tetris",
    concept: "A simple working Tetris game for Sega Genesis.",
    evidence: [
      "The playfield and score/line state are readable.",
      "A piece spawns visibly at the top of the playfield.",
      "Left/right/down movement works and responds to input.",
      "Rotation works and is visible.",
      "Pieces lock into the grid.",
      "Line clear or stacking present after pieces lock.",
      "Game-over possible at the top and checked.",
    ],
  },
  {
    id: "asteroids",
    label: "Asteroids",
    concept: "A simple working Asteroids-style game for Sega Genesis.",
    evidence: [
      "Ship, asteroids, and shots are visible.",
      "Rotation and thrust changes ship movement and was tested.",
      "Firing creates a moving projectile.",
      "Asteroids move and wrap continuously.",
      "Collision destruction affects score state and lives.",
      "Restart after death/game-over works and was tested.",
    ],
  },
];

function gameDoc(genre) {
  return `# Game Notes

## Concept

${genre.concept}

## Current State

The game is only considered complete when GAME.md, ASSETS.md, and PLAYTEST.md agree on the latest verified result.
`;
}

function assetsDoc() {
  return `# Asset Manifest

## Asset Plan

- Use deterministic SGDK primitives for gameplay-critical shapes.
- Include a simple audible loop so a passing gate proves sound is wired.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Gameplay primitives | SGDK primitives | \`src/main.c\` | Used | Primitive drawing used for gameplay objects; no ComfyUI sprite required for this fixture. |
| Music loop | MML music | \`res/theme.vgm\` | Captured | Compiled MML to VGM resource THEME_LOOP; audio evidence: captured non-silent maxAbsSample=1200. |

## Asset Source Decision Log

- Primitive shapes are acceptable for these verifier fixtures because they test playability evidence, not visual quality.
`;
}

function passingPlaytestDoc(genre) {
  const evidence = genre.evidence.map((line) => `- ${line}`).join("\n");
  return `# Playtest Notes

Playability gate: PASS.

## Latest Result

The ${genre.label} ROM compiled, loaded, and passed its genre checks.

## Quality Review

- Screen composition: Captured frame keeps the playfield, score, and controls readable without overlap.
- Player feedback: Movement and state changes are visible immediately after input.
- Restart clarity: The tested Start action returns the game to a clear initial state.
- Audio response: Captured non-silent audio matches the active gameplay loop.
- Style coherence: The primitive shapes and limited palette consistently fit the arcade presentation.

## Evidence

- Build: compiled \`out/rom.bin\`.
- Screen: captured visible gameplay frame.
${evidence}
- Input: movement controls were sent and observed.
- Restart: reset/start path was tested.
- Audio: captured non-silent maxAbsSample=1200 from the compiled music loop.
`;
}

function failingPlaytestDoc(genre) {
  return `# Playtest Notes

Playability gate: PASS.

## Latest Result

The ${genre.label} ROM compiled, but the required genre checks were not proven.

## Evidence

- Build: compiled \`out/rom.bin\`.
- Screen: captured one frame.
- Genre checks: pending.
- Audio: captured non-silent maxAbsSample=1200 from the compiled music loop.
`;
}

async function writeProject(projectPath, genre, playtestText) {
  await writeFile(path.join(projectPath, "GAME.md"), gameDoc(genre));
  await writeFile(path.join(projectPath, "ASSETS.md"), assetsDoc());
  await writeFile(path.join(projectPath, "PLAYTEST.md"), playtestText);
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

async function expectPass(genre) {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), `drive16-${genre.id}-pass-`));
  try {
    await writeProject(projectPath, genre, passingPlaytestDoc(genre));
    await runVerifier(projectPath);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

async function expectFail(genre) {
  const projectPath = await mkdtemp(path.join(os.tmpdir(), `drive16-${genre.id}-fail-`));
  try {
    await writeProject(projectPath, genre, failingPlaytestDoc(genre));
    try {
      await runVerifier(projectPath);
    } catch (error) {
      const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
      const expected = `PLAYTEST.md passes ${genre.label} without evidence for`;
      if (!output.includes(expected)) {
        throw new Error(`Expected ${genre.label} fixture to fail on missing genre evidence. Saw:\n${output}`);
      }
      return;
    }
    throw new Error(`${genre.label} fixture unexpectedly passed with pending genre checks.`);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

for (const genre of genres) {
  await expectFail(genre);
  await expectPass(genre);
}

console.log(`Genre playability fixture gates verified: ${genres.map((genre) => genre.label).join(", ")}`);
