# Phase 1 Evidence Packet

Date: 2026-06-29

Phase 1 exit criterion:

> From a text prompt, the agent writes C, builds the ROM, runs it, reads a
> screenshot, and self-corrects a deliberate compile error.

Status: evidenced locally. Human sign-off is required before Phase 2 begins.

## Agent Loop

Requirement: run OpenCode from a plain text prompt with the Phase 1 MCP
servers configured.

Evidence:

- Command:
  `DRIVE16_PHASE1_MODEL=openrouter/anthropic/claude-sonnet-4.6 scripts/validate-phase1-agent-loop.py --run-agent`
- Output:
  `Phase 1 agent-loop ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`
- OpenCode run log:
  `artifacts/phase1/agent-loop/opencode-run.jsonl`
- Prompt artifact:
  `artifacts/phase1/agent-loop/prompt.md`

## Self-Correction

Requirement: the agent must repair a deliberate compile error rather than
starting from an already-working project.

Evidence:

- Throwaway project:
  `artifacts/phase1/agent-loop/project`
- Final source:
  `artifacts/phase1/agent-loop/project/src/main.c`
- The validation harness confirmed the sentinel compile error
  `DRIVE16_COMPILE_ERROR_SENTINEL` was removed.
- The OpenCode JSON log contained calls to `query_documents`, `build_rom`,
  `read_build_log`, `run_rom`, and `capture_frame`.

## SGDK Build

Requirement: build the generated project through the SGDK build MCP server.

Evidence:

- Build status:
  `artifacts/phase1/sgdk-build/last-build.json`
- Build log:
  `artifacts/phase1/sgdk-build/last-build.log`
- Output ROM:
  `artifacts/phase1/agent-loop/project/out/rom.bin`
- The build status recorded `"ok": true` for the validation project.

## Genteel Run And Screenshot

Requirement: run the generated ROM through the emulator MCP server and inspect
a captured frame.

Evidence:

- Emulator status:
  `artifacts/phase1/emulator/state.json`
- Emulator log:
  `artifacts/phase1/emulator/last-run.log`
- Screenshot:
  `artifacts/phase1/emulator/last-frame.png`
- Visual result: screenshot shows `Drive16 Phase 1` and `Agent loop OK` on a
  blue background.

## Secret Hygiene

Requirement: no OpenRouter key enters the repo or validation artifacts.

Evidence:

- A workspace scan for the pasted OpenRouter key returned no files.
- The key was provided only as an environment variable for the validation run.

## Phase Gate

Phase 1 is ready for human sign-off. Do not begin Phase 2 until sign-off is
given.
