# Phase 3 App Shell

Date: 2026-06-29

This is the first Phase 3 application slice. It creates a runnable Tauri 2
shell with a React and Vite frontend.

## Scope

- Two-pane Drive16 workspace.
- Left pane with conversation, agent step stream, project files, and command
  input.
- Right pane with a blank ROM-style viewport, emulator transport controls,
  simple controller buttons, tool health, and frame readout.
- Top bar with project identity, model status, run action, and export action.
- Local UI state for message send, pause and resume, reset, and sprite marker
  movement.

This slice does not yet connect to OpenCode HTTP/SSE or the Genteel live
framebuffer. Those are the next Phase 3 integration units.

## Commands

Install dependencies:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app install
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

Run the local web preview:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app preview --host 127.0.0.1 --port 1420
```

Preview URL:

```text
http://127.0.0.1:1420/
```

## Evidence

- `pnpm --dir app build` passed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Chrome automation captured desktop and mobile screenshots:
  - `artifacts/phase3/app-shell/desktop.png`
  - `artifacts/phase3/app-shell/mobile.png`
- Desktop viewport check: `scrollWidth` 1440, `innerWidth` 1440,
  `scrollHeight` 900, `innerHeight` 900.
- Mobile responsive check: top bar bottom and workspace top both measured
  `149.6875`, confirming the first mobile overlap bug was fixed.
- Interaction check passed:
  - sending a message increased the message count to 5;
  - pause changed the emulator viewport to paused;
  - resume changed it back to running;
  - Right moved the sprite marker from `402.875px` to `464.859px`.

## Notes

The local Rust toolchain was refreshed from `rustc 1.74.0` to
`rustc 1.96.0` because current Tauri dependencies include crates using the
Rust 2024 edition.
