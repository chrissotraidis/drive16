# Phase 6 Interactive Loading

This slice started Unit 4 by creating the active-ROM loading path that the
interactive player adapter uses. The follow-up adapter slice now launches
imported ROM bytes through Nostalgist/RetroArch in the ROM viewport.

## What Changed

Native app:

- Added `read_rom_bytes`.
- The command accepts a repo-local ROM path.
- It rejects paths outside the repo.
- It rejects unsupported extensions.
- It returns base64 ROM bytes for `.bin`, `.gen`, `.md`, and `.smd`.

Frontend:

- Added `Play ROM` next to the proof controls.
- The Play action prepares the active ROM for the interactive player.
- Imported file bytes are preserved as a temporary blob URL when a user imports
  a ROM in the current browser session.
- Existing repo-local ROM paths use the native `read_rom_bytes` command in the
  desktop app.
- If the interactive provider is unavailable, the app reports
  `Player core needed` instead of pretending playback started.
- If the browser preview cannot read the active ROM from disk, the app reports
  a clear `Play setup failed` message.
- When a browser-session import is active, `Play ROM` passes the prepared blob
  into the embedded Nostalgist adapter.

## Safety Boundary

The player path does not accept arbitrary filesystem paths from the webview.
The native command resolves paths through the repo boundary and then validates
the ROM extension before reading bytes.

The player path does not:

- Commit imported ROMs.
- Upload ROMs.
- Mutate ROM bytes.
- Start a fake interactive session when the core is missing.

## Current Behavior

Desktop app path:

1. User imports or generates a ROM.
2. User clicks `Play ROM`.
3. The app reads the active repo-local ROM bytes through `read_rom_bytes`.
4. The frontend creates a temporary `blob:` URL.
5. The app launches Nostalgist against the prepared ROM payload.

Browser preview path:

1. User clicks `Play ROM` for a ROM that only exists on disk.
2. The app reports that the browser preview cannot read that ROM from disk.
3. If a user imports a ROM file in the browser session, those bytes are kept in
   memory and can be played immediately through the adapter path.

## Verification

Commands:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
pnpm --dir app build
git diff --check
```

Observed:

- Native tests passed: 44 passed, 4 ignored.
- New native tests covered repo-local ROM byte reads, outside-repo rejection,
  and unsupported-extension rejection.
- Frontend production build passed.
- Browser QA confirmed one `Play ROM` control.
- Clicking `Play ROM` in browser preview produced a visible
  `Play setup failed` state with no console warnings/errors.
- Browser QA then imported `examples/app-starter-blank/out/rom.bin`, clicked
  `Play ROM`, and confirmed the embedded player started with zero final console
  warnings/errors.

## Remaining Unit 4 Work

- Confirm imported ROM playback in the native app.
- Confirm generated ROM playback through the same path.
