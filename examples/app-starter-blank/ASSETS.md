# Asset Manifest

Use this file as the role ledger for the game. Every visible or audible game
role should have exactly one truthful row, even when the role uses primitive
tiles instead of a PNG.

## Asset Plan

- Pending: choose the gameplay roles before generating or wiring assets.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Game code primitives | None yet | `src/main.c` | Pending | Add rows as soon as a project uses primitive drawing, bundled assets, ComfyUI sprites, or MML music; notes must include prompt, crop/slice, and whether it was used when applicable. |

## Role Source Rules

- Simple geometric roles such as Pong paddles/balls, Snake body segments,
  Tetris blocks, borders, grids, and UI text should usually be SGDK
  primitives/tiles unless the user explicitly asks for styled generated art.
- Primitive rectangles and grid cells should be tilemap cells: load solid 8x8
  tiles with `VDP_loadTileData` and place them with `VDP_fillTileMapRect`.
  Do not use `VDP_drawRect`.
- ComfyUI currently generates one Genesis-safe 32x32 sprite PNG at a time.
  Treat each generated PNG as one role-specific SGDK `SPRITE`, not a reusable
  sprite sheet or generic decoration.
- If a generated image is cropped or sliced locally, record the source image,
  crop/slice output, and final SGDK symbol in the role table.
- Do not reuse one generated image for unrelated roles. A paddle is not a ball;
  a Snake head is not a wall; a Tetris block is not a title logo.
- Primitive text/tile rows should use the code path or drawing function in
  `Symbol / File`, such as `src/main.c draw_piece()`, not only a shared
  character like `#`. If one primitive glyph or helper is reused across
  multiple roles, say the shared primitive reuse is intentional in each
  affected row.
- Music and SFX rows must record compile status, the resource symbol/file, and
  audio evidence as captured, silent, or untested.

## Asset Source Decision Log

- Pending: no project-specific asset roles have been chosen yet.
