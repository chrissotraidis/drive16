# Phase 6 Interactive Player Adapter

This slice wires the Drive16 Play path into an embedded Nostalgist/RetroArch
player. Genteel remains the deterministic Verify/Capture Proof path.

## What Changed

- Added `nostalgist@0.21.1` to the app dependencies.
- Added a Drive16 player adapter at `app/src/player/nostalgist.ts`.
- Embedded an interactive player canvas inside the existing ROM viewport.
- `Play ROM` now launches the active imported ROM into the viewport.
- The player uses `genesis_plus_gx` at play time through Nostalgist.
- Drive16 still does not commit or vendor Genesis core binaries.
- The app suppresses Nostalgist's known canvas-size warning only for that exact
  warning string, so real console errors still surface.

## License Boundary

Nostalgist is an MIT browser wrapper. The Genesis runtime core is still a
separate licensing concern. Drive16 does not commit Genesis Plus GX binaries and
does not treat the core as a settled commercial distribution dependency.

## Browser QA

Flow tested against `http://127.0.0.1:1420/` with local Chrome automation:

1. Imported `examples/app-starter-blank/out/rom.bin` through the app file input.
2. Clicked `Play ROM`.
3. Confirmed the embedded player canvas became active.
4. Confirmed the canvas reports `data-player-core="genesis_plus_gx"`.
5. Pressed ArrowRight with the ROM viewport focused.
6. Confirmed the last input changed to `Right`.
7. Clicked Pause, Resume, and Stop.
8. Confirmed zero console warnings/errors in the final smoke.

Observed state:

- Feedback after play: `Interactive player started`.
- Session strip after play: `Interactive player` / `Playing`.
- Pause feedback: `Interactive player paused`.
- Resume feedback: `Interactive player resumed`.
- Stop feedback: `Interactive player stopped`.

## Remaining Phase 6 Work

- Verify the native Tauri desktop app path with the same adapter.
- Verify a Drive16-generated ROM artifact through the same Play path.
- Decide whether release builds should use user-supplied core files, a documented
  installer step, or a different licensed runtime provider.
