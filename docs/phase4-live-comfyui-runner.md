# Phase 4 Live ComfyUI Runner Evidence

## Scope

This slice adds the live runner for generated sprite validation. It does not
claim that live generation passed in this environment, because local ComfyUI was
not running on `http://127.0.0.1:8188`.

Implemented behavior:

- Added `scripts/run-comfyui-sprite-workflow.py`.
- Hardened `scripts/comfyui-mcp.sh` so `COMFYUI_MCP_AUTOUPDATE` defaults to
  `0` and ignored artifacts are reinstalled if they drift from the pinned
  `comfyui-mcp` version.
- The runner calls `get_system_stats` through the `drive16-comfyui` MCP wrapper
  before generation.
- It enqueues `drive16-genesis-sprite.workflow.json` through
  `enqueue_workflow`.
- It polls ComfyUI history, downloads the first PNG output from `/view`, and
  runs `scripts/validate-generated-sprite.py` on that PNG.
- It writes ignored run records under
  `artifacts/phase4/live-comfyui-sprite/`.
- It accepts `DRIVE16_COMFYUI_CHECKPOINT` or `--checkpoint` to use a
  compatible local checkpoint filename without editing the committed workflow
  JSON.

## Verification

Offline behavior:

```sh
scripts/run-comfyui-sprite-workflow.py
```

Result:

- The runner printed a `VALIDATION REQUEST` because local ComfyUI was not
  available on `http://127.0.0.1:8188`.
- Validation request artifact:
  `artifacts/phase4/live-comfyui-sprite/last-run.json`.

Wrapper determinism:

```sh
scripts/validate-comfyui-mcp-wrapper.py
```

Result:

- The wrapper initialized successfully after enforcing the pinned package
  version and disabling auto-update by default.

Generated sprite validator:

```sh
scripts/validate-generated-sprite.py --self-test
```

Result:

- The validator still accepted the synthetic valid sprite and rejected the
  over-palette fixture.

## Validation Request

Run this when local ComfyUI is available with the Pixel Art Diffusion XL
checkpoint and Pixydust Quantizer custom node installed:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

If the compatible checkpoint has a different local filename, set:

```sh
DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Expected result:

- The command enqueues through `drive16-comfyui`.
- It downloads a generated PNG under
  `artifacts/phase4/live-comfyui-sprite/`.
- `scripts/validate-generated-sprite.py` prints `Generated sprite ok`.

Paste the command output back into the worklog before marking the generated
sprite checklist item complete.
