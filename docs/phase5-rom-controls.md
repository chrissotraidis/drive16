# Phase 5 ROM Controls

This slice completes Phase 5 Unit 5 by making the ROM viewport visibly
controllable while keeping the tested-input boundary honest.

## Goal

The running ROM area should show the expected Genesis keyboard mapping, make
input focus visible, record local key input, and provide a verified movement
proof path.

## Behavior

- The ROM viewport is focusable.
- The controls strip shows:
  - `Click ROM to control` before focus.
  - `Input focused` after the viewport is clicked or focused.
  - Keyboard mapping for Arrows, Z, X, C, and Enter.
  - Latest local input.
  - `Run Right Proof`.
- ArrowLeft and ArrowRight update the local preview cursor position.
- Arrow keys and Z/X/C/Enter update the event feed as local input events.
- `Run Right Proof` uses the existing CORE/Genteel proof path and reports
  verified Right-input movement.
- The app does not claim full live manual controller injection into the
  emulator yet.

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

- ROM controls rendered under the viewport.
- Clicking the viewport changed the controls strip to `Input focused`.
- Pressing ArrowRight updated the event feed with `input.local.right`.
- Pressing Z updated the event feed with `input.local.a`.
- Latest input showed `A`.
- Clicking `Run Right Proof` changed latest input to `Right proof passed`.
- Runtime metadata showed `Right input verified`.
- Runtime metadata showed `Non-silent 1` for audio.

Native scripted proof:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml \
  v1_prompt_runs_core_asset_rom_when_tools_are_available \
  -- --ignored --nocapture
```

Result:

- The ignored live-environment test passed.
- The CORE ROM was built and run through Genteel.
- Right-input sprite movement was verified through the existing movement
  validator.
- Audio remained non-silent.

## Remaining Boundary

Manual key capture is currently local app state. It proves that the viewport can
receive keyboard focus and mapped keys, but continuous live input injection into
the running emulator remains future work.
