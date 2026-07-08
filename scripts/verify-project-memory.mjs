#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

function parseArgs(argv) {
  const args = {
    project: path.join(rootDir, "artifacts", "phase3", "active-project"),
    expectGate: "any",
    out: path.join(rootDir, "artifacts", "phase9", "project-memory-audit", "latest.json"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") {
      args.project = path.resolve(argv[++index]);
    } else if (arg === "--expect-gate") {
      args.expectGate = argv[++index];
    } else if (arg === "--require-pass") {
      args.expectGate = "pass";
    } else if (arg === "--out") {
      args.out = path.resolve(argv[++index]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["any", "pass", "fail", "unknown"].includes(args.expectGate)) {
    throw new Error("--expect-gate must be one of any, pass, fail, unknown");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: scripts/verify-project-memory.mjs [options]

Audits GAME.md, ASSETS.md, and PLAYTEST.md for contradiction-prone generated-game state.

Options:
  --project <dir>          Project directory. Default: artifacts/phase3/active-project
  --expect-gate <status>   any, pass, fail, or unknown. Default: any
  --require-pass           Shortcut for --expect-gate pass
  --out <file>             JSON report path. Default: artifacts/phase9/project-memory-audit/latest.json
`);
}

async function readProjectFile(projectPath, fileName) {
  const filePath = path.join(projectPath, fileName);
  return {
    fileName,
    filePath,
    text: await readFile(filePath, "utf8"),
  };
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function gateStatus(playtestText) {
  let gate = "unknown";
  for (const line of playtestText.split(/\r?\n/)) {
    const normalized = line.trim();
    if (!/^playability\s+gate\s*:/i.test(normalized)) continue;
    if (/\bpass\b/i.test(normalized)) gate = "pass";
    if (/\bfail\b/i.test(normalized)) gate = "fail";
  }
  if (gate !== "unknown") return gate;
  if (/current verdict[\s\S]{0,180}\bpartial\b/i.test(playtestText)) return "fail";
  return "unknown";
}

function assetRows(assetsText) {
  return assetsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\|.+\|$/.test(line))
    .filter((line) => !/^\|\s*-+/.test(line))
    .slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5)
    .map(([role, source, symbolFile, status, notes]) => ({
      role,
      source,
      symbolFile,
      status,
      notes,
    }));
}

function normalizedAssetFile(symbolFile) {
  const candidates = symbolFile.match(/`([^`]+)`/g)?.map((value) => value.replace(/`/g, "")) ?? [
    symbolFile,
  ];
  const fileCandidate = candidates.find((value) => /\.[a-z0-9]+$/i.test(value.trim()));
  return (fileCandidate ?? candidates[candidates.length - 1] ?? symbolFile).trim().toLowerCase();
}

function roleFamily(role) {
  const normalized = role.toLowerCase();
  if (/\bpaddle\b/.test(normalized)) return "paddle";
  if (/\bball\b/.test(normalized)) return "ball";
  if (/\bsnake|head|body|food\b/.test(normalized)) return normalized;
  if (/\bmusic|theme|loop\b/.test(normalized)) return "music";
  if (/\bsfx|sound\b/.test(normalized)) return "sfx";
  if (/\bbackground|wall|border|center|text|ui\b/.test(normalized)) return normalized;
  return normalized.replace(/\b(left|right|player\s*\d+|p1|p2)\b/g, "").trim() || normalized;
}

function reuseIsExplained(rows) {
  const combined = rows
    .map((row) => `${row.source} ${row.status} ${row.notes}`)
    .join(" ")
    .toLowerCase();
  return /\b(reuse|shared|same object|intentional|incorrect|wrong|mismatch|poor role|fallback)\b/.test(
    combined,
  );
}

function auditProject({ game, assets, playtest, expectGate }) {
  const issues = [];
  const warnings = [];
  const rows = assetRows(assets.text);
  const gate = gateStatus(playtest.text);
  const allText = `${game.text}\n${assets.text}\n${playtest.text}`;

  if (rows.length === 0) {
    issues.push("ASSETS.md must include a role ledger table.");
  }

  if (expectGate !== "any" && gate !== expectGate) {
    issues.push(`Expected playability gate ${expectGate}, but PLAYTEST.md reports ${gate}.`);
  }

  const failureTerms = [
    /\bFAIL\b/i,
    /\bnot proven\b/i,
    /\bpartial\b/i,
    /\bincorrect role\b/i,
    /\bmissing\b/i,
    /\bsilent\b/i,
    /\baudio was expected but not captured\b/i,
  ];
  if (gate === "pass" && hasAny(playtest.text, failureTerms)) {
    issues.push("PLAYTEST.md says the gate passes while still listing failed or unproven checks.");
  }

  if (gate === "fail" && /\b(fully playable|done|complete|passes the playability gate)\b/i.test(game.text)) {
    issues.push("GAME.md overclaims completion while PLAYTEST.md reports a failed gate.");
  }

  const assetGroups = new Map();
  for (const row of rows) {
    const assetFile = normalizedAssetFile(row.symbolFile);
    if (!assetFile || assetFile === "none yet") continue;
    if (!assetGroups.has(assetFile)) assetGroups.set(assetFile, []);
    assetGroups.get(assetFile).push(row);
  }

  for (const [assetFile, group] of assetGroups) {
    const families = new Set(group.map((row) => roleFamily(row.role)).filter(Boolean));
    if (families.size > 1 && !reuseIsExplained(group)) {
      issues.push(`ASSETS.md reuses ${assetFile} across unrelated roles without explaining why.`);
    }
  }

  const musicRows = rows.filter((row) => /\b(music|sfx|sound|theme|loop)\b/i.test(row.role));
  const expectsAudio = musicRows.some(
    (row) => !/\b(not used|none|disabled)\b/i.test(`${row.source} ${row.status} ${row.notes}`),
  );
  if (expectsAudio && !/\baudio\b/i.test(playtest.text)) {
    issues.push("ASSETS.md lists audio assets, but PLAYTEST.md does not record audio evidence.");
  }
  if (
    gate === "pass" &&
    expectsAudio &&
    !/\b(non-silent|audio:\s*(captured|audible)|audio.*captured|maxabs(?:sample)?\s*[:=]\s*[1-9])/i.test(
      playtest.text,
    )
  ) {
    issues.push("PLAYTEST.md passes the gate without non-silent audio evidence.");
  }
  if (
    !expectsAudio &&
    /\b(music|sound|audio)\b/i.test(game.text) &&
    !/\b(no music|not used|not proven|disabled)\b/i.test(allText)
  ) {
    warnings.push("Game notes mention audio, but ASSETS.md has no active audio role.");
  }

  for (const required of ["GAME.md", "ASSETS.md", "PLAYTEST.md"]) {
    if (!allText.includes(required) && required !== game.fileName) {
      warnings.push(`Project docs do not cross-reference ${required}.`);
    }
  }

  return {
    status: issues.length > 0 ? "failed" : "passed",
    gate,
    assetRows: rows.length,
    expectsAudio,
    issues,
    warnings,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectPath = path.resolve(args.project);
  const [game, assets, playtest] = await Promise.all([
    readProjectFile(projectPath, "GAME.md"),
    readProjectFile(projectPath, "ASSETS.md"),
    readProjectFile(projectPath, "PLAYTEST.md"),
  ]);

  const audit = auditProject({
    game,
    assets,
    playtest,
    expectGate: args.expectGate,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    projectPath,
    expectGate: args.expectGate,
    ...audit,
  };

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);

  if (report.status !== "passed") {
    throw new Error(`Project memory audit failed: ${report.issues.join(" | ")}`);
  }

  console.log(
    `Project memory audit passed: gate=${report.gate}, assets=${report.assetRows}, report=${path.relative(
      rootDir,
      args.out,
    )}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
