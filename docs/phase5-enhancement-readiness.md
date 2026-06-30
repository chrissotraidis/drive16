# Phase 5 Enhancement Readiness

This slice completes Phase 5 Unit 7 by replacing ambiguous enhancement On/Off
labels with explicit readiness state.

## Goal

AI sprites and MML music should make it clear whether each enhancement is
disabled, needs setup, ready, running, or failed. Disabled should mean
intentionally off, not missing.

## Behavior

AI sprites:

- `Disabled`: the toggle is intentionally off.
- `Needs setup`: enabled, but ComfyUI readiness has not been tested or needs
  attention.
- `Running`: ComfyUI readiness is being checked.
- `Ready`: ComfyUI, checkpoint, LoRA, and workflow checks are ready.
- `Failed`: the readiness check failed.
- Readiness row includes a next action.
- Checkpoint and LoRA names are visible above the editable fields.

MML music:

- `Disabled`: the toggle is intentionally off.
- `Ready`: the ctrmml wrapper and generated-MML prompt path are wired.
- Readiness row includes the generated-MML proof boundary.

## Evidence

Commands:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
pnpm --dir app build
```

Results:

- Native tests passed with 41 tests and 4 live-environment tests ignored.
- Frontend build passed.

Browser proof at `http://127.0.0.1:1420/`:

- Settings opened from the conversation header.
- AI sprites initially showed:
  - `Disabled`
  - `AI sprites are intentionally off.`
  - `Enable to configure ComfyUI.`
- MML music initially showed:
  - `Disabled`
  - `MML generation is intentionally off.`
  - `Enable to use the generated-MML prompt path.`
- Toggling MML music changed readiness to:
  - `Ready`
  - `ctrmml wrapper and generated-MML prompt path are wired.`
- Toggling AI sprites changed readiness to:
  - `Needs setup`
  - `ComfyUI readiness has not been tested.`
  - `Run Test after endpoint, checkpoint, and LoRA are set.`
- AI sprites model summary showed:
  - Checkpoint: `sd_xl_base_1.0.safetensors`
  - LoRA: `pixel-art-xl.safetensors`
- Running the ComfyUI test in browser preview changed AI sprites to:
  - `Failed`
  - `ComfyUI check failed: Failed to fetch`
  - `Check the endpoint, checkpoint, LoRA, then run Test.`

## Remaining Boundary

MML music does not yet have a separate lightweight readiness probe in the app.
When enabled, it reports Ready because the ctrmml wrapper and generated-MML
prompt path are wired; failures still surface during the generated-MML ROM
proof.
