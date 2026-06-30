# Phase 5 Action Feedback

This slice completes Phase 5 Unit 8 by putting action feedback next to the ROM
viewport.

## Goal

Run, Save, Export, Import, and related action states should be visible where
the user is watching the ROM. Path outputs should remain visible after the
action finishes.

## Behavior

- A ROM action feedback strip appears below the ROM controls.
- The strip reports:
  - Running ROM.
  - Saving project.
  - Exporting ROM.
  - Importing ROM.
  - Ready.
  - Action needs attention.
- Recent action chips show:
  - Active imported ROM path.
  - Latest project snapshot path.
  - Latest exported ROM path.
- The top bar and project menu still report status, but the ROM area is the
  primary feedback surface while testing.

## Evidence

Commands:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
pnpm --dir app build
```

Results:

- Native tests passed with 41 tests and 4 live-environment tests ignored.
- Frontend build passed.

Browser proof at `http://127.0.0.1:1420/`:

- Initial feedback showed:
  - `Ready`
  - `Starter ROM running. Browser preview is using simulated frames.`
- Clicking Run showed:
  - `Ready`
  - `Current starter ROM is running. Browser preview is using simulated frames.`
- Clicking Save added:
  - `artifacts/phase3/projects/drive16-starter-preview`
- Clicking Export added:
  - `artifacts/phase3/exports/drive16-starter-preview.bin`
- Clicking Import Test ROM added:
  - `artifacts/phase5/imports/drive16-import-preview-starter-test-rom.bin`
- Project menu status showed:
  - `Imported ROM active`
  - `starter-test-rom.bin copied to artifacts/phase5/imports/drive16-import-preview-starter-test-rom.bin`

## Remaining Boundary

Browser preview actions complete quickly, so transient Running/Saving/Exporting
states can be brief. Native long-running tasks still use the same feedback
model while busy.
