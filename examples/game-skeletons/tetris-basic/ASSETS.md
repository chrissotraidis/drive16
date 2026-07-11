# Tetris Starter Assets

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Falling and locked pieces | SGDK role-specific tiles | `src/main.c draw_piece() / draw_board()` | Used | Piece palettes are separate from text and frame palettes. |
| Playfield and statistics | SGDK static UI | `src/main.c draw_stats()` | Used | Score, lines, controls, and next piece remain readable outside the board. |
| Music | Bundled starter VGM | `res/tetris_loop.vgm` | Used | Wired to `tetris_loop`; audible browser review is still required. |
