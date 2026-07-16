#!/usr/bin/env node
// Unit test for the agent-run watchdog policy: kill idle runs, keep busy
// ones alive, and only cut a busy run at the absolute ceiling.
// Run: node --experimental-strip-types scripts/verify-agent-watchdog.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(scriptDir, "..", "app", "src", "agent", "watchdog.ts");
const { agentWatchdogVerdict, agentIdleLimitMs, agentRunHardLimitMs } = await import(
  pathToFileURL(modulePath).href
);

const start = 1_000_000;
const minute = 60_000;

const cases = [
  // A run with steady activity survives well past the old 5-minute kill.
  { name: "busy at 20 minutes", now: start + 20 * minute, last: start + 20 * minute - 30_000, verdict: "continue" },
  { name: "busy at 40 minutes", now: start + 40 * minute, last: start + 40 * minute - 60_000, verdict: "continue" },
  // Zero events for more than the idle limit is killed.
  { name: "idle from the start", now: start + agentIdleLimitMs, last: start, verdict: "idle" },
  { name: "went quiet mid-run", now: start + 12 * minute, last: start + 12 * minute - agentIdleLimitMs, verdict: "idle" },
  // Recent activity holds the idle verdict off.
  { name: "active 1s ago", now: start + 10 * minute, last: start + 10 * minute - 1_000, verdict: "continue" },
  // The absolute ceiling backstops a busy-forever run.
  { name: "busy at the ceiling", now: start + agentRunHardLimitMs, last: start + agentRunHardLimitMs - 1_000, verdict: "ceiling" },
];

let failures = 0;
for (const testCase of cases) {
  const verdict = agentWatchdogVerdict(testCase.now, start, testCase.last);
  if (verdict !== testCase.verdict) {
    failures += 1;
    console.error(`FAIL: ${testCase.name} -> ${verdict} (expected ${testCase.verdict})`);
  }
}

if (agentIdleLimitMs !== 5 * minute) {
  failures += 1;
  console.error(`FAIL: idle limit expected 5 minutes, got ${agentIdleLimitMs}ms`);
}
if (agentRunHardLimitMs < 30 * minute) {
  failures += 1;
  console.error(`FAIL: absolute ceiling must allow long healthy builds, got ${agentRunHardLimitMs}ms`);
}

if (failures) {
  console.error(`${failures} watchdog cases failed.`);
  process.exit(1);
}
console.log(`Agent watchdog ok: ${cases.length} cases passed.`);
