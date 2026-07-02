# Phase 8 UI Repair Slice 1

Status: implemented and browser-verified. Native-window click-through remains a
follow-up before calling the whole UI repair track complete.

## Why This Slice Exists

Phase 8 added useful readiness and provider truth, but the app surface became
hard to read in normal desktop windows. The visible problem was not another
backend feature. It was that chat, proof, setup, project actions, and player
state all competed at the same level.

This slice starts the repair track by making the app hierarchy clearer without
changing backend capability.

## Scope

- Keep feature work frozen while repairing the visible product surface.
- Preserve the existing Phase 8 OpenRouter and readiness hub behavior.
- Keep Verify/Genteel proof distinct from interactive Play.
- Do not bundle or change emulator-core distribution policy.
- Do not add new release claims.

## Changes

- Added `docs/ui-repair-control-map.md` as the working map for visible buttons,
  expected action, feedback location, and repair target.
- Reworked conversation identity:
  - general user messages render as chat;
  - setup/gating replies render as `Drive16`;
  - proof/build replies render as `Proof result`;
  - OpenRouter replies render as `OpenRouter`.
- Moved provider/session truth closer to the composer so a missing in-memory
  OpenRouter key is visible where the user sends chat.
- Removed the always-visible proof/files split from the conversation rail.
  Proof events and project files now live in collapsed inspector details.
- Compressed the project menu so actions come first and readiness details are
  behind disclosure controls.
- Compressed Agent Settings so provider setup stays primary, while Play Core,
  Enhancements, and Release Readiness are collapsed by default.
- Reworked ROM/player status rows so they wrap at normal desktop widths instead
  of truncating important state.

## Verification

- `pnpm --dir app build` passed.
- `git diff --check` passed.
- In-app browser checks passed at `1440x900`, `1100x760`, and `900x760`:
  - no horizontal overflow detected;
  - no detected meaning-destroying clipped text;
  - console warnings/errors were `0`.
- Sending `hey` without a session OpenRouter key now creates:
  - a user message labeled `You`;
  - a setup reply labeled `Drive16`;
  - no false `Local proof` / proof-result identity.
- Project menu check passed:
  - actions appear before backend readiness details;
  - readiness details are collapsed by default.
- Settings check passed:
  - switching to Ollama hides OpenRouter fields;
  - Play Core, Enhancements, and Release Readiness are collapsed by default;
  - the settings drawer fits inside the checked desktop width.

## Remaining UI Repair Work

- Run the same click-through in the native Tauri window, not only the browser
  preview.
- Finish the every-button trust audit for controls that open native file
  pickers or depend on local user files.
- Decide whether to keep or remove any remaining dead CSS from the old
  proof/files split after another rendered pass.
- Continue reducing visible status noise until the first screen explains the
  product without the README.
