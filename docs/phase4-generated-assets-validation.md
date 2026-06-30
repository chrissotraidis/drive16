# Phase 4 Generated Assets Validation Harness Evidence

## Scope

This slice adds the proof command for the remaining generated-assets prompt
path. It does not claim Phase 4 is complete, because local ComfyUI and Docker
Desktop are still required to produce the final evidence.

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

Result: the focused tests passed, then the ignored generated-MML proof stopped
at the Docker Desktop gate because the Docker daemon was not reachable.

## Validation Request

Run the live sprite generator first:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

Then run the combined generated-assets proof:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Expected result: the ignored native test builds the generated-assets SGDK
project, runs it in Genteel, captures neutral and Right-input screenshots,
proves Right-input sprite movement, and verifies non-silent generated music.
