# Phase 4 ComfyUI API Launch Evidence

## Scope

This slice adds a repeatable Drive16 launcher for the local ComfyUI API. It
does not download model weights and does not claim live sprite generation is
complete.

The launcher avoids depending on Comfy Desktop bundle internals. Comfy Desktop
had previously left a stale extra-models path pointing at
`/Applications/ComfyUI.app`, which no longer exists on this machine.

## Implemented Behavior

- Added `scripts/launch-phase4-comfyui-api.sh`.
- The launcher fetches ComfyUI source into ignored `artifacts/` storage.
- The source is pinned to
  `785141051163612f0e471a242c1f33341f60b9bd`.
- The launcher uses `~/Documents/ComfyUI` as the local data folder by default.
- The launcher serves `http://127.0.0.1:8188` by default, matching Drive16's
  Phase 4 readiness and live-runner scripts.
- When `COMFYUI_EXTRA_MODELS_CONFIG` is unset, the launcher writes a clean
  Drive16 extra-models config under ignored artifacts so stale Desktop paths do
  not break startup.
- The launcher passes an explicit SQLite database URL under
  `~/Documents/ComfyUI/user/comfyui.db`, matching the local ComfyUI data
  folder.
- `--prepare-only` fetches and verifies source without launching.
- `--install-requirements` installs ComfyUI Python requirements into the
  selected local ComfyUI Python environment.
- `scripts/setup-phase4-comfyui-prereqs.sh` now also supports
  `--install-pixydust-requirements`.

## Local Verification

The launcher was syntax-checked:

```sh
bash -n scripts/launch-phase4-comfyui-api.sh
```

The pinned source was prepared:

```sh
scripts/launch-phase4-comfyui-api.sh --prepare-only
```

Result: source was cloned into:

```text
artifacts/phase4/comfyui-api/src-785141051163612f0e471a242c1f33341f60b9bd
```

The ComfyUI requirements were aligned with the pinned source:

```sh
scripts/launch-phase4-comfyui-api.sh --install-requirements --prepare-only
```

The Pixydust custom node requirements were installed:

```sh
scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust-requirements --check
```

The API launch was probed by starting the launcher, reading
`/system_stats`, running readiness while the server was live, then stopping
the server.

Result: `http://127.0.0.1:8188/system_stats` returned ComfyUI system stats.
The live readiness report recorded:

- `api.ok: true`
- `pixydustQuantizer.ok: true`
- `workflowClasses.ok: true`
- `checkpoint.ok: false`

The remaining missing prerequisite is the Pixel Art Diffusion XL compatible
checkpoint.

If the compatible checkpoint has a different filename, set
`DRIVE16_COMFYUI_CHECKPOINT` before running readiness and the live workflow.

A later launcher probe also confirmed the explicit database URL removes the
previous database initialization warning while still serving the API.

The repeatable API smoke command was added and run:

```sh
scripts/validate-phase4-comfyui-api-smoke.sh
```

Result: the script started ComfyUI, ran the readiness check while the API was
live, confirmed API, workflow classes, and Pixydust Quantizer, then stopped
the ComfyUI process it launched. The remaining readiness miss was the
compatible checkpoint.

## Validation Request

Place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

Or set a compatible local checkpoint filename explicitly:

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
