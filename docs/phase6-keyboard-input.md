# Phase 6 Keyboard Input

Keyboard input now goes through the shared Drive16 player input model and into
the running Nostalgist player when one exists.

## Mapping

- Arrow keys: D-pad.
- `Z`: Genesis A button.
- `X`: Genesis B button.
- `C`: Genesis C button through the adapter's current RetroPad mapping.
- `Enter`: Start.

The viewport owns keyboard focus. The compact player controls do not steal
mouse focus from the viewport, so a user can press Play, focus the ROM, then
pause or resume without losing the first click.

## Adapter Path

`handleRomKeyDown` and `handleRomKeyUp` both resolve a `PlayerInputAction`.
When an interactive player runtime is active, Drive16 sends `pressDown` and
`pressUp` to Nostalgist. Without a runtime, the same input model still updates
the local UI and proof-event trail.

## Browser QA

With `examples/app-starter-blank/out/rom.bin` imported and playing:

- ArrowRight updated the visible last-input state to `Right`.
- The player-session strip stayed in the interactive player path.
- No console warnings/errors were reported in the final smoke.

The starter ROM is intentionally blank, so this verifies input delivery rather
than visible game movement. Movement proof remains covered by the Genteel
Verify path until a generated playable ROM is tested in this same player.
