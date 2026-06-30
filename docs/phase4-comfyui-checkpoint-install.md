# Phase 4 ComfyUI Checkpoint Install Helper Evidence

## Scope

This slice adds an explicit helper for placing a user-provided Pixel Art
Diffusion XL compatible checkpoint into the local ComfyUI checkpoints folder.
It does not choose, download, or commit model weights automatically. The user
must provide a local file path or URL, and may provide a SHA-256 hash for
verification.
The follow-up source audit in
`docs/phase4-comfyui-checkpoint-source-audit.md` keeps this behavior explicit
because the likely Civitai Pixel Art Diffusion XL source currently has metadata
that conflicts with the architecture appendix's open CreativeML assumption.

Implemented behavior:

- Added `scripts/install-phase4-comfyui-checkpoint.sh`.
- The helper accepts `--source <path-or-url>`.
- The helper accepts `--checkpoint <name>` and respects
  `DRIVE16_COMFYUI_CHECKPOINT`.
- The helper writes to
  `COMFYUI_ROOT/models/checkpoints/<checkpoint-name>`.
- The helper accepts `--link` for local source files so large user-selected
  checkpoints can be symlinked instead of copied.
- The helper rejects path-like checkpoint names.
- The helper can verify an optional `--sha256 <hash>` before installing.
- The helper can run `scripts/check-phase4-comfyui-readiness.py` with `--check`.
- `scripts/setup-phase4-comfyui-prereqs.sh` now points to the helper when the
  checkpoint is missing.

## Verification

Shell syntax:

```sh
bash -n scripts/install-phase4-comfyui-checkpoint.sh scripts/setup-phase4-comfyui-prereqs.sh
```

Result: passed.

Fixture install with SHA-256 verification:

```sh
mkdir -p artifacts/phase4/checkpoint-install-test
printf 'drive16 checkpoint installer fixture\n' > artifacts/phase4/checkpoint-install-test/source.safetensors
HASH=$(shasum -a 256 artifacts/phase4/checkpoint-install-test/source.safetensors | awk '{print $1}')
COMFYUI_ROOT="$PWD/artifacts/phase4/checkpoint-install-test/comfyui" \
  scripts/install-phase4-comfyui-checkpoint.sh \
  --source artifacts/phase4/checkpoint-install-test/source.safetensors \
  --checkpoint test-pixel.safetensors \
  --sha256 "$HASH"
```

Result:

- Installed the fixture to
  `artifacts/phase4/checkpoint-install-test/comfyui/models/checkpoints/test-pixel.safetensors`.
- Verified SHA-256
  `2de2cfee082e137f29a01565a6f3c20f114a8f004dc6ad0313cc4ab5ab57a0bc`.

Wrong-hash rejection:

```sh
COMFYUI_ROOT="$PWD/artifacts/phase4/checkpoint-install-test/comfyui-bad" \
  scripts/install-phase4-comfyui-checkpoint.sh \
  --source artifacts/phase4/checkpoint-install-test/source.safetensors \
  --checkpoint test-pixel.safetensors \
  --sha256 0000000000000000000000000000000000000000000000000000000000000000
```

Result: exited `66` with `Checkpoint SHA-256 mismatch`.

Fixture symlink install with SHA-256 verification:

```sh
mkdir -p artifacts/phase4/checkpoint-install-link-test
printf 'drive16 checkpoint symlink fixture\n' > artifacts/phase4/checkpoint-install-link-test/source.safetensors
HASH_LINK=$(shasum -a 256 artifacts/phase4/checkpoint-install-link-test/source.safetensors | awk '{print $1}')
COMFYUI_ROOT="$PWD/artifacts/phase4/checkpoint-install-link-test/comfyui-link" \
  scripts/install-phase4-comfyui-checkpoint.sh \
  --source artifacts/phase4/checkpoint-install-link-test/source.safetensors \
  --checkpoint linked-pixel.safetensors \
  --sha256 "$HASH_LINK" \
  --link
```

Result:

- Installed a symlink at
  `artifacts/phase4/checkpoint-install-link-test/comfyui-link/models/checkpoints/linked-pixel.safetensors`.
- The symlink points to the explicit local source fixture.
- Verified the same SHA-256 before accepting the linked checkpoint.

URL link rejection:

```sh
scripts/install-phase4-comfyui-checkpoint.sh \
  --source https://example.invalid/model.safetensors \
  --checkpoint linked-pixel.safetensors \
  --link
```

Result: exited `64` with `--link requires a local source file, not a URL`.

Current real readiness:

```sh
scripts/check-phase4-comfyui-readiness.py
```

Result: exits `68`. The local ComfyUI API is not reachable on
`127.0.0.1:8188`, the default checkpoint is not present in the checked model
paths, and workflow classes cannot be inspected without the API.

## Validation Request

Install a compatible checkpoint from an explicit source:

```sh
scripts/install-phase4-comfyui-checkpoint.sh \
  --source /path-or-url/to/compatible-checkpoint.safetensors \
  --checkpoint pixel-art-diffusion-xl.safetensors \
  --sha256 <optional-known-hash> \
  --check
```

For an already downloaded local model where you do not want another multi-GB
copy, add `--link`.

Then start local ComfyUI and run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```
