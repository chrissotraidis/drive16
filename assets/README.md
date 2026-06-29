# Assets

Bundled Drive16 assets used by the CORE build loop.

Only add assets with clear permissive licensing or original assets created for
Drive16.

## Core Pack

`assets/core/` is the Phase 2 and v1 bundled asset pack. It currently contains:

- `player.png`: original 32x32 indexed-color sprite.
- `loop.vgm`: original PSG-only looping VGM.
- `manifest.json`: stable asset IDs and SGDK resource symbols.

Phase 2 agents should use this pack before any generated-asset pipeline exists.
ComfyUI sprites and MML music are Phase 4 enhancements, not CORE dependencies.

## Phase 0 Assets

`assets/phase0/` is kept as the original validation fixture for Phase 0
evidence. New CORE prompts should use `assets/core/`.
