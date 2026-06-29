# Core Bundled Asset Pack

Original Drive16 v1 assets for Phase 2 and later CORE builds.

Use these assets when a prompt asks for the bundled sprite or bundled music
loop. Do not call ComfyUI, MML, or any generated-asset tool for Phase 2.

## Assets

- `player.png`: 32x32 indexed-color sprite with transparent palette index 0.
- `loop.vgm`: one-second PSG-only VGM loop for SGDK XGM conversion.
- `manifest.json`: stable IDs, paths, and SGDK resource symbols for the pack.

## SGDK Resource Symbols

Use these symbol names in `res/resources.res`:

```text
SPRITE drive16_player "<path-to-assets-core>/player.png" 4 4 NONE 0
XGM drive16_loop "<path-to-assets-core>/loop.vgm"
```

Use these declarations in `res/resources.h`:

```c
#include <genesis.h>

#ifndef _RES_RESOURCES_H_
#define _RES_RESOURCES_H_

extern const SpriteDefinition drive16_player;
extern const u8 drive16_loop[512];

#endif
```

The C code should load `drive16_player.palette` into one sprite palette line,
add the sprite with `SPR_addSprite`, update it with `SPR_update`, and start the
music with `XGM_startPlay(drive16_loop)`.
