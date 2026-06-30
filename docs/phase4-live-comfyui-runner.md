# Phase 4 Live ComfyUI Runner Evidence

## Scope

This slice adds the live runner for generated sprite validation. It now passes
in the local Phase 4 setup after the SDXL Base checkpoint and Pixel Art XL LoRA
are installed.

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
- If the raw generated PNG has no transparent pixels, the runner asks the
  validator to write an SGDK-ready indexed PNG that treats the dominant edge
  color as transparent palette index 0, then validates that repaired PNG.
- It writes ignored run records under
  `artifacts/phase4/live-comfyui-sprite/`.
- It accepts `DRIVE16_COMFYUI_CHECKPOINT` or `--checkpoint` to use a
  compatible local checkpoint filename without editing the committed workflow
  JSON.
- It runs `scripts/check-phase4-comfyui-readiness.py` before enqueueing so
  missing API, checkpoint, Pixydust, or workflow-class prerequisites produce a
  checkpoint-aware validation request instead of a failed generation attempt.

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

After the readiness preflight was added, the offline behavior was rerun:

```sh
scripts/run-comfyui-sprite-workflow.py
```

Result:

- The runner exited `2` with a `VALIDATION REQUEST`.
- It did not enqueue the ComfyUI workflow.
- The output included the Phase 4 readiness report and nearby checkpoint hints.
- `artifacts/phase4/live-comfyui-sprite/last-run.json` recorded `ok: false`,
  readiness exit code `68`, readiness report
  `artifacts/phase4/comfyui-readiness/latest.json`, and the readiness stdout
  with nearby checkpoint hints.

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

Live SDXL Base plus Pixel Art XL LoRA run:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

Result:

- The wrapper launched local ComfyUI.
- Readiness passed for API, checkpoint, LoRA, Pixydust Quantizer, and workflow
  classes.
- The runner generated prompt id
  `66752e6a-a6bd-44ae-92f1-fe5e4fa893bc`.
- Raw output had no transparent pixels, so the runner repaired the background
  into indexed palette transparency.
- The SGDK-ready PNG validated as 32x32, 16 palette slots, and 360 transparent
  pixels:
  `artifacts/phase4/live-comfyui-sprite/66752e6a-a6bd-44ae-92f1-fe5e4fa893bc/drive16_genesis_sprite_00003_-sgdk.png`.

## Repro Command

Run this when local ComfyUI dependencies and Docker Desktop are available:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

Expected result: the live sprite runner records `ok: true`, and the wrapper
continues into the generated-assets ROM proof.
