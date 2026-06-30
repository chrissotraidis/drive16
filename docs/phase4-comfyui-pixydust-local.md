# Phase 4 Local Pixydust Prerequisite Evidence

## Scope

This slice uses the committed setup helper to install the Pixydust Quantizer
custom node into the local ComfyUI folder. It does not download the Pixel Art
Diffusion XL checkpoint and does not claim live sprite generation is ready.

## Local Install

The setup helper was run with install and check enabled:

```sh
scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust --check
```

Result: the helper cloned Pixydust Quantizer into:

```text
/Users/chrissotraidis/Documents/ComfyUI/custom_nodes/ComfyUI-PixydustQuantizer
```

The installed custom node is pinned to:

```text
6ffbb1ca23637f61559c3bd13f7be2b37d1dae03
```

The installed worktree is clean:

```sh
git -C /Users/chrissotraidis/Documents/ComfyUI/custom_nodes/ComfyUI-PixydustQuantizer status --short
```

Result: no output.

## Readiness Result

The readiness check was rerun:

```sh
scripts/check-phase4-comfyui-readiness.py
```

Result: exited `68`, but the report now records `pixydustQuantizer.ok: true`.
The remaining missing prerequisites are:

- local ComfyUI API on `http://127.0.0.1:8188`
- Pixel Art Diffusion XL compatible checkpoint at
  `~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors`
- workflow class inspection, which needs the ComfyUI API to be reachable

## Regression Checks

The following checks passed:

- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py
  scripts/run-comfyui-sprite-workflow.py scripts/validate-comfyui-workflow.py`
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  reported 20 passed and 4 ignored.
- `npm run build` in `app/`

The combined generated-assets harness was rerun:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: focused tests passed, then the live generated-assets proof exited `66`
with the expected validation request because no live ComfyUI sprite output has
completed successfully.

## Validation Request

Place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

Start ComfyUI on `http://127.0.0.1:8188`, then run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```
