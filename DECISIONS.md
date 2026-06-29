# Drive16 Decisions

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
