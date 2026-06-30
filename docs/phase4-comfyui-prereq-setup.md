# Phase 4 ComfyUI Prerequisite Setup Evidence

## Scope

This slice adds a dry-run-first setup helper for the remaining live ComfyUI
sprite gate. It does not download a model checkpoint or claim that live sprite
generation is ready.

The helper covers the two local prerequisites identified by the readiness
check:

- Pixydust Quantizer custom node
- Pixel Art Diffusion XL compatible checkpoint

## Implemented Behavior

- Added `scripts/setup-phase4-comfyui-prereqs.sh`.
- The script is dry-run by default.
- `--install-pixydust` clones
  `https://github.com/sousakujikken/ComfyUI-PixydustQuantizer.git` into
  `~/Documents/ComfyUI/custom_nodes/ComfyUI-PixydustQuantizer`.
- The Pixydust install is pinned to commit
  `6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`.
- Existing Pixydust directories are left untouched.
- The script prints the required checkpoint path:
  `~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors`.
- When the checkpoint is missing, the script points to
  `scripts/install-phase4-comfyui-checkpoint.sh --source ... --checkpoint ... --check`
  for placing an explicit user-provided compatible checkpoint.
- `--check` can run `scripts/check-phase4-comfyui-readiness.py` afterward.

## Local Verification

The helper was syntax-checked:

```sh
bash -n scripts/setup-phase4-comfyui-prereqs.sh
```

The dry run was executed:

```sh
scripts/setup-phase4-comfyui-prereqs.sh
```

Result: the script reported the existing ComfyUI root, found the Pixydust
directory, and kept the checkpoint as an explicit validation request with the
checkpoint install helper command.

The readiness check was rerun:

```sh
scripts/check-phase4-comfyui-readiness.py
```

Result: exited `68` because the local ComfyUI API was not reachable, the
checkpoint was missing, and the Pixydust Quantizer custom node was missing.

The upstream Pixydust commit was resolved with:

```sh
git ls-remote https://github.com/sousakujikken/ComfyUI-PixydustQuantizer.git HEAD
```

Result: `6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`.

Regression checks passed:

- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py`
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  reported 20 passed and 4 ignored.
- `npm run build` in `app/`
- Secret scan
- Markdown punctuation and emoji guard
- Ignored-artifact checks
- `git diff --check`

## Validation Request

Prepare local ComfyUI:

```sh
scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust --check
```

Place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

Or install a user-provided compatible checkpoint with:

```sh
scripts/install-phase4-comfyui-checkpoint.sh --source /path-or-url/to/checkpoint.safetensors --checkpoint pixel-art-diffusion-xl.safetensors --check
```

Then start ComfyUI on `http://127.0.0.1:8188` and run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```
