# Phase 3 Starter ROM Preview

Date: 2026-06-29

This slice gives the app a real starter ROM path for the right pane before the
live framebuffer work begins.

## Scope

- Dedicated SGDK starter fixture: `examples/app-starter-blank`.
- Native Tauri command: `launch_starter_rom`.
- Native command behavior:
  - Uses `examples/app-starter-blank/out/rom.bin`.
  - Runs `scripts/build-sgdk.sh examples/app-starter-blank` if the ROM is
    missing.
  - Runs the pinned Genteel sidecar in headless mode.
  - Writes a PNG screenshot and RGB565 frame stream under
    `artifacts/phase3/starter-rom/`.
  - Returns a PNG data URL plus ROM and artifact metadata to the frontend.
- Right-pane ROM panel now displays the captured frame in Tauri and a clear
  browser-preview fallback when running under Vite preview.

## Commands

Build the starter ROM:

```sh
scripts/build-sgdk.sh examples/app-starter-blank
```

Run the focused starter path test:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml starter_paths_stay_in_expected_locations
```

Run the sidecar launch test:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml starter_rom_launches_existing_rom_when_assets_are_present -- --ignored
```

Validate the emitted frame stream:

```sh
scripts/validate-frame-stream.py artifacts/phase3/starter-rom/starter-frames.rgb565 --min-frames 6
```

Build the frontend:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app build
```

Run the app Rust tests:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml
```

Check the Tauri Rust shell:

```sh
cargo check --manifest-path app/src-tauri/Cargo.toml
```

Build the Tauri shell without bundling:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app tauri build --debug --no-bundle
```

## Evidence

- `scripts/build-sgdk.sh examples/app-starter-blank` passed and built:
  `examples/app-starter-blank/out/rom.bin`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  starter_paths_stay_in_expected_locations` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  starter_rom_launches_existing_rom_when_assets_are_present -- --ignored`
  passed and exercised the native launch function against Genteel.
- `scripts/validate-frame-stream.py
  artifacts/phase3/starter-rom/starter-frames.rgb565 --min-frames 6` passed
  with six frames, indices `0..150`, and `358400` nonzero pixels.
- `artifacts/phase3/starter-rom/starter-frame.png` is a 320 by 240 PNG with a
  valid PNG signature.
- `pnpm --dir app build` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with two
  non-ignored tests and one ignored sidecar test.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- In-app Browser validation loaded `http://127.0.0.1:1420/` with title
  `Drive16`.
- Browser DOM snapshot contained `Drive16 Agent`.
- Browser console warnings and errors were empty.
- Browser framework overlay check was negative.
- The `Launch starter ROM` button resolved to one control and kept the browser
  preview in the expected fallback state.
- Default viewport metrics: `scrollWidth: 1280`, `innerWidth: 1280`,
  `scrollHeight: 720`, and `innerHeight: 720`.
- Default viewport screen bounds cleared the status panel:
  `screen.bottom: 434`, `status.top: 469`.
- Mobile viewport metrics: `scrollWidth: 390`, `innerWidth: 390`,
  `scrollHeight: 1671`, and `innerHeight: 844`.
- Mobile viewport had no horizontal overflow, and the ROM pane was visible
  after scrolling.
- Browser screenshots:
  - `artifacts/phase3/starter-rom/browser-default.png`
  - `artifacts/phase3/starter-rom/browser-mobile-top.png`
  - `artifacts/phase3/starter-rom/browser-mobile-rom.png`

## Notes

The browser preview cannot invoke native Tauri commands, so it shows a preview
fallback. The native sidecar behavior is covered by the ignored focused Rust
test and the saved Genteel screenshot/frame stream artifacts.
