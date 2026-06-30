# Phase 4 MML FM Preset Evidence

## Scope

This slice ships an original starter library of YM2612 FM presets for generated
Megadrive MML. It does not add the full MML reference to RAG or wire generated
music into the prompt path.

Implemented behavior:

- Added `assets/enhancements/mml/fm-presets.mml` with six original FM voices.
- Added `assets/enhancements/mml/manifest.json` with stable preset IDs,
  instrument numbers, roles, default channels, volume hints, and sample
  phrases.
- Added `scripts/validate-mml-presets.py`.

## Presets

- `drive16_round_bass`, instrument `@80`, for bass lines.
- `drive16_clear_lead`, instrument `@81`, for simple melody lines.
- `drive16_soft_pad`, instrument `@82`, for held harmony.
- `drive16_chip_pluck`, instrument `@83`, for short arpeggios.
- `drive16_bright_bell`, instrument `@84`, for bell accents.
- `drive16_brass_stab`, instrument `@85`, for short chord stabs.

## Verification

```sh
scripts/validate-mml-presets.py
```

Result:

- Manifest schema, platform, unique preset IDs, FM channels, volume ranges,
  octave ranges, and instrument numbers passed validation.
- Each listed instrument was found in `fm-presets.mml`.
- Each preset compiled through the pinned `ctrmml` compiler to a VGM file.
- Each generated VGM had header `Vgm `, version `0x00000161`, and a YM2612
  clock.
- Validation artifact:
  `artifacts/phase4/mml-presets/validation.json`.

## Next

Add the MML reference to the RAG corpus.
