# Phase 4 Live Generated-Assets Proof Wrapper

## Scope

This slice adds a one-command wrapper for the remaining live Phase 4 gate. It
does not claim Phase 4 is complete. It runs the existing strict proof steps in
order so the final checkpoint-to-ROM path is repeatable after the compatible
checkpoint is installed.

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
- The wrapper respects `COMFYUI_URL` and `DRIVE16_COMFYUI_CHECKPOINT`.
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

## Validation Request

After installing or linking a compatible checkpoint, run:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

Expected result: the wrapper launches local ComfyUI if needed, readiness
passes, the live sprite runner records `ok: true` with a PNG accepted by
`scripts/validate-generated-sprite.py`, and the generated-assets ROM proof
builds and verifies the ROM through SGDK and Genteel.
