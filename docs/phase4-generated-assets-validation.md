# Phase 4 Generated Assets Validation Harness Evidence

## Scope

This slice adds the proof command for the generated-assets prompt path. The
real live-gated proof now passes after live ComfyUI sprite output is available
and Docker Desktop is running.

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
  `DRIVE16_COMFYUI_CHECKPOINT` and `DRIVE16_COMFYUI_LORA` overrides.
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

A fixture-only combined prompt proof was added and run:

```sh
scripts/validate-phase4-generated-assets-fixture-prompt.sh
```

Result: the script temporarily supplied a validator-accepted synthetic
generated sprite PNG to the live-run contract, ran the same ignored combined
generated-assets prompt proof, and restored the prior live-run record
afterward. The generated project referenced both
`SPRITE drive16_player "../../../../../artifacts/phase4/generated-assets-fixture/generated-sprite.png" 4 4 NONE 0`
and `XGM drive16_generated_music "generated_music.vgm"`. The ignored proof
passed, building a ROM, running Genteel, validating Right-input sprite
movement, and verifying non-silent generated audio.

The real live-gated proof was rerun immediately afterward:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: exit `66`, still gated on live ComfyUI sprite output. This confirms
the fixture proof did not mask the remaining live checkpoint and ComfyUI gate.

The real live-gated proof was rerun after installing SDXL Base plus Pixel Art
XL LoRA and generating a validated live sprite:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: passed. The focused tests passed, then the ignored generated-assets
proof built the generated-assets SGDK project, ran it in Genteel, captured
neutral and Right-input screenshots, proved Right-input sprite movement, and
verified non-silent generated music.

The full wrapper was then rerun:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

Result: passed end to end and printed `Phase 4 live generated-assets proof ok`.

## Repro Command

```sh
scripts/validate-phase4-live-generated-assets.sh
```
