# Asset Manifest

| Role | Source | Symbol / File | Status | Notes |
| --- | --- | --- | --- | --- |
| Target cursor | SGDK role-specific tile | `src/main.c TILE_CURSOR` | Used | Small cyan crosshair designed for the radar role and reviewed in the composed screen. |
| Defense cities | SGDK role-specific tiles | `src/main.c TILE_CITY_TOP / TILE_CITY_BASE` | Used | Two-tile skyline silhouettes remain readable at native resolution. |
| Rejected cursor concept | ComfyUI generated sprite | `res/missile_cursor.png` | Rejected | Oversized framed object was ambiguous as a target cursor and is not wired into the ROM. |
| Rejected city concept | ComfyUI generated sprite | `res/defense_city.png` | Rejected | Isolated image did not read clearly as a city in the composed screen and is not wired into the ROM. |
| Radar, missiles, blasts, terrain | SGDK role-specific tiles | `src/main.c presentation_tiles` | Used | Static composition stays on BG_B; only the dynamic overlay is refreshed during play. |
| Music loop | MML music | `res/missile_theme.mml` / `res/missile_theme.vgm` | Used | Original local Megadrive MML compiled through ctrmml for SGDK XGM playback. |
| Fire and blast SFX | SGDK PSG | `src/main.c` | Used | Direct PSG tone/noise envelopes provide distinct fire and explosion feedback. |

## Provenance rule

The two copied PNGs are retained as rejected provenance, not counted as used
ComfyUI art. Generator readiness or a valid PNG never counts as asset use until
the role is recognizable in the composed game screen.
