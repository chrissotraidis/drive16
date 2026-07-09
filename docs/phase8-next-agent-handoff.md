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
  requests for desktop chat and has a long timeout for build runs. The bridge
  now detects the common `4096`/HTTP 401 conflict where another local tool owns
  the default agent port, reports that plainly, and launches a Drive16-owned
  alternate local port instead of blaming the model. Restart paths stop only
  the child process Drive16 owns; if a separate healthy server is still on the
  current endpoint, Drive16 moves itself to a fresh owned port rather than
  killing unrelated local OpenCode processes.
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
- ComfyUI setup and local tooling exist. Settings can check readiness and launch
  the local API through `scripts/launch-phase4-comfyui-api.sh`; once running,
  readiness, direct sprite generation, and the generated-assets proof pass.
  Native chat sprite generation also passed with a 32x32 `spaceship.png`,
  `spaceship_sprite`, and a rebuilt ROM. If readiness is not `ready`, the agent
  prompt now tells the builder to use primitive/manual Genesis-safe art and
  record that fallback instead of claiming ComfyUI generation.
- ROM imports are capped at 16 MB and Play core files at 96 MB.

## Current Resume Point

Resume with builder reliability and playability before release hardening:

0. Verify the new local-dependency recovery paths in the native app: OpenCode
   should recover when port `4096` is occupied by a non-OpenCode service, and
   Settings should show ComfyUI `Starting` / `Ready` / exact failure states when
   using the Launch and Test buttons. The compact AI sprites status now labels
   common blockers as `Not running`, `Missing model`, `Missing LoRA`, or
   `Missing model + LoRA`; live sprite use still needs the generated-asset
   proof gate.
1. Keep live build logging visible in the chat rail: visible rows should be
   meaningful events, heartbeat should stay pinned instead of repeating, the
   newest visible event should stay in view, and the raw log should remain
   available for debugging. Session-scoped OpenCode activity should only affect
   the visible log/evidence when it belongs to the current pending build; stale
   session activity after reset/finish must not leak into the new project.
   The app now derives a compact phase label from real OpenCode events:
   Planning, Editing, Building, Testing, Done, or Failed.
2. Keep `GAME.md`, `ASSETS.md`, and `PLAYTEST.md` in active projects so
   continued work has concept, asset, issue, and evidence context. The app
   project menu now previews `ASSETS.md` role rows and small repo-local PNG
   thumbnails, but the agent still has to keep those rows truthful.
3. Require the builder to ask a few questions or state a default plan for broad
   prompts unless the user says to just build.
4. Require playability evidence before saying a game is done: movement,
   controls, visibility, start/restart, score state, no instant game-over, and
   style match. The visible evidence row should carry agent/preview audio proof
   as `Audio: checking`, `Audio: captured`, `Audio: silent`, or `Audio: failed`
   rather than burying audio status only in the raw log. It now also includes
   an aggregate playability gate: `Gate: no ROM`, `Gate: needs repair`,
   `Gate: failed`, or `Gate: verified`. `scripts/verify-project-memory.mjs`
   now rejects passing Snake/Pong/Tetris/Asteroids-style gates unless
   `PLAYTEST.md` records the relevant genre evidence; it also rejects a passing
   gate without active music/SFX evidence unless the project explicitly says
   audio was disabled or omitted by request. `pnpm --dir app
   verify:project-memory` now includes temporary genre fixtures for those four
   prompt families. The desktop app also surfaces that active-project gate in
   chat after an agent-produced ROM appears, so a built ROM with failed or
   missing playability memory is labeled as needing repair/unverified.
5. Preserve explicit asset disclosure: ComfyUI, MML, bundled assets, or
   primitive tiles. `ASSETS.md` is now the role ledger and should start with an
   Asset Plan before generation. ComfyUI should be treated as one validated
   Genesis-safe sprite PNG per semantic role, not a generic decoration or
   complete sprite sheet; simple geometry should stay primitive unless the user
   asks for styled generated art. Music/SFX rows should include compile status,
   ROM resource use, and audio evidence as captured, silent, or untested.
6. Run the model bakeoff only after the plumbing gates above are freshly
   verified. First run `pnpm --dir app check:live-game-audit-readiness`; it
   writes `artifacts/phase9/live-game-audit/readiness.json` and should block on
   missing app preview, OpenCode/OpenRouter, Docker/SGDK, contract, or
   project-memory prerequisites. The report has two readiness levels:
   primitive/fallback audit readiness and generated-sprite audit readiness.
   Docker is currently running and the direct generated-assets proof passed
   while ComfyUI was launched in the foreground. A detached shell ComfyUI
   restart did not stay listening afterward, so expect primitive/fallback
   readiness to be green while generated-sprite readiness remains false unless
   the app launch path or foreground launch has started ComfyUI again. Then run
   `pnpm --dir app prepare:live-game-audit` so readiness is refreshed and the
   next `report.json` template starts with plumbing fields from the current
   machine state. Prepare each native prompt run with
   `pnpm --dir app prepare:live-game-audit:prompt -- --prompt snake-basic`;
   run it with `pnpm --dir app run:live-game-audit:prompt -- --prompt
   snake-basic --model openrouter/<model>`, repeating for Pong, Tetris, and
   Asteroids. Each run writes an isolated project, prompt, trace, and
   `run-record.json` under `artifacts/phase9/live-game-audit/runs/`; real runs
   stream live JSONL/stderr to `opencode-run.jsonl` and `opencode-run.stderr`
   and expose process state in `opencode-run.status.json`. That
   packet must prove compile,
   preview, screen, input, restart, audio, asset-ledger, gameplay-rule, and
   project-memory evidence before it can be trusted. After that, use
   `pnpm --dir app prepare:model-bakeoff` for the cross-model report across
   DeepSeek V3.1 and at least two stronger alternatives; that command refuses
   to write the bakeoff template until
   `pnpm --dir app verify:live-game-audit:report` passes. `pnpm --dir app
   verify:live-game-audit` and `pnpm --dir app
   verify:model-bakeoff` currently self-test the report verifiers; they are not
   evidence that the live audit or bakeoff has run. Use
   `pnpm --dir app verify:live-game-audit:report` for the actual completed
   audit packet; it should fail until every required native prompt run and
   evidence file exists. Use `pnpm --dir app verify:model-bakeoff:report` for
   the actual completed bakeoff packet; it should fail until every model/prompt
   run has evidence files.
   Current historical live-audit evidence is failed DeepSeek V3.1 `snake-basic`
   evidence under `artifacts/phase9/live-game-audit/runs/`, not a pass. The
   first recorded run compiled after one repair and reached emulator
   frame/input checks, but failed the evidence loop because no
   `capture_audio` call/audio dump happened and project memory still failed.
   A later retry that explicitly asked for `verify_audio` got stuck earlier:
   it tried invalid MML syntax three times before reading
   `corpus/mml/ctrmml-megadrive.md`, then edited `src/main.c` after the
   existing `out/rom.bin` timestamp and never rebuilt, ran, captured input, or
   verified audio after that final edit. A manual post-run SGDK build of that
   final source failed on deprecated `VDP_setPlanSize`, proving the ROM was
   stale evidence. `scripts/verify-opencode-audio-trace.mjs` now catches the
   old missing-audio pattern, and the builder prompt should use
   `verify_audio` first, read/query the MML corpus before compiling, stop music
   retries after two failures, and rebuild after the final source/resource edit.
   The live-game audit verifier also rejects a passing run when `out/rom.bin`
   is older than project `src/` or `res/` files. Fix the underlying completion
   loop before running the remaining prompt set.
   A newer primitive/fallback retry proved the MML-read rule is taking effect,
   but exposed a stricter sequencing bug: the agent read the MML corpus first,
   then made five failed `drive16-mml-music_compile_music` calls, never reached
   source implementation, build, emulator frame capture, input, or audio
   verification, and overclaimed music in `GAME.md`. The audio trace verifier
   now rejects repeated failed `compile_music` calls after the two-attempt cap,
   and the builder prompt now states that core playable gameplay comes before
   optional music unless the user explicitly asks for music-first work.
   A later primitive/fallback trace was interrupted after `GAME.md`, `ASSETS.md`,
   and `src/main.c` edits but before `build_rom`, frame capture, input, or audio
   verification. Treat it as incomplete evidence, not a finished model verdict.
   It did expose a useful guard: the command
   `scripts/verify-opencode-audio-trace.mjs --expect-game-progress` now fails
   traces where source/resource edits are not followed by a rebuild, frame
   capture, and input evidence, and the live-audit verifier now applies that
   trace check to passing runs.
   The native project-memory audit now also rejects weak
   `Playability gate: PASS` notes before the app surfaces a build as verified:
   PASS needs an Evidence section without pending/untested markers, genre
   evidence for the detected game type, and captured/non-silent audio evidence
   or an explicit no-audio request.
   The app also tracks pending-run milestones now: source/resource edit, build,
   screen check, input check, and audio check. If OpenCode stalls after one of
   those milestones, the visible error should name the missing next step.
   The ComfyUI Launch button now writes
   `artifacts/phase4/comfyui-api/drive16-comfyui-launch.log`; if launch exits
   before `/system_stats` becomes reachable, Settings should report the exit
   status and the tail of that log. The managed child is tied to the requested
   endpoint, so changing the Settings endpoint/port should relaunch Drive16's
   child instead of waiting on a process listening somewhere else.
7. Keep `pnpm --dir app verify:project-memory` green. It now checks the active
   project plus temporary genre fixtures and audio fixtures, including
   missing/uncaptured/explicitly omitted audio.
8. Keep release hardening queued after this gate: app-data storage, bundling,
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
- Keep app refresh passive for remembered ROMs. If the active project already
  has `out/rom.bin`, Drive16 should show that the ROM is available, but it
  should not auto-load preview frames or start playback until the user presses
  Verify or Play.
- Keep player audio safety volume-based. Interactive Play should start with
  RetroArch at minimum volume and app volume at 0%; do not reintroduce
  toggle-mute startup logic that can accidentally invert the sound state. New
  Project should also reset app volume to 0% even when no active player runtime
  exists.
- Keep agent-finished ROMs tied to real preview evidence. If the UI says it is
  loading/checking a generated ROM, the completion path must call the ROM
  preview loader and preserve an error state when that capture fails.
- Treat preview capture as a hard prerequisite for optimistic completion UI.
  Even if project memory says `Playability gate: PASS`, a failed preview load
  must surface `Preview failed` and keep the build in an error state.
- Keep the phase labels evidence-based. OpenCode `finished` should display as
  Testing while Drive16 performs preview capture and project-memory audit; only
  the explicit verification-passed event should display as Done.
- Do not commit API keys, commercial ROMs, emulator core binaries, model
  weights, or generated artifacts that belong under ignored artifact folders.
- Do not imply the dev-CDN Play path is public-release ready.
- Do not describe Ollama as a working build-agent path until it is implemented
  and verified.
