# Phase 4 Generated Sprite SGDK Resource Evidence

## Scope

This slice proves that a validator-accepted generated-sprite PNG can be handed
to SGDK `rescomp` as a `SPRITE` resource and built into a ROM. It uses the
validator's ignored synthetic fixture, not live ComfyUI output, so it does not
close the live generated-sprite gate.

Implemented behavior:

- Added `scripts/validate-generated-sprite-sgdk-resource.sh`.
- The script runs `scripts/validate-generated-sprite.py --self-test` to create
  a known-good generated-sprite PNG fixture under ignored artifacts.
- It copies that PNG into an ignored SGDK project under
  `artifacts/phase4/generated-sprite-sgdk-resource/project`.
- It writes a `SPRITE drive16_player "generated-sprite.png" 4 4 NONE 0`
  resource entry and a minimal SGDK program that displays the sprite.
- It builds the project through `scripts/build-sgdk.sh`, which runs SGDK
  `rescomp`.
- It runs the built ROM through Genteel and captures a screenshot.
- It writes `artifacts/phase4/generated-sprite-sgdk-resource/latest.json`.

## Verification

Generated sprite SGDK resource harness:

```sh
scripts/validate-generated-sprite-sgdk-resource.sh
```

Result:

- The generated-sprite validator accepted the synthetic 32x32 indexed PNG.
- The validator reported 4 palette slots and 704 transparent pixels.
- SGDK `rescomp` accepted the PNG as
  `SPRITE drive16_player "generated-sprite.png" 4 4 NONE 0`.
- `rescomp` reported 1 VDP sprite and 6 tiles.
- `scripts/build-sgdk.sh` built
  `artifacts/phase4/generated-sprite-sgdk-resource/project/out/rom.bin`.
- Genteel captured
  `artifacts/phase4/generated-sprite-sgdk-resource/generated-sprite-resource.png`.
- The screenshot visually shows `Drive16 Phase 4`, `Generated SPRITE`, and the
  generated sprite on screen.

## Next

Keep the main generated-sprite checklist item open until live ComfyUI output
passes the same PNG validation and the combined generated-assets prompt proof.
