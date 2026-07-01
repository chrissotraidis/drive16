# Drive16 Decisions

## 2026-07-01 - Input profiles live with the ROM player

Context:

After user-supplied Play setup, the player surface still showed keyboard
mappings but no durable input profile or real controller detection. Putting
this in Agent Settings would mix ROM/play controls with inference-provider
configuration.

Decision:

Add a local input profile owned by the player surface. Keyboard and controller
bindings share stable action IDs for D-pad, A, B, C, and Start. The compact
Controls panel lives beside Play/Verify, persists the profile in localStorage,
offers Reset defaults, and reports Gamepad API/controller readiness honestly.
Basic standard-gamepad button/D-pad transitions can feed the same player input
path as keyboard input, but full remapping and per-device hardware QA remain
later work.

Consequence:

Drive16 now has a scalable input boundary without pretending controller support
is distribution-complete. A user can see whether keyboard is ready, whether a
controller is visible, and whether the current profile maps every player
action without leaving the ROM player context.

## 2026-07-01 - User-supplied Genesis core is the preferred Play path

Context:

The first Phase 7 slice made the core policy honest, but a fresh downloader
still needed a concrete way to provide a local compatible Genesis core. The app
could use the dev CDN in local development, but that did not give users control
over release-clean Play setup.

Decision:

Add a user-supplied core flow. `Set Up Play` / `Choose Core` accepts a
compatible Genesis RetroArch/libretro Emscripten `.zip` archive or `.js +
.wasm` pair, stores normalized files under ignored
`artifacts/phase7/interactive-core`, and makes `Play ROM` prefer those local
files. The dev CDN path remains available only as a development fallback.
Agent Settings does not own this state because the core is a ROM/player
capability, not an inference-provider setting.

Consequence:

Drive16 can now move from "honestly caveated" to "configurable" for
interactive Play. Fresh downloaders can verify whether a user core is installed
and readable, while the repo still avoids committing Genesis Plus GX,
RetroArch Emscripten, or other emulator core binaries.

## 2026-07-01 - Interactive Play core delivery is dev-only until release-settled

Context:

Product V1 can play imported and generated ROMs through the embedded
Nostalgist/RetroArch adapter, but the current Mega Drive path resolves
Genesis Plus GX from Nostalgist's default dev CDN. Nostalgist itself is MIT
licensed, but Libretro documents the Genesis Plus GX core as non-commercial.
Drive16 should not imply that a release-safe Genesis core is bundled.

Decision:

Treat the current Nostalgist/RetroArch path as a local-development interactive
adapter. Show it as `Play ready` with `Dev CDN` when browser capabilities are
present. Do not commit or vendor Genesis Plus GX, RetroArch Emscripten, or
other emulator core binaries. Keep Genteel as the deterministic
Verify/Capture Proof path. A future public release must choose a user-supplied
core flow, a license-reviewed installer-managed flow, or a replacement runtime
before calling interactive Play distribution-settled.

Consequence:

Fresh downloaders can see whether Play is ready, setup-needed, or dev-only
without guessing. Missing interactive Play setup no longer affects Verify, and
the app has a single readiness contract for `available`, `dev-only`, `missing`,
`needs-user-action`, and `unsupported`.

## 2026-06-30 - Nostalgist is integrated without vendoring Genesis cores

Context:

The Phase 6 adapter boundary is now ready to host a real browser player. The
app needs imported ROMs to be playable inside the existing ROM viewport, but it
must not quietly bundle emulator cores with non-commercial licensing terms.

Decision:

Add `nostalgist@0.21.1` as the browser player wrapper and launch imported ROM
bytes into an embedded canvas with the `genesis_plus_gx` core selected at play
time. Do not commit or vendor Genesis Plus GX core binaries. Keep this as a
runtime delivery dependency until a release licensing/install decision is made.

Consequence:

Drive16 now has real interactive imported-ROM play while preserving the
distribution boundary. Release packaging still needs an explicit core delivery
policy before Phase 6 can be treated as distribution-complete.

## 2026-06-30 - Interactive play uses an adapter boundary

Context:

Phase 6 needs imported and generated Genesis ROMs to become playable inside
Drive16, but the current app only performs finite Genteel proof captures.
Browser emulator wrappers exist, but the Genesis core license must not be
blurred into the app's permissive distribution posture. Nostalgist is MIT and
browser-friendly, but its default Mega Drive path uses Genesis Plus GX.
Genesis Plus GX is documented as non-commercial. EmulatorJS is a heavier
GPL-3.0 frontend. romdevtools and retroemu are useful local references, but do
not provide the embedded Drive16 playfield requested for this phase.

Decision:

Add Phase 6 around an interactive player provider boundary. Target a
Nostalgist/RetroArch adapter for the first browser-hosted interactive player,
but do not commit Genesis Plus GX core binaries or treat that core as a settled
commercial distribution dependency. Keep Genteel as the Verify/Capture Proof
path, not the human Play path.

Consequence:

Drive16 can build the player UI, input model, and generated/imported ROM play
flows without locking the product into a questionable emulator-core license.
Future builds can swap the provider, use user-supplied cores, or make an
explicit licensing decision before distribution.

## 2026-06-30 - Local and hosted setup paths stay separate

Context:

Phase 5 needs both a hosted BYOK path and a fully local path, but those should
not be blended in the UI or setup docs. OpenRouter depends on an API key.
Ollama depends on a local HTTP service and an installed model. AI sprites depend
on local ComfyUI, model files, Pixydust, and the ComfyUI API.

Decision:

Document OpenRouter, Ollama, and ComfyUI as separate setup paths. Treat
OpenRouter as hosted BYOK, Ollama as local inference readiness, and ComfyUI as
an optional local enhancement dependency behind AI sprites.

Consequence:

The app can remain honest when one path is ready and another is not. A missing
Ollama model or stopped ComfyUI API does not affect the OpenRouter BYOK path,
and OpenRouter setup does not imply local inference or local sprite generation
is ready.

## 2026-06-30 - Primary action feedback belongs near the ROM viewport

Context:

Phase 5 user testing showed that Run, Save, Export, and Import could update
state without feeling obvious. The top bar and project menu had feedback, but a
user watching the ROM viewport could still miss what changed.

Decision:

Add a near-ROM action feedback strip under the controls. It reports the current
action state and keeps recent import, save, and export paths visible as compact
chips. The top bar and project menu remain, but the emulator area becomes the
primary feedback surface while testing a ROM.

Consequence:

Actions no longer look dead when the user is focused on the viewport. Save,
Export, and Import leave path evidence in the same area as Run feedback.

## 2026-06-30 - Enhancement toggles report readiness, not generic On/Off

Context:

Phase 5 needs AI sprites and MML music to be understandable from Agent
Settings. A generic `Off` label made it unclear whether an enhancement was
intentionally disabled, missing setup, currently checking, ready, or failed.

Decision:

Use explicit readiness labels for enhancement toggles. AI sprites can report
Disabled, Needs setup, Running, Ready, or Failed based on ComfyUI readiness.
MML music reports Disabled when intentionally off and Ready when enabled because
the ctrmml wrapper and generated-MML prompt path are wired. Each readiness row
includes a next action.

Consequence:

The settings modal no longer treats disabled features as broken. ComfyUI setup
problems show a concrete next step, while MML music remains honest about its
current proof boundary.

## 2026-06-30 - ROM-first layout collapses panels without losing status

Context:

Phase 5 needs the emulator viewport to become the primary surface when the user
is testing a ROM. The app already had a focused-emulator mode, but the user
also needed a way to collapse the conversation rail and tool/status cards
without making the system feel blind.

Decision:

Keep explicit toolbar controls for the conversation rail, ROM detail panels,
and focused emulator mode. When details are collapsed or focused mode is active,
replace the full cards with a compact status strip that keeps the current ROM
path and tool summary visible.

Consequence:

The user can give the ROM more space without losing orientation. Full status is
one click away, and focused mode no longer requires the large card grid to stay
on screen.

## 2026-06-30 - ROM controls distinguish local input state from emulator proof

Context:

Phase 5 needs visible ROM controls and keyboard mapping, but the current app
does not yet have continuous live keyboard/controller injection into the running
emulator session. Drive16 already has a verified scripted Right-input proof
through the CORE ROM and Genteel.

Decision:

Add a ROM controls strip that makes the viewport focusable, shows the keyboard
mapping, records local key input state, and exposes `Run Right Proof` as the
verified movement test. Treat manual key capture as local app control state
until live emulator input is implemented and tested.

Consequence:

The app now feels controllable and shows what keys matter without overstating
manual emulator support. The tested movement claim remains tied to the existing
scripted Genteel proof path.

## 2026-06-30 - Imported ROMs are active local artifacts, not repo assets

Context:

Phase 5 Unit 4 moved Import ROM from a prepared folder into an actual app
workflow. The app needs to accept user-selected Genesis ROM files, run them, and
export the active ROM without ever treating imported binaries as source files.

Decision:

Copy selected ROM bytes into ignored `artifacts/phase5/imports` after
extension validation and filename sanitization. The frontend tracks the copied
path as the active Imported ROM. Native run and export commands accept active
ROM paths only after resolving them inside the Drive16 workspace, so arbitrary
absolute paths or path traversal are rejected.

Consequence:

Drive16 can run and export an imported ROM through the same visible app
controls used for generated ROMs. Imported user ROMs stay outside git, and
commercial ROMs are neither required nor committed for validation. The verified
test path uses the repo-generated starter ROM copied into ignored storage.

## 2026-06-30 - Imported ROM storage starts in ignored Phase 5 artifacts

Context:

Phase 5 needs an Import ROM entry point, but the repo must never commit user
ROMs, commercial ROMs, or imported build artifacts. The app also needs visible
feedback before the native file picker and copy path are fully wired.

Decision:

Prepare imported ROM storage at `artifacts/phase5/imports`, which is covered by
the repo artifact ignore rules. The Unit 3 Import ROM action creates or
previews that storage path and shows accepted Genesis ROM extensions. Actual
file picking, copying, active-ROM switching, and emulator launch remain the
Unit 4 import-flow work.

Consequence:

The menu now has a non-dead Import ROM action and a safe local destination for
the next slice. Imported ROM files stay outside git by default, and the app
does not imply a ROM was imported before the copy path exists.

## 2026-06-30 - Freeform chat stays gated until live replies are wired

Context:

Phase 5 needs the conversation pane to be honest about what is happening. The
current app can run verified local ROM proof prompts and can post messages to
OpenCode with `noReply`, but it does not yet stream a live model-written answer
back into the shell.

Decision:

Label verified ROM-building responses as local proof. Gate general freeform
prompts when the selected provider has not been tested. When provider and
OpenCode readiness exist, continue treating the current OpenCode path as a
no-reply log path until live answer streaming is implemented and verified.

Consequence:

The app no longer implies that Claude, Ollama, or any other selected model is
answering when it is not. Phase 5 can add live response streaming later without
rewriting the local proof path or weakening the provider boundary.

## 2026-06-30 - Ollama readiness uses a native local endpoint probe

Context:

Phase 5 needs clean provider switching and a truthful fully local model path.
The app previously let the user select Ollama, but the settings surface still
showed OpenRouter model and API key controls. It also had no real local
provider check. Browser preview may be unable to reach Ollama because local
service access can hit browser CORS or runtime limits.

Decision:

Render OpenRouter and Ollama as mutually exclusive settings panels. Keep the
OpenRouter key and model list only in the OpenRouter panel. Add a Tauri
`check_ollama_endpoint` command that accepts only local HTTP endpoints,
defaults to `127.0.0.1:11434`, calls `/api/tags`, and reports whether the
selected model is installed. In browser preview, report that the native app
performs the local Ollama check instead of implying a failed provider setup.

Consequence:

The UI now has a clean hosted versus local provider boundary. Ollama testing is
local-only, requires no key, and does not rely on browser networking behavior.
Later Phase 5 work can use this as the provider-readiness source before
claiming live local inference.

## 2026-06-30 - Generated sprite background repair is part of the ComfyUI path

Context:

The first live SDXL Base plus Pixel Art XL LoRA sprite outputs were valid
32x32 RGB pixel-art images, but the raw PNGs had no alpha channel or reserved
transparent color. SGDK sprite resources need a transparent palette slot, and
the Phase 4 validator correctly rejected raw generated PNGs with no
transparent pixels.

Decision:

Keep the raw ComfyUI output as evidence, but have the live runner write a
separate SGDK-ready indexed PNG when the raw output has no transparency. The
repair treats the dominant edge color as the generated background, maps it to
palette index 0 with alpha 0, preserves the remaining opaque colors, and then
reruns the strict generated-sprite validator.

Consequence:

The Phase 4 pipeline stays honest about raw model output while producing a
palette-legal SGDK sprite artifact for the ROM proof. If a generated image
uses too many opaque colors after background repair, the validator still
rejects it and the gate remains open.

## 2026-06-30 - Default ComfyUI model pair is SDXL Base plus Pixel Art XL LoRA

Context:

Phase 4 originally preferred a dedicated Pixel Art Diffusion XL checkpoint for
cleaner sprite output. The likely public source metadata for that checkpoint
now makes it a poor default for an open repo installer, because Drive16 should
not silently auto-download model weights with unclear redistribution and
derivative terms. The user asked for a better open dependency path that a fresh
clone can install or be told how to install.

Decision:

Use Stability AI SDXL Base as the default checkpoint and `nerijs/pixel-art-xl`
as the default pixel-art LoRA. Keep both model files outside git. Ship an
installer that downloads them only after `--accept-model-licenses`, and let
advanced users override the filenames with `DRIVE16_COMFYUI_CHECKPOINT` and
`DRIVE16_COMFYUI_LORA`.

Consequence:

The default Phase 4 path becomes easier to document and install from upstream
Hugging Face sources, while still preserving explicit license acceptance and
local-only model storage. Sprite quality remains a live ComfyUI validation
gate, so this decision does not mark Phase 4 complete by itself.

## 2026-06-30 - Pixel Art Diffusion XL source remains user-selected

Context:

Phase 4 needs a Pixel Art Diffusion XL compatible checkpoint for live ComfyUI
sprite generation. The architecture appendix describes Pixel Art Diffusion XL
as open CreativeML, but the current Civitai API metadata for model `277680`
reports restricted commercial use, no derivatives, no different license, and
restricted redistribution outside Civitai. A local scan found other image
checkpoints on disk, but not a dedicated Pixel Art Diffusion XL checkpoint in
the local ComfyUI model folders.

Decision:

Treat the Pixel Art Diffusion XL checkpoint as a user-selected external model
asset. Keep Drive16 from auto-downloading that checkpoint or baking a Civitai
source URL into scripts. Continue to accept explicit user-provided local files
or URLs through the checkpoint installer, with optional SHA-256 verification.

Consequence:

The Phase 4 generated-sprite gate remains honest and license-aware. The app and
validation scripts can use a local compatible checkpoint once the user provides
one, but Drive16 does not redistribute or silently acquire model weights whose
current upstream metadata conflicts with the architecture assumption.

## 2026-06-30 - ComfyUI checkpoint filename override is runtime-only

Context:

Phase 4 defaults to `pixel-art-diffusion-xl.safetensors`, but a user may have
a Pixel Art Diffusion XL compatible checkpoint under a different local
filename. Requiring manual edits to the committed workflow JSON would make the
validation path brittle and easy to drift from the manifest.

Decision:

Keep the committed workflow and manifest on the default checkpoint filename.
Allow `DRIVE16_COMFYUI_CHECKPOINT` and matching `--checkpoint` flags to select
a different compatible checkpoint at runtime. The live runner rewrites the
`CheckpointLoaderSimple.ckpt_name` input in memory before enqueueing.

Consequence:

Drive16 can validate and run against a locally named compatible checkpoint
without changing committed workflow metadata or downloading model weights.

## 2026-06-30 - ComfyUI API launch uses pinned source artifacts

Context:

Phase 4 needs a reachable local ComfyUI API on Drive16's expected port before
the generated-sprite workflow can run. Comfy Desktop is installed locally, but
its bundle layout changed and a prior launch log referenced
`/Applications/ComfyUI.app`, which no longer exists. The remaining workflow
should not depend on a moving desktop-app internal path.

Decision:

Add `scripts/launch-phase4-comfyui-api.sh`. The script fetches a pinned
ComfyUI source checkout into ignored `artifacts/` storage, uses the existing
`~/Documents/ComfyUI` data folder, generates a clean Drive16 extra-models
config, and serves `127.0.0.1:8188` by default. Python requirement installs
remain explicit through `--install-requirements`.

Consequence:

The Phase 4 live sprite gate can be prepared from repeatable repo commands
without relying on Comfy Desktop internals or pulling model weights. ComfyUI
still runs as a separate local process, preserving the license boundary.

## 2026-06-30 - ComfyUI prerequisite setup stays explicit

Context:

The Phase 4 generated-sprite path needs a local ComfyUI server, the Pixydust
Quantizer custom node, and a Pixel Art Diffusion XL compatible checkpoint.
The custom node is source code that can be pinned and installed, while the
checkpoint is a large external model asset with separate license, source, size,
and hardware considerations.

Decision:

Add a dry-run-first setup helper that can install the Pixydust Quantizer custom
node only when explicitly requested. Pin the Pixydust install to
`6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`. Do not download the model
checkpoint automatically; print the required checkpoint path and keep it as a
validation request.

Consequence:

Drive16 can help prepare the local ComfyUI gate without silently pulling model
weights or mutating existing custom-node installs. The generated-sprite
checklist item remains open until a real live ComfyUI output passes validation.

## 2026-06-30 - Generated sprite prompt path consumes only live validated output

Context:

Phase 4 has self-test PNG fixtures for the generated-sprite validator, but
those fixtures are not live ComfyUI output. The generated-assets prompt path
must not treat synthetic or stale local artifacts as evidence that AI sprite
generation works.

Decision:

When `AI sprites` is enabled for the generated-MML prompt path, require the
live ComfyUI runner record at
`artifacts/phase4/live-comfyui-sprite/last-run.json` to report `ok: true`.
Resolve the recorded `downloadedPng` inside the repo, rerun
`scripts/validate-generated-sprite.py --symbol drive16_player`, and only then
write that PNG into the generated SGDK `resources.res`.

Consequence:

The app can wire the combined generated sprite and generated music path without
claiming Phase 4 sprite validation is complete. If live ComfyUI has not
produced a validated PNG, the command returns a validation request instead of
building from a self-test artifact.

## 2026-06-30 - Generated music prompt path stays separate from CORE

Context:

Phase 4 needs the app prompt path to use generated assets only when enhancement
settings are enabled. The proven Phase 3 CORE prompt path must stay stable, and
the generated sprite path still needs live ComfyUI validation before it can be
treated as ROM-ready.

Decision:

Add a separate native `run_phase4_music_prompt` command and call it only when
the `MML music` setting is enabled. The command generates a short deterministic
MML loop from the committed FM presets, compiles it with the pinned `ctrmml`
sidecar, and keeps using the proven bundled sprite until the generated sprite
gate is closed.

Consequence:

The app can exercise generated MML music without changing the default CORE
prompt path or claiming generated sprites are ready. Full generated-music ROM
proof still requires Docker Desktop so SGDK can build the generated project.

## 2026-06-30 - MML RAG note is Drive16-authored

Context:

Phase 4 needs the agent to retrieve `ctrmml` Megadrive MML syntax before
writing generated music. The upstream `ctrmml` repository is GPL-2.0, and
copying its full reference into Drive16 would complicate the corpus license
posture.

Decision:

Add a concise Drive16-authored crib sheet to `corpus/mml/` instead of copying
the upstream manual. The note records the syntax Drive16 needs for the first
generated-music path and references the original preset IDs committed under
`assets/enhancements/mml/`.

Consequence:

The agent can retrieve MML syntax and preset guidance through RAG without
vendoring upstream GPL documentation wholesale. If later music features need a
fuller reference, that can be added with explicit source and license handling.

## 2026-06-30 - FM presets ship as original MML data

Context:

Phase 4 generated music needs a small library of known-good FM instruments
because unaided YM2612 patch design is weak. The library must not copy GPL
sample songs or tracker data into Drive16, and it must stay optional with the
MML enhancement path.

Decision:

Ship original Drive16 preset data under `assets/enhancements/mml/` as a
`ctrmml` include file plus a JSON manifest. Validate every preset by compiling
a short sample phrase through the pinned `ctrmml` compiler.

Consequence:

Generated MML can reference stable instrument numbers without inventing FM
voice tables from scratch. The preset data remains independent of CORE bundled
music, and RAG ingestion plus prompt wiring remain later Phase 4 units.

## 2026-06-30 - MML music uses ctrmml as a sidecar MCP tool

Context:

Phase 4 calls for generated music through MML compiled by `ctrmml`. The
upstream project is GPL-2.0, so it cannot be linked into the permissively
licensed Drive16 app. The app also needs the music path to stay optional and
separate from CORE bundled assets.

Decision:

Add a `drive16-mml-music` MCP server that invokes a pinned `ctrmml` `mmlc`
binary from ignored artifacts. The server accepts complete Megadrive MML text,
compiles it to VGM, validates the VGM header, and returns an SGDK `XGM`
resource line. `ctrmml` source and build output stay under `artifacts/`.

Consequence:

The agent can compile generated MML through MCP without vendoring or linking
GPL code into Drive16. FM preset authoring, RAG reference ingestion, app prompt
wiring, and generated-asset ROM proof remain follow-up Phase 4 units.

## 2026-06-30 - Live ComfyUI sprite validation uses a committed runner

Context:

Phase 4 needs a real generated PNG to pass the Drive16 sprite validator before
the generated-sprite checklist item can close. Local ComfyUI may not be running
in every agent environment, and `comfyui-mcp` can auto-update its ignored npm
artifact unless disabled.

Decision:

Add `scripts/run-comfyui-sprite-workflow.py` as the live validation entrypoint.
It checks ComfyUI through `drive16-comfyui`, enqueues the committed workflow,
downloads the output PNG from ComfyUI history, and runs the generated-sprite
validator. Also default `COMFYUI_MCP_AUTOUPDATE=0` in `scripts/comfyui-mcp.sh`
and reinstall the pinned package if the ignored artifact version drifts.

Consequence:

The live ComfyUI proof has one command and still uses the MCP integration under
test. When ComfyUI is unavailable, the runner produces an explicit validation
request instead of pretending the generated-sprite task is done.

## 2026-06-30 - Generated sprite validation accepts ComfyUI PNG shapes

Context:

ComfyUI SaveImage output may be RGB or RGBA PNG data rather than the indexed
PNG format used by the bundled CORE sprite. Phase 4 still needs to enforce the
Genesis limits before any generated image is handed to SGDK.

Decision:

Validate generated sprites with a Drive16 script that reads indexed, RGB,
grayscale, or RGBA PNGs and enforces the hardware-facing contract: 32x32
pixels, 4x4 tiles, binary transparency, and no more than 16 palette slots
including transparency. For RGB output, reserve `255,0,255` as the transparent
background color until a later normalization step writes indexed PNG output.

Consequence:

Generated ComfyUI output can be rejected or accepted locally before SGDK build
wiring. The current validator proves the gate exists, but the Phase 4 generated
sprite task remains open until an actual ComfyUI-generated PNG passes it.

## 2026-06-30 - ComfyUI sprite workflow is an API prompt contract

Context:

Phase 4 needs a tuned Genesis palette ComfyUI workflow before generated sprite
outputs can be validated as SGDK resources. Live ComfyUI generation may require
GPU setup and checkpoint installation, but the workflow shape can be committed
and checked locally first.

Decision:

Ship the Drive16 sprite workflow as a ComfyUI API-format prompt under
`assets/enhancements/comfyui/`, paired with a manifest and structural validator.
The graph uses standard ComfyUI generation nodes, nearest-neighbor 32x32
scaling, and Pixydust `Quantizer` with 16 colors. It targets the optional
`drive16-comfyui` MCP server through `enqueue_workflow`.

Consequence:

Drive16 now has a concrete, versioned AI sprite workflow contract without
committing model weights or generated PNGs. Actual generated-output quality,
palette-index transparency, and SGDK `SPRITE` legality remain separate
validation work in the next Phase 4 unit.

## 2026-06-30 - ComfyUI MCP wrapper uses the external MIT package

Context:

Phase 4 calls for wrapping ComfyUI via `comfyui-mcp`. The npm package
`comfyui-mcp` is MIT licensed, runs as a standalone stdio MCP process, and
requires Node.js 22 or newer. Drive16 must keep the ComfyUI path optional and
separate from the Tauri app.

Decision:

Configure OpenCode with a `drive16-comfyui` local MCP server that launches
`scripts/comfyui-mcp.sh`. The launcher installs `comfyui-mcp@0.21.0` into
ignored Phase 4 artifacts, uses a Node 22 or newer runtime, defaults to local
`COMFYUI_URL=http://127.0.0.1:8188`, and keeps downloaded cache data under
ignored artifacts.

Consequence:

The agent can discover and call ComfyUI tools through MCP without vendoring or
linking ComfyUI into Drive16. The wrapper is present even when no local ComfyUI
server is running, and actual sprite generation stays behind later workflow and
asset-validation units.

## 2026-06-30 - ComfyUI health probing is native and local-only

Context:

Phase 4 needs ComfyUI endpoint configuration and health checks before wrapping
ComfyUI through MCP. ComfyUI is a separate GPL process and must stay optional.
Browser-only probing can also be blocked by local CORS behavior.

Decision:

Add a native Tauri command that accepts only local `http://127.0.0.1` or
`http://localhost` ComfyUI endpoints, normalizes the port to `8188` when
omitted, and probes `GET /system_stats`. The settings UI exposes the endpoint
field and test action only after `AI sprites` is enabled.

Consequence:

Drive16 can check whether a local ComfyUI process is available without linking
ComfyUI into the app, without accepting remote endpoints, and without making
the CORE bundled-asset flow depend on the enhancement.

## 2026-06-30 - Phase 4 enhancements start behind default-off toggles

Context:

Phase 4 adds AI sprite generation through ComfyUI and MML music generation
through ctrmml. The architecture requires both enhancement paths to stay off
the CORE critical path so the proven bundled-asset flow remains reliable.

Decision:

Begin Phase 4 by adding app settings toggles for `AI sprites` and `MML music`.
Both default to off and only change UI state in this slice. External
dependencies, endpoint checks, MCP wrapping, generated assets, and prompt
orchestration remain follow-up units behind these gates.

Consequence:

The app now has an explicit user-controlled boundary for the Phase 4
enhancements before any GPL ComfyUI process, `comfyui-mcp`, or ctrmml compiler
integration is added. The existing CORE ROM path remains the default.

## 2026-06-29 - Phase 3 v1 prompt uses the proven CORE project path

Context:

Phase 3 must prove that a non-developer can ask for a controllable sprite with
music and get a working ROM in the right pane. Phase 2 already proved the
agent can produce that CORE bundled-asset project. The app still must render
that result through the desktop shell without storing model credentials.

Decision:

Add a native `run_v1_prompt` command that prefers the existing Phase 2
agent-produced project under `artifacts/phase2/agent-loop/project` when it is
present, and falls back to the committed `examples/phase2-core-assets` fixture
otherwise. The command builds the selected project, runs Genteel, validates
Right-input sprite movement, and checks non-silent audio before the UI marks
the ROM as ready.

Consequence:

The Phase 3 app can now turn the v1 chat request into a verified bundled
sprite/music ROM in the right pane without writing secrets into project files.
The proof is grounded in the earlier agent-produced CORE project when that
artifact exists locally. A later hardening pass can replace the artifact reuse
with a fresh live OpenCode generation from the settings credential handoff.

## 2026-06-29 - Phase 3 exports write generated ROMs to ignored artifacts

Context:

Phase 3 needs project management and export-ROM wiring before the app can drive
the v1 prompt end to end. The current app project is still the starter SGDK
fixture, and generated ROM files must not enter git.

Decision:

Export the current starter ROM by copying it into
`artifacts/phase3/exports/` with a timestamped filename. Keep this as the
Phase 3 export target until the app grows a user-selected project directory or
save/export picker.

Consequence:

The app has a real native export path that can be tested without committing ROM
artifacts. Later project management work can swap the destination to a
user-selected folder while keeping the same command contract.

## 2026-06-29 - Phase 3 model settings keep BYOK keys ephemeral

Context:

Phase 3 needs provider choice, OpenRouter key entry, model selection, and a
connection test before the app drives the full prompt through OpenCode. The
architecture requires BYOK or local model access and forbids subscription relay
or secrets in the repo.

Decision:

Store the OpenRouter key only in frontend runtime state for this settings
slice. Test it directly against OpenRouter's key endpoint from the webview,
using the documented bearer-token flow and CORS-supported endpoint. Do not
write the key to project files, local storage, OpenCode config, or docs.

Consequence:

The app can prove that a pasted OpenRouter key is accepted and that a model is
selected without introducing secret persistence. Later app prompt wiring still
needs a deliberate runtime handoff from settings to OpenCode so live model
replies can run without committing credentials.

## 2026-06-29 - Phase 3 OpenCode bridge starts with no-reply messages

Context:

Phase 3 needs the left conversation pane to become a real OpenCode client, but
the settings surface for provider choice, OpenRouter key entry, model selector,
and connection testing is the next separate checklist item. Secrets must never
be written to the repo.

Decision:

Start the app bridge by checking or launching `opencode serve`, probing
`/global/health`, subscribing the frontend to `/global/event`, creating a
session on first send, and posting composer messages with `noReply: true`.
Use the canonical local HTTP routes directly for this bridge slice, while
keeping the app contract aligned with OpenCode HTTP/SSE.

Consequence:

The left pane now proves local OpenCode transport, session creation, message
posting, and SSE event streaming without consuming or storing a provider key.
The visible model reply remains intentionally gated until the next settings
unit wires runtime credentials and model selection.

## 2026-06-29 - Phase 3 framebuffer starts from sampled Genteel streams

Context:

Phase 3 needs the right pane to render the Genteel framebuffer. The current
native starter path already runs Genteel as a separate sidecar process and
writes a `D16F` RGB565 frame stream under ignored artifacts.

Decision:

Start the app-side framebuffer renderer by parsing the sampled Genteel stream
file and drawing the returned RGB565 frames into a webview canvas. Keep Genteel
as a separate process and keep persistent emulator process control, controller
input, and per-frame app streaming as follow-up work on top of the same canvas
path.

Consequence:

The app now proves the right pane can render actual Genteel framebuffer data
without linking emulator code into the Tauri binary. The first implementation
is sampled stream replay rather than a long-running interactive emulator
session, so later input and live-control work must extend the sidecar process
adapter.

## 2026-06-29 - Phase 3 app shell uses Tauri with React and Vite

Context:

Phase 3 begins the desktop app shell. The architecture already selects Tauri
2.x for the native shell, but the repo had only an `app/` placeholder and no
frontend framework, package manifest, or Rust shell.

Decision:

Use a Tauri 2 shell with a React and Vite frontend for the Phase 3 app. Keep
the first slice to a visible two-pane shell with local UI state, while OpenCode
HTTP/SSE and Genteel framebuffer integration remain separate follow-up units.

Consequence:

Drive16 now has a runnable app surface that can host the proven Phase 1 and
Phase 2 loops. The frontend remains lightweight and package-local under `app/`,
and Tauri sidecar/process isolation remains aligned with the license posture.

## 2026-06-29 - Phase 2 audio evidence belongs in emulator MCP

Context:

Phase 2 must prove the bundled VGM loop is playing while staying on CORE tools.
The first Phase 2 harness design asked the agent to use MCP for build/run/frame
inspection, then used a direct Genteel audio dump in the harness for music
evidence.

Decision:

Expose audio evidence in `mcp-servers/emulator/server.py`. `run_rom` now accepts
`dump_audio`, and `capture_audio` inspects the WAV dump and reports whether it
is non-silent. The Phase 2 prompt and harness require `capture_audio`.

Consequence:

The actual agent loop can prove sprite, control, screenshot, and music evidence
through CORE MCP tools. The harness can still use direct Genteel runs for
independent screenshot-difference cross-checks, but audio is no longer outside
the MCP contract.

## 2026-06-29 - Phase 2 harness verifies audio outside MCP

Context:

The Phase 2 exit criterion includes a playing bundled music loop. The current
emulator MCP server can run ROMs, capture frames, and script input, but it does
not expose an audio-dump tool.

Decision:

Keep the agent interaction on CORE MCP tools, then let
`scripts/validate-phase2-agent-loop.py` perform a final direct Genteel
verification pass against the generated ROM. That pass captures neutral and
Right-input screenshots and writes an audio dump to confirm non-silent output.

Consequence:

The Phase 2 agent still proves it can produce and run the ROM through MCP, and
the harness supplies objective audio evidence until the emulator MCP grows an
audio inspection method.

## 2026-06-29 - Phase 2 agent skill files live under agent/skills

Context:

Phase 2 must teach the agent how to reference bundled assets through
`resources.res`, wire a controllable sprite, and attach a music loop. OpenCode
is currently driven by explicit validation prompts, while `mcp-local-rag`
provides repo-indexed documentation.

Decision:

Store Drive16-owned operating recipes under `agent/skills/`, starting with
`agent/skills/phase2-core-assets.md`. Validation harnesses can read these files
into OpenCode prompts, and RAG still carries the searchable SGDK and Drive16
project-pattern knowledge.

Consequence:

Phase 2 has a stable prompt ingredient independent of provider configuration.
The eventual app can keep using these files as local agent context or migrate
them into an OpenCode-native skill mechanism if one becomes the better fit.

## 2026-06-29 - Phase 2 CORE pack starts from original Drive16 assets

Context:

Phase 2 needs a bundled asset pack that the agent can reference through
`resources.res` without calling ComfyUI, MML, or any generated-asset pipeline.
Phase 0 already produced and validated tiny original Drive16 assets: a 32x32
indexed PNG sprite and a PSG-only looping VGM.

Decision:

Promote those original assets into `assets/core/` as the Phase 2 CORE bundled
asset pack, with stable resource symbols `drive16_player` and `drive16_loop`.
Keep `assets/phase0/` as the original Phase 0 evidence fixture.

Consequence:

Phase 2 can teach and validate the agent against a stable v1 asset contract
without adding new asset-generation dependencies. The final asset license still
follows the broader app-license confirmation gate before release.

## 2026-06-29 - Phase 1 agent-loop validation uses a throwaway project

Context:

The Phase 1 exit criterion must prove a real text prompt can drive OpenCode to
write C, build a ROM, read the result, and self-correct a deliberate compile
error. Running that proof requires an OpenRouter credential and model choice
outside the repo.

Decision:

Use `scripts/validate-phase1-agent-loop.py` as the gate harness. It prepares a
fresh SGDK project under ignored `artifacts/phase1/agent-loop/project` with a
known compile error, writes the exact OpenCode prompt to
`artifacts/phase1/agent-loop/prompt.md`, and only runs the agent when
`--run-agent` is passed with `DRIVE16_PHASE1_MODEL` set to an OpenRouter model
and an OpenRouter credential available.

Consequence:

The repo now contains the precise validation artifact for the human to run
after credentials are configured. Phase 1 is still not complete until the
script runs with the agent, the compile error is fixed by OpenCode, the ROM
builds, Genteel captures a frame, and the script verifies those artifacts.

## 2026-06-29 - Project OpenCode config keeps credentials external

Context:

Phase 1 needs OpenCode to run with the SGDK build server, Genteel emulator
server, RAG server, and an OpenRouter model. The installed OpenCode binary is
version `1.14.33`, supports `opencode serve`, and loads project-level
`opencode.json`. No OpenRouter credential is currently configured.

Decision:

Commit project `opencode.json` with only the local Phase 1 MCP server
configuration. Keep OpenRouter credentials outside the repo through
`opencode providers login` or `OPENROUTER_API_KEY`, and document that as a
validation gate in `docs/phase1-opencode.md`.

Consequence:

The non-secret OpenCode setup is reproducible and checked in. The next
end-to-end agent run cannot be marked complete until a human configures an
OpenRouter credential and model outside git.

## 2026-06-29 - Local RAG uses pinned mcp-local-rag under artifacts

Context:

Phase 1 needs `mcp-local-rag` with SGDK and VDP documents indexed before the
agent starts writing Genesis C. The current system `node` is v21.1.0, while
`mcp-local-rag@0.15.3` requires Node 22 or newer and failed under `npx`.

Decision:

Pin `mcp-local-rag` to version `0.15.3` and install it into ignored
`artifacts/phase1/mcp-local-rag/` through `scripts/mcp-local-rag.sh`. The
wrapper runs the installed CLI with `DRIVE16_NODE` when set, otherwise the
bundled Codex Node 24 runtime when present, otherwise a system Node 22 or newer.
The Phase 1 corpus uses SGDK v2.11 docs and headers plus Drive16-authored VDP
and project-pattern notes.

Consequence:

The RAG server path is reproducible without changing global Node or npm state.
The indexed database and embedding model cache stay out of git under
`artifacts/phase1/rag/`, while the source documents and fetch/index scripts are
tracked.

## 2026-06-29 - Python stdio MCP server for the Genteel sidecar

Context:

Phase 1 needs an emulator adapter with `run_rom`, `capture_frame`,
`send_input`, and `read_state`. Phase 0 already proved the pinned Genteel build,
headless screenshot capture, input scripting, and the Drive16 RGB565 frame
stream patch.

Decision:

Implement `mcp-servers/emulator/server.py` as a dependency-free Python stdio
MCP server. It launches the pinned Genteel binary as a native sidecar process
per `run_rom` call, writes screenshots and frame streams under
`artifacts/phase1/emulator/`, and uses Genteel CSV input scripts as the first
implementation of `send_input`.

Consequence:

The Phase 1 text loop can run and inspect ROM output without waiting for the
Phase 3 Tauri live pane. The adapter remains process-isolated from the app and
can evolve into a persistent live-view sidecar when the application shell needs
continuous rendering.

## 2026-06-29 - Python stdio MCP server for SGDK builds

Context:

Phase 1 starts by exposing the proven docker-sgdk build path as MCP tools. The
repo does not yet have a Node, Rust, or Python package manifest, and adding a
package manager would be extra surface for this first integration slice.

Decision:

Implement `mcp-servers/sgdk-build/server.py` as a small dependency-free Python
stdio MCP server. It exposes `build_rom`, `clean`, and `read_build_log`, invokes
`scripts/build-sgdk.sh`, and stores the latest log under
`artifacts/phase1/sgdk-build/`. For now, project paths must stay inside the
Drive16 repository.

Consequence:

The Phase 1 build tool is immediately runnable on a clean checkout with Python
and Docker. Later app and OpenCode integration can keep this server as a
sidecar process or replace it with a packaged implementation once the app
runtime is chosen in Phase 3.

## 2026-06-29 - Genteel frame-stream patch for live-view proof

Context:

Phase 0 needed proof that Genteel can provide a live framebuffer path for the
future Tauri pane. The public pinned Genteel CLI supports screenshots but not a
continuous frame stream. Its source does expose `vdp.framebuffer`.

Decision:

Apply a small Drive16-owned patch to the pinned Genteel source during
`scripts/build-genteel.sh`. The patch adds `--stream-frames <file>` and
`--stream-every <n>` for headless runs. Each streamed record uses a simple
binary format: `D16F` magic, version, 320x240 dimensions, RGB565 format marker,
frame index, payload length, and raw RGB565 framebuffer payload.

Consequence:

Phase 0 now has an evidenced live-frame source without vendoring or linking
Genteel into Drive16. Phase 1's emulator sidecar can consume the same stream or
replace it with an upstreamed/socket-based variant.

## 2026-06-29 - Proposed: resolve Genteel live-framebuffer path

Context:

Phase 0 requires confirmation that Genteel can stream a framebuffer for the
future live Tauri pane. The pinned buildable Genteel revision
`8043061f50782d6066cd39925f0f808f06d665ea` supports headless screenshots,
input scripts, audio dump, GUI rendering, and an internal `vdp.framebuffer`.
Source inspection did not find a documented continuous framebuffer stream CLI or
sidecar protocol.

Decision:

Proposed, awaiting human confirmation: treat Genteel's current public CLI as
validated for headless screenshots and scripted verification, but not yet
validated for Drive16's live-view sidecar. Choose one before Phase 1:

- add a small upstream or local Genteel adapter that exposes frames from
  `vdp.framebuffer` over stdout, a socket, or shared memory;
- use the Genteel GUI only for Phase 0 live-view proof and defer stream adapter
  implementation to the Phase 1 emulator MCP work;
- switch the live-view proof to a fallback emulator with a documented frame
  streaming path, while keeping Genteel for headless verification.

Consequence:

Phase 0 cannot be signed off until the human confirms which path to take and the
chosen path is evidenced. No Phase 1 work should begin before this is resolved.

## 2026-06-29 - Pin buildable Genteel revision for Phase 0

Context:

Genteel is the Phase 0 emulator target. The observed current `main` commit
`bd4fc05b2020a6889b323815f22ae577c70e52fa` exposes the expected headless
screenshot CLI but did not compile locally because `src/main.rs` references a
missing audio helper.

Decision:

For Phase 0 validation, build Genteel from commit
`8043061f50782d6066cd39925f0f808f06d665ea`, which preserves the documented
`--headless <frames> --screenshot <path>` CLI and builds successfully on this
machine with Rust 1.96.0.

Consequence:

The known-good homebrew screenshot and accuracy check can run locally now. This
does not close the live-framebuffer requirement, and it should be revisited
before Phase 1 if upstream `main` remains unbuildable.

## 2026-06-29 - Genteel CLI source for Phase 0 scripts

Context:

The first Genteel validation script used a provisional CLI shape because the
local machine had no Genteel binary. Phase 0 needs exact headless screenshot
commands before human validation can be reliable.

Decision:

Use `segin/genteel` as the intended Genteel source for Phase 0 validation and
align scripts to the observed CLI at commit
`bd4fc05b2020a6889b323815f22ae577c70e52fa`:
`genteel --headless <frames> --screenshot <path> <ROM>`.

Consequence:

The screenshot validation script now matches upstream source evidence. The
continuous live-framebuffer path is still an explicit Phase 0 validation item,
not an assumed capability.

## 2026-06-29 - Known-good Phase 0 accuracy ROM

Context:

Phase 0 requires Genteel accuracy validation against a known-good homebrew ROM,
but the repo must not include commercial ROMs or unlicensed downloads.

Decision:

Use SGDK's upstream `sample/basics/hello-world` release ROM from pinned commit
`846b1a3c8551392eebbab33182b80cf4291fd2e8` as the known-good open homebrew
accuracy check. Fetch it into ignored `artifacts/` storage, verify SHA-256, and
record source/license metadata before running it in Genteel.

Consequence:

The accuracy check is reproducible without committing a ROM binary. It confirms
basic SGDK ROM execution in Genteel, while broader emulator compatibility can be
expanded later if Phase 0 exposes Genteel risk.

## 2026-06-29 - Phase 0 validation assets are original

Context:

Phase 0 needs a bundled sprite and VGM loop, but the architecture forbids
commercial ROM-derived material and requires license hygiene.

Decision:

Generate tiny original validation assets under `assets/phase0/` with
`scripts/generate-phase0-assets.py`: an indexed 32x32 sprite PNG and a PSG-only
VGM loop.

Consequence:

Phase 0 can validate SGDK `SPRITE` and `XGM` resource wiring without copying
commercial game art or music. Final asset licensing should be confirmed before
release alongside the app license.

## 2026-06-29 - Proposed app license: MIT

Context:

Drive16 needs a permissive license posture while isolating copyleft and
non-commercial dependencies as separate sidecar processes. The architecture
requires Genteel as the MIT default emulator, BlastEm only as a GPLv3 sidecar,
Genesis Plus GX only as explicit opt-in, and ComfyUI only as a separate Phase 4
process.

Decision:

Propose MIT for the Drive16 app code. Do not finalize a `LICENSE` file until the
human confirms this choice.

Consequence:

The repo can document the intended license stance now, while release licensing
remains a human confirmation gate. Any copyleft or non-commercial component must
stay outside the linked app binary.

## 2026-06-29 - Phase 0 validation fixture location

Context:

The architecture intentionally leaves the final Drive16 project format open
until before Phase 3, but Phase 0 needs a concrete SGDK project to validate the
manual toolchain.

Decision:

Place manual spike fixtures under `examples/`, starting with
`examples/sgdk-hello-world/`. These fixtures are validation assets, not the final
Drive16 project format.

Consequence:

Phase 0 can produce exact build commands now without prematurely deciding the
future app project layout.
