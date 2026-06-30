# Phase 4 Live Generated-Assets Proof Wrapper

## Scope

This slice adds a one-command wrapper for the remaining live Phase 4 gate. The
wrapper now passes locally with the default SDXL Base checkpoint and Pixel Art
XL LoRA installed.

## Implemented Behavior

- Added `scripts/validate-phase4-live-generated-assets.sh`.
- The wrapper checks whether `COMFYUI_URL` is already reachable.
- If the local API is not reachable, the wrapper launches
  `scripts/launch-phase4-comfyui-api.sh` and waits for `/system_stats`.
- If the wrapper starts ComfyUI, it stops that process on exit.
- The wrapper runs `scripts/check-phase4-comfyui-readiness.py`.
- If readiness passes, it runs `scripts/run-comfyui-sprite-workflow.py`.
- If the live sprite run passes, it runs
  `scripts/validate-phase4-generated-assets-prompt.sh`.
- The wrapper respects `COMFYUI_URL`, `DRIVE16_COMFYUI_CHECKPOINT`, and
  `DRIVE16_COMFYUI_LORA`.
- Existing scripts still own the strict checks and validation-request exit
  codes.

## Verification

Shell syntax:

```sh
bash -n scripts/validate-phase4-live-generated-assets.sh
```

Result: passed.

Current not-ready behavior:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

Result:

- The wrapper printed the Step 0 API launch plus the three live proof steps.
- It launched local ComfyUI because the API was not already reachable.
- It stopped at Step 1 after readiness.
- `scripts/check-phase4-comfyui-readiness.py` exited `68` with the expected
  validation request because the selected compatible checkpoint was missing.
- The readiness report recorded `api.ok: true`, `workflowClasses.ok: true`,
  `pixydustQuantizer.ok: true`, and `checkpoint.ok: false`.
- After the wrapper exited, `http://127.0.0.1:8188/system_stats` was not
  reachable, confirming the wrapper stopped the process it launched.

Successful live proof:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check
scripts/validate-phase4-live-generated-assets.sh
```

Result:

- The installer placed `sd_xl_base_1.0.safetensors` and
  `pixel-art-xl.safetensors` in the local ComfyUI model folders.
- The wrapper launched local ComfyUI because the API was not already
  reachable.
- Readiness passed for API, checkpoint, LoRA, Pixydust Quantizer, and workflow
  classes.
- Live ComfyUI generated prompt id
  `66752e6a-a6bd-44ae-92f1-fe5e4fa893bc`.
- The runner wrote the SGDK-ready generated sprite at
  `artifacts/phase4/live-comfyui-sprite/66752e6a-a6bd-44ae-92f1-fe5e4fa893bc/drive16_genesis_sprite_00003_-sgdk.png`.
- The repaired PNG validated as 32x32, 16 palette slots, and 360 transparent
  pixels.
- `scripts/validate-phase4-generated-assets-prompt.sh` passed after Docker
  Desktop was started.
- The wrapper printed `Phase 4 live generated-assets proof ok`.

## Repro Command

After accepting the model licenses and making Docker Desktop available, run:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

Expected result: the wrapper launches local ComfyUI if needed, readiness
passes, the live sprite runner records `ok: true`, and the generated-assets ROM
proof builds and verifies the ROM through SGDK and Genteel.
