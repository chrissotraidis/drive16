# Phase 4 ComfyUI Model Selection

## Scope

This note replaces the earlier single-checkpoint assumption for Phase 4 AI
sprites. Drive16 now defaults to a clearer Hugging Face dependency pair:

- SDXL Base checkpoint:
  `stabilityai/stable-diffusion-xl-base-1.0`
- Pixel-art style LoRA:
  `nerijs/pixel-art-xl`

The files are not bundled or committed. They remain local ComfyUI dependencies.

## Research

The earlier likely Pixel Art Diffusion XL checkpoint source on Civitai had
metadata that restricted redistribution and derivatives. That made it a poor
default for an open repo installer.

The Hugging Face metadata checked on 2026-06-30 showed:

- `stabilityai/stable-diffusion-xl-base-1.0` uses license tag `openrail++`
  and exposes `sd_xl_base_1.0.safetensors`.
- `nerijs/pixel-art-xl` uses license tag `creativeml-openrail-m`, declares
  `base_model: stabilityai/stable-diffusion-xl-base-1.0`, and exposes
  `pixel-art-xl.safetensors`.
- `PublicPrompts/All-In-One-Pixel-Model` is older and pixel-sprite oriented,
  but it is not SDXL and would require a larger workflow retune.

OpenRAIL-family model licenses are available for local download, but they are
not plain OSI open-source software licenses. Drive16 therefore requires an
explicit installer flag before downloading weights.

## Decision

Use SDXL Base plus Pixel Art XL LoRA as the default Phase 4 dependency.

Reasons:

- both files are directly resolvable from Hugging Face
- the LoRA is much smaller than a dedicated 6 GiB pixel-art checkpoint
- the LoRA model card recommends nearest-neighbor downscaling, which matches
  Drive16's 32x32 sprite workflow
- the existing ComfyUI graph only needs a standard `LoraLoader` node
- users can still override filenames with `DRIVE16_COMFYUI_CHECKPOINT` and
  `DRIVE16_COMFYUI_LORA`

## Install

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check
```

The default paths are:

```text
~/Documents/ComfyUI/models/checkpoints/sd_xl_base_1.0.safetensors
~/Documents/ComfyUI/models/loras/pixel-art-xl.safetensors
```

For custom local files:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
export DRIVE16_COMFYUI_LORA=your-lora-name.safetensors
scripts/check-phase4-comfyui-readiness.py
```

## Verification

The repository now verifies the workflow contract against
`CheckpointLoaderSimple` plus `LoraLoader`, and readiness checks require:

- local ComfyUI API
- SDXL base checkpoint
- Pixel Art XL LoRA
- Pixydust Quantizer
- committed workflow classes

The live Phase 4 proof remains:

```sh
scripts/validate-phase4-live-generated-assets.sh
```
