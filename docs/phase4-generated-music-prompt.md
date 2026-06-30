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

## Validation Request

The full generated-ROM proof could not run in this environment because Docker
was installed but the Docker daemon was not reachable.

Run this after starting Docker Desktop:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Expected result:

- The ignored native test builds the generated SGDK project through
  `scripts/build-sgdk.sh`.
- Genteel captures a neutral screenshot.
- Genteel captures a Right-input screenshot and audio dump.
- `scripts/validate-sprite-movement.py` proves the bundled sprite moves right.
- The audio dump is non-silent.

## Next

Keep the broad prompt-path checklist item open until the generated music ROM
proof passes and the generated sprite side has a real validated ComfyUI PNG.
