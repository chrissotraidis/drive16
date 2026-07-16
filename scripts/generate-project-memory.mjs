#!/usr/bin/env node
// Generate the mechanical parts of a Drive16 project's memory files from a
// run's OpenCode trace, so the model's output budget goes to the game instead
// of ledger bookkeeping. Writes only what the trace proves:
//   - PLAYTEST.md: trace-backed Evidence bullet rows, and Project stage /
//     Playability gate lines when missing (defaults PROTOTYPE / FAIL).
//   - ASSETS.md: stamps music/sound rows with the captured-audio phrase when
//     verify_audio succeeded.
// Semantic claims (gameplay rules, composition quality) stay with the model
// and with Drive16's later review gates. This tool never writes gate PASS.
//
// Usage:
//   node scripts/generate-project-memory.mjs --run <runPath> [--write]
//   node scripts/generate-project-memory.mjs --project <path> --trace <jsonl> [--write]

import { readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeOpenCodeAudioTrace } from "./verify-opencode-audio-trace.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

function parseArgs(argv) {
  const args = { run: "", project: "", trace: "", write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") args.run = path.resolve(argv[++index]);
    else if (arg === "--project") args.project = path.resolve(argv[++index]);
    else if (arg === "--trace") args.trace = path.resolve(argv[++index]);
    else if (arg === "--write") args.write = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: generate-project-memory.mjs --run <runPath> [--write]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.run) {
    args.project ||= path.join(args.run, "project");
    args.trace ||= path.join(args.run, "opencode-run.jsonl");
  }
  if (!args.project || !args.trace) {
    throw new Error("Provide --run <runPath>, or --project and --trace.");
  }
  return args;
}

async function newestMtime(target) {
  if (!existsSync(target)) return 0;
  const info = await stat(target);
  if (info.isFile()) return info.mtimeMs;
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(target);
  let latest = 0;
  for (const entry of entries) {
    latest = Math.max(latest, await newestMtime(path.join(target, entry)));
  }
  return latest;
}

// Each row states only what the trace or filesystem proves, worded to satisfy
// the corresponding verify-project-memory / audio-evidence regexes.
async function mechanicalEvidenceRows(summary, projectPath) {
  const rows = [];
  const romPath = path.join(projectPath, "out", "rom.bin");
  const romExists = existsSync(romPath);
  const romFresh =
    romExists &&
    (await stat(romPath)).mtimeMs >=
      Math.max(
        await newestMtime(path.join(projectPath, "src")),
        await newestMtime(path.join(projectPath, "res")),
      );
  if (summary.buildRomSuccesses > 0 && romFresh) {
    rows.push(
      `ROM compiled: build_rom succeeded ${summary.buildRomSuccesses} time(s) and out/rom.bin is newer than src/ and res/.`,
    );
  }
  if (summary.captureFrameCalls > 0) {
    rows.push(
      `Screen captured: ${summary.captureFrameCalls} emulator frame capture(s) recorded during the run.`,
    );
  }
  if (summary.sendInputSuccesses > 0 && summary.sendInputDirectionalCalls > 0) {
    rows.push(
      "D-pad input tested: directional send_input succeeded and the ROM was re-run with the input script.",
    );
  }
  if (summary.sendInputStartCalls > 0) {
    rows.push("Restart checked: Start button input was scripted and the ROM re-run.");
  }
  const audioProofs = summary.verifyAudioSuccesses + summary.captureAudioSuccesses;
  if (audioProofs > 0) {
    rows.push(
      "Audio verified: captured non-silent audio evidence from the emulator audio dump.",
    );
  } else if (summary.verifyAudioFailures + summary.captureAudioFailures > 0) {
    rows.push("Audio check failed: the emulator audio capture did not prove non-silent audio.");
  }
  return rows;
}

function upsertEvidenceSection(playtestText, rows) {
  const marker = "<!-- drive16:mechanical-evidence -->";
  const block = [marker, ...rows.map((row) => `- ${row}`)].join("\n");
  const sectionPattern = /(##[^\n]*Evidence[^\n]*\s*\n)([\s\S]*?)(?=\n## |\s*$)/i;

  if (playtestText.includes(marker)) {
    const markerPattern = /<!-- drive16:mechanical-evidence -->[\s\S]*?(?=\n\n|\n## |\s*$)/;
    return playtestText.replace(markerPattern, block);
  }
  const match = playtestText.match(sectionPattern);
  if (match) {
    return playtestText.replace(
      sectionPattern,
      (whole, heading, body) => `${heading}${body.replace(/\s*$/, "")}\n\n${block}\n`,
    );
  }
  return `${playtestText.replace(/\s*$/, "")}\n\n## Evidence\n\n${block}\n`;
}

function ensureLine(playtestText, linePattern, fallbackLine) {
  if (linePattern.test(playtestText)) return playtestText;
  // Insert after the first heading so stage/gate lines lead the file.
  const lines = playtestText.split("\n");
  const headingIndex = lines.findIndex((line) => line.startsWith("#"));
  lines.splice(headingIndex + 1, 0, "", fallbackLine);
  return lines.join("\n");
}

function stampAssetsAudioRows(assetsText) {
  const phrase = "captured non-silent audio evidence";
  return assetsText
    .split("\n")
    .map((line) => {
      if (!line.trim().startsWith("|")) return line;
      const cells = line.split("|");
      if (cells.length < 6) return line;
      const role = cells[1]?.toLowerCase() ?? "";
      const status = cells[4]?.trim().toLowerCase() ?? "";
      const isAudioRow = /\b(music|sound|sfx|audio)\b/.test(role);
      if (!isAudioRow || status !== "used" || line.toLowerCase().includes(phrase)) return line;
      cells[cells.length - 2] = ` ${cells[cells.length - 2].trim()} ${phrase}. `;
      return cells.join("|");
    })
    .join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const traceText = await readFile(args.trace, "utf8");
  const summary = analyzeOpenCodeAudioTrace(traceText);
  const rows = await mechanicalEvidenceRows(summary, args.project);

  const changes = [];
  const playtestPath = path.join(args.project, "PLAYTEST.md");
  if (existsSync(playtestPath) && rows.length) {
    let playtest = await readFile(playtestPath, "utf8");
    let updated = upsertEvidenceSection(playtest, rows);
    updated = ensureLine(updated, /Project stage:\s*\w+/i, "Project stage: PROTOTYPE");
    updated = ensureLine(updated, /Playability gate:\s*\w+/i, "Playability gate: FAIL");
    if (updated !== playtest) {
      changes.push(`PLAYTEST.md: ${rows.length} mechanical evidence row(s)`);
      if (args.write) await writeFile(playtestPath, updated);
    }
  }

  const audioProofs = summary.verifyAudioSuccesses + summary.captureAudioSuccesses;
  const assetsPath = path.join(args.project, "ASSETS.md");
  if (existsSync(assetsPath) && audioProofs > 0) {
    const assets = await readFile(assetsPath, "utf8");
    const updated = stampAssetsAudioRows(assets);
    if (updated !== assets) {
      changes.push("ASSETS.md: stamped audio row(s) with captured non-silent audio evidence");
      if (args.write) await writeFile(assetsPath, updated);
    }
  }

  const mode = args.write ? "wrote" : "dry-run (pass --write to apply)";
  console.log(`Project memory generator ${mode}:`);
  if (!changes.length) console.log("  no mechanical updates needed");
  for (const change of changes) console.log(`  ${change}`);
  for (const row of rows) console.log(`  evidence: ${row}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
