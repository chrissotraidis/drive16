# Phase 6 Audio

Status: historical Phase 6 note, updated with current audio truth.

## Current State

Drive16 now exposes a player audio button with four explicit states:

- `Audio unavailable`: no interactive audio path is currently available, such
  as a no-ROM/no-player state or a player session with no readable audio
  context.
- `Enable sound`: the player has an audio context, but the browser/webview has
  not allowed it to run yet.
- `Sound on`: the player audio context is running and not muted.
- `Muted`: the player audio context is running and mute is active.

Interactive ROM playback must always start with app volume at `0%`. Pressing
Play may start the emulator, but it must not produce audible speaker output
until the user intentionally raises the in-app volume slider. Muting a live
session also resets the app volume back to `0%`.

The generated-MML proof path still uses emulator audio dumping as the hard
evidence. A non-silent `capture_audio` result proves generated music better
than the speaker button alone.

## Remaining Work

Audio remains part of the current robustness gate:

- Keep generated-game claims tied to non-silent emulator audio evidence when
  sound is expected.
- Keep `Audio unavailable` reserved for true unavailable states.
- Keep Play startup and mute actions at `0%` app volume unless the user raises
  the slider.
- Run a separate native audible speaker pass before claiming the desktop player
  is audibly proven by human listening.
