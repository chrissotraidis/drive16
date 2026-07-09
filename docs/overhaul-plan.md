# Drive16 Overhaul Plan

Date: 2026-07-05
Status: functional reliability, first-run, presentation-v2 baseline, model
comparison, MIT licensing, and ad-hoc direct-download packaging are verified

This plan came from a full four-track audit (agent pipeline, UI, native
backend/emulator, asset-generation pipelines). It replaces the Phase 8
"UI repair slice" treadmill with a product-level plan aimed at the original
vision: a Lovable/Bolt-style conversational Genesis game builder anyone can
use.

## Current implementation status

Updated 2026-07-10 after the final reliability, presentation, and packaging
audits:

- The deterministic Snake, Pong, Tetris, and Asteroids skeletons now use custom
  tile art and composed playfield panels instead of sparse text glyphs. All
  four build, pass screenshot-quality contract v2, and emit non-silent audio.
  The 12 historical model outputs were rescored under v2; none pass the new
  presentation bar, so their comparison is operational rather than a visual
  sign-off.

- Track E now has writable app-data runtime paths, bundled support resources,
  an explicit CSP, a user-supplied release core policy, ad-hoc whole-bundle
  signing, DMG integrity checks, an isolated first-launch smoke, and an MIT
  `LICENSE`. The owner chose direct download rather than App Store or
  Apple-notarized distribution; notarization is optional future install polish.

- The July 7 native evidence proved important plumbing, but user testing of a
  generated Snake ROM showed the product can still build a ROM while hiding
  progress, skipping meaningful playability gates, and overclaiming completion.
  The active gate is now visible chat logging, per-project game/playtest notes,
  sound-toggle correctness, explicit asset disclosure, and playable evidence.
  Release hardening should not resume until this is stable.

- Track A is wired in the desktop app: `app/src/App.tsx` routes Tauri chat
  through the OpenCode agent, `opencode.rs` sends real `noReply: false`
  requests, and `opencode.json` loads the Drive16 builder skill plus SGDK,
  emulator, RAG, ComfyUI, and MML MCP tools. Minimal OpenRouter smokes showed
  same-session OpenCode turns can repeat the first instruction, so the app now
  starts a fresh OpenCode session for each build turn while preserving state in
  the active project workspace. Native UI turns now edit and rebuild the same
  active project repeatedly; the verified pass changed `NATIVE ONE` to
  `NATIVE TWO` and reloaded the player from the rebuilt ROM.
- Track B is partially wired: `app/src/player/nostalgist.ts` resumes the
  RetroArch Web Audio context and exposes mute state. Direct generated-MML
  tooling passes; chat-through-agent music now generated `upbeat_loop.vgm`,
  wired it through SGDK resources, changed `main.c`, rebuilt the ROM, and
  reloaded the player. Native speaker playback still needs a separate audible
  pass.
- Track C is implemented as a rebuilt two-pane shell with extracted React
  components under `app/src/components/`; `App.tsx` is smaller but still owns
  most app state.
- Track D is now proven in the native product loop while local services are
  running: the agent has music and sprite-generation recipes, and the supporting
  scripts remain local/optional.
  ComfyUI failed when the API process was not running; with
  `scripts/launch-phase4-comfyui-api.sh` running, readiness, direct sprite
  generation, the generated-assets proof, and native chat sprite generation all
  pass.
- Track E is technically hardened for a local release: Docker/Genteel timeouts,
  import caps, app-data paths, bundling, CSP, and public interactive-core policy
  are implemented. The MIT license and direct-download distribution posture are
  now owner-confirmed.

The audit below describes the pre-overhaul app. Do not read statements such as
"the shipped app does not have an agent", "audio gated", or "image generation
is unreachable" as current code truth.

## Audit: the five root causes

### 1. The agent was never plugged in (the #1 bottleneck)

The shipped app does not have an agent. `submitMessage()` in
`app/src/App.tsx` routes every prompt through `isV1Prompt()` — a literal
string match for words like "sprite" + "music" + "move". That one prompt runs
a hardcoded proof script (`v1_prompt.rs`). Every other prompt goes to
OpenRouter as plain chat, with a system prompt that explicitly forbids the
model from building anything, plus regex "overclaim" guards.

Meanwhile the real machinery exists and works — but only in CLI harnesses:

- `mcp-servers/sgdk-build/server.py` (build_rom, read_build_log) — works.
- `mcp-servers/emulator/server.py` (run_rom, capture_frame, capture_audio,
  send_input) — works.
- RAG corpus (`corpus/`) indexed via mcp-local-rag — works.
- Agent skill file `agent/skills/phase2-core-assets.md` — written, never
  loaded by the app.
- OpenCode bridge (`app/src-tauri/src/opencode.rs`) — spawns/connects to
  `opencode serve`, but posts messages with hardcoded `noReply: true`. The
  app uses OpenCode as a message logger, never as the agent.

`scripts/validate-phase1-agent-loop.py` / `validate-phase2-agent-loop.py`
prove the full conversation → C code → build → run → verify loop works
end-to-end outside the app. The app never calls it. Roughly 85% of the loop
exists; 0% is reachable from the chat box.

### 2. The UI is a monolith built around the wrong story

`App.tsx` is 5,896 lines, 41 useState hooks, zero component decomposition,
no state store; `styles.css` is 2,952 lines. Six overlapping status enums,
21+ label-mapping functions, and the same icon+label+detail readiness pill
rendered 40+ times. Modals take 20–24 drilled props. The language of the UI
is the language of the dev process ("proof", "readiness", "verify right",
"phase 8 hub") instead of the product ("build my game", "play it").

The one good property: the backend boundary is clean — 21 typed Tauri
commands. A new shell can be built against them without touching Rust.
Verdict from the audit: rebuild the shell, don't incrementally refactor.

### 3. Music "doesn't work" because the interactive player has no audio

The music pipeline itself is ~95% functional: MML → ctrmml → VGM → SGDK XGM
→ ROM builds, and Genteel headless verification confirms non-silent audio
(audio_max_abs=14043). But the interactive player
(`app/src/player/nostalgist.ts`) never initializes/routes Web Audio; the
`PlayerAudioState` type exists and is never set; the UI shows "Audio gated".
So every ROM plays silently in the app, and the user experiences "music is
broken" even though the generated VGM is fine.

### 4. Image generation exists but is unreachable from the app

ComfyUI sprite pipeline is ~85% built: tuned workflow JSON
(`assets/enhancements/comfyui/drive16-genesis-sprite.workflow.json`), a
production-quality 544-line Genesis constraint validator
(`scripts/validate-generated-sprite.py`: 32x32, 16 colors, index-0
transparency, tile alignment), and 1,000 lines of readiness checking in
`comfyui.rs`. What's missing: any way to actually generate a sprite from the
app. There is no "generate" command, no UI trigger, no agent tool. It is
readiness-check theater.

### 5. The app is repo-locked and fragile

- `repo_root()` is baked at compile time from `CARGO_MANIFEST_DIR`; every
  path (examples/, scripts/, artifacts/) assumes the git checkout. Tauri
  bundling is disabled (`tauri.conf.json: bundle.active=false`). A packaged
  .app cannot work.
- SGDK Docker build has no timeout — Docker hang = app hang.
- ROM/core imports have no size limits (full base64 into memory).
- Genteel is cloned/patched/built on demand; failure leaves dirty state.
- No LICENSE file. CSP is null.

## What already works (keep it)

- SGDK Docker build path, Genteel headless verify + frame stream, sprite
  movement validation, audio-dump validation.
- Bundled CORE assets (player.png, loop.vgm) and the starter project.
- MCP servers: sgdk-build, emulator, mml-music, RAG corpus.
- The 21 typed Tauri commands (project save/open/export, ROM import,
  interactive core import, endpoint checks).
- Interactive play via Nostalgist with user-supplied core, keyboard +
  gamepad input profiles, now with the Web Audio resume/mute path.
- ComfyUI workflow contract + sprite validator.

## The plan

Ordering principle: make the core loop real first (that is the product),
ship the audible/visible wins early, rebuild the shell in parallel on the
clean Tauri contract, then wire asset generation into the same agent loop.

### Track A — Make conversation actually build games (core loop)

Goal: any reasonable prompt ("make the sprite blue", "add a second enemy",
"make it scroll") results in the agent editing C, building, verifying, and
the new ROM appearing in the player.

1. Finish the OpenCode wiring that Phase 3 skipped:
   - Send user prompts as real agent requests (remove `noReply: true`).
   - Inject provider credentials (OpenRouter key / Ollama endpoint) into
     OpenCode config at connect time.
   - Load the system prompt + skill files (extend
     `agent/skills/phase2-core-assets.md` into a proper "Drive16 builder"
     skill) and enable the MCP servers from `opencode.json`.
   - Stream OpenCode SSE events into the chat rail as live tool activity
     ("writing player.c", "building ROM", "build error, fixing...").
   - On successful build, auto-load the fresh ROM into the player pane.
2. Give the agent a real project workspace: one active SGDK project dir per
   Drive16 project (start from the starter template), which the agent edits
   and the app builds/plays/exports. Kill the split between
   `examples/app-starter-blank`, `artifacts/phase2/.../project`, and
   imports.
3. Delete the string-match router, the overclaim regex guards, and the
   freeform gating copy. With a real agent there is nothing to overclaim.
   Fallback: if OpenCode proves unreliable as the spine, replace it with a
   direct in-app tool-calling loop (TS against OpenRouter/Ollama chat
   completions, calling the same MCP servers). The MCP tools and prompts
   carry over either way.

Exit: 5 varied prompts in a row produce built, playable ROMs with visible
agent progress and self-correction on a deliberate compile error.

### Track B — Make it audible (small, do first)

1. Initialize/resume the Web Audio context on the Play click (user gesture),
   wire Nostalgist/RetroArch audio output, add mute/volume to the player.
2. Set `PlayerAudioState` truthfully; remove "Audio gated" copy.
3. Verify with the bundled-loop ROM and a generated-MML ROM.

Exit: click Play, hear music.

### Track C — Rebuild the shell (the UI overhaul)

Rebuild, not refactor. New component tree against the existing 21 Tauri
commands + the Track A agent stream.

1. Target experience (matches the original architecture doc §3.11):
   - Left: conversation. Messages, streamed agent actions, input box.
     Nothing else.
   - Right: the game, big. Play/pause/reset, volume, fullscreen. Controls
     mapping behind one small button.
   - Top bar: project name/switcher, model indicator, Export.
   - One Settings view: provider + key + test, enhancements (sprites/music),
     advanced diagnostics tucked at the bottom.
   - First-run: a single setup checklist (Docker, emulator, model key) that
     replaces the "readiness hub", then drops you into a running starter ROM.
2. Structure: ~10 components (ChatRail, MessageList, Composer, PlayerPane,
   TransportBar, TopBar, SettingsView, SetupChecklist, ProjectMenu,
   StatusPill), 4–6 hooks (useAgentSession, usePlayer, useProject,
   useProviderSettings, useInputProfile), one Zustand (or context) store.
   One status enum, one StatusPill component.
3. Language pass: no "proof", "readiness", "verified", "slice", "phase" in
   user-facing copy. Build states: building / running / error. That's it.
4. Keep `player/` (input, nostalgist, coreReadiness) mostly as-is; it's the
   healthiest frontend code.

Exit: the app reads as chat-left / game-right with one status language;
App.tsx retired.

### Track D — Wire in image (and music) generation as agent tools

1. Sprite generation end-to-end in-app: a native `generate_sprite(prompt)`
   command (or MCP call from the agent) that enqueues the ComfyUI workflow,
   polls with a timeout, downloads the PNG, runs the existing validator,
   and drops the asset + rescomp line into the active project.
2. Expose it as a tool to the Track A agent so "give the player a spaceship
   ship sprite" works in conversation; also add a small asset drawer in the
   UI (preview generated/bundled assets, regenerate).
3. Same for music: expose `compile_music` (MML server) to the agent; keep
   the FM preset library in the agent's context so it writes decent MML.
4. ComfyUI stance: keep ComfyUI as the local engine (it stays a separate
   GPL process, workflow already tuned), but add lifecycle help (launch
   button / auto-launch script with timeout) so users don't hand-start it.
   Evaluate a lighter alternative (e.g. a small dedicated pixel-art model
   runner) only if ComfyUI setup keeps hurting; the validator and resource
   wiring are engine-agnostic.

Exit: from chat, a generated, palette-legal sprite and a generated MML track
end up in a built ROM without touching a terminal. This was verified on July 7
with `upbeat_loop.vgm` and a 32x32 `spaceship_sprite`; keep it as a regression
smoke while improving asset review UI and ComfyUI lifecycle help.

### Track E — Robustness and shippability

1. Replace compile-time `repo_root()` with proper app-data dirs
   (`~/Library/Application Support/Drive16/...`) + bundled resources;
   re-enable Tauri bundling; make a packaged .app work.
2. Timeouts on Docker builds, Genteel runs, ComfyUI generation; size caps on
   ROM/core imports; graceful errors when Docker/Genteel are missing.
3. Add LICENSE (MIT per DECISIONS.md), set a
   real CSP, decide core-distribution policy.
4. Prune: archive the 31 one-off validation scripts out of the top-level
   flow, collapse the phase-doc sprawl into docs/ архив, keep a single
   README quickstart.

Exit: a .dmg a stranger can install and reach "playing a game I described"
with only Docker + an OpenRouter key.

## Original sequencing

- Week 1: Track B (audio, ~1 day) + Track A start (agent wiring).
- Weeks 1–3: Track A to exit; Track C rebuild in parallel (different layer,
  minimal file overlap — new shell consumes the same commands).
- Weeks 3–4: Track D (agent tools for sprites/music) on top of A+C.
- Weeks 4–5: Track E hardening + packaging.

Tracks A and C are parallelizable. D depends on A. E is last but its small
items (timeouts, size caps) can ride along anytime.

## Owner decisions recorded

1. MIT license confirmed; `LICENSE` landed on 2026-07-10.
2. macOS distribution is ad-hoc-signed direct download/source, not App Store.
3. Release builds use a user-supplied interactive core rather than silently
   fetching the development CDN fallback.
4. The packaged app uses the explicit local-service-aware CSP now in
   `tauri.conf.json`.
5. Ollama is a real local build-agent path; OpenRouter remains available.

Whether ComfyUI remains the long-term sprite engine is a future product choice,
not a release blocker.
