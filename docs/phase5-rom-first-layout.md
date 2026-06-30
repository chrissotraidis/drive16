# Phase 5 ROM-First Layout

This slice completes Phase 5 Unit 6 by letting the ROM viewport take priority
without hiding all status.

## Goal

The user should be able to collapse the conversation rail and ROM detail panels
when they want to focus on the emulator. Status should remain available in a
compact form.

## Behavior

- The emulator toolbar includes a conversation rail toggle.
- The emulator toolbar includes a ROM details toggle.
- Focused emulator mode still exists.
- Collapsing the conversation rail hides the left pane and expands the emulator
  area.
- Collapsing ROM details hides the full status cards and shows compact status.
- Focused emulator mode also shows compact status instead of the full card
  grid.
- Compact status shows:
  - Current ROM path.
  - Tool summary.
  - `Show Details`.
- `Show Details` restores the full status grid and exits focused mode.
- The layout wraps at narrow widths without horizontal overflow.

## Evidence

Commands:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
pnpm --dir app build
```

Results:

- Native tests passed with 41 tests and 4 live-environment tests ignored.
- Frontend build passed.

Browser proof at `http://127.0.0.1:1420/`:

- `Hide conversation pane` hid the left pane.
- `Hide ROM details` hid the full status grid.
- Compact status appeared with ROM path, tool summary, and `Show Details`.
- Focused emulator mode kept compact status visible and full cards hidden.
- `Show Details` restored full status and exited focused mode.
- `Show conversation pane` restored the left pane.

Narrow viewport proof:

- Temporary viewport: `390x760`.
- ROM controls wrapped.
- Compact status wrapped.
- `document.documentElement.scrollWidth` did not exceed `window.innerWidth`
  beyond tolerance.

## Remaining Boundary

The panes are collapsible, not yet draggable/resizable. A future layout pass can
add persistent split positions if repeated use shows the fixed collapse states
are not enough.
