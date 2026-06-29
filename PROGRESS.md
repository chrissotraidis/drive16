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
- [ ] Human validation: docker-sgdk builds the hello-world ROM.
- [ ] Human validation: Genteel runs the hello-world ROM.
- [ ] Human validation: Genteel captures a headless screenshot.
- [ ] Human validation: Genteel accuracy is checked with a known-good open homebrew ROM.
- [ ] Human validation: Genteel live-framebuffer streaming path is confirmed.
- [ ] Human validation: docker-sgdk builds the Phase 0 asset ROM.
- [ ] Human validation: the Phase 0 asset ROM plays the bundled VGM loop.
- [ ] Human validation: the Phase 0 asset ROM shows a controllable bundled sprite.
- [x] Add a complete Phase 0 human validation runbook.

## Current Task

Await human validation for the docker-sgdk builds, Genteel run path, screenshot,
known-good ROM accuracy, live-framebuffer path, audible VGM loop, and
controllable sprite.

## Next Up

After validation results come back, update the Phase 0 checklist with the real
build, screenshot, known-good ROM, live-view, audio, and input evidence. If
validation fails, repair the fixture or tool scripts before doing any Phase 1
work.
