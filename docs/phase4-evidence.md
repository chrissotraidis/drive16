# Phase 4 Evidence Packet

## Exit Criterion

From a prompt, the agent can optionally generate a palette-legal sprite and a
short MML track in place of bundled assets, and still builds a working ROM.

## Current Status

Phase 4 is not complete. All app, script, wrapper, validator, prompt-path, and
fixture proofs are in place, but the real live ComfyUI sprite gate remains
open until a compatible Pixel Art Diffusion XL checkpoint is installed and
local ComfyUI produces a PNG that passes the generated-sprite validator.

## Completed Evidence

| Requirement | Evidence |
| --- | --- |
| Enhancements are default-off and CORE remains independent | `docs/phase4-enhancement-toggles.md` |
| ComfyUI endpoint settings and readiness rows exist behind `AI sprites` | `docs/phase4-comfyui-endpoint.md`, `docs/phase4-comfyui-readiness.md` |
| `comfyui-mcp` wrapper exists as a separate optional process | `docs/phase4-comfyui-mcp.md` |
| Tuned Genesis sprite ComfyUI workflow is committed | `docs/phase4-comfyui-workflow.md` |
| Generated sprite PNG validator enforces 32x32, 4x4 tiles, transparency, and palette slots | `docs/phase4-generated-sprite-validator.md` |
| Validator-accepted generated sprite can be consumed by SGDK `rescomp` | `docs/phase4-generated-sprite-sgdk-resource.md` |
| Live ComfyUI sprite runner exists and validates downloaded PNGs | `docs/phase4-live-comfyui-runner.md` |
| Pixydust Quantizer prerequisite can be installed and detected | `docs/phase4-comfyui-pixydust-local.md` |
| ComfyUI API launch path exists | `docs/phase4-comfyui-api-launch.md` |
| Checkpoint override and install helper exist for local filenames and user-provided sources | `docs/phase4-comfyui-checkpoint-override.md`, `docs/phase4-comfyui-checkpoint-install.md` |
| ctrmml MML music MCP wrapper exists | `docs/phase4-mml-music-mcp.md` |
| FM preset library is committed | `docs/phase4-mml-presets.md` |
| MML reference is in the RAG corpus | `docs/phase4-mml-rag-corpus.md` |
| Generated-MML prompt path builds and verifies a ROM | `docs/phase4-generated-music-prompt.md` |
| App prompt path gates generated sprites on a successful live ComfyUI PNG | `docs/phase4-generated-sprite-prompt-gate.md` |
| Combined generated-sprite plus generated-MML prompt path is wired | `docs/phase4-generated-assets-fixture-prompt.md` |
| Real combined generated-assets proof script exists and stops at honest live gates | `docs/phase4-generated-assets-validation.md` |

## Open Gate

The remaining live gate is the real ComfyUI sprite output:

- `scripts/check-phase4-comfyui-readiness.py` exits `68` because the local
  ComfyUI API is not reachable on `127.0.0.1:8188`, the default checkpoint is
  not present in the checked model paths, and workflow classes cannot be
  inspected without the API.
- `scripts/validate-phase4-generated-assets-prompt.sh` exits `66` because
  `artifacts/phase4/live-comfyui-sprite/last-run.json` does not record a
  successful live sprite run.

## Validation Request

Install a compatible checkpoint from an explicit source:

```sh
scripts/install-phase4-comfyui-checkpoint.sh \
  --source /path-or-url/to/compatible-checkpoint.safetensors \
  --checkpoint pixel-art-diffusion-xl.safetensors \
  --sha256 <optional-known-hash> \
  --check
```

Start local ComfyUI:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Expected result: readiness records `ok: true`, the live sprite run records
`ok: true` with a downloaded PNG that passes
`scripts/validate-generated-sprite.py`, and the generated-assets prompt proof
builds a ROM, runs it in Genteel, captures neutral and Right-input
screenshots, proves Right-input sprite movement, and verifies non-silent
generated audio.

## Phase Gate

Do not mark Phase 4 complete until the validation request above passes with
real live ComfyUI output.
