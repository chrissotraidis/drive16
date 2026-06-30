# Phase 6 Player Controls

Interactive controls now live beside the ROM input/proof controls instead of in
the tool cards.

## Controls

- `Play ROM`: prepares the active ROM and launches it into the embedded player.
- `Pause` / `Resume`: toggles the interactive player state.
- `Reset`: restarts the active player runtime.
- `Stop`: exits the interactive runtime and returns the viewport to proof
  preview mode.
- `Verify Right`: remains the separate Genteel scripted proof action.

The extra controls appear only while an interactive player runtime exists, so
the normal ROM toolbar does not grow permanently.

## Browser QA

Imported `examples/app-starter-blank/out/rom.bin`, clicked `Play ROM`, then
confirmed:

- `Pause` changes feedback to `Interactive player paused`.
- The same button changes to `Resume`.
- `Resume` changes feedback to `Interactive player resumed`.
- `Stop` changes feedback to `Interactive player stopped`.
- Final console warning/error count was zero.
