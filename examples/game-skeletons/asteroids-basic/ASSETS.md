# Asteroids Starter Assets

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Ship directions | SGDK composed role-specific tiles | `src/main.c draw_ship / presentation_tiles` | Used | Four readable 16x16 orientations assembled from mirrored quadrants with a separate ship/UI palette. |
| Asteroids | SGDK composed role-specific tiles | `src/main.c draw_asteroid / TILE_ROCK` | Used | 16x16 mirrored rock silhouettes are visually distinct from the ship and projectiles. |
| Bullets | SGDK role-specific tile | `src/main.c TILE_BULLET` | Used | Bright 8x8 projectile feedback uses its own shape and palette. |
| Star field and frame | SGDK static background | `src/main.c TILE_STAR / TILE_SOLID` | Used | Loaded once; moving objects update only BG_A. |
| Music | Local MML composition | `res/asteroids_music.mml` / `res/asteroids_music.vgm` | Used | Six-channel 68.8-second A/B arrangement with bass, lead, pad, pluck, brass stabs, and sectional PSG percussion; passes the structural baseline, while audible browser taste review is still required. |
