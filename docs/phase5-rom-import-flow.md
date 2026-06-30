# Phase 5 ROM Import Flow

This slice completes Phase 5 Unit 4 by turning Import ROM into an active app
workflow.

## Goal

Drive16 should accept a local Genesis ROM file, copy it into ignored local
storage, make it the active ROM, and let Run and Export operate on that active
ROM.

## Behavior

- Import ROM accepts `.bin`, `.gen`, `.md`, and `.smd`.
- Selected ROM bytes are copied into `artifacts/phase5/imports`.
- Imported filenames are sanitized before writing.
- Imported files live under ignored `artifacts/` storage and must not be
  committed.
- The app updates the current project to `Imported ROM`.
- Runtime metadata shows the imported ROM path.
- Run and rerun launch the imported ROM path when one is active.
- Export copies the active imported ROM when one is active.
- New Project clears the imported ROM state and returns to the starter project.
- A separate `Import Test ROM` action imports the repo-generated starter ROM
  for safe validation without commercial ROMs.

## Native Commands

- `prepare_rom_import` creates or verifies ignored import storage.
- `import_rom_bytes` validates a selected ROM name, decodes the selected file
  bytes, and writes the copied ROM under `artifacts/phase5/imports`.
- `import_test_rom` copies the generated starter ROM into the ignored import
  directory for validation.
- `launch_rom_path` runs an active repo-local ROM path through Genteel.
- `export_rom_path` exports an active repo-local ROM path.

Native run and export path inputs must stay inside the Drive16 workspace.
Absolute paths and traversal outside the repo are rejected.

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

- Project menu showed `Import Test ROM`.
- Clicking `Import Test ROM` changed action status to `Imported ROM active`.
- Project summary changed to `Imported ROM`.
- Runtime metadata pointed at
  `artifacts/phase5/imports/drive16-import-preview-starter-test-rom.bin`.
- The ROM viewport showed framebuffer preview frames.
- Clicking Run logged `run.started` with the imported ROM path.
- Clicking Export reported `artifacts/phase3/exports/drive16-import-preview.bin`.

Local Genteel proof:

```sh
mkdir -p artifacts/phase5/imports artifacts/phase5/import-verification
cp examples/app-starter-blank/out/rom.bin \
  artifacts/phase5/imports/drive16-import-cli-starter-test.bin
artifacts/phase0/genteel-src/target/release/genteel \
  --headless 180 \
  --stream-frames artifacts/phase5/import-verification/imported-test-frames.rgb565 \
  --stream-every 30 \
  --screenshot artifacts/phase5/import-verification/imported-test-frame.png \
  artifacts/phase5/imports/drive16-import-cli-starter-test.bin
file artifacts/phase5/import-verification/imported-test-frame.png \
  artifacts/phase5/import-verification/imported-test-frames.rgb565
```

Observed:

- Genteel loaded
  `artifacts/phase5/imports/drive16-import-cli-starter-test.bin`.
- It ran 180 frames headlessly.
- It wrote `artifacts/phase5/import-verification/imported-test-frame.png`.
- The PNG is valid `320 x 240` image data.
- It wrote
  `artifacts/phase5/import-verification/imported-test-frames.rgb565`.

Git hygiene:

```sh
git status --short --ignored artifacts/phase5/imports \
  artifacts/phase5/import-verification
```

Output only reported ignored `artifacts/`, confirming the imported ROM and
proof captures are not tracked.

## Remaining Boundary

The browser preview uses simulated frames for imported ROM UI proof. The native
Genteel path was verified separately with an ignored imported test ROM copy.
Unit 5 should add visible input controls and make the manual-control boundary
clear.
