#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const reportPath = process.argv[2];
if (!reportPath) {
  throw new Error("Usage: node scripts/verify-reference-run.mjs <reference-run.json>");
}

const report = JSON.parse(await readFile(reportPath, "utf8"));
assert(report.schemaVersion === 1, "Reference run schemaVersion must be 1.");
assert(report.kind === "drive16-reference-run", "Reference run kind is invalid.");
assert(report.referenceOnly === true, "Reference evidence must be marked referenceOnly.");
assert(/^[a-f0-9]{64}$/.test(report.rom?.sha256 ?? ""), "Reference ROM SHA-256 is missing.");
assert(Number(report.rom?.bytes) > 0, "Reference ROM byte size is missing.");

const captures = new Map((report.captures ?? []).map((capture) => [capture.label, capture]));
for (const label of ["title", "started", "action-baseline", "action", "idle15", "restart"]) {
  const capture = captures.get(label);
  assert(capture, `Reference run is missing the ${label} capture.`);
  assert(/^[a-f0-9]{64}$/.test(capture.screenshotSha256 ?? ""), `${label} screenshot hash is missing.`);
  assert(Number(capture.frames) > 0, `${label} frame count is missing.`);
}

assert(captures.get("idle15").frames >= 900, "Idle evidence must cover at least 15 seconds at 60 fps.");
assert(
  captures.get("action").frames === captures.get("action-baseline").frames,
  "Action and baseline captures must use the same frame count.",
);
assert(
  Number(report.signals?.actionDifference) >= 0,
  "Action-difference measurement is missing.",
);
assert(
  typeof report.signals?.audioNonSilent === "boolean",
  "Audio signal measurement is missing.",
);
assert(
  String(report.usage?.notAllowed ?? "").includes("copying source"),
  "Reference evidence must explicitly prohibit copying source or extracted assets.",
);
assert(
  Array.isArray(report.manualReviewRequired) && report.manualReviewRequired.length >= 5,
  "Reference evidence must retain human taste and semantics review.",
);

console.log(
  `Reference run verified: ${path.basename(reportPath)} ` +
    `action_delta=${report.signals.actionDifference} ` +
    `audio=${report.signals.audioNonSilent ? "signal" : "silent"}`,
);
