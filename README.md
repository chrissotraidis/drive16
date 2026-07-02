# Drive16

Drive16 is an open-source, conversational builder for Sega Genesis / Mega Drive
games. You talk to an agent, it writes SGDK C, builds a ROM, runs it in an
emulator, reads the result, and iterates.

The core v1 target is deliberately narrow: from a conversation, Drive16 writes
and builds a Genesis ROM with SGDK, runs it, self-corrects build or runtime
issues, puts a controllable bundled sprite on screen, and plays a bundled VGM
loop.

## Current status

The earlier CORE v1 proof is complete and evidenced: the Phase 3 app flow can
launch a two-pane Drive16 shell, start from a blank ROM preview, accept the
prompt `make a sprite I can move left and right with music`, build the bundled
sprite plus music ROM, verify right-input sprite movement, and verify
non-silent audio.

Product V1 closure is complete for the local review scope. The app has an
interactive Play foundation, native generated-ROM Play is verified, provider
setup is truthful, project lifecycle actions are covered, and post-v1 work is
separated from the V1 stop line.

Phase 8 Slice 1 adds live OpenRouter freeform replies. OpenRouter remains BYOK
and the default tested model is `deepseek/deepseek-chat-v3.1`; after a key is
tested, general chat prompts receive non-streaming OpenRouter replies while
the CORE sprite/music prompt still routes through the local ROM proof path.
Ollama generation remains out of scope for this slice.

Phase 8 Slice 2 adds a first-run readiness hub. Click `Setup` in the top bar,
or open the project menu, to see the current truth for ROM proof, interactive
Play core setup, OpenRouter chat, Ollama readiness-only status, OpenCode/local
tools, optional ComfyUI/MML enhancements, and public-release blockers.

UI repair work is now paused on feature expansion and focused on making the
normal desktop app usable. Slice 1 separates chat from proof and collapses
secondary readiness/files/proof details. Slice 2 fixes the `Verify Right`
stuck-status bug, improves browser-preview Play feedback, and verifies that
the current native dev window shows the repaired Phase 8 shell. Slice 3 makes
the default desktop shell calmer: provider/session truth sits by the composer,
ROM/tool details start collapsed, and the player status strip keeps secondary
details behind `More`.

Phase 7 Slice 3 is implemented: interactive Play now has a local input profile
surface. The ROM player keeps the default keyboard mapping visible, stores the
current profile in localStorage, offers Reset defaults, detects browser
Gamepad API/controller presence, and reports truthful controller states near
the player. Basic standard-gamepad button/D-pad transitions are wired into the
same player input action path as keyboard input when a controller is detected.

Phase 7 Slice 2 added the user-supplied core setup path. `Set Up Play` /
`Choose Core` accepts a compatible Genesis RetroArch/libretro Emscripten
`.zip` or `.js + .wasm` pair, copies the core into ignored local storage, and
makes `Play ROM` prefer that user core. The Nostalgist/RetroArch `Dev CDN`
path remains a local-development fallback only. Genteel remains the local
Verify/Capture Proof path.

Evidence:

- Phase 6 packet: `docs/phase6-evidence.md`
- Product V1 packet: `docs/product-v1-evidence.md`
- Post-v1 backlog: `docs/post-v1-backlog.md`
- Phase 8 OpenRouter replies: `docs/phase8-openrouter-freeform-replies.md`
- Phase 8 readiness hub: `docs/phase8-readiness-hub.md`
- Phase 8 UI checkpoint: `docs/phase8-ui-optimization-checkpoint.md`
- Phase 8 UI repair slice: `docs/phase8-ui-repair-slice1.md`
- Phase 8 UI repair slice 2: `docs/phase8-ui-repair-slice2.md`
- Phase 8 UI repair slice 3: `docs/phase8-ui-repair-slice3.md`
- Phase 8 next-agent handoff: `docs/phase8-next-agent-handoff.md`
- UI repair control map: `docs/ui-repair-control-map.md`
- Phase 7 core policy: `docs/phase7-interactive-core-distribution.md`
- Phase 7 user core flow: `docs/phase7-user-core-flow.md`
- Phase 7 input profiles: `docs/phase7-input-profiles.md`
- Phase 3 packet: `docs/phase3-evidence.md`
- Core prompt proof: `docs/phase3-v1-prompt.md`
- Current ledger: `PROGRESS.md`
- Iteration journal: `WORKLOG.md`

Phase 4 was approved after the live generated-assets proof passed locally:
default-off settings toggles, ComfyUI readiness checks, the `comfyui-mcp`
wrapper, the tuned Genesis sprite workflow, generated sprite validation, MML
music generation, and the combined generated-assets proof harness are all in
place.

Phase 5 completed provider settings cleanup, conversation truthfulness,
project menu hardening, local ROM import, ROM controls, ROM-first layout, and
enhancement/action feedback clarity. Agent Settings now switches cleanly
between OpenRouter and Ollama, hides hosted key/model fields when the local
provider is active, and adds a native local Ollama `/api/tags` check. The
conversation pane now labels local proof responses, gates freeform prompts when
the selected provider is not tested, and avoids implying live model replies are
streaming. The project menu now surfaces New, Save, Open, Import, Export, and
Agent Settings with visible action feedback. Import ROM accepts `.bin`, `.gen`,
`.md`, and `.smd`, stores copied ROMs under ignored
`artifacts/phase5/imports`, and makes Run/Export use the active imported ROM.
The ROM viewport now shows a keyboard mapping, focus state, local input
feedback, and a scripted Right-input proof action. The conversation rail and
ROM detail panels can collapse so the emulator can take priority without losing
compact status. Enhancement toggles now show explicit readiness labels instead
of ambiguous On/Off state. Run, Save, Export, and Import actions now report
near the ROM viewport and preserve recent action paths.

Phase 6 has added the first embedded interactive Play path. Drive16 keeps
Genteel as the deterministic Verify/Capture Proof path and uses a separate
Nostalgist/RetroArch adapter for human play inside the ROM viewport. Imported
ROM bytes can now be loaded into the embedded player, keyboard input reaches
the running player, and compact Pause/Resume/Reset/Stop controls appear beside
Play only while a player session exists. Genesis core delivery remains explicit:
Drive16 does not commit Genesis Plus GX core binaries and does not treat that
core as a settled commercial distribution dependency.

## What to do next

Current next step: finish the UI repair track before adding another feature
slice. The next UI pass should run in the native Tauri window and verify every
visible button either works, gives local feedback, or is clearly unavailable
with a reason. If another agent picks this up, start with
`docs/phase8-next-agent-handoff.md`.

Current local validation:

- Ollama HTTP is reachable at `http://127.0.0.1:11434/api/tags` after the
  local service wakes.
- The app default `qwen2.5-coder:7b` is not currently installed on this
  machine. Install it with `ollama pull qwen2.5-coder:7b` or enter an installed
  model name in Agent Settings.
- ComfyUI model files are present under `~/Documents/ComfyUI`, including
  `sd_xl_base_1.0.safetensors` and `pixel-art-xl.safetensors`.
- The local ComfyUI API is not currently running on `127.0.0.1:8188`, so AI
  sprite readiness correctly reports setup failure until ComfyUI is launched.

To reproduce the Phase 4 live generated-assets proof after reviewing and
accepting the upstream model licenses:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check

scripts/validate-phase4-live-generated-assets.sh
```

The live proof wrapper launches local ComfyUI if needed, checks readiness, runs
the live sprite workflow, validates the generated PNG, builds the generated
sprite plus generated-MML ROM, runs it in Genteel, verifies movement, and
verifies non-silent audio.

## Running the app locally

The browser preview runs from the Tauri app folder:

```sh
pnpm --dir app install
pnpm --dir app dev
```

Then open:

```text
http://127.0.0.1:1420/
```

Useful checks:

```sh
scripts/check-interactive-play-core.mjs
scripts/verify-phase6-loop.sh --browser
scripts/verify-phase6-loop.sh --no-browser --with-v1-proof
```

Optional online Play-core check:

```sh
scripts/check-interactive-play-core.mjs --online
```

Release-clean local Play setup:

1. Obtain a compatible Genesis Plus GX RetroArch/libretro Emscripten core as a
   `.zip` archive or a `.js + .wasm` pair.
2. In the app, open the project menu and click Set Up Play, or use Choose Core
   beside Play ROM.
3. Select the core archive or pair. Drive16 stores normalized core files under
   ignored `artifacts/phase7/interactive-core`.
4. Confirm the readiness pill says `Play ready` / `User core`.

The repo does not vendor emulator core binaries. For local development without
a user core, the app can still use the explicit dev-CDN fallback while running
from the dev server.

Interactive player smoke:

1. Import a Genesis ROM through the project menu.
2. Choose a user core, or run from the dev server with the dev-CDN fallback.
3. Click Play ROM.
4. Click the ROM viewport and use Arrow keys, `Z`, `X`, `C`, and Enter.
5. Open Controls beside Play to review the saved profile, controller readiness,
   and Reset defaults.
6. Use Pause/Resume, Reset, or Stop from the compact player controls.

If the app reports `Play setup needed`, click Verify instead. Verify uses the
local Genteel proof path and does not depend on the interactive RetroArch core.
If the app reports `Dev preview only` / `Dev CDN`, local interactive Play can
run from the dev server, but Drive16 still has not bundled a release-settled
Genesis core.

The native Tauri app can be run with:

```sh
pnpm --dir app tauri dev
```

The browser check covers imported-ROM Play, keyboard input, player controls,
Verify, Save, Export, and narrow layout. The generated CORE proof check covers
the slower bundled-sprite/music proof path.

## Provider and enhancement setup

OpenRouter hosted BYOK:

1. Select OpenRouter in Agent Settings.
2. Paste an OpenRouter API key.
3. Select the hosted model. The current default is
   `deepseek/deepseek-chat-v3.1`.
4. Click Test OpenRouter.
5. General chat prompts can now receive OpenRouter replies. The sprite/music
   CORE prompt still uses the local proof path and does not depend on hosted
   model replies.

Ollama local:

1. Install and start Ollama.
2. Install or choose a local model:

```sh
ollama pull qwen2.5-coder:7b
```

3. Select Ollama in Agent Settings.
4. Use endpoint `http://127.0.0.1:11434`.
5. Enter the installed model name.
6. Click Test Ollama.

ComfyUI local AI sprites:

1. Install or select a local ComfyUI data folder. Drive16 defaults to:

```text
~/Documents/ComfyUI
```

2. Install the default model pair after reviewing the upstream licenses:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check
```

3. Launch the local ComfyUI API when needed:

```sh
scripts/launch-phase4-comfyui-api.sh
```

4. In Agent Settings, enable AI sprites and click Test ComfyUI.

For the full generated sprite plus MML proof:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

## Phase map

- Phase 0: SGDK, Genteel, frame stream, sprite, and VGM spike evidence.
- Phase 1: text-only agent build loop with OpenRouter and CORE MCP servers.
- Phase 2: agent-produced CORE ROM with bundled sprite and bundled music.
- Phase 3: core v1 app flow, complete and approved.
- Phase 4: optional AI sprites and generated MML music, proof passed locally
  and approved.
- Phase 5: hardening and fully local path, ready for human review.
- Phase 6: interactive imported/generated ROM player, ready for Product V1
  closure review.
- Product V1 closure: generated-ROM native Play, golden path clarity, provider
  truth, project lifecycle, and final evidence packet, complete for local
  review.
- Phase 8 Slice 1: OpenRouter-only live freeform replies, with CORE proof and
  Ollama generation kept separate.
- Phase 8 Slice 2: readiness / first-run hub for proof, Play, provider,
  enhancement, and release-blocker truth.
- Phase 8 UI repair: normal-window shell cleanup for chat/proof identity,
  compact player controls, collapsed diagnostics, and trustworthy button
  feedback.

## Model stance

Drive16 is bring-your-own-key or local-only:

- OpenRouter is the default hosted model path and supports live freeform
  replies after key testing.
- Ollama is the local readiness path; live Ollama replies are not wired yet.
- Direct provider keys can be added as configuration.
- Consumer subscription login relay is out of scope.

No Drive16 flow should ask a user to log into a Claude, ChatGPT, or other
consumer subscription account.

## Asset and model hygiene

The repo must not contain commercial ROMs, disassemblies, API keys, model
weights, generated ROM build output, or large local artifacts. ComfyUI model
weights stay outside git and are installed or linked into the local ComfyUI
folder by explicit user action.

## License posture

Drive16 app code is intended to use a permissive license. Copyleft or
non-commercial dependencies must run as separate processes and must not be
linked or vendored into the Tauri binary. MIT is proposed in `DECISIONS.md` as
the app license, pending human confirmation before finalizing a `LICENSE` file.
