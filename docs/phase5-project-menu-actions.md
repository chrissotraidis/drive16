# Phase 5 Project Menu Actions

This slice continues Phase 5 hardening by making the project menu the home for
project and ROM actions.

## Goal

The menu should expose the expected project actions and every button should
give visible feedback. Importing a ROM is a separate Unit 4 flow, but the menu
should already make the safe local import path visible.

## Behavior

- Current Project section now shows:
  - Project path.
  - Active ROM path.
  - Saved snapshot path when available.
  - Export path when available.
  - Import storage path when prepared.
- Actions section now includes:
  - `New Project`.
  - `Save Project`.
  - `Open Project`.
  - `Import ROM`.
  - `Export ROM`.
  - Action status panel for the latest project action.
- Projects section now shows:
  - Active starter project.
  - Recent saved snapshots when available.
  - Empty state before the first save.
- Import ROM:
  - Prepares `artifacts/phase5/imports`.
  - Shows `.bin`, `.gen`, `.md`, and `.smd` as accepted extensions.
  - Does not claim a ROM file was imported yet.

## Native Commands

- `list_project_snapshots` lists saved project snapshot directories under
  `artifacts/phase3/projects`.
- `prepare_rom_import` creates or verifies ignored storage under
  `artifacts/phase5/imports`.

## Evidence

Commands:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml project -- --nocapture
pnpm --dir app build
```

Rendered browser proof at `http://127.0.0.1:1420/`:

- App loaded with title `Drive16`.
- Console warnings and errors were empty.
- Project menu contained New Project, Save Project, Open Project, Import ROM,
  Export ROM, and Agent Settings.
- Clicking Open Project before saving showed `No saved projects yet`.
- Clicking Save Project added a recent `drive16-starter-preview` snapshot row.
- Clicking Open Project after saving selected the saved snapshot and updated
  the action status.
- Clicking Import ROM showed `artifacts/phase5/imports` and accepted
  extensions `.bin`, `.gen`, `.md`, `.smd`.
- Clicking Export ROM updated the action status and export path.
- Clicking Agent Settings opened the settings dialog and closed the project
  menu.
- Clicking New Project reset the starter project and showed a fresh local proof
  message.

Screenshot:

- `/tmp/drive16-phase5-unit3/project-menu-actions.png`
