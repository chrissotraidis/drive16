# Phase 6 Controller Foundation

Controller support is prepared but not claimed as complete.

## Current Foundation

- Player input actions use stable IDs such as `dpad.left`, `button.a`, and
  `button.start`.
- The player session model has a `controllerReady` field.
- The UI says `Controller later`, not `Controller ready`.
- Keyboard input and future controller events can share the same
  `PlayerInputAction` path.

## Not Built Yet

- Gamepad API polling.
- Controller profile settings.
- Per-device mapping.
- Tested controller input.

That work should happen after keyboard play and generated-ROM play are stable.
