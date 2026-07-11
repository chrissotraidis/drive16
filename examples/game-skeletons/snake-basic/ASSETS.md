# Snake Starter Assets

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Snake head and body | SGDK role-specific tiles | `src/main.c draw_snake()` | Used | Head and body use distinct tile treatment. |
| Food | SGDK role-specific tile | `src/main.c place_food()` | Used | Separate palette and role. |
| Board and score | SGDK static UI | `src/main.c draw_border() / draw_score()` | Used | Board is not repainted every movement frame. |
| Music | Bundled starter VGM | `res/snake_loop.vgm` | Used | Wired to `snake_loop`; audible browser review is still required. |
