# Phase 8 Next-Agent Handoff

Status: historical handoff, superseded by the July 5 overhaul.

Last updated: 2026-07-07.

## How To Read This Now

This file used to be the current resume point for the Phase 8 UI/IA repair
track. It is no longer the current project handoff. The app moved into the
2026-07-05 overhaul recorded in `PROGRESS.md`, `WORKLOG.md` iterations 112-114,
and `docs/overhaul-plan.md`.

Use this file only as context for what was true at the end of Phase 8:

- Phase 8 repaired the UI enough to make the app usable in normal desktop
  windows.
- It verified native file-picker open/cancel paths and the visible button paths
  available without external files.
- It kept Genteel proof separate from interactive Play and kept dev-CDN Play
  caveated.

## Current State After The Overhaul

The current code state is different:

- Desktop chat is wired to the real OpenCode agent path in `app/src/App.tsx`.
  A minimal OpenRouter smoke showed same-session OpenCode turns can repeat the
  first instruction, so the app now starts a fresh OpenCode session per build
  turn and keeps continuity in the active project workspace. Direct
  app-payload turns can edit and rebuild the active project twice in a row, and
  the native UI click-through now did the same with `NATIVE ONE` then
  `NATIVE TWO`. Browser preview still has a limited fallback path because it has
  no Tauri agent bridge.
- The OpenCode bridge in `app/src-tauri/src/opencode.rs` sends real agent
  requests with `noReply: false` for desktop chat and has a long timeout for
  build runs.
- `opencode.json` loads `agent/skills/drive16-app-builder.md` plus SGDK,
  emulator, RAG, ComfyUI, and MML MCP tools.
- The active mutable project lives in
  `artifacts/phase3/active-project`, created from
  `examples/app-starter-blank`.
- Agent-built ROMs load into the player when
  `artifacts/phase3/active-project/out/rom.bin` exists; the July 7 native pass
  verified this after text, music, and sprite turns.
- Player audio is wired through the Nostalgist/RetroArch Web Audio path with a
  mute control. Direct generated-MML proof passes; chat music now generated
  `upbeat_loop.vgm`, wired resources, changed `main.c`, and rebuilt the ROM.
  Native speaker playback still needs a separate audible pass.
- ComfyUI setup and local tooling exist. The API must be running on
  `127.0.0.1:8188`; once launched, readiness, direct sprite generation, and the
  generated-assets proof pass. Native chat sprite generation also passed with a
  32x32 `spaceship.png`, `spaceship_sprite`, and a rebuilt ROM.
- ROM imports are capped at 16 MB and Play core files at 96 MB.

## Current Resume Point

Resume with builder reliability and playability before release hardening:

1. Keep live build logging visible in the chat rail: visible rows should be
   meaningful events, heartbeat should stay pinned instead of repeating, the
   newest visible event should stay in view, and the raw log should remain
   available for debugging. Session-scoped OpenCode activity should only affect
   the visible log/evidence when it belongs to the current pending build; stale
   session activity after reset/finish must not leak into the new project.
2. Keep `GAME.md` and `PLAYTEST.md` in active projects so continued work has
   concept, asset, issue, and evidence context.
3. Require the builder to ask a few questions or state a default plan for broad
   prompts unless the user says to just build.
4. Require playability evidence before saying a game is done: movement,
   controls, visibility, start/restart, score state, no instant game-over, and
   style match. The visible evidence row should carry agent/preview audio proof
   as `Audio: checking`, `Audio: captured`, `Audio: silent`, or `Audio: failed`
   rather than burying audio status only in the raw log. It now also includes
   an aggregate playability gate: `Gate: no ROM`, `Gate: incomplete`,
   `Gate: failed`, or `Gate: verified`.
5. Preserve explicit asset disclosure: ComfyUI, MML, bundled assets, or
   primitive tiles. `ASSETS.md` is now the role ledger. ComfyUI should be
   treated as one validated Genesis-safe sprite PNG per semantic role, not a
   generic decoration or complete sprite sheet; simple geometry should stay
   primitive unless the user asks for styled generated art.
6. Keep release hardening queued after this gate: app-data storage, bundling,
   CSP, license, and public core policy.

## Still Not Verified In This Doc Pass

This doc is still historical. The July 7 reliability pass did perform fresh
native OpenCode prompt runs and live ComfyUI sprite generation, but it did not
verify a packaged installable app or perform a separate audible speaker pass.

## Guardrails

- Keep Genteel Verify/Capture Proof separate from interactive Play.
- Keep the desktop project header sourced from the active project workspace.
  The older starter-project summary is historical context and must not
  overwrite the current project name on refresh.
- Do not commit API keys, commercial ROMs, emulator core binaries, model
  weights, or generated artifacts that belong under ignored artifact folders.
- Do not imply the dev-CDN Play path is public-release ready.
- Do not describe Ollama as a working build-agent path until it is implemented
  and verified.
