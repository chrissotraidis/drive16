# Phase 7 Input Profiles

Status: implemented for Phase 7 Slice 3.

## Goal

Make interactive Play controls feel like a real product surface without
claiming more than Drive16 can prove. Keyboard input remains the default path,
controller readiness is now detected through the browser Gamepad API, and the
current input profile is persisted locally.

## What Changed

- Added a shared player input profile with stable action IDs for D-pad, A, B,
  C, and Start.
- Kept the default keyboard mapping:
  Arrows, `Z`, `X`, `C`, and Enter.
- Added default controller bindings for standard browser gamepads:
  stick/D-pad directions, buttons 0, 1, 2, and Start.
- Persisted the input profile in localStorage as `drive16.inputProfile.v1`.
- Added a compact Controls panel near the ROM player controls, not Agent
  Settings.
- Added Reset defaults.
- Added browser Gamepad API detection with truthful states:
  `Controller unavailable`, `Controller detected`, and
  `Mapping not configured`.
- Wired detected controller transitions into the same player input action path
  used by keyboard input. The app only sends down/up transitions, not repeated
  held-button spam.

## Runtime Truth

- `Keyboard ready`: the default keyboard profile is available.
- `Controller unavailable`: the Gamepad API has no connected controller, or the
  browser surface cannot expose one.
- `Controller detected`: a connected controller is visible and the current
  profile maps every player action.
- `Mapping not configured`: a controller is visible but the current profile is
  incomplete.

Controller input is now wired into the running player path when the browser
reports a connected gamepad. Per-device remapping, multi-controller selection,
and hardware-specific validation remain later work.

## Verification

Commands run:

```sh
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check
cargo test --manifest-path app/src-tauri/Cargo.toml
node scripts/verify-phase6-browser-smoke.mjs --url http://127.0.0.1:1422/ --user-core artifacts/phase7/core-fixtures/genesis_plus_gx_libretro.zip --out artifacts/phase7/browser-smoke-input-profile-user-core
node scripts/verify-phase6-browser-smoke.mjs --url http://127.0.0.1:1422/ --core-status missing --out artifacts/phase7/browser-smoke-input-profile-missing-core
```

Evidence:

- User-core Play plus input profile smoke passed:
  `artifacts/phase7/browser-smoke-input-profile-user-core/browser-smoke.json`
- Missing-core Play setup plus input profile smoke passed:
  `artifacts/phase7/browser-smoke-input-profile-missing-core/browser-smoke.json`
- The browser smoke verifies default keyboard labels, Controls open/close,
  Reset defaults persistence, and no-controller truthfulness.

## Remaining Out Of Scope

- Full remapping editor.
- Per-device controller profiles.
- Multiple simultaneous controllers.
- Packaged controller hardware QA.
