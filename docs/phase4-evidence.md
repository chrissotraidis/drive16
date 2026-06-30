# Phase 4 Evidence Packet

## Exit Criterion

From a prompt, the agent can optionally generate a palette-legal sprite and a
short MML track in place of bundled assets, and still builds a working ROM.

## Current Status

Phase 4 is not complete. All app, script, wrapper, validator, prompt-path, and
fixture proofs are in place, but the real live ComfyUI sprite gate remains
open until the default SDXL Base checkpoint plus Pixel Art XL LoRA are
installed and local ComfyUI produces a PNG that passes the generated-sprite
validator.

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
| ComfyUI API launch and smoke path exists | `docs/phase4-comfyui-api-launch.md`, `docs/phase4-comfyui-api-smoke.md` |
| Checkpoint override and install helper exist for local filenames and user-provided sources | `docs/phase4-comfyui-checkpoint-override.md`, `docs/phase4-comfyui-checkpoint-install.md` |
| Pixel Art Diffusion XL source metadata was audited without auto-downloading weights | `docs/phase4-comfyui-checkpoint-source-audit.md` |
| Default ComfyUI model pair selected with explicit installer | `docs/phase4-comfyui-model-selection.md` |
| ctrmml MML music MCP wrapper exists | `docs/phase4-mml-music-mcp.md` |
| FM preset library is committed | `docs/phase4-mml-presets.md` |
| MML reference is in the RAG corpus | `docs/phase4-mml-rag-corpus.md` |
| Generated-MML prompt path builds and verifies a ROM | `docs/phase4-generated-music-prompt.md` |
| App prompt path gates generated sprites on a successful live ComfyUI PNG | `docs/phase4-generated-sprite-prompt-gate.md` |
| Combined generated-sprite plus generated-MML prompt path is wired | `docs/phase4-generated-assets-fixture-prompt.md` |
| Real combined generated-assets proof scripts exist and stop at honest live gates | `docs/phase4-generated-assets-validation.md`, `docs/phase4-live-generated-assets-proof.md` |

## Open Gate

The remaining live gate is the real ComfyUI sprite output:

- `scripts/validate-phase4-comfyui-api-smoke.sh` passes and records
  `apiOk: true`, `workflowClassesOk: true`, and `pixydustOk: true`, while
  keeping model-file readiness separate. The smoke was rerun on 2026-06-30 and
  confirmed the API, workflow classes, and Pixydust are ready in the current
  local setup.
- `scripts/validate-phase4-live-generated-assets.sh` now launches local
  ComfyUI if the API is not already reachable, reaches readiness with
  `api.ok: true`, `workflowClasses.ok: true`, and `pixydustQuantizer.ok: true`,
  then exits `68` until the SDXL checkpoint and Pixel Art XL LoRA are present.
- `scripts/validate-phase4-generated-assets-prompt.sh` exits `66` because
  `artifacts/phase4/live-comfyui-sprite/last-run.json` does not record a
  successful live sprite run.
- `docs/phase4-comfyui-checkpoint-source-audit.md` records that the likely
  Civitai Pixel Art Diffusion XL source currently has metadata that conflicts
  with the architecture appendix's open CreativeML assumption, so Drive16 must
  keep the checkpoint source user-selected.
- `docs/phase4-comfyui-model-selection.md` records the replacement default:
  Stability AI SDXL Base plus `nerijs/pixel-art-xl` LoRA from Hugging Face,
  with explicit model-license acceptance before download.

## Validation Request

Install the default local ComfyUI model pair after reviewing the upstream
model licenses:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check
```

Do not redistribute or commit the model weights. For custom local files, set
`DRIVE16_COMFYUI_CHECKPOINT` and `DRIVE16_COMFYUI_LORA`.

Then run the live gate sequence:

```sh
scripts/validate-phase4-live-generated-assets.sh
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
