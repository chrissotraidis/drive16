# Drive16 Progress

Current phase: Phase 0, manual spike

Exit criterion: a hand-built ROM shows a controllable sprite and plays a bundled
loop, verified by a Genteel screenshot, with the live-view path confirmed.

## Phase 0 Checklist

- [x] Bootstrap repo skeleton and living project files.
- [x] Add a pinned docker-sgdk build script for SGDK 2.11.
- [x] Add a minimal SGDK hello-world validation project.
- [ ] Human validation: docker-sgdk builds the hello-world ROM.
- [ ] Human validation: Genteel runs the hello-world ROM.
- [ ] Human validation: Genteel captures a headless screenshot.
- [ ] Human validation: Genteel live-framebuffer streaming path is confirmed.
- [ ] Add and verify a bundled VGM loop through SGDK's XGM driver.
- [ ] Add and verify a bundled controllable sprite through `rescomp`.

## Current Task

Await human validation for the docker-sgdk build and Genteel run path.

## Next Up

After validation results come back, update the Phase 0 checklist with the real
build and screenshot evidence, then move to the bundled VGM loop unit.
