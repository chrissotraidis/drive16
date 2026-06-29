# Phase 3 App Preflight

Date: 2026-06-29

This slice adds app-side dependency and CORE tool health checks to the Tauri
shell.

## Scope

- Native Tauri command: `run_preflight`.
- Checks:
  - OpenCode command availability.
  - Docker command availability.
  - SGDK build script presence.
  - Genteel sidecar binary presence.
  - Drive16 RAG corpus presence.
  - CORE bundled asset presence.
- Frontend health panel with a refresh button.
- Browser-preview fallback that makes it clear native command checks only run
  inside the Tauri app.

## Commands

Build the frontend:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app build
```

Check the Tauri Rust shell:

```sh
cargo check --manifest-path app/src-tauri/Cargo.toml
```

Run the focused Rust preflight test:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml preflight_reports_expected_core_checks
```

Build the Tauri shell without bundling:

```sh
PATH="/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:/Users/chrissotraidis/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" pnpm --dir app tauri build --debug --no-bundle
```

## Evidence

- `pnpm --dir app build` passed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  preflight_reports_expected_core_checks` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- In-app Browser validation loaded `http://127.0.0.1:1420/` with title
  `Drive16`.
- Browser DOM snapshot contained `Drive16 Agent`.
- Browser console warnings and errors were empty.
- Browser framework overlay check was negative.
- Refreshing `data-testid="refresh-health"` updated the health summary.
- Browser preview health summary showed:
  `Needs attention` and `Preview mode`.
- Browser preview health list showed OpenCode and Docker as `Check`, with SGDK
  build and Genteel as `Ready`.
- Default viewport metrics: `scrollWidth: 1280`, `innerWidth: 1280`,
  `scrollHeight: 720`, and `innerHeight: 720`.
- Mobile viewport metrics: `scrollWidth: 390`, `innerWidth: 390`,
  `scrollHeight: 1632`, and `innerHeight: 844`.
- Browser screenshots:
  - `artifacts/phase3/preflight/browser-default.png`
  - `artifacts/phase3/preflight/browser-mobile-top.png`
  - `artifacts/phase3/preflight/browser-mobile-health.png`

## Fixes During Validation

- Constrained the desktop emulator viewport by available height so the 1280 by
  720 browser viewport no longer crowds the health panel.
- Tightened mobile width and wrapping rules so the top controls, messages, and
  health rows no longer clip horizontally.

## Notes

The app-side native preflight uses Rust process and file checks. It does not
read or store provider credentials. The OpenRouter key remains a runtime
setting for later model connection work.
