# Pong Starter Assets

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Player and CPU paddles | SGDK role-specific tiles | `src/main.c draw_paddle()` | Used | Paddle role is distinct from ball and court. |
| Ball | Hardware sprite (SPRITE resource) | `res/ball.png` / `ball_sprite` via `SPR_addSprite` | Used | High-contrast moving target on the sprite layer; demonstrates the Genesis sprite engine. |
| Court and score | SGDK static UI | `src/main.c draw_court() / draw_score()` | Used | Court remains static between movement updates. |
| Music | Bundled starter VGM | `res/pong_loop.vgm` | Used | Wired to `pong_loop`; audible browser review is still required. |
