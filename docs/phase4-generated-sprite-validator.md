# Phase 4 Generated Sprite Validator Evidence

## Scope

This slice adds the local validator for generated ComfyUI sprite PNGs. It does
not claim that a live ComfyUI run has produced an accepted sprite yet. The next
unit should run the workflow against a local ComfyUI instance, then pass the
resulting PNG to this validator.

Implemented behavior:

- Added `scripts/validate-generated-sprite.py`.
- The validator reads PNG data directly and does not require Pillow or other
  image libraries.
- It accepts indexed, RGB, grayscale, or RGBA 8-bit non-interlaced PNGs.
- It enforces the Drive16 ComfyUI manifest output size of 32x32.
- It enforces the Genesis hardware sprite limit of 4x4 tiles.
- It requires binary transparency through alpha 0, indexed palette index 0, or
  the reserved transparent RGB color `255,0,255`.
- It enforces at most 16 palette slots, including transparency.
- It reports the SGDK `SPRITE` resource line for the accepted PNG.
- It writes ignored validation output under
  `artifacts/phase4/generated-sprite-validation/`.

## Verification

Validator self-test:

```sh
scripts/validate-generated-sprite.py --self-test
```

Result:

- A synthetic 32x32 indexed PNG with transparent palette index 0 was accepted.
- A synthetic 32x32 indexed PNG using 18 palette slots was rejected.
- Validation artifact:
  `artifacts/phase4/generated-sprite-validation/last-validation.json`.

Syntax check:

```sh
python3 -m py_compile scripts/validate-generated-sprite.py
```

Result:

- The validator compiled successfully.

## Next

Run the ComfyUI workflow through `drive16-comfyui`, then validate the generated
PNG with:

```sh
scripts/validate-generated-sprite.py <generated-png>
```
