# Drive16 Progress

Current phase: Phase 1, agent build loop, text only

Exit criterion: from a text prompt, the agent writes C, builds the ROM, runs it,
reads a screenshot, and self-corrects a deliberate compile error.

## Phase 1 Checklist

- [x] Human sign-off: Phase 0 approved.
- [x] Wrap SGDK build as an MCP server with `build_rom`, `clean`, and
  `read_build_log`.
- [x] Wrap Genteel as a sidecar adapter and MCP server with `run_rom`,
  `capture_frame`, `send_input`, and `read_state`.
- [x] Stand up `mcp-local-rag` and index the SGDK plus VDP docs.
- [x] Add project OpenCode config for the Phase 1 MCP servers.
- [x] Verify `opencode serve` starts with the project config.
- [x] Add a Phase 1 text-loop validation harness with a deliberate compile error.
- [x] Configure OpenRouter credential and model outside the repo.
- [x] Drive the loop from a plain CLI prompt, such as "make the screen blue".
- [x] Prove the agent can self-correct a deliberate compile error.

## Current Task

Phase 1 exit criterion is evidenced locally. The text-loop validation used a
throwaway SGDK project with a deliberate compile error, built the fixed ROM,
ran it in Genteel, and captured a screenshot.

## Next Up

Phase gate: request human sign-off for Phase 1 before starting Phase 2.

## Completed Phase 1 Gate

Evidence packet: `docs/phase1-evidence.md`.

- [x] OpenCode ran from a plain text prompt with the Phase 1 MCP servers.
- [x] RAG was queried before Genesis C edits.
- [x] The deliberate compile error was repaired by the agent loop.
- [x] The generated SGDK project built to `out/rom.bin`.
- [x] Genteel ran the generated ROM and captured a screenshot.
- [x] Screenshot shows `Drive16 Phase 1` on a blue background.

## Completed Phase 0 Gate

Evidence packet: `docs/phase0-evidence.md`.

- [x] Bootstrap repo skeleton and living project files.
- [x] Add a pinned docker-sgdk build script for SGDK 2.11.
- [x] Add a minimal SGDK hello-world validation project.
- [x] Add original Phase 0 sprite and VGM validation assets.
- [x] Add an SGDK asset ROM fixture wiring the sprite and VGM through `rescomp`.
- [x] Add a pinned known-good open homebrew validator for Genteel accuracy.
- [x] Align the Genteel screenshot validator with the observed upstream CLI.
- [x] Add a pinned Genteel source-build helper.
- [x] Local validation: docker-sgdk builds the hello-world ROM.
- [x] Local validation: Genteel runs the hello-world ROM.
- [x] Local validation: Genteel captures a screenshot of the hello-world ROM.
- [x] Local validation: Genteel captures a headless screenshot from a known-good ROM.
- [x] Local validation: Genteel accuracy is checked with a known-good open homebrew ROM.
- [x] Local validation: Genteel live-framebuffer path streams RGB565 frame records.
- [x] Local validation: docker-sgdk builds the Phase 0 asset ROM.
- [x] Local validation: the Phase 0 asset ROM emits non-silent audio from the bundled VGM loop.
- [x] Local validation: the Phase 0 asset ROM shows a controllable bundled sprite through scripted input.
- [x] Add a complete Phase 0 human validation runbook.
