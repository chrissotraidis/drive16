#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
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
  const primitiveCharacter = candidates
    .map((value) => value.trim().match(/^["'](.{1})["'](?:\s+character)?$/i)?.[1])
    .find(Boolean);
  if (primitiveCharacter) return `character:${primitiveCharacter}`;
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

function hasAssetPlan(assetsText) {
  return /^##\s+Asset Plan\b/im.test(assetsText);
}

function isGeneratedAssetRow(row) {
  return /\b(comfyui|generated|ai sprite|stable diffusion)\b/i.test(
    `${row.source} ${row.status}`,
  );
}

function assetRoleIsVague(role) {
  const normalized = role
    .toLowerCase()
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^(asset|sprite|image|graphic|art|object|thing|generated sprite|generated asset|comfyui sprite)$/.test(
    normalized,
  );
}

function generatedAssetRecordsPrompt(row) {
  return /\bprompt\s*:/i.test(`${row.source} ${row.status} ${row.notes}`);
}

function generatedAssetRecordsCrop(row) {
  return /\b(crop|cropped|slice|sliced|normalized|32x32|16x16|sgdk sprite)\b/i.test(
    `${row.source} ${row.status} ${row.notes}`,
  );
}

function generatedAssetRecordsUse(row) {
  return /\b(used|not used|unused|wired|referenced|in rom|resource)\b/i.test(
    `${row.status} ${row.notes}`,
  );
}

function normalizeEvidenceText(text) {
  return text.replace(/[\u2010-\u2015\u2212]/g, "-");
}

const genreAuditRules = [
  {
    id: "snake",
    label: "Snake",
    detect: /\bsnake\b/i,
    checks: [
      ["score starts at 0", /\bscore\b[\s\S]{0,80}\b(0|zero)\b/i],
      ["snake and food visible", /\bsnake\b[\s\S]{0,120}\bfood\b|\bfood\b[\s\S]{0,120}\bsnake\b/i],
      ["D-pad movement visible", /\b(d-?pad|direction|input|left|right|up|down)\b[\s\S]{0,120}\b(move|movement|visible|tested|respond)/i],
      ["food can be approached or eaten", /\bfood\b[\s\S]{0,120}\b(approach|eat|eaten|consume|consumed|without instant fail)/i],
      ["collision fail state checked", /\b(wall|self)[\s\S]{0,120}\b(collision|fail|game over|death)/i],
      ["restart checked", /\b(start|restart|reset)\b[\s\S]{0,120}\b(game over|checked|works|tested|restart)/i],
    ],
  },
  {
    id: "pong",
    label: "Pong",
    detect: /\bpong\b/i,
    checks: [
      ["paddles and ball visible", /\bpaddles?\b[\s\S]{0,120}\bball\b|\bball\b[\s\S]{0,120}\bpaddles?\b/i],
      ["paddle input tested", /\bpaddle\b[\s\S]{0,120}\b(input|respond|move|tested|control)/i],
      ["ball travels and bounces", /\bball\b[\s\S]{0,140}\b(travel|move|bounce|bounces|bounced)/i],
      ["scoring changes", /\bscor(e|ing)\b[\s\S]{0,120}\b(change|increments?|updates?|side|point)/i],
      ["serve or point restart visible", /\b(serve|point restart|restart|reset)\b[\s\S]{0,120}\b(visible|checked|works|tested)/i],
    ],
  },
  {
    id: "tetris",
    label: "Tetris",
    detect: /\btetris\b/i,
    checks: [
      ["playfield and score/line state readable", /\bplayfield\b[\s\S]{0,160}\b(score|line|state|readable)/i],
      ["piece spawns visibly", /\bpiece\b[\s\S]{0,120}\b(spawn|visible|appears)/i],
      ["left/right/down movement works", /\b(left|right|down)\b[\s\S]{0,160}\b(move|movement|works|tested|respond)/i],
      ["rotation works", /\brotation|rotate\b[\s\S]{0,120}\b(works|tested|respond|visible)/i],
      ["pieces lock into grid", /\b(lock|locks|locked)\b[\s\S]{0,120}\b(grid|piece|pieces)/i],
      ["line clear or stacking present", /\b(line clear|clears? line|stack|stacking)\b/i],
      ["game-over possible", /\bgame[- ]?over\b[\s\S]{0,120}\b(possible|top|checked|tested|state)/i],
    ],
  },
  {
    id: "asteroids",
    label: "Asteroids",
    detect: /\basteroids?\b/i,
    checks: [
      ["ship, asteroids, and shots visible", /\bship\b[\s\S]{0,160}\basteroids?\b[\s\S]{0,160}\b(shot|shots|projectile|bullet)/i],
      ["rotation or thrust changes ship", /\b(rotation|rotate|thrust)\b[\s\S]{0,140}\b(ship|changes|tested|respond|works)/i],
      ["firing creates moving projectile", /\b(fire|firing|shot|projectile|bullet)\b[\s\S]{0,140}\b(move|moving|creates|visible|tested)/i],
      ["asteroids move or wrap", /\basteroids?\b[\s\S]{0,120}\b(move|moving|wrap|continuous)/i],
      ["collisions/destruction affect state", /\b(collision|destroy|destruction)\b[\s\S]{0,160}\b(score|state|death|lives|affect)/i],
      ["restart after death/game-over works", /\b(restart|start|reset)\b[\s\S]{0,160}\b(death|game[- ]?over|works|tested)/i],
    ],
  },
];

function latestPlaytestText(playtestText) {
  const latest = playtestText.match(/## Latest Result\s*([\s\S]*?)(?:\n## |\s*$)/i);
  const evidence = playtestText.match(/##[^\n]*Evidence[^\n]*\s*([\s\S]*?)(?:\n## |\s*$)/i);
  return [latest?.[1] ?? "", evidence?.[1] ?? ""].join("\n");
}

function markdownSection(text, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?:\\n## |\\s*$)`, "i"))?.[1] ?? "";
}

function gameGenreContext(gameText) {
  const focused = [
    markdownSection(gameText, "Concept"),
    markdownSection(gameText, "Current Build"),
  ]
    .filter(Boolean)
    .join("\n");
  if (focused.trim()) return focused;

  return gameText
    .replace(/##\s+SGDK Starter Notes\s*\n[\s\S]*?(?=\n## |\s*$)/gi, "")
    .replace(/##\s+First Build References\s*\n[\s\S]*?(?=\n## |\s*$)/gi, "")
    .replace(/##\s+Controls\s*\n[\s\S]*?(?=\n## |\s*$)/gi, "")
    .replace(/##\s+Next Intended Change\s*\n[\s\S]*?(?=\n## |\s*$)/gi, "");
}

function detectedGenre({ gameText, playtestText }) {
  const playtestSource = latestPlaytestText(playtestText);
  return (
    genreAuditRules.find((rule) => rule.detect.test(playtestSource)) ??
    genreAuditRules.find((rule) => rule.detect.test(gameGenreContext(gameText)))
  );
}

function missingGenreEvidence({ genre, playtestText }) {
  if (!genre) return [];
  const text = latestPlaytestText(playtestText);
  if (/\bgenre checks\s*:\s*(pending|untested|not tested|missing|n\/a)\b/i.test(text)) {
    return genre.checks.map(([label]) => label);
  }
  return genre.checks
    .filter(([, pattern]) => !pattern.test(text))
    .map(([label]) => label);
}

function hasCapturedAudioEvidence(text) {
  const normalized = normalizeEvidenceText(text);
  return /\b(non-silent|audible|maxabs(?:sample)?\s*[:=]\s*[1-9]|audio\s*:\s*(captured|audible)|audio[\s\S]{0,80}captured)\b/i.test(
    normalized,
  );
}

function audioEvidenceIsNegated(text) {
  const normalized = normalizeEvidenceText(text);
  const negativeBeforeAudio = /\b(no|not|without|missing|uncaptured|untested|pending|failed|(?<!non-)silent)\b[^\n]{0,80}\b(audio evidence|audio|non-silent|audible|maxabs(?:sample)?)\b/i;
  const audioBeforeNegative = /\b(audio evidence|audio)\b[^\n]{0,80}\b(not captured|uncaptured|untested|pending|failed|missing|(?<!non-)silent)\b/i;
  return negativeBeforeAudio.test(normalized) || audioBeforeNegative.test(normalized);
}

function latestEvidenceText(playtestText) {
  return normalizeEvidenceText(latestPlaytestText(playtestText));
}

function audioDisabledByUserRequest(text) {
  return /\b(no music|no sound|no audio|without music|without sound|without audio)\b[\s\S]{0,100}\b(by request|user (asked|requested)|asked for|requested by user)\b/i.test(text)
    || /\b(audio|music|sound)\s+(disabled|omitted)\s+by request\b/i.test(text)
    || /\bsilent by request\b/i.test(text);
}

function audioSelfOmittedWithoutUserRequest(text) {
  return /\b(no music requested|no sound requested|no audio requested|audio intentionally omitted|music intentionally omitted|sound intentionally omitted|intentionally omitted for simple|omitted for simple|audio omitted)\b/i.test(text)
    && !audioDisabledByUserRequest(text);
}

function gameClaimsBuiltMissingRom(gameText, romExists) {
  if (romExists) return false;
  return gameText.split(/\r?\n/).some((line) => {
    const lower = line.toLowerCase();
    return lower.includes("out/rom.bin")
      && /\b(built|compiled|ready|produced|fresh)\b/.test(lower);
  });
}

function gameClaimsNoIssuesWhileGateFails(gameText, gate) {
  if (gate === "pass") return false;
  return /\bknown issues\b[\s\S]{0,160}\b(none|none yet|no known issues)\b/i.test(gameText);
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

function groupUsesSharedPrimitiveCode(assetFile, rows) {
  if (!assetFile.includes("src/main.c")) return false;
  return rows.every((row) => {
    const text = `${row.source} ${row.status} ${row.notes}`;
    return !isGeneratedAssetRow(row) && /\b(primitive|tile|tilemap|text|code|drawn)\b/i.test(text);
  });
}

function groupUsesSharedPrimitiveApi(assetFile, rows) {
  if (!/\b(vdp_loadtiledata|vdp_filltilemaprect|vdp_drawtext(?:bg)?)\b/i.test(assetFile)) {
    return false;
  }
  return rows.every((row) => {
    const text = `${row.source} ${row.status} ${row.notes}`;
    return !isGeneratedAssetRow(row) && /\b(primitive|tile|tilemap|text|font|ui|code|drawn)\b/i.test(text);
  });
}

function auditProject({ game, assets, playtest, expectGate, romExists }) {
  const issues = [];
  const warnings = [];
  const rows = assetRows(assets.text);
  const gate = gateStatus(playtest.text);
  const allText = `${game.text}\n${assets.text}\n${playtest.text}`;
  const latestEvidence = latestEvidenceText(playtest.text);
  const genre = detectedGenre({ gameText: game.text, playtestText: playtest.text });

  if (gameClaimsBuiltMissingRom(game.text, romExists)) {
    issues.push("GAME.md claims out/rom.bin is built, but out/rom.bin does not exist.");
  }

  if (gameClaimsNoIssuesWhileGateFails(game.text, gate)) {
    issues.push("GAME.md claims there are no known issues while PLAYTEST.md does not pass.");
  }

  if (audioSelfOmittedWithoutUserRequest(allText)) {
    issues.push("Project memory claims audio was omitted without an explicit user no-audio request.");
  }

  if (rows.length === 0) {
    issues.push("ASSETS.md must include a role ledger table.");
  }

  if (gate === "pass" && !hasAssetPlan(assets.text)) {
    issues.push("ASSETS.md passes the gate without an Asset Plan section.");
  }

  if (expectGate !== "any" && gate !== expectGate) {
    issues.push(`Expected playability gate ${expectGate}, but PLAYTEST.md reports ${gate}.`);
  }

  const failureTerms = [
    /\b(failed|failure|not passed)\b/i,
    /\bnot proven\b/i,
    /\bpartial\b/i,
    /\bincorrect role\b/i,
    /\bmissing\b/i,
    /(?<!non-)silent\b/i,
    /\baudio was expected but not captured\b/i,
  ];
  if (gate === "pass" && hasAny(latestEvidence, failureTerms)) {
    issues.push("PLAYTEST.md says the gate passes while still listing failed or unproven checks.");
  }

  if (gate === "pass" && genre) {
    const missing = missingGenreEvidence({ genre, playtestText: playtest.text });
    for (const check of missing) {
      issues.push(`PLAYTEST.md passes ${genre.label} without evidence for: ${check}.`);
    }
  }

  if (gate === "fail" && genre && /\bgenre checks\s*:\s*(pass|passed|complete|verified)\b/i.test(playtest.text)) {
    issues.push("PLAYTEST.md reports genre checks passing while the playability gate still fails.");
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
    if (
      families.size > 1
      && !groupUsesSharedPrimitiveCode(assetFile, group)
      && !groupUsesSharedPrimitiveApi(assetFile, group)
      && !reuseIsExplained(group)
    ) {
      issues.push(`ASSETS.md reuses ${assetFile} across unrelated roles without explaining why.`);
    }
  }

  if (gate === "pass") {
    for (const row of rows.filter(isGeneratedAssetRow)) {
      if (assetRoleIsVague(row.role)) {
        issues.push(`ASSETS.md generated asset row uses a vague role: ${row.role}.`);
      }
      if (!generatedAssetRecordsPrompt(row)) {
        issues.push(`ASSETS.md generated asset row for ${row.role} does not record the prompt.`);
      }
      if (!generatedAssetRecordsCrop(row)) {
        issues.push(`ASSETS.md generated asset row for ${row.role} does not record crop/slice normalization.`);
      }
      if (!generatedAssetRecordsUse(row)) {
        issues.push(`ASSETS.md generated asset row for ${row.role} does not record whether it was used.`);
      }
    }
  }

  const musicRows = rows.filter((row) => /\b(music|sfx|sound|theme|loop)\b/i.test(row.role));
  const activeAudioRows = musicRows.filter(
    (row) => !/\b(not used|none|disabled|intentionally omitted)\b/i.test(`${row.source} ${row.status} ${row.notes}`),
  );
  const expectsAudio = activeAudioRows.length > 0;
  const audioExplicitlyDisabled = audioDisabledByUserRequest(allText);

  if (gate === "pass" && !expectsAudio && !audioExplicitlyDisabled) {
    issues.push("PLAYTEST.md passes the gate without active music/SFX evidence or an explicit no-audio decision.");
  }

  for (const row of activeAudioRows) {
    const rowText = `${row.role} ${row.source} ${row.symbolFile} ${row.status} ${row.notes}`;
    if (gate === "pass" && /\b(music|theme|loop)\b/i.test(row.role) && !/\b(vgm|mml|xgm|compiled?|resource)\b/i.test(rowText)) {
      issues.push(`ASSETS.md audio row for ${row.role} does not record compiled music/resource wiring.`);
    }
    if (gate === "pass" && (!hasCapturedAudioEvidence(rowText) || audioEvidenceIsNegated(rowText))) {
      issues.push(`ASSETS.md audio row for ${row.role} does not record captured audio evidence.`);
    }
  }

  if (expectsAudio && !/\baudio\b/i.test(playtest.text)) {
    issues.push("ASSETS.md lists audio assets, but PLAYTEST.md does not record audio evidence.");
  }
  if (
    gate === "pass" &&
    expectsAudio &&
    (!hasCapturedAudioEvidence(latestEvidence) || audioEvidenceIsNegated(latestEvidence))
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
    genre: genre?.id ?? "unknown",
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
  const romExists = await fileExists(path.join(projectPath, "out", "rom.bin"));

  const audit = auditProject({
    game,
    assets,
    playtest,
    expectGate: args.expectGate,
    romExists,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    projectPath,
    romExists,
    expectGate: args.expectGate,
    ...audit,
  };

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);

  if (report.status !== "passed") {
    throw new Error(`Project memory audit failed: ${report.issues.join(" | ")}`);
  }

  console.log(
    `Project memory audit passed: gate=${report.gate}, genre=${report.genre}, assets=${report.assetRows}, report=${path.relative(
      rootDir,
      args.out,
    )}`,
  );
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
