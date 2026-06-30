# Phase 6 UI Language Cleanup

This slice makes the app more honest about the difference between interactive
play and proof capture.

## Goal

Do not let "Run" mean:

- Build a project.
- Capture a Genteel proof.
- Animate captured frames.
- Play a ROM interactively.
- Export a ROM.

Phase 6 reserves **Play** for the future interactive emulator session and uses
**Verify** or **Proof** for the existing Genteel capture path.

## What Changed

Top bar:

- The phase label now reads `Phase 6 player`.
- The primary ROM action now reads `Verify`.
- Busy state now reads `Verifying`.
- The status pill reads `Ready` when no proof capture is in progress.

Right pane:

- The pane label changed from `Live ROM` to `ROM Player`.
- The captured-frame toolbar now says `Pause proof preview`,
  `Resume proof preview`, and `Capture current ROM proof`.
- The proof panel in the conversation rail is titled `Proof`.

ROM controls:

- The focus prompt now says `Click ROM for keyboard`.
- The scripted movement proof action now says `Verify Right`.
- While busy, it says `Verifying Right`.

Action feedback:

- Capture work now reports `Verifying ROM`.
- Import and generated-ROM messages now say proof/capture when they are using
  the Genteel path.
- Prompt-completion messages now say the proof preview is loaded on the right
  instead of claiming the ROM is running interactively.

## Product Boundary

Current truth:

- **Verify** uses Genteel to build or capture proof output.
- **Proof preview** displays captured or simulated frames.
- **Keyboard focus** records Drive16 player input state.
- **Play** is reserved for the future interactive emulator adapter.

Not claimed yet:

- Imported ROMs are not playable interactively.
- Keyboard input is not sent into a live emulator core yet.
- Controller support is not wired yet.

## Verification

Commands:

```sh
pnpm --dir app build
git diff --check
```

Browser flow:

```text
app loads -> top bar shows Verify -> ROM pane shows player/proof language -> keyboard focus still works
```

Expected visible labels:

- `Phase 6 player`
- `Verify`
- `ROM Player`
- `Proof preview`
- `Click ROM for keyboard`
- `Verify Right`

Observed in browser QA:

- Page identity: `http://127.0.0.1:1420/`, title `Drive16`.
- `verify-rom` control rendered once with visible text `Verify`.
- Old visible labels `Run Right Proof`, `Rerun current ROM`, `Live ROM`,
  `Pause emulator`, `Resume emulator`, and `Phase 5 hardening` were not present
  in the rendered app.
- Console error/warning count was zero.
- Clicking the ROM viewport and pressing ArrowRight still changed the
  player-session strip to `Keyboard captured` and last input `Right`.
- Screenshot captured in the in-app browser QA session.

## Next Unit

Wire imported ROMs into the interactive player adapter path. If the emulator
core is still unavailable, the Play action should provide a clear needs-core
state instead of silently falling back to proof capture.
