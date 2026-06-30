# Phase 4 Generated Assets Fixture Prompt Evidence

## Scope

This slice proves that the combined Phase 4 prompt path is wired once a
validated generated-sprite PNG exists. It uses a validator-accepted synthetic
PNG fixture and temporarily writes a fixture `last-run.json` record, then
restores the real live ComfyUI run record afterward.

It does not claim that live ComfyUI output exists. The live ComfyUI sprite gate
remains open until `scripts/run-comfyui-sprite-workflow.py` records `ok: true`
from a real local ComfyUI run.

Implemented behavior:

- Added `scripts/validate-phase4-generated-assets-fixture-prompt.sh`.
- The script runs the generated-sprite validator self-test and copies the
  accepted PNG to `artifacts/phase4/generated-assets-fixture/generated-sprite.png`.
- It validates that PNG as `drive16_player`.
- It temporarily writes
  `artifacts/phase4/live-comfyui-sprite/last-run.json` with `ok: true` and the
  fixture PNG path.
- It runs the same ignored native combined proof,
  `phase4_generated_assets_prompt_runs_when_tools_are_available`.
- It restores the previous live ComfyUI run record, or removes the temporary
  record if none existed.

## Verification

Fixture generated-assets prompt proof:

```sh
scripts/validate-phase4-generated-assets-fixture-prompt.sh
```

Result:

- The generated-sprite validator accepted the synthetic 32x32 indexed PNG with
  4 palette slots and 704 transparent pixels.
- The focused Phase 4 prompt tests passed: 5 passed, 2 ignored.
- The ignored combined generated-assets prompt proof passed: 1 passed.
- The generated project resource file referenced:
  `SPRITE drive16_player "../../../../../artifacts/phase4/generated-assets-fixture/generated-sprite.png" 4 4 NONE 0`.
- The generated project also referenced
  `XGM drive16_generated_music "generated_music.vgm"`.
- The generated ROM exists at
  `artifacts/phase4/generated-music-prompt/project/out/rom.bin`.
- Genteel screenshots and audio exist:
  `artifacts/phase4/generated-music-prompt/phase4-music-neutral.png`,
  `artifacts/phase4/generated-music-prompt/phase4-music-right.png`, and
  `artifacts/phase4/generated-music-prompt/phase4-music-audio.wav`.
- Visual sanity check: the neutral screenshot shows `Drive16 Phase 4`,
  `Generated sprite`, the generated sprite, and `Generated MML music`.

Live gate honesty check:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Result: exit `66`. The real live-gated proof still stops because the live
ComfyUI sprite run has not completed successfully.

## Next

Place the compatible checkpoint, start local ComfyUI, pass readiness, generate
a live sprite PNG, then rerun the real generated-assets proof.
