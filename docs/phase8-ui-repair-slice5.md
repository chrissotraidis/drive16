# Phase 8 UI Repair Slice 5

Status: implemented and native-open verified.

## What Changed

- Found and fixed the native review trap where macOS could reopen a stale
  debug `Drive16.app` bundle with embedded Phase 7 UI even though the source
  and browser preview were current.
- Rebuilt the debug macOS app bundle from the current frontend and verified the
  visible native app shows the Phase 8 readiness hub.
- Added `scripts/launch-drive16-native.sh`, plus `pnpm --dir app
  launch:native`, to close old `drive16` debug processes, rebuild the debug
  `.app`, and open the current bundle.
- Shortened missing interactive-Play setup copy so the player feedback row and
  top status do not become clipped paragraphs.
- Verified native app click-through for:
  - `Import Test ROM`;
  - `Import ROM` open/cancel;
  - `Set Up Play` open/cancel;
  - `Play ROM` with no user core.

## Verification

- `pnpm --dir app tauri build --debug --bundles app` passed and rebuilt
  `app/src-tauri/target/debug/bundle/macos/Drive16.app`.
- Native desktop inspection showed `Phase 8 readiness hub` in the rebuilt app,
  not the stale Phase 7 shell.
- `Import Test ROM` imported the repo-generated starter ROM into
  `artifacts/phase5/imports`, switched the workspace to `Imported ROM`, and
  captured proof.
- `Set Up Play` opened the macOS file picker, then returned visible
  `Choose Play core` feedback after cancel.
- `Import ROM` opened the macOS file picker, then returned visible
  `Choose ROM file` feedback after cancel.
- `Play ROM` without a core returned `Play setup needed` with concise setup
  text.
- `pnpm --dir app build` passed.
- `bash -n scripts/launch-drive16-native.sh` passed.
- `node --check scripts/verify-phase6-browser-smoke.mjs` passed.
- `git diff --check` passed.
- Browser smoke passed with evidence under
  `artifacts/phase8/browser-smoke-native-trust-20260703`.

## Remaining

- Test `Set Up Play` with a real compatible user core when one is available.
- Test `Import ROM` valid local file selection beyond the repo-generated test
  ROM path.
- Broader visible-button trust audit is complete in Slice 6.
- Decide whether Controls stays only beside the ROM player or also appears in
  Settings as a fuller input configuration surface.
