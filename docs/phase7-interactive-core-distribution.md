# Phase 7 Interactive Core Distribution

Status: distribution policy and browser player implemented; packaged macOS
rendering remains blocked.

## Goal

Make Drive16 honest and easy to install/run for interactive Play without
pretending emulator-core distribution is already settled.

## Upstream Facts Checked

- Drive16 currently uses `nostalgist@0.21.1` as the browser player wrapper.
- Nostalgist is MIT licensed:
  `https://github.com/arianrhodsandlot/nostalgist/blob/main/license`
- Nostalgist is built around RetroArch Emscripten builds, and its README says
  default ROM/core loading uses jsDelivr:
  `https://github.com/arianrhodsandlot/nostalgist`
- The local Nostalgist runtime maps Mega Drive playback to
  `genesis_plus_gx` and resolves core files from
  `arianrhodsandlot/retroarch-emscripten-build` on jsDelivr.
- Libretro documents the Genesis Plus GX core as non-commercial:
  `https://docs.libretro.com/library/genesis_plus_gx/`

This is enough to make a product decision for Drive16, but it is not a legal
opinion.

## Decision

Use the current Nostalgist/RetroArch path as a streamed browser interactive
adapter when a user core is not configured:

- Preferred status in the app: `Play ready` with `User core`.
- Streamed fallback status in the app: `Play ready online`.
- Do not commit Genesis Plus GX, RetroArch Emscripten, or other emulator core
  binaries into the repo.
- Do not claim the public/distributable app bundles a Genesis core.
- Keep Genteel as the local `Verify/Capture Proof` path.
- Do not call the packaged macOS player ready while its WKWebView canvas is
  black, even though the same ROM/core/input path works in the browser.
- Treat a future public release as requiring either:
  - the current user-supplied core flow,
  - a license-reviewed installer-managed flow, or
  - a replacement interactive runtime with a release-compatible license.

## Readiness Contract

The app now models interactive core readiness with these statuses:

- `available`: a release-safe user-supplied or packaged core is configured.
- `dev-only`: the current Nostalgist dev-CDN adapter can attempt Play, but the
  core is not bundled or release-settled.
- `missing`: no interactive core is configured.
- `needs-user-action`: the user must provide or configure a core.
- `unsupported`: the browser environment cannot run the WebAssembly player.

`available` allows Play through the selected local core. `dev-only` allows Play
through the explicit development fallback. All other states keep `Play ROM`
clickable so the user gets a setup explanation, while `Verify` remains
available.

## User Core Flow

Drive16 now includes a user-supplied core setup path:

- `Set Up Play` appears in the project menu.
- `Choose Core` appears beside `Play ROM`.
- The chooser accepts a compatible `.zip` archive or `.js + .wasm` pair.
- ZIP archives are extracted in the browser and normalized before storage.
- Native storage writes the selected pair under ignored
  `artifacts/phase7/interactive-core`.
- `Play ROM` reads the local core pair and passes it to Nostalgist as
  `{ name, js, wasm }` before falling back to the dev CDN.

## UI Contract

- The ROM player shows a compact readiness pill near the keyboard controls.
- The player session strip says `Verify` is still available.
- The Tools panel includes `Interactive Play` as a setup/readiness item.
- Agent Settings does not own this state; it is a ROM/player capability, not
  an inference-provider setting.

## Setup Check

Run the local check:

```sh
scripts/check-interactive-play-core.mjs
```

Run the optional online check:

```sh
scripts/check-interactive-play-core.mjs --online
```

The command confirms the current dev-CDN posture, checks the installed
Nostalgist wrapper metadata, reports whether a local user core pair is present
and readable, checks Verify availability, and verifies that no emulator core
binaries are tracked in git. The online mode also checks whether the current dev
CDN core URL is reachable.

## Verification

Latest evidence:

- Local setup check:
  `scripts/check-interactive-play-core.mjs`
- Optional online setup check:
  `scripts/check-interactive-play-core.mjs --online`
- Frontend build:
  `pnpm --dir app build`
- Native project tests:
  `cargo test --manifest-path app/src-tauri/Cargo.toml project::`
- User-core browser smoke:
  `artifacts/phase7/browser-smoke-user-core`
- Missing-core browser smoke:
  `artifacts/phase7/browser-smoke-missing-core`
- Full browser/native loop:
  `artifacts/phase6/verify-loop/20260701-135734`
- Browser Play-ready mode:
  `artifacts/phase7/core-readiness/dev-only-final`
- Browser missing-core mode:
  `artifacts/phase7/core-readiness/missing-final`
- Native spot-check screenshot:
  `/tmp/drive16-p7-native.png`

The browser smoke accepts a core-status override:

```sh
scripts/verify-phase6-browser-smoke.mjs --core-status dev-only
scripts/verify-phase6-browser-smoke.mjs --core-status missing
scripts/verify-phase6-browser-smoke.mjs --user-core /path/to/genesis_plus_gx_libretro.zip
```

Expected behavior:

- `--user-core`: imported ROM Play starts through the selected local core.
- `dev-only`: imported ROM Play starts through the streamed fallback in the
  browser.
- `missing`: Play reports setup needed, and Verify still captures proof.
- Native app: the packaged core starts and accepts controls, but the current
  macOS WKWebView canvas remains black. Treat this as a release blocker; native
  Genteel Verify remains the working deterministic proof path.

The broader loop can keep using:

```sh
scripts/verify-phase6-loop.sh --browser
```
