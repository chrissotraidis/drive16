# Phase 4 Generated Assets Validation Harness Evidence

## Scope

This slice adds the proof command for the remaining generated-assets prompt
path. It does not claim Phase 4 is complete, because live ComfyUI sprite output
is still required to produce the final evidence.

The new validation script runs the focused Phase 4 prompt tests, then runs an
ignored native test that requests both generated assets:

- live validated ComfyUI sprite
- generated MML music compiled to VGM
- SGDK ROM build
- Genteel neutral screenshot
- Genteel Right-input screenshot
- sprite movement proof
- non-silent audio proof

## Implemented Behavior

- Added ignored native test
  `phase4_generated_assets_prompt_runs_when_tools_are_available`.
- Added `scripts/validate-phase4-generated-assets-prompt.sh`.
- The script exits with clear validation requests for three expected gates:
  missing live ComfyUI sprite output, generated sprite validator rejection, and
  Docker Desktop not running.
- The missing-live-sprite validation request now points to the current
  checkpoint-aware readiness sequence:
  `scripts/launch-phase4-comfyui-api.sh`,
  `scripts/check-phase4-comfyui-readiness.py`, and the optional
  `DRIVE16_COMFYUI_CHECKPOINT` override.
- Documented the script in `scripts/README.md`.

## Local Verification

The combined validation command was run:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: the focused tests passed, then the ignored generated-assets proof
stopped at the live ComfyUI sprite gate because local ComfyUI was not
reachable.

The existing generated-music validation command was also rerun:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Result: the focused tests passed, then the ignored generated-MML proof passed.
Docker Desktop was running, SGDK built the generated project, Genteel captured
the verification screenshots, sprite movement passed, and generated audio was
non-silent.

The combined validation command was rerun after the generated-MML proof passed:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: it still stopped at the live ComfyUI sprite gate because
`artifacts/phase4/live-comfyui-sprite/last-run.json` does not record a
successful live generated sprite.

The harness was rerun after refreshing the validation request:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: exit `66`. The focused tests passed, with 5 passed and 2 ignored. The
ignored generated-assets proof stopped at the live ComfyUI sprite gate and
printed the checkpoint-aware sequence: default checkpoint path, optional
`DRIVE16_COMFYUI_CHECKPOINT`, `scripts/launch-phase4-comfyui-api.sh`,
`scripts/check-phase4-comfyui-readiness.py`, and
`scripts/run-comfyui-sprite-workflow.py`.

## Validation Request

Place a Pixel Art Diffusion XL compatible checkpoint at the default path:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the compatible checkpoint uses a different local filename, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Start local ComfyUI:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, confirm readiness and run the live sprite generator:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

Then run the combined generated-assets proof:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Expected result: the ignored native test builds the generated-assets SGDK
project, runs it in Genteel, captures neutral and Right-input screenshots,
proves Right-input sprite movement, and verifies non-silent generated music.
