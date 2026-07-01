# Phase 6 Controller Foundation

Controller support is now prepared and partially wired, but not claimed as
full hardware-complete support.

## Current Foundation

- Player input actions use stable IDs such as `dpad.left`, `button.a`, and
  `button.start`.
- Phase 7 Slice 3 added a persisted local input profile.
- The player session model reports a richer controller readiness state.
- The UI reports `Controller unavailable`, `Controller detected`, or
  `Mapping not configured` instead of a placeholder.
- Keyboard input and future controller events can share the same
  `PlayerInputAction` path.
- Basic standard-gamepad button/D-pad transitions are wired into the player
  input action path when the browser reports a connected gamepad.

## Not Built Yet

- Full remapping editor.
- Per-device mapping.
- Multi-controller selection.
- Packaged hardware QA across common controllers.

That work should happen after keyboard play and generated-ROM play are stable.
