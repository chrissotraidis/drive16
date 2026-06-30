# Drive16 ComfyUI Sprite Workflow

This folder contains the Phase 4 ComfyUI workflow for optional Genesis sprite
generation.

Files:

- `manifest.json`: Drive16 contract for the workflow, model expectation,
  output dimensions, palette limit, and SGDK resource shape.
- `drive16-genesis-sprite.workflow.json`: ComfyUI API-format prompt graph for
  `enqueue_workflow`.
- `scripts/validate-generated-sprite.py`: validates generated PNG output
  against the manifest and reports the SGDK `SPRITE` resource line.

This slice ships the workflow contract only. It does not claim that a live
ComfyUI run has produced a palette-legal SGDK sprite yet. That is the next
Phase 4 validation unit.

The workflow keeps the generator local-only:

- Generate with a dedicated Pixel Art Diffusion XL compatible checkpoint.
- Decode at a model-friendly size.
- Downscale to 32x32 with nearest-neighbor scaling.
- Quantize through Pixydust `Quantizer` to 16 colors.
- Save with a Drive16 filename prefix for later sprite validation.

After a live generation run, validate the output:

```sh
scripts/validate-generated-sprite.py <generated-png>
```
