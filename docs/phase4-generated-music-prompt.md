# Phase 4 Generated Music Prompt Evidence

## Scope

This slice wires the optional `MML music` setting into the app prompt path. When
the user asks for the existing sprite-with-music prompt and `MML music` is on,
the app calls a Phase 4 native command that creates a generated SGDK project
with:

- the proven bundled controllable sprite from `assets/core/player.png`
- generated MML using `assets/enhancements/mml/fm-presets.mml`
- a VGM compiled by the pinned `ctrmml` sidecar
- an SGDK `XGM drive16_generated_music "generated_music.vgm"` resource

The AI sprite path remains gated until a live ComfyUI PNG passes the generated
sprite validator.

## Implemented Behavior

- Added native command `run_phase4_music_prompt`.
- Added `app/src-tauri/src/phase4_prompt.rs`.
- Updated the React send path so the `MML music` toggle selects the generated
  music command.
- Kept the default CORE `run_v1_prompt` path unchanged when `MML music` is off.
- Added `scripts/validate-phase4-generated-music-prompt.sh`.

## Local Verification

The focused native tests passed:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt -- --nocapture
```

The frontend production build passed:

```sh
npm run build
```

The generated MML path ran far enough to write ignored artifacts under
`artifacts/phase4/generated-music-prompt/`:

- `project/res/generated_music.mml`
- `project/res/generated_music.vgm`
- `project/src/main.c`
- `project/res/resources.res`

The generated VGM was detected as VGM v1.61 with PSG and YM2612 chips.

## Full ROM Proof

Docker Desktop was started and the full generated-MML ROM proof passed:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Result:

- Focused Phase 4 prompt tests passed: 5 passed, 2 ignored.
- The ignored generated-MML native test passed.
- The generated SGDK project built through `scripts/build-sgdk.sh`.
- Genteel captured neutral and Right-input screenshots.
- `scripts/validate-sprite-movement.py` proved the bundled sprite moved right:
  `changed_pixels=768`, `delta=155`, `orthogonal_span=25`.
- The generated audio dump was non-silent: `audio_max_abs=14043`.
- The generated ROM was written to
  `artifacts/phase4/generated-music-prompt/project/out/rom.bin`.

The verified ignored artifacts are not committed:

- `artifacts/phase4/generated-music-prompt/phase4-music-neutral.png`
- `artifacts/phase4/generated-music-prompt/phase4-music-right.png`
- `artifacts/phase4/generated-music-prompt/phase4-music-audio.wav`
- `artifacts/phase4/generated-music-prompt/project/out/rom.bin`

## Validation Request

The generated-MML music side is now proven. The combined generated-assets proof
still needs live ComfyUI sprite output. Run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Expected result:

- The live ComfyUI runner records `ok: true`.
- The downloaded PNG passes `scripts/validate-generated-sprite.py`.
- The combined generated-assets ROM builds and passes the same Genteel
  screenshot, movement, and audio checks.

## Next

Keep the broad prompt-path checklist item open until the generated sprite side
has a real validated ComfyUI PNG and the combined generated-assets proof passes.
