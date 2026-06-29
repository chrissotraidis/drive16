# Phase 2 Core Assets Skill

Use this skill when a Drive16 Phase 2 prompt asks for a controllable bundled
sprite, bundled music, or the CORE asset pack.

## Scope

- Use CORE tools only: `drive16-rag`, `drive16-sgdk-build`, and
  `drive16-emulator`.
- Do not use ComfyUI, generated sprites, MML, generated music, or Phase 4
  enhancement tools.
- Work only inside the SGDK project path provided by the validation prompt.

## Required Retrieval

Before editing C or resources, query `drive16-rag` for:

```text
Drive16 Phase 2 drive16_player drive16_loop resources.res SPRITE XGM
```

Use the returned Drive16 project-pattern notes plus SGDK `rescomp`, sprite, joy,
and XGM references.

## Asset Contract

Use the CORE bundled asset pack in `assets/core/`:

- `drive16_player`: `assets/core/player.png`, 32 x 32 indexed-color sprite,
  transparent palette index 0, declared as a 4 x 4 SGDK sprite.
- `drive16_loop`: `assets/core/loop.vgm`, PSG-only looping VGM, declared as an
  SGDK `XGM` resource.

Write `res/resources.res` with paths relative to that file:

```text
SPRITE drive16_player "<relative-path-to-assets-core>/player.png" 4 4 NONE 0
XGM drive16_loop "<relative-path-to-assets-core>/loop.vgm"
```

Write `res/resources.h` with:

```c
#include <genesis.h>

#ifndef _RES_RESOURCES_H_
#define _RES_RESOURCES_H_

extern const SpriteDefinition drive16_player;
extern const u8 drive16_loop[512];

#endif
```

## Main Loop Pattern

In `src/main.c`:

- Include `<genesis.h>` and `"resources.h"`.
- Initialize input and sprites with `JOY_init()` and `SPR_init()`.
- Load `drive16_player.palette->data` into a sprite palette line.
- Add the sprite with `SPR_addSprite`.
- Poll `JOY_readJoypad(JOY_1)` every frame and move the sprite with the D-pad.
- Call `SPR_update()` and `SYS_doVBlankProcess()` every frame.
- Start music with `XGM_startPlay(drive16_loop)`.
- Draw text that includes `Drive16 Phase 2` so screenshots can be recognized.

## Verification Loop

- Build only through `drive16-sgdk-build`.
- If the build fails, call `read_build_log`, repair the issue, and rebuild.
- Run the ROM through `drive16-emulator`.
- Call `capture_frame` and inspect the screenshot result.
- To prove controls, call `send_input` with Player 1 `right`, run the ROM again,
  and call `capture_frame` again.
