# Asset Manifest

Use this file as the role ledger for the game. Every visible or audible game
role should have exactly one truthful row, even when the role uses primitive
tiles instead of a PNG.

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Game code primitives | None yet | `src/main.c` | Pending | Add rows as soon as a project uses primitive drawing, bundled assets, ComfyUI sprites, or MML music. |

## Role Source Rules

- Simple geometric roles such as Pong paddles/balls, Snake body segments,
  Tetris blocks, borders, grids, and UI text should usually be SGDK
  primitives/tiles unless the user explicitly asks for styled generated art.
- ComfyUI currently generates one Genesis-safe 32x32 sprite PNG at a time.
  Treat each generated PNG as one role-specific SGDK `SPRITE`, not a reusable
  sprite sheet or generic decoration.
- If a generated image is cropped or sliced locally, record the source image,
  crop/slice output, and final SGDK symbol in the role table.
- Do not reuse one generated image for unrelated roles. A paddle is not a ball;
  a Snake head is not a wall; a Tetris block is not a title logo.

## Asset Source Decision Log

- Pending: no project-specific asset roles have been chosen yet.
