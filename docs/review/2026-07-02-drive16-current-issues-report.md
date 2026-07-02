# Drive16 Current Issues Report

Date: 2026-07-02

Project path: `/Users/chrissotraidis/Documents/GitHub/drive16`

Live/runtime path: browser preview usually at `http://127.0.0.1:1420/?core-status=dev-only`; native Tauri app is built from `app/src-tauri`.

Source prompt inputs:

- `/Users/chrissotraidis/Downloads/Fable 5/fable_5_mythos_prompting_guide.md`
- `/Users/chrissotraidis/Downloads/Fable 5/fable-5-project-audit-prompt-template.md`

## What The Project Does

Drive16 is an open-source conversational builder for Sega Genesis / Mega Drive
games. The intended product loop is:

1. A user talks to a Drive16 agent.
2. The agent writes SGDK C.
3. Drive16 builds a Genesis ROM.
4. Drive16 verifies the ROM through deterministic proof capture.
5. The user can play the ROM inside the app.
6. The user can save/export the project or ROM.

The current v1 target is deliberately narrow: generate and build a bundled
sprite/music ROM, verify movement and non-silent audio, and expose enough Play,
Save/Open, Import, Export, provider setup, and controls UI that a non-developer
can understand what is happening.

## What Is Working

Evidence:

- `README.md`
- `PROGRESS.md`
- `WORKLOG.md`
- `DECISIONS.md`
- `docs/product-v1-evidence.md`
- `docs/phase6-verification-loop.md`
- `docs/phase7-interactive-core-distribution.md`
- `docs/phase7-user-core-flow.md`
- `docs/phase7-input-profiles.md`

Current confirmed working areas:

- Product V1 is closed for the local review scope.
- The app has a ROM-first shell with project actions, conversation rail,
  provider settings, ROM viewport, proof status, and tool readiness.
- Generated CORE ROM proof passed locally, including right-input movement and
  non-silent bundled audio proof.
- Imported ROMs can be copied into ignored local storage and used as the active
  ROM source.
- Interactive Play exists behind a Nostalgist/RetroArch adapter boundary.
- Genteel remains the deterministic Verify/Capture Proof path.
- `Play ROM` can use a user-supplied Genesis RetroArch/libretro Emscripten core
  from a `.zip` archive or `.js + .wasm` pair.
- The dev CDN path is explicitly labeled as development-only, not release
  settled.
- Keyboard input is wired through a shared player input profile.
- Basic browser Gamepad API detection and standard-gamepad transitions are
  wired into the same player input path.
- Input profile state persists in localStorage as `drive16.inputProfile.v1`.
- Provider settings distinguish OpenRouter and Ollama instead of mixing their
  fields.
- Freeform model chat is honestly labeled as paused/no-reply rather than fake
  streamed assistant behavior.
- Browser smoke coverage exercises New, Save, Open, Import, Play, keyboard
  ArrowRight, Pause/Resume/Reset/Stop, Verify, Export, and narrow layout.

## What Is Not Working Or Not Finished

Evidence:

- `docs/post-v1-backlog.md`
- `docs/product-v1-evidence.md`
- `docs/phase7-interactive-core-distribution.md`
- `docs/phase7-input-profiles.md`
- `app/src/player/coreReadiness.ts`
- `app/src/player/input.ts`
- `app/src/player/nostalgist.ts`
- `app/src/App.tsx`

Remaining gaps:

- Public/distributable interactive Play is not fully settled. The preferred
  path is now user-supplied core setup, but installer-managed core acquisition,
  bundled core policy, and release packaging remain unresolved.
- Live freeform agent replies are not implemented in the shell. The app logs or
  gates freeform messages and keeps the ROM-changing proof path local.
- Interactive audio is still gated. The generated CORE proof verifies
  non-silent audio, but the embedded human Play surface does not yet claim
  verified interactive audio.
- Controller support is foundational, not product-complete. There is no full
  remapping editor, per-device profile handling, multi-controller support, or
  packaged hardware QA.
- ROM management is still project-action level, not a real library. Import,
  Save, Open, Play, Verify, and Export exist, but there is no generalized
  multi-ROM browser or metadata view.
- Optional enhancements remain setup-heavy. ComfyUI sprites and MML music are
  documented and partially wired as readiness surfaces, but they are not yet a
  smooth end-user creation workflow.
- Brand assets are now coherent enough for the app, but the generated raster
  mark does not yet have a canonical vector/source-design asset.

## Major Product Issues

### 1. Play Is Real Locally, But Public Play Is Still A Policy Decision

Evidence:

- `docs/phase7-interactive-core-distribution.md`
- `docs/phase7-user-core-flow.md`
- `app/src/player/coreReadiness.ts`
- `scripts/check-interactive-play-core.mjs`

Drive16 has done the right thing by separating proof from play and by not
pretending Genesis core binaries are bundled. The current UX can be honest:
`Play ready` / `User core`, `Dev preview only` / `Dev CDN`, or `Play setup
needed`.

The remaining issue is not primarily a code bug. It is a product/release
policy issue:

- Should public Drive16 rely on user-supplied cores?
- Should an installer guide/download a core after license acceptance?
- Should Drive16 replace the interactive runtime with a different release-safe
  path?

Until that decision is made, the product can be locally useful but should not
describe embedded Genesis Play as distribution-complete.

### 2. The Conversational Builder Promise Still Outruns The Live Agent Surface

Evidence:

- `README.md`
- `PROGRESS.md`
- `app/src/App.tsx`
- `docs/post-v1-backlog.md`

Drive16 describes itself as a conversational builder, and the narrow CORE
prompt path has real proof. However, freeform model replies are currently
paused/no-reply in the app shell, even when provider setup is available. This
is truthful, which is good, but it means the product promise is still ahead of
the general conversation UX.

This is the biggest user-experience gap after Play setup. A user can see an
agent surface, but broad model-backed iteration is not yet a reliable product
feature.

### 3. Controls Are No Longer Missing, But They Are Not Yet A Mature Input System

Evidence:

- `docs/phase7-input-profiles.md`
- `app/src/player/input.ts`
- `app/src/App.tsx`
- `scripts/verify-phase6-browser-smoke.mjs`

The current input model is a good foundation:

- stable action IDs;
- default keyboard mapping;
- default standard-gamepad bindings;
- localStorage persistence;
- Reset defaults;
- truthful controller states;
- controller transitions into the same player input path.

What remains is the difference between "controller-ready foundation" and "real
controller support":

- edit bindings in-app;
- detect per-device identities;
- support multiple players/controllers;
- test actual hardware on macOS and browser preview;
- expose controller troubleshooting without crowding the ROM viewport.

This should stay near the player, not Agent Settings.

## Architectural Issues

### Proof And Play Are Correctly Split, But The Split Must Stay Visible

Evidence:

- `docs/phase6-player-architecture.md`
- `docs/phase6-interactive-player-adapter.md`
- `docs/product-v1-evidence.md`
- `app/src/player/nostalgist.ts`

Genteel is deterministic proof/capture. Nostalgist/RetroArch is human
interactive Play. This boundary is one of the strongest architecture decisions
in the repo. Do not collapse it for convenience.

Risk:

- A future implementation could accidentally make Verify depend on interactive
  core availability.
- A future UI could describe dev-CDN Play as release-safe.
- A future packaging step could accidentally commit or bundle emulator core
  binaries.

### App State Is Becoming Dense In `App.tsx`

Evidence:

- `app/src/App.tsx`
- `app/src/player/*`
- `app/src-tauri/src/project.rs`

Some domain boundaries already exist under `app/src/player`, which is good.
However, the main React file still owns a large amount of UI state, provider
state, agent state, player state, project state, and action feedback. This is
not yet an emergency, but it will become hard to reason about if Phase 8 adds
live agent streaming, a ROM library, controller remapping, and enhancement
workflows without extracting focused components/hooks.

High-leverage extraction targets:

- player controls and readiness UI;
- project menu/actions;
- provider settings;
- conversation/agent mode state;
- ROM library/import/export state.

Do this only when adding the next feature would otherwise make the file harder
to test or review. Avoid a broad refactor for its own sake.

### Verification Is Strong, But Evidence Is Scattered

Evidence:

- `docs/phase6-verification-loop.md`
- `scripts/verify-phase6-loop.sh`
- `scripts/verify-phase6-browser-smoke.mjs`
- `scripts/check-interactive-play-core.mjs`
- `docs/product-v1-evidence.md`

Drive16 has unusually good evidence for a young app. The risk is discoverability
and drift: a future contributor has to understand which check proves which
promise. The existing README helps, but a compact "golden path verifier" page
or release checklist would reduce friction before public v1.

## Operational Issues

### Local Dependencies Need A Cleaner First-Run Story

Evidence:

- `README.md`
- `docs/post-v1-backlog.md`
- `scripts/check-interactive-play-core.mjs`

A fresh user may need:

- Node/pnpm app dependencies;
- Rust/Tauri dependencies;
- SGDK build path;
- Genteel proof path;
- OpenRouter or Ollama if they want model-backed behavior;
- optional ComfyUI and model files;
- optional user-supplied Genesis core.

The docs are honest, but the first-run flow is still dependency-heavy. The
highest-leverage improvement is not adding more features; it is making the app
tell the user, in one place, what is ready, what is optional, and what exact
action unblocks the next step.

### Packaging Is Not A Product Surface Yet

Evidence:

- `docs/post-v1-backlog.md`
- `WORKLOG.md`
- `README.md`

The app can be built as a Tauri app, and recent icon work produced a debug app
bundle. But signing, notarization, installer polish, and public distribution
are out of scope so far. This is fine for local review, but it is a real
blocker before claiming public desktop-app readiness.

## Symptoms Versus Causes

Symptoms:

- A user may think Play "should just work" after cloning the repo.
- A user may expect the chat agent to answer arbitrary prompts.
- A user may see controller labels and assume all controller hardware is
  supported.
- A user may not know whether ComfyUI/MML are usable product features or
  readiness checks.
- A user may struggle to know which verification command matters for which
  promise.

Underlying causes:

- Emulator-core distribution has real licensing/product constraints.
- The current agent UX is intentionally truthful but not yet a live general
  model conversation loop.
- Input work has reached a good technical boundary but not a mature UI for
  mapping and multi-device support.
- Optional enhancement tooling is powerful but still local-setup oriented.
- Evidence was produced phase by phase, so it is accurate but spread across
  many files.

## Highest-Leverage Implementation Opportunities

### A. Release-Clean Play Onboarding

Smallest useful scope:

- Keep user-supplied core as the release-clean path for now.
- Make Set Up Play feel like a guided product flow.
- Add clearer copy for `.zip` versus `.js + .wasm`.
- Add success/failure examples in the UI.
- Keep Verify always available and visibly separate.
- Add one browser smoke path for missing core, one for user core, and one for
  dev-only mode.

Why it matters:

This closes the biggest "I cloned it, now what?" gap without forcing a risky
license or packaging decision.

### B. Live Agent Conversation Slice

Smallest useful scope:

- Pick one provider path, likely OpenRouter because it is already tested.
- Stream or return one real freeform reply into the conversation panel.
- Keep ROM-changing proof prompts distinct from general chat.
- Add failure states for missing key, provider failure, OpenCode failure, and
  unsupported action.
- Do not broaden to every provider at once.

Why it matters:

The core product identity is conversational. A narrow truthful live-reply slice
would reduce the biggest mismatch between app promise and app behavior.

### C. Controller Remapping Editor

Smallest useful scope:

- Keep it inside the Controls panel.
- Let the user remap one keyboard/control action at a time.
- Preserve Reset defaults.
- Store versioned local profiles.
- Add smoke coverage for editing one binding and resetting.
- Defer multi-controller and hardware QA.

Why it matters:

This turns the input-profile foundation into visible user agency without
building a full emulator settings application.

### D. Product Readiness Hub

Smallest useful scope:

- One in-app readiness view or README section that says:
  - Build/proof ready;
  - Play ready/user core/dev-only/setup needed;
  - Agent ready/ROM proof only/no-reply;
  - AI sprites ready/needs ComfyUI/off;
  - MML ready/off;
  - Packaging/dev build only.
- Link each state to the exact next action or verification command.

Why it matters:

The app has many true states. The user should not have to read a dozen phase
docs to understand them.

## What Should Not Be Changed Or Overcomplicated

- Do not remove the Genteel proof path. It is the deterministic backbone of
  Drive16's claims.
- Do not silently bundle or download emulator cores without an explicit
  licensing/distribution decision.
- Do not move Play/core/controller settings into Agent Settings. They belong
  near the ROM player.
- Do not make ComfyUI, MML, Ollama, or controller support required for the
  v1 golden path.
- Do not turn the app into a generic emulator frontend before the builder loop
  is stronger.
- Do not fake live agent replies. The current no-reply honesty is better than
  fake intelligence.
- Do not refactor all of `App.tsx` before the next product slice. Extract only
  where the next feature makes the current file materially worse.

## Important Uncertainty And Missing Evidence

The following should be verified by a future audit before implementation
decisions:

- Fresh-clone setup on a clean Mac: how many manual steps are required before a
  non-developer can see the starter ROM, Verify, and Play setup states?
- Native Tauri app behavior after signing/notarization assumptions enter the
  picture.
- Real controller hardware behavior on macOS, not just browser Gamepad API
  mocks.
- Whether OpenRouter freeform replies should go through OpenCode, direct
  browser fetch, a Tauri command, or a backend bridge.
- Whether a user-supplied Genesis core is acceptable for public release, or
  whether Drive16 needs an installer-managed or replacement-runtime solution.
- Whether generated brand assets need vectorization before marketing or app
  store style surfaces.

## Suggested Next Audit Commands

Use these only for inspection and verification. Do not mutate production/live
state:

```sh
git status --short --branch
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check
cargo test --manifest-path app/src-tauri/Cargo.toml
scripts/check-interactive-play-core.mjs
scripts/verify-phase6-loop.sh --browser
scripts/verify-phase6-loop.sh --no-browser --with-v1-proof
```

If a user-supplied Genesis core fixture is available:

```sh
scripts/verify-phase6-browser-smoke.mjs --user-core /path/to/genesis_plus_gx_libretro.zip
```

## Bottom Line

Drive16 is in a much better state than the early "buttons do not work" version.
The app now has a coherent local v1: proof, play foundation, import/export,
provider truth, controls, and evidence.

The remaining product blockers are not random polish. They are specific:

1. make Play setup release-clean and understandable;
2. make the conversation agent genuinely live for at least one narrow path;
3. mature input/control handling without turning the app into a settings maze;
4. consolidate readiness so fresh users know what is real, optional, gated, or
   future work.

Those should be handled in narrow slices. The product is close enough that
truthful focus matters more than adding more surface area.
