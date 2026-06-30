# Drive16 Decisions

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
