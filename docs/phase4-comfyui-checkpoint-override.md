# Phase 4 ComfyUI Checkpoint Override Evidence

## Scope

This slice makes the remaining Phase 4 checkpoint gate explicit but less
brittle. The committed workflow still defaults to
`pixel-art-diffusion-xl.safetensors`, but the readiness check, prerequisite
helper, and live ComfyUI runner can now use a compatible checkpoint with a
different local filename.

No model weights are downloaded or committed.

## Implemented Behavior

- `scripts/check-phase4-comfyui-readiness.py` accepts
  `--checkpoint <name>` or `DRIVE16_COMFYUI_CHECKPOINT=<name>`.
- Readiness reports the selected checkpoint name, the manifest default, and
  whether an override is active.
- `scripts/run-comfyui-sprite-workflow.py` accepts
  `--checkpoint <name>` or `DRIVE16_COMFYUI_CHECKPOINT=<name>`.
- The live runner rewrites the `CheckpointLoaderSimple.ckpt_name` input in
  memory before enqueueing the workflow. The committed workflow JSON remains
  unchanged.
- `scripts/setup-phase4-comfyui-prereqs.sh` accepts `--checkpoint <name>` and
  `DRIVE16_COMFYUI_CHECKPOINT=<name>` so validation requests print the selected
  checkpoint path.

## Local Verification

The changed scripts were syntax-checked:

```sh
bash -n scripts/setup-phase4-comfyui-prereqs.sh scripts/launch-phase4-comfyui-api.sh
python3 -m py_compile scripts/check-phase4-comfyui-readiness.py scripts/run-comfyui-sprite-workflow.py scripts/validate-comfyui-workflow.py
```

The prerequisite helper was run with an alternate checkpoint name:

```sh
scripts/setup-phase4-comfyui-prereqs.sh --checkpoint alternate-pixel.safetensors --check
```

Result: it printed the selected checkpoint path under
`~/Documents/ComfyUI/models/checkpoints/alternate-pixel.safetensors` and
exited `68` because the checkpoint is not present.

The readiness check was run with the same override:

```sh
DRIVE16_COMFYUI_CHECKPOINT=alternate-pixel.safetensors scripts/check-phase4-comfyui-readiness.py
```

Result: the readiness report recorded `checkpoint.name:
alternate-pixel.safetensors`, `checkpoint.manifestName:
pixel-art-diffusion-xl.safetensors`, and `checkpoint.override: true`.

The live runner was run against an intentionally closed local port:

```sh
COMFYUI_URL=http://127.0.0.1:65535 DRIVE16_COMFYUI_CHECKPOINT=alternate-pixel.safetensors scripts/run-comfyui-sprite-workflow.py
```

Result: it wrote an ignored validation request whose command preserved the
selected checkpoint override.

## Validation Request

Place a Pixel Art Diffusion XL compatible checkpoint at either the default
path:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

or use a compatible local filename explicitly:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```
