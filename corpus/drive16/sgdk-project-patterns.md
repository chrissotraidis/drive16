# Drive16 SGDK Project Patterns

Drive16-authored notes for how the agent should edit SGDK projects during the
Phase 1 and Phase 2 CORE loops.

## Project Shape

- Keep generated SGDK projects small and ordinary.
- Use a `Makefile` that includes `$(GDK)/makefile.gen`.
- Put C source under `src/`.
- Put SGDK resource declarations under `res/resources.res` when assets are
  needed.
- Build through the Drive16 SGDK MCP server instead of invoking Docker directly.

## Minimal Main Loop

- Include `<genesis.h>`.
- Initialize the display, palettes, input, and any text or primitive drawing
  before the loop.
- Use `while(TRUE)` for the main loop.
- End each loop with `SYS_doVBlankProcess()`.
- Poll joypads with SGDK input helpers when controls are needed.

## Phase 1 Constraints

- The agent may write text demos such as a colored screen, centered text, or a
  box made from tiles or simple drawing helpers.
- The agent must read build errors from `read_build_log()` and fix C compile
  errors before running the ROM.
- After a successful build, the agent must call `run_rom()` and then
  `capture_frame()` so it can inspect the result.
- Phase 1 should not depend on sprite PNGs, VGM loops, ComfyUI, or music
  generation.

## Phase 2 Bundled Assets

Phase 2 uses the CORE bundled asset pack in `assets/core/`. Do not generate new
sprites or music in Phase 2. Use these stable resource symbols:

- Sprite: `drive16_player`, from `assets/core/player.png`, 32 x 32 pixels,
  4 x 4 SGDK tiles, transparent palette index 0.
- Music: `drive16_loop`, from `assets/core/loop.vgm`, PSG-only looping VGM for
  SGDK XGM conversion.

Declare the assets in `res/resources.res` with paths relative to that
`resources.res` file:

```text
SPRITE drive16_player "<relative-path-to-assets-core>/player.png" 4 4 NONE 0
XGM drive16_loop "<relative-path-to-assets-core>/loop.vgm"
```

Declare the generated symbols in `res/resources.h`:

```c
#include <genesis.h>

#ifndef _RES_RESOURCES_H_
#define _RES_RESOURCES_H_

extern const SpriteDefinition drive16_player;
extern const u8 drive16_loop[512];

#endif
```

In `src/main.c`, include `"resources.h"`, call `JOY_init()` and `SPR_init()`,
load `drive16_player.palette->data` into a sprite palette line, add the sprite
with `SPR_addSprite`, move it from D-pad input with `JOY_readJoypad(JOY_1)`,
call `SPR_update()` every frame, and play the loop with
`XGM_startPlay(drive16_loop)`.
