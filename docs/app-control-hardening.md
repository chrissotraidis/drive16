# App Control Hardening Evidence

## Scope

This slice responds to a hands-on app audit where visible controls felt inert
or unclear. It does not change the Phase 4 generated-asset gate. It hardens
the core app shell so visible buttons produce obvious state changes, feedback,
or scoped reset behavior.

## Implemented Behavior

- The top-level `Run` action is now labeled `Run ROM` and launches the current
  starter ROM path.
- The top bar now includes `New Project`, which resets the app to a fresh
  starter-template conversation and preview state.
- The top bar shows a live action hint so recent button clicks have visible
  feedback.
- `Export ROM` now updates that same action hint in preview and native paths.
- The emulator fullscreen button is now a focused-emulator mode with a real
  enter and exit state.
- Pause and resume now update visible action feedback and the event stream.
- Tool health now labels browser-preview checks as limited instead of generic
  attention, and the UI can render per-tool setup hints when native checks
  provide them.
- Icon buttons now expose native browser tooltips through their labels.

## Browser Audit

Before the fix, the rendered `Run` button existed but clicking it left the
status, starter summary, and event stream unchanged.

After the fix, the in-app browser at `http://127.0.0.1:1420/` showed these
unique visible controls:

- `New Project`
- `Run ROM`
- `Export ROM`
- `Pause emulator`
- `Launch starter ROM`
- `Focus emulator`
- `Agent settings`
- `Refresh tool health`

The interaction pass verified:

- `Run ROM` appends a `run.started` event and updates the action hint to the
  running starter-ROM state.
- `New Project` resets to a starter-template conversation and appends
  `project.new`.
- `Focus emulator` adds the focused layout class and changes the button to
  `Exit focused emulator`.
- `Exit focused emulator` restores the normal workspace layout.
- Pause changes the button to `Resume emulator` and appends
  `emulator.paused`.
- Resume changes the button back to `Pause emulator` and appends
  `emulator.resumed`.
- `Refresh tool health` updates the action hint to explain that browser
  preview checks are limited.
- `Export ROM` appends `export.preview` and shows the preview export path in
  the action hint.
- `Agent settings` opens the settings panel, and `Close settings` closes it.

Console warnings and errors were empty during the interaction pass.

## Responsive Check

The browser viewport was temporarily set to a mobile size. The top actions
wrapped as:

- `New Project`
- `Run ROM`
- `Export ROM`

The mobile check reported no horizontal overflow.

## Verification

```sh
pnpm --dir app build
```

Result: passed.
