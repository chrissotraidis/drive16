# Phase 4 ComfyUI Workflow Evidence

## Scope

This slice ships the tuned Genesis palette ComfyUI workflow contract for the
optional AI sprite path. It does not run live generation yet and does not mark
generated sprites as SGDK-ready. The next Phase 4 unit validates generated PNG
output as a palette-legal `SPRITE` resource.

Implemented behavior:

- Added `assets/enhancements/comfyui/manifest.json`.
- Added `assets/enhancements/comfyui/drive16-genesis-sprite.workflow.json`.
- Added `scripts/validate-comfyui-workflow.py`.
- Documented the enhancement asset folder separately from the CORE asset pack.

## Workflow Contract

The workflow is a ComfyUI API-format prompt object for `enqueue_workflow`.

Contract details:

- Uses `CheckpointLoaderSimple` with a Pixel Art Diffusion XL compatible
  checkpoint placeholder.
- Generates at 512x512, then downscales to 32x32 with `nearest-exact`.
- Quantizes through Pixydust `Quantizer` with `fixed_colors` set to 16.
- Keeps dithering off for clearer tile readability.
- Saves with the Drive16 prefix
  `drive16/generated/drive16_genesis_sprite`.
- Records the SGDK resource shape as `SPRITE <symbol> "<generated-png>" 4 4
  NONE 0`.

The Pixydust custom node source maps the ComfyUI class type `Quantizer` to the
Pixydust quantizer node and exposes `fixed_colors`, `reduction_method`,
`dither_pattern`, and batch controls:
https://github.com/sousakujikken/ComfyUI-PixydustQuantizer

`comfyui-mcp` documents that `enqueue_workflow` accepts ComfyUI API-format JSON:
https://www.npmjs.com/package/comfyui-mcp

## Verification

Workflow contract:

```sh
scripts/validate-comfyui-workflow.py
```

Result:

- Workflow JSON parsed as ComfyUI API format, not UI format.
- Required nodes were present:
  `CheckpointLoaderSimple`, `CLIPTextEncode`, `EmptyLatentImage`,
  `KSampler`, `VAEDecode`, `ImageScale`, `Quantizer`, and `SaveImage`.
- Source size was 512x512.
- Final output size was 32x32.
- Final downscale used nearest-neighbor scaling.
- Pixydust quantization was set to 16 colors.
- Dithering was off.
- Manifest reserved palette index 0 for the follow-up SGDK sprite validator.
- Validation artifact:
  `artifacts/phase4/comfyui-workflow/validation.json`.

## Next

Validate generated sprites as palette-legal SGDK `SPRITE` resources.
