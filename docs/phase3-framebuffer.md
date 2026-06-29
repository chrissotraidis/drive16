# Phase 3 Framebuffer Rendering

Date: 2026-06-29

This slice renders the Genteel RGB565 framebuffer stream in the right pane.
The starter launch path still runs Genteel as a separate sidecar process and
reads the stream file it emits.

## Scope

- Native starter launch parses `D16F` RGB565 frame records from
  `artifacts/phase3/starter-rom/starter-frames.rgb565`.
- `launch_starter_rom` returns frame width, frame height, stream count, and a
  small set of base64 RGB565 payloads alongside the PNG screenshot metadata.
- The React right pane decodes RGB565 frames into RGBA pixels and renders them
  to a `<canvas>`.
- The existing pause and resume control now pauses and resumes frame
  advancement.
- Browser preview uses explicitly labeled preview frames so the rendered canvas
  path can be checked without native Tauri commands.

## Commands

Run the app Rust tests:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml
```

Run the native sidecar launch test:

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

Check the Tauri Rust shell:

```sh
cargo check --manifest-path app/src-tauri/Cargo.toml
```

Build the Tauri shell without bundling:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app tauri build --debug --no-bundle
```

## Evidence

- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with three
  non-ignored tests and one ignored sidecar test.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  starter_rom_launches_existing_rom_when_assets_are_present -- --ignored`
  passed. The native response included `frameWidth: 320`, `frameHeight: 240`,
  and RGB565 frame payloads.
- `scripts/validate-frame-stream.py
  artifacts/phase3/starter-rom/starter-frames.rgb565 --min-frames 6` passed
  with six frames, indices `0..150`, and `358400` nonzero pixels.
- `pnpm --dir app build` passed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- In-app Browser validation loaded `http://127.0.0.1:1420/` with title
  `Drive16`.
- Browser DOM snapshot contained `Drive16 Agent`.
- Browser console warnings and errors were empty.
- Browser framework overlay check was negative.
- Browser canvas check found one `data-testid="framebuffer-canvas"` element
  with `width="320"` and `height="240"`.
- Browser frame samples moved between frame indices `30` and `0` while running.
- Browser pause interaction found exactly one `Pause emulator` control and
  changed the screen class to `genesis-screen paused framebuffer`.
- Default viewport metrics: `scrollWidth: 1280`, `innerWidth: 1280`,
  `scrollHeight: 720`, and `innerHeight: 720`.
- Default viewport screen bounds cleared the status panel:
  `screen.bottom: 434`, `status.top: 469`.
- Mobile viewport metrics: `scrollWidth: 390`, `innerWidth: 390`,
  `scrollHeight: 1688`, and `innerHeight: 844`.
- Mobile viewport had no horizontal overflow, and the framebuffer canvas was
  visible after scrolling.
- Browser screenshots:
  - `artifacts/phase3/framebuffer/browser-default.png`
  - `artifacts/phase3/framebuffer/browser-mobile-top.png`
  - `artifacts/phase3/framebuffer/browser-mobile-framebuffer.png`

## Notes

This is the first app-side framebuffer renderer. It renders sampled frames from
the Genteel stream file. A long-running emulator sidecar with controller input
and per-frame app streaming can build on this canvas path later.
