# Drive16 Decisions

## 2026-06-29 - Genteel CLI source for Phase 0 scripts

Context:

The first Genteel validation script used a provisional CLI shape because the
local machine had no Genteel binary. Phase 0 needs exact headless screenshot
commands before human validation can be reliable.

Decision:

Use `segin/genteel` as the intended Genteel source for Phase 0 validation and
align scripts to the observed CLI at commit
`bd4fc05b2020a6889b323815f22ae577c70e52fa`:
`genteel --headless <frames> --screenshot <path> <ROM>`.

Consequence:

The screenshot validation script now matches upstream source evidence. The
continuous live-framebuffer path is still an explicit Phase 0 validation item,
not an assumed capability.

## 2026-06-29 - Known-good Phase 0 accuracy ROM

Context:

Phase 0 requires Genteel accuracy validation against a known-good homebrew ROM,
but the repo must not include commercial ROMs or unlicensed downloads.

Decision:

Use SGDK's upstream `sample/basics/hello-world` release ROM from pinned commit
`846b1a3c8551392eebbab33182b80cf4291fd2e8` as the known-good open homebrew
accuracy check. Fetch it into ignored `artifacts/` storage, verify SHA-256, and
record source/license metadata before running it in Genteel.

Consequence:

The accuracy check is reproducible without committing a ROM binary. It confirms
basic SGDK ROM execution in Genteel, while broader emulator compatibility can be
expanded later if Phase 0 exposes Genteel risk.

## 2026-06-29 - Phase 0 validation assets are original

Context:

Phase 0 needs a bundled sprite and VGM loop, but the architecture forbids
commercial ROM-derived material and requires license hygiene.

Decision:

Generate tiny original validation assets under `assets/phase0/` with
`scripts/generate-phase0-assets.py`: an indexed 32x32 sprite PNG and a PSG-only
VGM loop.

Consequence:

Phase 0 can validate SGDK `SPRITE` and `XGM` resource wiring without copying
commercial game art or music. Final asset licensing should be confirmed before
release alongside the app license.

## 2026-06-29 - Proposed app license: MIT

Context:

Drive16 needs a permissive license posture while isolating copyleft and
non-commercial dependencies as separate sidecar processes. The architecture
requires Genteel as the MIT default emulator, BlastEm only as a GPLv3 sidecar,
Genesis Plus GX only as explicit opt-in, and ComfyUI only as a separate Phase 4
process.

Decision:

Propose MIT for the Drive16 app code. Do not finalize a `LICENSE` file until the
human confirms this choice.

Consequence:

The repo can document the intended license stance now, while release licensing
remains a human confirmation gate. Any copyleft or non-commercial component must
stay outside the linked app binary.

## 2026-06-29 - Phase 0 validation fixture location

Context:

The architecture intentionally leaves the final Drive16 project format open
until before Phase 3, but Phase 0 needs a concrete SGDK project to validate the
manual toolchain.

Decision:

Place manual spike fixtures under `examples/`, starting with
`examples/sgdk-hello-world/`. These fixtures are validation assets, not the final
Drive16 project format.

Consequence:

Phase 0 can produce exact build commands now without prematurely deciding the
future app project layout.
