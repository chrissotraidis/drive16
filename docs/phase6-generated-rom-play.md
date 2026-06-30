# Phase 6 Generated ROM Play

Generated ROMs use the same `ActiveRomSource` and `Play ROM` path as starter
and imported ROMs.

## Code Path

When a V1/CORE prompt finishes, `applyV1PromptResult` clears any imported ROM
state and stores the generated `romPath` in `v1PromptResult`. The active ROM
source then becomes:

- kind: `generated`
- label: generated project name
- path: `v1PromptResult.romPath`
- storage: `generated-artifact`

`Play ROM` reads that active path through `read_rom_bytes` in the Tauri app and
passes the prepared payload into the same Nostalgist adapter used by imported
ROMs.

## Verification

Command proof:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture
```

Result:

- Passed: 1 ignored V1/CORE proof test run explicitly.
- Refreshed Genteel screenshot/audio/frame evidence under
  `artifacts/phase3/v1-prompt`.
- Git remained clean after the proof run.

Player smoke:

- Loaded the generated CORE fixture `examples/phase2-core-assets/out/rom.bin`
  into the embedded player.
- Confirmed `Interactive player started`.
- Confirmed the canvas core was `genesis_plus_gx`.
- Pressed ArrowRight and confirmed visible last input changed to `Right`.
- Stopped the player.
- Final console warning/error count was zero.

## Native App Boundary

The native Tauri process was running, and the native `read_rom_bytes` command is
covered by tests. Direct macOS UI automation of the native window was not
available because the shell process does not have Accessibility control.

The remaining final-regression item is a human or accessibility-enabled click
through of the native window: run a generated prompt, click `Play ROM`, and
confirm the generated active source starts without importing it first.
