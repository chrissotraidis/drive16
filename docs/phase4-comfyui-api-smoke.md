# Phase 4 ComfyUI API Smoke Evidence

## Scope

This slice adds a repeatable smoke test for the local ComfyUI API. The smoke
test starts ComfyUI only when it is not already reachable, runs the Phase 4
readiness check, records whether the API, workflow classes, and Pixydust are
available, then stops the ComfyUI process that it started.

It does not require or fake the Pixel Art Diffusion XL compatible checkpoint.

## Implemented Behavior

- Added `scripts/validate-phase4-comfyui-api-smoke.sh`.
- The script uses `scripts/launch-phase4-comfyui-api.sh` when
  `http://127.0.0.1:8188/system_stats` is not already reachable.
- It writes ignored logs under `artifacts/phase4/comfyui-api-smoke/`.
- It runs `scripts/check-phase4-comfyui-readiness.py` while the API is live.
- It requires:
  - ComfyUI API reachable
  - committed workflow classes present in `/object_info`
  - Pixydust `Quantizer` present
- It allows the checkpoint check to remain false, and prints the checkpoint
  validation request when that is the only remaining prerequisite.

## Verification

ComfyUI API smoke:

```sh
scripts/validate-phase4-comfyui-api-smoke.sh
```

Result:

- The script started ComfyUI from the pinned source checkout.
- The readiness report recorded `api.ok: true`.
- The readiness report recorded `workflowClasses.ok: true` with all required
  classes present: `CLIPTextEncode`, `CheckpointLoaderSimple`,
  `EmptyLatentImage`, `ImageScale`, `KSampler`, `Quantizer`, `SaveImage`, and
  `VAEDecode`.
- The readiness report recorded `pixydustQuantizer.ok: true`.
- The readiness report recorded `checkpoint.ok: false`.
- Smoke report:
  `artifacts/phase4/comfyui-api-smoke/latest.json`.
- Launch log:
  `artifacts/phase4/comfyui-api-smoke/comfyui-launch.log`.
- After the smoke test, `http://127.0.0.1:8188/system_stats` was no longer
  reachable, confirming the script stopped the process it launched.

Current refresh on 2026-06-30:

- `scripts/validate-phase4-comfyui-api-smoke.sh` exited `0`.
- `artifacts/phase4/comfyui-api-smoke/latest.json` recorded `ok: true`,
  `apiOk: true`, `workflowClassesOk: true`, `pixydustOk: true`, and
  `checkpointOk: false`.
- `artifacts/phase4/comfyui-readiness/latest.json` recorded `api.ok: true`,
  `workflowClasses.ok: true`, and `pixydustQuantizer.ok: true`.
- The only remaining readiness miss was the selected compatible checkpoint,
  `pixel-art-diffusion-xl.safetensors`.

## Remaining Gate

Install the compatible checkpoint, then run the full live generated-assets
proof:

```sh
scripts/install-phase4-comfyui-checkpoint.sh \
  --source /path-or-url/to/compatible-checkpoint.safetensors \
  --checkpoint pixel-art-diffusion-xl.safetensors \
  --sha256 <optional-known-hash> \
  --check
```

The wrapper will start by checking readiness:

```sh
scripts/validate-phase4-live-generated-assets.sh
```
