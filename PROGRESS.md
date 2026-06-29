# Drive16 Progress

Current phase: Phase 0, manual spike

Exit criterion: a hand-built ROM shows a controllable sprite and plays a bundled
loop, verified by a Genteel screenshot, with the live-view path confirmed.

## Phase 0 Checklist

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
- [ ] HUMAN DECISION: choose and confirm Genteel live-framebuffer path.
- [x] Local validation: docker-sgdk builds the Phase 0 asset ROM.
- [x] Local validation: the Phase 0 asset ROM emits non-silent audio from the bundled VGM loop.
- [x] Local validation: the Phase 0 asset ROM shows a controllable bundled sprite through scripted input.
- [x] Add a complete Phase 0 human validation runbook.

## Current Task

Await human decision on the Genteel live-framebuffer path.

## Next Up

After the live-framebuffer path is chosen, implement or run the smallest proof
that streams frames from Genteel or an approved fallback, record the exact
command/API and evidence, then request Phase 0 sign-off.
