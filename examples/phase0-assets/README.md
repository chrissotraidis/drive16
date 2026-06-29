# Phase 0 Assets ROM

This fixture wires a bundled sprite and bundled VGM loop through SGDK resources.
It is still part of Phase 0, not the final Drive16 project format.

Validation from the repo root:

```sh
scripts/generate-phase0-assets.py --check
scripts/build-sgdk.sh examples/phase0-assets
GENTEEL_BIN=/path/to/genteel scripts/validate-genteel.sh examples/phase0-assets/out/rom.bin artifacts/phase0/phase0-assets.png
```

Expected result:

- SGDK builds `examples/phase0-assets/out/rom.bin`.
- Genteel captures `artifacts/phase0/phase0-assets.png`.
- In a live Genteel window, the D-pad moves the sprite and the PSG loop is audible.
