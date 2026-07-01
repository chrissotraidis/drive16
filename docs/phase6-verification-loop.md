# Phase 6 Verification Loop

Phase 6 now has a repeatable verification entrypoint:

```sh
scripts/verify-phase6-loop.sh --browser
```

The loop writes logs and browser screenshots under ignored local storage:

```text
artifacts/phase6/verify-loop/<timestamp>/
```

## What It Checks

- Frontend build: `pnpm --dir app build`
- Native format: `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check`
- Native tests: `cargo test --manifest-path app/src-tauri/Cargo.toml`
- Optional generated CORE proof:
  `cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture`
- Git whitespace: `git diff --check`
- Tracked artifact hygiene: no committed ROM/core/model-weight artifacts.
- Secret hygiene: no tracked OpenRouter key pattern.
- Browser smoke, when the preview is reachable or `--browser` is passed.

## Browser Smoke

The browser smoke expects a Drive16 preview at:

```text
http://127.0.0.1:1420/
```

It exercises the current v1-critical controls:

1. Load the app and confirm the Drive16 shell is meaningful, not blank.
2. Open the project menu.
3. Import a local repo-generated ROM file.
4. Focus the ROM viewport and press ArrowRight.
5. Click Play ROM.
6. Pause, resume, reset, and stop the interactive player.
7. Verify the active ROM proof preview.
8. Save and export.
9. Reload at a narrow viewport and check for horizontal overflow.

The smoke captures screenshots for initial load, project menu, player stopped,
and mobile layout.

By default it imports:

```text
examples/app-starter-blank/out/rom.bin
```

Use another local ROM with:

```sh
scripts/verify-phase6-loop.sh --browser --rom /path/to/test-rom.bin
```

## Modes

Run once and require a live browser preview:

```sh
scripts/verify-phase6-loop.sh --browser
```

Run the native/build/hygiene checks without browser automation:

```sh
scripts/verify-phase6-loop.sh --no-browser
```

Run the slower generated CORE proof too:

```sh
scripts/verify-phase6-loop.sh --browser --with-v1-proof
```

Repeat the loop:

```sh
scripts/verify-phase6-loop.sh --browser --repeat 3
```

Keep running until a regression appears:

```sh
scripts/verify-phase6-loop.sh --browser --until-fail
```

## Remaining Manual Check

This loop covers the browser preview and native Rust command/test surface. The
remaining human check from the Phase 6 evidence still matters: in the native
Tauri window, run or select a generated CORE ROM, click Play ROM, confirm it
starts without importing first, press ArrowRight, then Pause/Resume/Stop.
