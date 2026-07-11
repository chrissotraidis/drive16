# Playtest Notes

Project stage: PROTOTYPE.

## Baseline state

This deterministic starter includes a safe title/instruction screen, paced
first-pass gameplay, role-specific tile art, looping MML music, PSG effects,
pause, reset, HUD, and game-over state. It still requires a fresh ROM build,
15-second idle check, browser playthrough, and visible quality review after
being copied into the active project.

Playability gate: FAIL.

Reason: build, screen, input, and audio evidence are intentionally pending for
the newly seeded active project. Do not change this to PASS merely because the
starter files exist.

## Required evidence

- Build: current `out/rom.bin` is newer than source/resources.
- Start: readable objective and controls before danger; Start enters gameplay.
- Screen: radar frame, cities, cursor, HUD, missiles, and control legend visible.
- Idle: gameplay remains active and responsive after at least 15 seconds without input.
- Input: D-pad cursor movement and A/B explosion observed.
- Gameplay: a missile can be destroyed, score changes, and a city can be lost.
- State: Start pauses/resumes and C resets.
- Audio: non-silent music/effect capture recorded.
- Assets: cursor/city provenance matches `ASSETS.md` and the ROM resources.

## Latest evidence

Pending fresh seed/build verification.
