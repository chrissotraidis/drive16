# Scripts

Toolchain and validation scripts live here.

- `build-sgdk.sh`: builds an SGDK project with the pinned docker-sgdk image.
- `validate-genteel.sh`: runs a ROM through a Genteel binary and captures a
  screenshot when the local Genteel CLI supports the expected headless flags.
- `validate-known-good-homebrew.sh`: fetches a pinned upstream SGDK sample ROM,
  verifies its hash, records source/license metadata, and runs it through
  Genteel for the Phase 0 accuracy check.
- `validate-phase0-assets.sh`: builds and runs the Drive16 Phase 0 sprite and
  VGM validation ROM.
