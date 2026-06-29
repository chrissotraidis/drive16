# Phase 3 V1 Prompt Evidence

This slice wires the Phase 3 app prompt path to a verified bundled
sprite/music ROM.

## Scope

- Native Tauri command `run_v1_prompt` accepts the chat prompt.
- The native command prefers the existing Phase 2 agent-produced project at
  `artifacts/phase2/agent-loop/project` when it exists locally.
- If that ignored artifact is absent, it falls back to the committed CORE
  reference fixture at `examples/phase2-core-assets`.
- The command verifies the CORE project contract before running:
  `drive16_player`, `drive16_loop`, `JOY_readJoypad`, `SPR_addSprite`,
  `SPR_update`, and `XGM_startPlay`.
- The command validates the bundled assets, builds the ROM with
  `scripts/build-sgdk.sh`, runs it in Genteel, captures a neutral frame stream,
  captures a Right-input screenshot, dumps audio, validates sprite movement,
  and checks the audio dump is non-silent.
- The chat composer detects the v1-style request and calls this command in the
  Tauri app.
- Browser preview uses an honest preview result and says that native
  verification runs inside the app.

## Native Verification

Focused Rust tests:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt -- --nocapture
3 passed; 1 ignored
```

Native v1 prompt run:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml \
  v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture
1 passed
```

The local Phase 2 agent project was present:

```text
Phase 2 agent project present
```

Frame stream:

```text
scripts/validate-frame-stream.py artifacts/phase3/v1-prompt/v1-frames.rgb565 --min-frames 6
Frame stream ok: 6 frames, indices 0..150, nonzero pixels 15760
```

Sprite movement:

```text
scripts/validate-sprite-movement.py artifacts/phase3/v1-prompt/v1-neutral.png \
  artifacts/phase3/v1-prompt/v1-right.png --direction right --min-delta 24 --min-changed 40
Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25
```

Audio:

```text
audio max abs: 10922 samples: 322386
```

Native artifacts:

- `artifacts/phase3/v1-prompt/v1-neutral.png`
- `artifacts/phase3/v1-prompt/v1-right.png`
- `artifacts/phase3/v1-prompt/v1-audio.wav`
- `artifacts/phase3/v1-prompt/v1-frames.rgb565`

## Browser Verification

Target:

```text
http://127.0.0.1:1420/
```

Flow:

```text
load app -> type "make a sprite I can move left and right with music" ->
send -> generated CORE ROM state appears in the right pane
```

Initial state:

- Page title was `Drive16`.
- OpenCode status rendered `OpenCode live`.
- Runtime metadata showed the starter blank ROM.
- Movement and Audio were `Pending`.
- Browser console warnings and errors were empty.

After prompt:

- The chat appended the user prompt.
- Browser preview appended:
  `Previewed the bundled sprite/music ROM flow. The native app command builds the ROM, verifies Right-input movement, and checks non-silent audio.`
- Project summary changed to `Generated CORE ROM`.
- ROM path changed to `examples/phase2-core-assets/out/rom.bin` in preview.
- Movement changed to `Right input verified`.
- Audio changed to `Non-silent 1` in preview.
- Event feed recorded `v1.ready`.
- Browser console warnings and errors remained empty.

Mobile check:

- Mobile viewport was set to `390` by `844`.
- The same prompt flow rendered `Generated CORE ROM`.
- Movement and Audio proof rows remained visible in runtime metadata.
- No horizontal document overflow was detected.
- Browser console warnings and errors remained empty.

Screenshots:

- `artifacts/phase3/v1-prompt-browser/browser-after-prompt.png`
- `artifacts/phase3/v1-prompt-browser/browser-mobile.png`

## Final Build Verification

Full Rust suite:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml
10 passed; 2 ignored
```

Rust check:

```text
cargo check --manifest-path app/src-tauri/Cargo.toml
passed
```

Frontend build:

```text
pnpm --dir app build
passed
```

Tauri debug build:

```text
pnpm --dir app tauri build --debug --no-bundle
finished dev profile and built app/src-tauri/target/debug/drive16
```

Secret scan and `git diff --check` also passed before commit.
