# Phase 8 UI Repair Slice 2

Status: implemented and verified for browser-preview interaction plus current
native-window visual state. Full native file-picker click-through remains open.

## What Changed

- Fixed a button-trust bug where `Verify Right` completed its proof but left the
  top bar stuck on `Verifying`.
- Made browser-preview `Play ROM` feedback truthful and less alarming when the
  preview cannot read the current ROM from disk. It now explains that the user
  should import a ROM in the browser session or use the desktop app for the
  current project.
- Added stable UI audit hooks for Agent Settings, the composer mode label, and
  the settings panel.
- Restarted the native app and confirmed the current Phase 8 repair UI is
  visible in the real `Drive16` desktop window.

## Verification

- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser responsive checks passed at `1440x900`, `1180x780`, and `1040x740`:
  - page title: `Drive16`;
  - phase label: `Phase 8 readiness hub`;
  - no horizontal overflow;
  - no detected clipped button/message/status text;
  - message labels separate `Drive16`, `You`, and `Proof result`;
  - composer label: `OpenRouter key needed`.
- Browser interaction checks passed:
  - `Play ROM` reports that browser preview cannot read the current disk ROM and
    points to import-or-desktop-app next steps.
  - `Verify Right` completes, records `Right proof passed`, appends a
    `Proof result`, and returns the top status to `Ready`.
  - Agent Settings opens from the conversation panel.
  - Switching to Ollama hides OpenRouter fields and shows Ollama fields.
  - Settings detail sections stay collapsed by default.
  - Closing Settings leaves the composer labeled `Ollama readiness only`.
  - `Setup` opens the project menu with `Actions` as the first visible section
    and readiness details collapsed.
- Native-window verification:
  - stopped stale Drive16 windows that were still showing the old Phase 7 UI;
  - relaunched `pnpm --dir app tauri dev`;
  - verified the current raw dev window is `1440x900`;
  - captured the real desktop window showing the Phase 8 repair UI, not the old
    proof/files split.

## Remaining

- Direct native click-through for OS file-picker paths:
  - `Import ROM`;
  - `Choose Core` / `Set Up Play`.
- Decide whether to automate stale-window cleanup in the dev launch flow so the
  old bundled app cannot be mistaken for the current dev window.
- Continue pruning old CSS only after another rendered pass confirms no shared
  styles are still needed.
