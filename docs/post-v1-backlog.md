# Post-V1 Backlog

This file is the current backlog after the July 5 overhaul. Older Phase 7/8
backlog items are kept in their phase docs as history; do not treat them as the
current resume point unless a new goal explicitly reopens them.

## Current Priority - Builder Reliability And Playability

Recent Snake testing showed the app can build a ROM while still leaving the
user blind during the run, overclaiming completion, and producing a game that
is not yet a comfortable playable result. Treat the next work as making the
builder loop honest and observable before packaging:

- Show live build activity in the chat rail: plan, reads, edits, build
  attempts, failures/fixes, asset generation, ROM runs, input tests, and
  screenshot/audio checks.
- Keep `GAME.md` and `PLAYTEST.md` in every active project and require the
  builder to read/update them on continued work.
- Require broad prompts to ask a few questions or state a default plan before
  building, unless the user says to just build.
- Treat playability as a gate: visible movement, controls, start/restart,
  score state, no instant game-over, and requested style must be verified
  before saying a game is done.
- Make asset usage explicit: ComfyUI, MML, bundled assets, or primitive tiles.
- Keep the broken Snake project as the current proof case until it remains
  playable through native UI testing as well as headless evidence.

## Next Priority - Release Hardening

After the builder reliability/playability gate is credible, resume packaging
work:

- Move repo-locked paths from `CARGO_MANIFEST_DIR` / `artifacts/...` to
  app-data storage and bundled resources where appropriate.
- Enable and verify Tauri bundling for an installable macOS app.
- Add `LICENSE` after the owner confirms the intended MIT license.
- Set a real CSP instead of `csp: null`.
- Decide the public interactive Play core policy. The current Nostalgist dev
  CDN fallback is useful for local development, but it is not a release policy.
- Run a native smoke pass against the packaged app, not only the browser
  preview.

## Reliability Smoke To Keep

- Refresh persistence is covered by browser smoke for the OpenRouter key, AI
  sprites toggle, MML music toggle, and ComfyUI endpoint/checkpoint/LoRA values.
- Logging is improved around OpenCode auth, session creation, prompt finish,
  tool activity, failed-build fixing/retry/fixed states, ROM detection, and
  failure duration.
- Broad vague prompts are covered by browser smoke: `Build a game.` asks quick
  design questions and does not spend a model call.
- Native UI chat completed consecutive edit/build turns: `NATIVE ONE`, then
  `NATIVE TWO`.
- Native chat generated and wired MML music into `upbeat_loop.vgm`, resources,
  `main.c`, and a rebuilt ROM. Native speaker playback still deserves a
  separate audible pass.
- Native chat generated a 32x32 ComfyUI `spaceship.png`, wired
  `spaceship_sprite`, rebuilt the ROM, and reloaded the player while the local
  API was running.
- The Snake proof-case now has live agent evidence for project-note reads,
  build, ROM run, scripted input, screenshot capture, and `PLAYTEST.md`
  update. The event-contract verifier keeps those raw agent events mapped to
  visible chat-log labels.
- The same Snake project now has direct generated-assets evidence: ComfyUI
  `res/snake_head.png`, MML `res/snake_theme.vgm`, rebuilt ROM, neutral and
  scripted screenshots, movement diff, and non-silent emulator audio under
  `artifacts/phase9/generated-snake-proof/`. Treat this as proof the pipeline
  can wire assets, not proof that the generated art is final quality.

## Still Useful Product Work

- Broader prompt bakeoff for the OpenCode builder agent.
- Fully local Ollama build-agent support. Ollama is currently readiness-only
  for desktop building.
- Multi-project workspace switching beyond the current active workspace and
  saved snapshots.
- Richer generated asset review, regenerate, and correction UI.
- Fully managed ComfyUI lifecycle if local sprite setup remains painful.
- Full controller remapping editor, multi-controller support, and packaged
  hardware QA.
- Generalized multi-ROM library and metadata browser.

## Completed Or Superseded Backlog

- Phase 7 interactive-core policy and user-supplied core setup are implemented.
- Phase 7 input profiles, keyboard mapping, and basic controller detection are
  implemented.
- Phase 8 OpenRouter freeform replies and first-run readiness hub were
  implemented, then superseded by the July 5 desktop-agent path.
- Phase 8 UI repair Slices 1-7 are historical; the current shell was rebuilt in
  the overhaul.
- Interactive audio is no longer an open backlog item; the Nostalgist player
  now resumes Web Audio and exposes a mute control.
- ROM/core import size caps are no longer open; the current limits are 16 MB
  for ROM imports and 96 MB for Play core files.

## Historical Context

The 2026-07-02 review packet in `docs/review/` is still useful decision
support. Its claims were correct for Phase 8, but the active continuation path
now starts from `PROGRESS.md`, `WORKLOG.md` iterations 112-114, and
`docs/overhaul-plan.md`.
