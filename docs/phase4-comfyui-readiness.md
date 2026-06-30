# Phase 4 ComfyUI Readiness Evidence

## Scope

This slice adds a readiness check for the remaining live ComfyUI sprite gate.
It does not claim that a generated sprite exists. It makes the local
prerequisites explicit before running the live sprite workflow.

The readiness check verifies:

- local ComfyUI API is reachable at `127.0.0.1:8188`
- committed workflow classes are present in ComfyUI `/object_info`
- `pixel-art-diffusion-xl.safetensors` is available to
  `CheckpointLoaderSimple`
- Pixydust `Quantizer` is available as a ComfyUI node
- optional `DRIVE16_COMFYUI_CHECKPOINT` or `--checkpoint` override when a
  compatible local checkpoint uses a different filename

It also falls back to filesystem checks under `~/Documents/ComfyUI` when the
API is not reachable.

## Implemented Behavior

- Added `scripts/check-phase4-comfyui-readiness.py`.
- The script writes
  `artifacts/phase4/comfyui-readiness/latest.json`.
- The script exits `68` with a validation request when the API, checkpoint, or
  Pixydust node is missing.
- The script records the selected checkpoint name, the manifest default, and
  whether a runtime override is active.
- Documented the script in `scripts/README.md`.
- The app's native `check_comfyui_endpoint` command now mirrors the same
  readiness concepts in the settings drawer: API, checkpoint, Pixydust, and
  workflow classes.

## Local Verification

The readiness check was run:

```sh
scripts/check-phase4-comfyui-readiness.py
```

Result: exit `68`, with a validation request. The local ComfyUI API was not
reachable, no `pixel-art-diffusion-xl.safetensors` checkpoint was found under
`~/Documents/ComfyUI/models/checkpoints`, and no Pixydust Quantizer custom node
was found under `~/Documents/ComfyUI/custom_nodes`.

The generated-MML proof remains passed from the previous iteration. The
combined generated-assets proof remains gated only on live ComfyUI sprite
output.

The app-side readiness command was verified with focused native tests:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture
```

Result: 11 passed.

The frontend production build was rerun:

```sh
npm run build
```

Result: passed.

## Validation Request

Install or start local ComfyUI so this passes:

```sh
scripts/check-phase4-comfyui-readiness.py
```

If the compatible checkpoint has a different local filename, run:

```sh
DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors scripts/check-phase4-comfyui-readiness.py
```

Expected result: the readiness report records `ok: true`.

Then run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```
