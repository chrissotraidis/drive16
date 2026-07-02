# Phase 8 UI Repair Slice 3

Status: implemented and verified in browser-preview windows. Native OS
file-picker completion remains open.

## What Changed

- Moved provider/session truth out of the top of the conversation and into a
  compact row directly above the composer.
- Set ROM/tool details to collapsed by default, so the first screen prioritizes
  chat, the ROM player, controls, and local feedback.
- Reworked the player session strip so the first row shows only the current ROM,
  Play readiness, and input readiness. Verify/core/controller/audio details now
  live behind a `More` disclosure.
- Tightened OpenRouter missing-key copy so it explains the in-memory session key
  rule without producing a cramped wall of text.
- Fixed normal-window wrapping for the composer session row and compact status
  row.

## Verification

- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser responsive checks passed at `1440x900`, `1180x780`, and `1040x740`:
  - no horizontal overflow;
  - no detected clipped visible button/message/session/status text;
  - status details are collapsed by default;
  - compact status summary remains visible;
  - message labels stay separated as `Drive16`, `You`, and `Proof result`.
- Browser interaction checks passed:
  - sending `hey` with no session OpenRouter key appends a normal `You` message
    followed by a `Drive16` setup reply, not a proof result;
  - `Play ROM` reports the browser-preview disk-ROM limitation next to the ROM
    player;
  - `Verify Right` reports `Right proof passed` and appends a `Proof result`;
  - `Show Details` expands the ROM/tool inspector;
  - `Setup` opens the project menu with `Actions` first and readiness details
    collapsed;
  - Agent Settings opens with secondary sections collapsed;
  - switching to Ollama hides OpenRouter fields and relabels the composer as
    `Ollama readiness only`.
- Browser console warning/error log was empty after the interaction pass.

## Remaining

- Direct native click-through for OS file-picker paths:
  - `Import ROM`;
  - `Choose Core` / `Set Up Play`.
- Decide whether to automate stale-window cleanup in the dev launch flow so the
  old bundled app cannot be mistaken for the current dev window.
- Continue pruning old CSS only after another rendered pass confirms no shared
  styles are still needed.

## Pause Note

Work paused here because the user needed the computer and native UI automation
should not continue while the desktop is being used.

Current known state at pause:

- Slice 3 code and docs are implemented.
- Browser-preview layout and interaction checks passed.
- `pnpm --dir app build` passed.
- `git diff --check` passed.
- The current native dev window visually showed the Slice 3 UI before native
  file-picker testing began.
- Native OS file-picker completion was not verified. The attempted coordinate
  click hit another foreground app after macOS focus changed, so the native
  `Import ROM` and `Choose Core` click-throughs remain intentionally open.

Resume from here by re-fronting or relaunching the current Tauri dev app,
confirming the visible Slice 3 shell, then testing only the remaining native
OS file-picker paths.
