# Phase 2 Core Assets ROM

This fixture is the Phase 2 reference shape for using the CORE bundled asset
pack. It wires `assets/core/player.png` and `assets/core/loop.vgm` through
SGDK `resources.res`, then moves the sprite with the D-pad while the loop plays.

Validation from the repo root:

```sh
scripts/validate-phase2-core-assets.sh
```

Expected result:

- SGDK builds `examples/phase2-core-assets/out/rom.bin`.
- Genteel captures neutral and Right-input screenshots under
  `artifacts/phase2/core-assets/`.
- The audio dump is non-silent.
