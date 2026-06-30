# Phase 4 ComfyUI Checkpoint Source Audit

## Scope

This slice audits the likely upstream source for the Phase 4 Pixel Art
Diffusion XL checkpoint before Drive16 treats it as a normal install target.
The audit does not download model weights and does not close the live ComfyUI
gate.

## Findings

Local model scan:

```sh
find /Users/chrissotraidis -path /Users/chrissotraidis/Library -prune -o \
  -path /Users/chrissotraidis/.Trash -prune -o \
  -path /Users/chrissotraidis/Documents/GitHub/drive16/.git -prune -o \
  \( -iname '*.safetensors' -o -iname '*.ckpt' -o -iname '*.pt' \) -print
```

Result:

- Found general image checkpoints under DiffusionBee and Fooocus.
- Found `juggernautXL_version6Rundiffusion.safetensors` under Fooocus.
- Did not find a dedicated Pixel Art Diffusion XL checkpoint already installed
  under the local ComfyUI model folders.

Upstream metadata check:

```sh
curl -L --fail --silent --show-error \
  https://civitai.com/api/v1/models/277680
```

Result:

- The model ID is `277680`.
- The model name is `Pixel Art Diffusion XL`.
- The model type is `Checkpoint`.
- The base model is `SDXL 1.0`.
- The current primary file is
  `pixelArtDiffusionXL_spriteShaper.safetensors`.
- The current primary file SHA-256 is
  `7ADFFA28D4003A773C2D4E5F10AE1BA63C33573967864A7F9A4A3BE9C9F04A93`.
- The file is approximately 6.46 GiB.
- The metadata sets `allowNoCredit` to `false`.
- The metadata sets `allowDerivatives` to `false`.
- The metadata sets `allowDifferentLicense` to `false`.
- The metadata reports commercial use as restricted to Civitai-rented use.
- The model description also restricts redistribution outside Civitai without
  written approval.

## Impact

The architecture appendix currently describes Pixel Art Diffusion XL as open
CreativeML. The current Civitai metadata for the likely source does not support
that assumption. Because Phase 4 depends on license hygiene and separate
process boundaries, Drive16 should not bake this checkpoint source into scripts
or auto-download it as a default dependency.

## Validation Request

Continue to require an explicit user-provided checkpoint source:

```sh
scripts/install-phase4-comfyui-checkpoint.sh \
  --source /path-or-url/to/compatible-checkpoint.safetensors \
  --checkpoint pixel-art-diffusion-xl.safetensors \
  --sha256 <optional-known-hash> \
  --check
```

If the user chooses the Civitai Pixel Art Diffusion XL checkpoint, treat that as
a local user-selected model with its own external license. Do not redistribute
or commit the model weights.

## Phase Gate

This audit does not satisfy the generated-sprite checklist item. Phase 4 still
requires a live ComfyUI PNG generated from a compatible checkpoint and accepted
by `scripts/validate-generated-sprite.py`.
