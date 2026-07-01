# Phase 7 User Core Flow

Status: implemented for Phase 7 Slice 2.

## Goal

Turn the Phase 7 core-delivery policy into user agency: Drive16 can now accept
a compatible local Genesis RetroArch/libretro Emscripten core and prefer it for
interactive Play.

## What Changed

- Added `Set Up Play` / `Choose Core` beside project and ROM player actions,
  not inside Agent Settings.
- Accepted either a `.zip` archive or a `.js + .wasm` pair in the frontend.
- Extracted `.zip` archives in the browser with `fflate`.
- Copied normalized core files into ignored local storage:
  `artifacts/phase7/interactive-core/genesis_plus_gx_libretro.js`
  and `artifacts/phase7/interactive-core/genesis_plus_gx_libretro.wasm`.
- Added Tauri commands to report, prepare, import, and read the local core pair.
- Made `Play ROM` prefer the user-supplied core. The dev CDN path remains only
  a development fallback.
- Updated the core checker so it reports user core JS/WASM presence,
  readability, tracked core-binary hygiene, and Verify path availability.

## Runtime Truth

- `Play ready` / `User core`: a user-supplied core is loaded and Play uses it.
- `Dev preview only` / `Dev CDN`: local dev fallback can run, but the core is
  not bundled or release-settled.
- `Play setup needed`: Play explains setup and Verify remains available.

## Verification

Commands run:

```sh
pnpm --dir app build
cargo test --manifest-path app/src-tauri/Cargo.toml project::
scripts/check-interactive-play-core.mjs --online
scripts/verify-phase6-browser-smoke.mjs --url http://127.0.0.1:1422/ --user-core artifacts/phase7/core-fixtures/genesis_plus_gx_libretro.zip --out artifacts/phase7/browser-smoke-user-core
scripts/verify-phase6-browser-smoke.mjs --url http://127.0.0.1:1422/ --core-status missing --out artifacts/phase7/browser-smoke-missing-core
```

Evidence:

- User core import and Play passed:
  `artifacts/phase7/browser-smoke-user-core/browser-smoke.json`
- Missing core setup explanation passed:
  `artifacts/phase7/browser-smoke-missing-core/browser-smoke.json`
- No emulator core binaries are tracked by git.

## Remaining Out Of Scope

- Full controller remapping editor and packaged controller hardware QA.
- Installer-managed core acquisition.
- Public packaging, signing, notarization, or marketplace/library UX.
- Choosing a permanent bundled Genesis core.
