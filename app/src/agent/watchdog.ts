// Agent-run watchdog policy.
//
// Pure so scripts/verify-agent-watchdog.mjs can unit-test it: a run is killed
// for being idle (no agent activity for agentIdleLimitMs), not for being busy.
// Healthy local-model builds legitimately run tens of minutes; the absolute
// ceiling only backstops a run that stays busy without ever finishing.

export const agentIdleLimitMs = 5 * 60_000;
export const agentRunHardLimitMs = 45 * 60_000;

export type WatchdogVerdict = "continue" | "idle" | "ceiling";

export function agentWatchdogVerdict(
  nowMs: number,
  startedAtMs: number,
  lastActivityAtMs: number,
  idleLimitMs = agentIdleLimitMs,
  hardLimitMs = agentRunHardLimitMs,
): WatchdogVerdict {
  if (nowMs - startedAtMs >= hardLimitMs) return "ceiling";
  if (nowMs - Math.max(lastActivityAtMs, startedAtMs) >= idleLimitMs) return "idle";
  return "continue";
}
