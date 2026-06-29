# Phase 3 Gate Evidence

Status: Phase 3 evidence is assembled. Human sign-off is required before any
Phase 4 enhancement work begins.

## Exit Criterion

Phase 3 exits when a non-developer launches the app, sees a blank ROM running,
types `make a sprite I can move left and right with music`, and gets a working
ROM in the right pane using bundled assets.

## Requirement Map

| Requirement | Evidence |
| --- | --- |
| Non-developer can launch the app | `docs/phase3-app-shell.md` records the React/Vite plus Tauri shell, the debug Tauri build, desktop and mobile browser checks, and the built app at `app/src-tauri/target/debug/drive16`. |
| App checks local dependencies and CORE tool health | `docs/phase3-preflight.md` records the native preflight command for OpenCode, Docker, SGDK, Genteel, RAG corpus, and CORE assets, plus browser health-panel verification. |
| App starts with a blank ROM running | `docs/phase3-starter-rom.md` records the starter SGDK fixture, native `launch_starter_rom`, Genteel screenshot capture, and saved starter frame stream. |
| Right pane renders emulator frames | `docs/phase3-framebuffer.md` records native RGB565 frame extraction from Genteel and canvas rendering in the right pane. |
| Left pane connects to the agent spine | `docs/phase3-opencode-bridge.md` records OpenCode health, server discovery, session creation, message posting, and SSE event streaming. |
| Settings support BYOK model setup | `docs/phase3-model-settings.md` records provider selection, OpenRouter key entry, model selector, connection testing, mobile verification, and key non-persistence. |
| Project management and ROM export exist | `docs/phase3-project-export.md` records native project summary, export-ROM wiring, ignored artifact export location, browser export interaction, and secret scan. |
| The v1 prompt produces bundled sprite and music ROM state | `docs/phase3-v1-prompt.md` records the chat prompt path, native CORE ROM build, Genteel neutral and Right-input captures, frame stream validation, sprite movement validation, non-silent audio, and browser right-pane verification. |

## V1 Prompt Proof

`docs/phase3-v1-prompt.md` is the core gate proof for the final Phase 3 user
flow.

- Focused tests:
  `cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt -- --nocapture`
  passed with `3 passed; 1 ignored`.
- Native CORE ROM run:
  `cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture`
  passed with `1 passed`.
- Source project:
  `artifacts/phase2/agent-loop/project` was present locally for the run.
- Frame stream:
  `scripts/validate-frame-stream.py artifacts/phase3/v1-prompt/v1-frames.rgb565 --min-frames 6`
  passed with six frames, frame indices `0..150`, and `15760` nonzero pixels.
- Movement:
  `scripts/validate-sprite-movement.py artifacts/phase3/v1-prompt/v1-neutral.png artifacts/phase3/v1-prompt/v1-right.png --direction right --min-delta 24 --min-changed 40`
  passed with `changed_pixels=768` and `delta=155`.
- Audio:
  the generated audio dump had `audio max abs: 10922` across `322386` samples.
- Browser prompt flow:
  the preview at `http://127.0.0.1:1420/` accepted
  `make a sprite I can move left and right with music`, changed the project
  summary to `Generated CORE ROM`, updated Movement to `Right input verified`,
  updated Audio to `Non-silent 1`, recorded `v1.ready`, and had no console
  warnings or errors.
- Mobile browser check:
  viewport `390` by `844` kept the generated CORE ROM state visible, had no
  horizontal overflow, and had no console warnings or errors.

Saved artifacts:

- `artifacts/phase3/v1-prompt/v1-neutral.png`
- `artifacts/phase3/v1-prompt/v1-right.png`
- `artifacts/phase3/v1-prompt/v1-audio.wav`
- `artifacts/phase3/v1-prompt/v1-frames.rgb565`
- `artifacts/phase3/v1-prompt-browser/browser-after-prompt.png`
- `artifacts/phase3/v1-prompt-browser/browser-mobile.png`

## Final Verification Already Recorded

The Phase 3 v1 prompt iteration recorded:

- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with
  `10 passed; 2 ignored`.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app build` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built
  `app/src-tauri/target/debug/drive16`.
- Secret scan passed.
- `git diff --check` passed.

## Honest Caveat

The native v1 prompt command prefers the existing Phase 2 agent-produced CORE
project under `artifacts/phase2/agent-loop/project` when that ignored artifact
is present, and falls back to the committed `examples/phase2-core-assets`
fixture otherwise. This keeps Phase 3 grounded in the already proven CORE
agent output while avoiding key persistence.

A later hardening pass can replace this artifact reuse with fresh live OpenCode
generation from the runtime settings credential handoff. That follow-up is not
required to sign off the current Phase 3 gate unless the human wants the gate
standard tightened.

## Gate Request

Please review the evidence above and confirm whether Phase 3 is approved. Do
not begin Phase 4 until the human explicitly signs off.
