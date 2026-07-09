# Game Notes

## Concept

This is a blank Drive16 starter project. Replace this section when the user
starts a real game.

## Current Build

- Code: `src/main.c`
- Assets: `res/`
- ROM: `out/rom.bin`
- Asset usage: none yet; see `ASSETS.md`

## SGDK Starter Notes

- `VDP_drawText`, `VDP_clearPlane`, `VDP_loadTileData`, and
  `VDP_fillTileMapRect` are safe starter APIs in this project.
- Do not use `VDP_drawRect`, `srand`, or C library `rand()`; they are not
  available in the current build setup.
- For simple blocky graphics, load a solid 8x8 tile and draw grid cells with
  `VDP_fillTileMapRect`.

## First Build References

- For a simple Snake request, `examples/game-skeletons/snake-basic/` is a
  proven compact source and audio seed. Copy/adapt its `src/main.c` and `res/`
  files, then build and test before polishing docs or art.
- For a simple Pong request, `examples/game-skeletons/pong-basic/` is a proven
  compact source and audio seed. Copy/adapt its `src/main.c` and `res/` files,
  then build and test before polishing docs or art.
- For a simple Tetris request, `examples/game-skeletons/tetris-basic/` is a
  proven compact source and audio seed. Copy/adapt its `src/main.c` and `res/`
  files, then build and test before polishing docs or art.
- For a simple Asteroids request, `examples/game-skeletons/asteroids-basic/` is
  a proven compact source and audio seed. Copy/adapt its `src/main.c` and
  `res/` files, then build and test before polishing docs or art.

## Controls

- D-pad: available for game movement once implemented
- Start: available for start/restart once implemented
- A/B/C: available for actions once implemented

## Known Issues

- No game-specific behavior has been implemented yet.

## Next Intended Change

- Ask the user what to build, or state a small default plan before editing.
