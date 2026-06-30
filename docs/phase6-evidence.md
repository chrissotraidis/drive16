# Phase 6 Evidence

Status: ready for human review with one explicit native-window click-through
remaining.

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

## Verification

Commands passed:

```sh
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture
git diff --check
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

## Remaining Review Item

The Tauri native process was running, and the native `read_rom_bytes` command is
covered by tests. Direct native-window click automation was not available
because the shell process does not have macOS Accessibility control.

Human review should still do this native-window click-through:

1. In the native Drive16 window, run or select a generated CORE ROM.
2. Click `Play ROM`.
3. Confirm the generated active source starts without importing it first.
4. Click the viewport, press ArrowRight, then Pause/Resume/Stop.

If that passes, Phase 6 can be treated as complete for the current v1 scope.
