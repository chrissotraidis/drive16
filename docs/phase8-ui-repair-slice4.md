# Phase 8 UI Repair Slice 4

Status: implemented and browser-smoke verified.

## What Changed

- Added an app-side guard for OpenRouter replies that claim local ROM work
  happened without a local proof result.
- Tightened the OpenRouter system prompt so chat replies cannot claim to build,
  compile, verify, export, run, or play ROMs.
- If a model reply overclaims local proof, Drive16 now blocks that reply and
  tells the user to run the real local path through the bundled sprite/music
  prompt or `Verify Right`.
- Made chat cards denser so the conversation rail wastes less vertical space.
- Changed missing interactive-Play wording from `Choose Core` toward
  `Set Up Play`, and clarified that this means supplying a compatible Genesis
  emulator core for interactive play.
- Clarified that Verify still works through the local Genteel proof path even
  when interactive Play setup is missing.
- Updated browser smoke coverage so a mocked OpenRouter overclaim is blocked.
- Repaired stale smoke-test selectors for the current Settings entry point and
  no-key composer mode label.

## Verification

- `pnpm --dir app build` passed.
- `node --check scripts/verify-phase6-browser-smoke.mjs` passed.
- `git diff --check` passed.
- Browser preview loaded at `http://127.0.0.1:1420/?core-status=dev-only`
  with no console warnings or errors.
- Rendered check confirmed the compact message styling is active:
  - message padding: `10px`;
  - message body font size: `13px`.
- Browser smoke passed with evidence under
  `artifacts/phase8/browser-smoke-ui-trust-20260703`.
- The smoke now verifies:
  - no-key freeform chat remains guarded;
  - OpenRouter live mocked freeform replies still work;
  - a mocked model reply saying `ROM built successfully` is blocked;
  - the CORE sprite/music prompt still routes to the local proof path and does
    not call OpenRouter;
  - ROM import, keyboard input, controls panel, Play feedback, Verify Right,
    Save/Open/Export, Settings, and responsive checks still pass.

## Remaining

- Native app click-through for real OS file-picker flows:
  - `Import ROM`;
  - `Set Up Play`.
- Decide whether Controls should stay beside the ROM player, move into
  Settings, or appear in both places as a compact player shortcut plus a fuller
  Settings view.
- Make local proof progress more obvious while a build is actually running.
- Consider adding a visible `Build demo` or `Run proof` primary action so the
  user does not need to guess that the magic phrase starts the local proof path.
