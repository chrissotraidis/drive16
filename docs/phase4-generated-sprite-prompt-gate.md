# Phase 4 Generated Sprite Prompt Gate Evidence

## Scope

This slice extends the generated-MML prompt path so it can request a generated
sprite only when the `AI sprites` toggle is enabled together with `MML music`.
It does not claim the generated-sprite checklist item is complete.

The native command now accepts a `useGeneratedSprite` flag. When the flag is
false, it keeps using the proven bundled sprite. When the flag is true, it
requires:

- `artifacts/phase4/live-comfyui-sprite/last-run.json` exists.
- The live ComfyUI run record has `ok: true`.
- The record includes `downloadedPng`.
- The PNG resolves inside the Drive16 repo.
- The PNG passes `scripts/validate-generated-sprite.py --symbol drive16_player`.

Only after those checks does the generated SGDK project point
`SPRITE drive16_player` at the generated PNG.

## Implemented Behavior

- Updated native command `run_phase4_music_prompt` to receive a structured
  request with `prompt` and `useGeneratedSprite`.
- Added a generated-sprite asset gate in `app/src-tauri/src/phase4_prompt.rs`.
- Re-validated the live ComfyUI PNG before writing it into `resources.res`.
- The app-side validation request now includes the default checkpoint path,
  optional `DRIVE16_COMFYUI_CHECKPOINT`, local API launcher, readiness check,
  and live sprite runner before asking the user to retry the AI-sprite prompt.
- Updated the React send path so `AI sprites` only affects the prompt path when
  `MML music` is also enabled.
- Updated the app project summary labels for the combined generated sprite and
  generated music path.

## Local Verification

Focused Phase 4 native tests passed:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt -- --nocapture
```

Result: 5 passed, 1 ignored.

The focused Phase 4 native tests were rerun after the app-side validation
request was refreshed:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt -- --nocapture
```

Result: 5 passed, 2 ignored. The generated-sprite gate tests now assert that
the error shown by the native prompt path includes
`DRIVE16_COMFYUI_CHECKPOINT`, `scripts/launch-phase4-comfyui-api.sh`,
`scripts/check-phase4-comfyui-readiness.py`, and
`scripts/run-comfyui-sprite-workflow.py`.

Full non-ignored native tests passed:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture
```

Result: 20 passed, 3 ignored.

The full non-ignored native suite was rerun after the same change:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture
```

Result: 20 passed, 4 ignored.

The frontend production build passed:

```sh
npm run build
```

The generated-music validation script still reached the expected Docker gate:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Result: exit `65` with a Docker Desktop validation request.

## Validation Requests

Live ComfyUI sprite proof is still required. Place a Pixel Art Diffusion XL
compatible checkpoint at the default path:

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

Expected result: `artifacts/phase4/live-comfyui-sprite/last-run.json` records
`ok: true` and a downloaded PNG that passes the Drive16 generated-sprite
validator.

Full generated-ROM proof is still required after Docker Desktop is running:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Expected result: the ignored native test builds the generated SGDK project,
runs it in Genteel, captures neutral and Right-input screenshots, proves
Right-input sprite movement, and verifies non-silent audio.

## Next

Keep the generated-sprite validation, broad prompt-path, and generated-ROM
checklist items open until a real live ComfyUI PNG passes and Docker can build
the generated project.
