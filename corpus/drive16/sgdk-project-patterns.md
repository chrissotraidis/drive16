# Drive16 SGDK Project Patterns

Drive16-authored notes for how the agent should edit SGDK projects during the
Phase 1 text-only loop.

## Project Shape

- Keep generated SGDK projects small and ordinary.
- Use a `Makefile` that includes `$(GDK)/makefile.gen`.
- Put C source under `src/`.
- Put SGDK resource declarations under `res/resources.res` only when assets are
  needed. Phase 1 should avoid assets.
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
