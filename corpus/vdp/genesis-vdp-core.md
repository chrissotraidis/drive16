# Genesis VDP Core Notes

Drive16-authored notes for the Phase 1 RAG corpus. These notes keep the agent's
first SGDK code generation inside the hardware limits that matter most.

## Display

- Standard visible resolution is 320 x 224 in H40 mode or 256 x 224 in H32
  mode.
- The VDP renders two scrolling planes, plane A and plane B, plus a window
  plane.
- Tile graphics are 8 x 8 pixels.
- Each tile pixel is a 4-bit palette index from 0 to 15.
- Palette index 0 is transparent for sprites and should be treated as reserved
  when preparing sprite art.

## Palettes

- The machine has 4 palette lines.
- Each palette line has 16 colors.
- A scene can show 64 palette entries at once.
- Colors come from a 512-color master palette.
- A hardware sprite uses one 16-color palette line.

## Sprites

- Up to 80 hardware sprites can be visible on screen.
- Up to 20 hardware sprites can appear on one scanline.
- A single hardware sprite is at most 4 x 4 tiles, or 32 x 32 pixels.
- Larger characters should be split into multiple sprites and arranged with
  the SGDK sprite engine.

## Timing

- The main CPU is a Motorola 68000 at about 7.67 MHz.
- Sound uses a Zilog Z80 at about 3.58 MHz.
- Heavy VDP updates should happen during vertical blank where possible.
- The agent should prefer SGDK helpers for VRAM, palette, sprite, and DMA work
  instead of writing raw registers in Phase 1.

## Agent Rules

- Query this corpus before writing Genesis or SGDK code.
- Prefer a minimal `main.c` with `VDP_`, `JOY_`, `SPR_`, `XGM_`, and
  `SYS_doVBlankProcess` calls for CORE demos.
- Do not use bundled sprite or VGM assets in Phase 1. Those belong to Phase 2.
- Keep Phase 1 prompts text-only, such as setting the background color or
  drawing simple tiles or text.
- In Phase 2, use the bundled `assets/core/` pack for sprite and music prompts.
  Do not use generated sprites, generated music, ComfyUI, or MML tools.
