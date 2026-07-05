# Phase 8 UI Repair Slice 6

Status: implemented and native-click verified.

## What Changed

- Completed the native visible-button trust pass that remained after Slice 5.
- Confirmed the rebuilt macOS app opens into the current Phase 8 shell with ROM
  details collapsed by default.
- Verified primary project lifecycle controls in the native app:
  - `Save`;
  - `Export`;
  - `Open Project` after a saved snapshot exists.
- Verified secondary app-shell controls in the native app:
  - `Agent Settings`;
  - OpenRouter/Ollama provider switching;
  - `Controls`;
  - `Reset defaults`;
  - `Show Details` / `Hide ROM details`;
  - `Hide conversation pane` / `Show conversation pane`.
- Left Controls near the ROM player for now. That keeps input mappings close to
  the screen they affect instead of adding more global Settings sprawl.

## Verification

- Native desktop inspection showed `Phase 8 readiness hub` in the rebuilt
  debug app bundle.
- `Save` created a project snapshot under `artifacts/phase3/projects` and
  showed the saved path in the app.
- `Export` copied the active ROM under `artifacts/phase3/exports` and showed
  the exported path in the app.
- `Open Project` loaded the latest saved snapshot and refreshed the proof
  preview.
- `Agent Settings` opened the compact settings drawer.
- Switching to Ollama hid OpenRouter key/model fields and kept provider state
  inside Settings.
- Switching back to OpenRouter restored the OpenRouter setup state in Settings.
- `Controls` opened the input mapping panel, `Reset defaults` saved the
  default profile locally, and closing the panel returned to the compact player
  controls.
- `Show Details` expanded ROM/tool details; `Hide ROM details` returned the
  app to the compact default.
- `Hide conversation pane` made the ROM player the main workspace; `Show
  conversation pane` restored the chat rail.

## Remaining

- Test `Set Up Play` with a real compatible user core when one is available.
- Test `Import ROM` with a valid local ROM chosen through the native file
  picker, beyond the repo-generated test path.
- Add import/core size limits and clearer invalid-file handling before treating
  local file ingestion as robust.
- Decide public release policy for bundled/unbundled interactive Play cores,
  signing, notarization, CSP, and project license.
