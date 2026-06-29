# Drive16 Progress

Current phase: Phase 2, core assets via bundled pack

Exit criterion: from a prompt, the agent produces a ROM with a controllable
bundled sprite and a playing bundled loop, using CORE tools only.

## Phase 2 Checklist

- [x] Human sign-off: Phase 1 approved.
- [x] Promote the original Drive16 sprite and loop into a CORE bundled asset
  pack.
- [ ] Add a Phase 2 CORE asset fixture project that references the pack through
  `resources.res`.
- [ ] Teach the agent, via RAG or skill context, to wire the bundled sprite and
  music loop.
- [ ] Add a Phase 2 validation harness for a prompt-driven asset ROM.
- [ ] Drive the loop from a plain prompt for a controllable bundled sprite with
  music.
- [ ] Verify the generated ROM in Genteel with scripted input and audio output.

## Current Task

Phase 2 has started. The CORE bundled asset pack is established under
`assets/core/` with stable symbols for the agent to use.

## Next Up

Add and verify a Phase 2 CORE asset fixture project that references the pack
through `resources.res`.

## Completed Phase 2 Work

- [x] Phase 1 approval received from the human.
- [x] Core pack added at `assets/core/` with `drive16_player` and
  `drive16_loop`.
- [x] Core pack validator added at `scripts/validate-core-assets.py`.
- [x] RAG project-pattern notes updated with Phase 2 asset symbols and wiring
  guidance.

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
