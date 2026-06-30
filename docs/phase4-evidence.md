# Phase 4 Evidence Packet

## Exit Criterion

From a prompt, the agent can optionally generate a palette-legal sprite and a
short MML track in place of bundled assets, and still builds a working ROM.

## Current Status

Phase 4 exit evidence is complete and ready for human sign-off. The default
SDXL Base checkpoint plus Pixel Art XL LoRA were installed locally after human
license acceptance. The live proof wrapper launched ComfyUI, generated a
sprite, repaired the dominant generated background into SGDK palette-index-0
transparency, validated the PNG, built the generated-sprite plus generated-MML
ROM, ran it in Genteel, and passed the generated-assets proof.

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
| Real combined generated-assets proof passes with live ComfyUI output | `docs/phase4-generated-assets-validation.md`, `docs/phase4-live-generated-assets-proof.md` |

## Live Gate Evidence

The live gate was run successfully on 2026-06-30:

- `scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check`
  installed the local model files:
  `~/Documents/ComfyUI/models/checkpoints/sd_xl_base_1.0.safetensors` and
  `~/Documents/ComfyUI/models/loras/pixel-art-xl.safetensors`.
- `scripts/validate-phase4-live-generated-assets.sh` passed end to end.
- The wrapper launched local ComfyUI because the API was not already running.
- Readiness passed with API, checkpoint, LoRA, Pixydust Quantizer, and
  workflow classes ready.
- The live sprite run recorded prompt id
  `66752e6a-a6bd-44ae-92f1-fe5e4fa893bc`.
- Raw ComfyUI output had no transparent pixels, so the runner wrote an
  SGDK-ready repaired PNG:
  `artifacts/phase4/live-comfyui-sprite/66752e6a-a6bd-44ae-92f1-fe5e4fa893bc/drive16_genesis_sprite_00003_-sgdk.png`.
- The repaired PNG validated as 32x32, 16 palette slots, and 360 transparent
  pixels.
- The generated-assets native proof passed, including generated sprite,
  generated MML music, SGDK build, Genteel run, movement proof, and non-silent
  audio proof.
- The wrapper printed `Phase 4 live generated-assets proof ok`.

## Repro Command

On a machine with the model licenses accepted and Docker Desktop available:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check
scripts/validate-phase4-live-generated-assets.sh
```

## Phase Gate

Phase 4 is at the human sign-off gate. Do not begin Phase 5 until the human
approves this evidence.
