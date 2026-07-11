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

const gameDoc = `# Game Notes

## Concept

A simple working demo game with a player, visible input, a generated sprite, and a short music loop.

## Current State

Completion is defined by GAME.md, ASSETS.md, and PLAYTEST.md agreeing on the latest verified build.
`;

const playtestDoc = `# Playtest Notes

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
- Audio: captured non-silent maxAbsSample=1200 from THEME_LOOP.
`;

const goodAudioRow =
  "| Music loop | MML music | `res/theme.vgm` | Captured | Compiled MML to VGM resource THEME_LOOP; audio evidence: captured non-silent maxAbsSample=1200. |";

function assetsDoc(rows, { includePlan = true } = {}) {
  return `# Asset Manifest

${includePlan ? `## Asset Plan

- Player: generated ComfyUI sprite, normalized to a Genesis-safe 32x32 PNG.
- Music: short MML loop compiled and captured.
` : ""}
| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
${rows.join("\n")}
${goodAudioRow}
`;
}

const scenarios = [
  {
    id: "good-generated-role",
    shouldPass: true,
    assets: assetsDoc([
      "| Player | ComfyUI sprite | `res/player.png` | Used | prompt: blue pilot character; crop/slice: normalized 32x32 from generated PNG; used in ROM: yes as sprite_player. |",
    ]),
  },
  {
    id: "missing-asset-plan",
    shouldPass: false,
    expectedError: "without an Asset Plan section",
    assets: assetsDoc(
      [
        "| Player | ComfyUI sprite | `res/player.png` | Used | prompt: blue pilot character; crop/slice: normalized 32x32 from generated PNG; used in ROM: yes as sprite_player. |",
      ],
      { includePlan: false },
    ),
  },
  {
    id: "vague-generated-role",
    shouldPass: false,
    expectedError: "uses a vague role",
    assets: assetsDoc([
      "| Sprite | ComfyUI sprite | `res/player.png` | Used | prompt: blue pilot character; crop/slice: normalized 32x32 from generated PNG; used in ROM: yes as sprite_player. |",
    ]),
  },
  {
    id: "missing-generated-crop",
    shouldPass: false,
    expectedError: "does not record crop/slice normalization",
    assets: assetsDoc([
      "| Player | ComfyUI sprite | `res/player.png` | Used | prompt: blue pilot character; used in ROM: yes as sprite_player. |",
    ]),
  },
  {
    id: "missing-generated-use",
    shouldPass: false,
    expectedError: "does not record whether it was used",
    assets: assetsDoc([
      "| Player | ComfyUI sprite | `res/player.png` | Ready | prompt: blue pilot character; crop/slice: normalized 32x32 from generated PNG. |",
    ]),
  },
];

async function writeProject(projectPath, scenario) {
  await mkdir(path.join(projectPath, "src"), { recursive: true });
  await mkdir(path.join(projectPath, "out"), { recursive: true });
  await writeFile(path.join(projectPath, "GAME.md"), gameDoc);
  await writeFile(path.join(projectPath, "ASSETS.md"), scenario.assets);
  await writeFile(path.join(projectPath, "PLAYTEST.md"), playtestDoc);
  await writeFile(
    path.join(projectPath, "src", "main.c"),
    "#include <genesis.h>\nint main(bool hardReset) { (void) hardReset; while (TRUE) SYS_doVBlankProcess(); return 0; }\n",
  );
  await writeFile(path.join(projectPath, "out", "rom.bin"), Buffer.from([0x00]));
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
  const projectPath = await mkdtemp(path.join(os.tmpdir(), `drive16-assets-${scenario.id}-`));
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
      throw new Error(`${scenario.id} unexpectedly passed without required asset role proof.`);
    }
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

for (const scenario of scenarios) {
  await runScenario(scenario);
}

console.log("Asset role fixture gates verified: plan, role, prompt, crop, and use evidence");
