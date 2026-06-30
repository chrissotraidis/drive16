# Phase 6 Player Architecture

This slice creates the first Drive16-owned boundary for interactive play. It
does not integrate a live emulator core yet. The purpose is to stop mixing
captured-frame proof state, local keyboard display state, imported ROM storage,
and future interactive playback into one ambiguous `Run` concept.

## What Changed

New app modules:

- `app/src/player/types.ts`
- `app/src/player/input.ts`
- `app/src/player/index.ts`

The player model now has explicit concepts for:

- Active ROM source.
- Player provider.
- Player session state.
- Player audio state.
- Keyboard input action.
- Input focus and future controller readiness.

## Active ROM Source

The app now derives an `ActiveRomSource` from the current Drive16 state:

- Starter ROM: repo-local starter project ROM.
- Imported ROM: copied into ignored `artifacts/phase5/imports`.
- Generated ROM: Drive16-generated output from the CORE or generated-asset
  prompt path.

This keeps ROM storage separate from player runtime state. Importing a ROM
still means copying it into ignored local storage. Playing or verifying that ROM
is a separate concern.

## Provider Boundary

Two provider concepts exist now:

- `proof-preview`: existing captured-frame validation path.
- `nostalgist-retroarch`: first target for a future browser-hosted
  interactive player.

The current app renders `nostalgist-retroarch` as unconfigured rather than
pretending interactive play is finished. Genteel remains the Verify/Capture
Proof path.

## Input Boundary

Keyboard input is now defined once in `app/src/player/input.ts`:

| Physical input | Player action |
| --- | --- |
| Arrow keys | D-pad |
| Z | A |
| X | B |
| C | C |
| Enter | Start |

The viewport still captures keys locally, but it now records those keys through
the player input model. The next implementation unit can send the same action
objects into an emulator adapter instead of creating another key map.

## UI Surface

The right pane now includes a compact player-session strip above the ROM
viewport. It reports:

- Active ROM path.
- Interactive player provider state.
- Proof path availability.
- Keyboard focus/input state.
- Controller readiness status.
- Audio readiness status.

The strip is intentionally compact and wraps on narrower screens. It gives
Drive16 an honest place to show "interactive player needs core" without turning
the emulator surface into a large settings panel.

## Current Boundary

Completed:

- Active ROM source model.
- Player provider model.
- Input action model.
- Compact player session status surface.
- Keyboard mapping now comes from the shared input model.
- Genteel proof path remains separate from interactive player provider state.

Not yet complete:

- Real Nostalgist/RetroArch player adapter.
- ROM bytes loaded into the interactive emulator.
- Keyboard actions passed into the running emulator core.
- Audio output from interactive playback.
- Controller polling.

## Verification

Commands:

```sh
pnpm --dir app build
git diff --check
```

Browser flow:

```text
app loads -> player strip renders -> ROM viewport receives focus -> ArrowRight/Z update input state
```

Observed:

- TypeScript and Vite production build passed.
- Diff whitespace check passed.
- Browser page identity: `http://127.0.0.1:1420/`, title `Drive16`.
- Player strip rendered once.
- Console error/warning count was zero.
- ROM viewport focus plus ArrowRight/Z changed the strip to
  `Keyboard captured` with last action `A`.
- Screenshot captured in the in-app browser QA session.

## Next Unit

Clean up the visible UI language:

- Use Play only for the future interactive player action.
- Rename current Genteel capture actions to Verify/Capture Proof where needed.
- Keep Export and Import separate.
- Avoid adding crowded toolbars around the viewport.
