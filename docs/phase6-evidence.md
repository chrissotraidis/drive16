# Phase 6 Evidence

Status: native generated-ROM Play verified. Phase 6 is ready for Product V1
closure review.

## What Phase 6 Added

- Interactive Play is separate from Genteel Verify/Capture Proof.
- Imported ROM bytes can launch in an embedded Nostalgist/RetroArch player.
- A generated CORE ROM fixture can launch in the same embedded player.
- Keyboard input uses the shared Drive16 input model and is sent to the running
  player.
- Compact Pause/Resume, Reset, and Stop controls live beside Play.
- Audio is labeled as gated until it is verified.
- Controller support has a shared input-action foundation but is not claimed as
  complete.
- Drive16 does not commit imported ROMs, Genesis core binaries, WASM cores,
  model weights, API keys, or secrets.

## Evidence Docs

- `docs/phase6-emulator-core-selection.md`
- `docs/phase6-player-architecture.md`
- `docs/phase6-ui-language.md`
- `docs/phase6-interactive-loading.md`
- `docs/phase6-interactive-player-adapter.md`
- `docs/phase6-keyboard-input.md`
- `docs/phase6-player-controls.md`
- `docs/phase6-audio.md`
- `docs/phase6-controller-foundation.md`
- `docs/phase6-generated-rom-play.md`
- `docs/phase6-verification-loop.md`
- `docs/phase6-to-product-v1-goal.md`

## Verification

Commands passed:

```sh
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture
git diff --check
scripts/verify-phase6-loop.sh --browser
scripts/verify-phase6-loop.sh --no-browser --with-v1-proof
```

Native test result:

- 44 passed, 4 ignored in the regular native suite.
- The ignored V1/CORE generated-ROM proof was run explicitly and passed.

Browser player smoke:

- Imported `examples/app-starter-blank/out/rom.bin`.
- Clicked `Play ROM`.
- Confirmed `Interactive player started`.
- Pressed ArrowRight and confirmed last input changed to `Right`.
- Confirmed Pause, Resume, and Stop feedback.
- Final console warning/error count: zero.

Repeatable verification loop:

- `scripts/verify-phase6-loop.sh --browser` passed against
  `http://127.0.0.1:1420/`.
- Browser smoke covered New Project, Save, Open, imported
  `examples/app-starter-blank/out/rom.bin`, clicked Play ROM, sent ArrowRight,
  ran Pause/Resume/Reset/Stop, Verify, Export, and checked mobile overflow.
- Evidence written under
  `artifacts/phase6/verify-loop/20260701-131904`.
- `scripts/verify-phase6-loop.sh --no-browser --with-v1-proof` passed the
  slower generated CORE proof mode.
- Evidence written under
  `artifacts/phase6/verify-loop/20260701-131922`.

Generated CORE player smoke:

- Used the generated CORE fixture at `examples/phase2-core-assets/out/rom.bin`.
- Confirmed it starts in the embedded player with `genesis_plus_gx`.
- Pressed ArrowRight and confirmed last input changed to `Right`.
- Stopped the player.
- Final console warning/error count: zero.

Hygiene:

- `main` matched `origin/main` after the pushed checkpoints.
- Tracked-file scan found no Genesis core binaries, `.wasm` files,
  `.safetensors` model weights, OpenRouter keys, or obvious secrets.

## Native Generated-ROM Play

Native generated-ROM Play passed on July 1, 2026:

1. Submitted `Make a sprite I can move left and right with music.` in the
   native Tauri window.
2. Confirmed `Generated CORE ROM` was active.
3. Clicked `Play ROM` by native accessibility name.
4. Confirmed the generated ROM started in the embedded player.
5. Sent ArrowRight and confirmed `Right` input.
6. Clicked Pause, Resume, Reset, and Stop by native accessibility name.
7. Confirmed final feedback showed `Interactive player stopped`.

Evidence screenshots:

- `artifacts/product-v1/native-click-through/20260701-1324/native-generated-play.png`
- `artifacts/product-v1/native-click-through/20260701-1324/native-generated-controls-stopped.png`
