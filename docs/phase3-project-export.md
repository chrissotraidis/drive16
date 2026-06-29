# Phase 3 Project Export Evidence

This slice adds project metadata and export-ROM wiring for the current starter
project.

## Scope

- Native Tauri command `load_project_summary` returns the current starter
  project name, project path, ROM path, export directory, ROM status, and the
  expected files.
- Native Tauri command `export_current_rom` builds the starter ROM if needed
  and copies the current ROM into `artifacts/phase3/exports/`.
- The top-bar `Export ROM` button calls the export command in Tauri.
- The browser preview uses an explicit preview export result so the UI can be
  tested without filesystem access.
- The left file panel now shows project metadata and file status from the
  project summary rather than a hard-coded file list.

The export directory is under ignored artifacts for this phase so generated ROM
files never enter git.

## Native Verification

Focused Rust tests:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml project -- --nocapture
2 passed
```

The focused tests prove:

- project summaries resolve the starter project paths and expected files.
- `export_current_rom_for_repo` copies an existing ROM into the exports
  directory and reports byte count, source path, and export path.

The final iteration verification also runs the full Rust suite, Rust check,
frontend build, and Tauri debug build before commit.

Full Rust suite:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml
7 passed; 1 ignored
```

Rust check:

```text
cargo check --manifest-path app/src-tauri/Cargo.toml
passed
```

Frontend build:

```text
pnpm --dir app build
passed
```

Tauri debug build:

```text
pnpm --dir app tauri build --debug --no-bundle
finished dev profile and built app/src-tauri/target/debug/drive16
```

## Browser Verification

Target:

```text
http://127.0.0.1:1420/
```

Initial state:

- Page title was `Drive16`.
- OpenCode status rendered `OpenCode live`.
- Project summary rendered `Starter Project` and `examples/app-starter-blank`.
- Runtime metadata rendered the ROM path and export directory.
- `Export ROM` button was present.
- Browser console warnings and errors were empty.

Export action:

- Clicked `Export ROM`.
- Runtime metadata updated to `0 B exported` in browser preview mode.
- Event feed recorded `export.preview` with the export path.
- Browser console warnings and errors remained empty.

Mobile check:

- Mobile viewport was set to `390` by `844`.
- Project summary remained visible.
- Runtime metadata still showed the export directory.
- No horizontal document overflow was detected.
- Browser console warnings and errors remained empty.

Screenshots:

- `artifacts/phase3/project-export/browser-after-export.png`
- `artifacts/phase3/project-export/browser-mobile.png`

## Secret Check

The final iteration secret scan checks that no OpenRouter key or matching
secret assignment was written to repo files.
