# Phase 7 Interactive Core Distribution

Status: selected and implemented for the first post-v1 slice.

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

Use the current Nostalgist/RetroArch path as a local-development interactive
adapter only:

- Current status in the app: `Play ready` with `Dev CDN`.
- Do not commit Genesis Plus GX, RetroArch Emscripten, or other emulator core
  binaries into the repo.
- Do not claim the public/distributable app bundles a Genesis core.
- Keep Genteel as the local `Verify/Capture Proof` path.
- Treat a future public release as requiring either:
  - a user-supplied core flow,
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

Only `available` and `dev-only` allow Play to start. All other states keep
`Play ROM` clickable so the user gets a setup explanation, while `Verify`
remains available.

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
Nostalgist wrapper metadata, and verifies that no emulator core binaries are
tracked in git. The online mode also checks whether the current dev CDN core URL
is reachable.

## Verification

Latest evidence:

- Local setup check:
  `scripts/check-interactive-play-core.mjs`
- Optional online setup check:
  `scripts/check-interactive-play-core.mjs --online`
- Frontend build:
  `pnpm --dir app build`
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
```

Expected behavior:

- `dev-only`: imported ROM Play starts through the current adapter.
- `missing`: Play reports setup needed, and Verify still captures proof.
- Native app: accessibility text showed `Play ready`, `Dev CDN`,
  `Interactive Play`, `Verify still uses local Genteel`, and the setup hints in
  the desktop window.

The broader loop can keep using:

```sh
scripts/verify-phase6-loop.sh --browser
```
