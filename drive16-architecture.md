---
project: Drive16
type: architecture and phased build plan
created: 2026-06-29
updated: 2026-06-29
status: draft v2
---

# Drive16: Architecture and Phased Build Plan

A conversational, agentic builder for Sega Genesis / Mega Drive games. You talk to it
in plain language on the left, the game runs live on the right, and it writes the C,
compiles the ROM, runs it, looks at the result, and iterates with you. It can also
generate sprites and music, but those are enhancements layered on top of the core loop,
not the core itself. Open source. Model-agnostic. Every component swappable.

This document is the implementation reference. It names specific projects, versions,
licenses, and interfaces, and it sequences the build into phases an AI code agent can
execute step by step.

---

## 0. Revision notes (v2)

v2 is a critical-review pass on v1. Six changes, three of them material:

1. Emulator and license. v1 made Genesis Plus GX the default live-view core. Its license
   is non-commercial, which forecloses futures and is murky even for free distribution.
   Reversed: Genteel (MIT, actively developed, full debug + headless) is now the primary
   emulator for both live view and verification; BlastEm (GPLv3) is the accuracy fallback
   as a separate process; Genesis Plus GX is demoted to optional.
2. Music pipeline. mml2vgm is a C#/.NET Windows tool, wrong for a cross-platform app.
   ctrmml (C++, cross-platform) is now primary. AI-generated music is moved off the v1
   critical path; v1 plays a bundled VGM loop.
3. Sprite pipeline. SDXL produces muddy output below 32x32 and Genesis tiles are 8x8.
   AI sprite generation is moved off the v1 critical path; v1 uses bundled sprite assets.
   When added, generation runs at 32px+ with nearest-neighbor downscale.
4. Spine embedding (resolved). OpenCode runs as a headless server (`opencode serve`,
   OpenAPI 3.1, SSE) with a TypeScript SDK. The app talks to it over local HTTP.
5. Live emulator embedding (position taken). Run the emulator as a native sidecar
   process, not WASM in the webview. This is faster and keeps GPL code at arm's length.
6. v1 scope. Recentred on the agent build-and-verify loop. The two shakiest pipelines
   (AI sprites, AI music) are deferred so they cannot sink the core proof.

The throughline: protect the core loop, defer the riskiest asset generation, and keep
licensing clean by isolating copyleft and non-commercial components as separate processes.

---

## 1. Problem

Making a Genesis game today is a manual, multi-tool grind. You hand-write C or 68000
assembly against the SGDK library, draw tiles in a sprite editor, compose FM music in a
tracker, run a resource compiler to wire assets into the build, assemble the ROM, and
test it in an emulator with a debugger. Every loop is manual. The knowledge needed
(VDP quirks, sprite limits, palette rules, memory layout) is well documented for humans
on the NESdev/SpritesMind wikis but is scattered across forums and reference pages.

A general-purpose AI coding model already knows C cold and can drive each of these tools.
What does not exist is a single application that wraps the whole pipeline into one
agent loop, injects the Genesis-specific knowledge into the model's context, and lets a
non-expert build a working ROM by conversation. That is the gap Drive16 fills.

The constraint that shapes everything: the value is not a custom-trained model. A generic
model plus the right context plus a tight build-and-verify loop is enough. So Drive16 is
an orchestration and integration product, not a machine-learning project. A fine-tuned
local model is a later optimization, not a prerequisite.

---

## 2. Solution

A desktop application with two panes:

- Left: a conversational terminal where you talk to the agent and watch it work.
- Right: a live emulator window showing the current ROM running.

Under the panes sits a model-agnostic agent loop connected to a set of tools, each
exposed over the Model Context Protocol (MCP). The agent has standing access to a
retrieval-augmented (RAG) knowledge base of Genesis documentation that is injected into
context whenever it works. When you ask for something, the agent retrieves the relevant
docs, writes or edits C, compiles the ROM with SGDK, runs it in the emulator, reads
compiler errors and screenshots, and fixes its own output until it builds and runs. It
can also call sprite and music tools, but those are optional enhancements, not the spine.
You stay in the loop as the creative director.

### 2.1 The v1 success criterion (rescoped)

The core proof is the loop, not the asset generators. v1 succeeds when, from a
conversation, Drive16:

- writes and edits C, builds a Genesis ROM with SGDK, runs it, reads the result, and
  self-corrects a compile or logic error, and
- puts a controllable sprite on screen using a bundled sprite asset, and
- plays a bundled VGM music loop.

AI sprite generation and AI music composition are explicitly out of the v1 criterion.
They are Phase 4 enhancements. This keeps the two least-proven pipelines off the critical
path so they cannot block the thing that actually matters: the agent reliably building
and fixing real Genesis code.

Three properties are non-negotiable in the design:

1. Free to run. Default path is bring-your-own-key (BYOK) through OpenRouter, with a
   fully local option via Ollama. No mandatory paid service.
2. Model-agnostic. The model is a config value, swappable between hosted and local with
   no code change.
3. Swappable components. Every external project sits behind a standard interface (MCP
   for tools, a sidecar adapter for the emulator, a provider string for the model) so any
   one can be upgraded or replaced independently as it evolves.

---

## 3. Architecture

### 3.1 Layered model

Drive16 is four layers. Each layer is independently swappable.

```
+---------------------------------------------------------------+
|  LAYER 0  App shell (Tauri)                                   |
|  Two-pane desktop UI, settings, project management, the       |
|  emulator viewport. This is the code you write.               |
+---------------------------------------------------------------+
|  LAYER 1  Agent spine (OpenCode, run as a headless server)   |
|  The agent loop: planning, tool calling, error handling.      |
|  Model-agnostic, MCP-native, BYOK. App talks to it over HTTP. |
+---------------------------------------------------------------+
|  LAYER 2  Model (config only)                                |
|  OpenRouter (BYOK default) | Ollama (local) | direct keys.    |
+---------------------------------------------------------------+
|  LAYER 3  MCP tool servers (each swappable)                  |
|  CORE:  1 RAG docs   2 SGDK build   3 Emulator (sidecar)     |
|  ENH:   4 ComfyUI sprites   5 MML music   6 Sprite edit      |
+---------------------------------------------------------------+
```

CORE tools are required for the v1 loop. ENH (enhancement) tools are added in later
phases and are not on the v1 critical path.

The contract between layers is what makes swapping safe:

- Layer 0 talks to Layer 1 (OpenCode) over local HTTP and server-sent events.
- Layer 1 talks to Layer 2 through a provider string. Changing models is editing config.
- Layer 1 talks to Layer 3 through MCP. Any tool that speaks MCP plugs in unchanged.
- Layer 0 and the emulator tool talk to the emulator through a sidecar adapter interface
  (`run_rom`, `capture_frame`, `send_input`, `read_state`). Any emulator with an adapter
  drops in.

### 3.2 How the app and the agent connect

OpenCode is not embedded as a library. It runs as a headless server via `opencode serve`,
which exposes an OpenAPI 3.1 HTTP endpoint plus server-sent events, backed by SQLite
session persistence. The Tauri shell is a client of that server, using the
`@opencode-ai/sdk` TypeScript client. The left pane streams the agent's messages and tool
actions over SSE; user input posts to the server.

This resolves the v1 open question about embedding the spine. The shell and the brain are
decoupled over a local API, which also means the agent can be swapped (OpenClaw, a custom
loop) as long as the replacement exposes a comparable local endpoint.

### 3.3 The build-and-verify loop

This loop is the core of the product. It is where most engineering effort goes.

1. You state intent in the left pane ("make a sprite I can move left and right").
2. The agent queries the RAG docs server for relevant Genesis/SGDK references.
3. The agent writes or edits C in the project, plus a `resources.res` entry to reference
   the bundled sprite asset.
4. The agent calls the SGDK build tool. `rescomp` compiles assets into C; GCC builds
   the ROM.
5. On a build error, the compiler output returns to the agent, which fixes and rebuilds.
6. On success, the ROM loads into the emulator sidecar. The headless path scripts inputs
   and captures a screenshot.
7. The agent inspects the screenshot and state, compares to intent, and either reports
   done or iterates from step 2.

The human approves and redirects at any step. v1 is a guided builder, not a one-shot
generator.

### 3.4 Component inventory

Every external dependency, its role, license, what it rests on, and its swap target.
"Build" means you write the glue. "Reuse" means you consume it as-is. CORE vs ENH marks
whether it is on the v1 critical path.

**Layer 0: App shell**

| Component | Role | License | Build/Reuse | Swap target |
|---|---|---|---|---|
| Tauri 2.x | Desktop shell, two-pane UI, native webview + Rust core | MIT / Apache-2.0 | Build (your app) | Electron |

Tauri over Electron because Drive16 runs alongside a sidecar emulator and, later, a local
model and/or ComfyUI, all of which consume RAM and GPU. Tauri idles around 30-60 MB
versus 150-300 MB for Electron and ships a 15-20 MB binary versus 80-150 MB. Tauri's
sidecar mechanism is also how the emulator process is launched and managed.

**Layer 1: Agent spine**

| Component | Role | License | Build/Reuse | Swap target |
|---|---|---|---|---|
| OpenCode (`opencode serve`) | Headless agent loop, MCP client, BYOK, HTTP+SSE API | MIT | Reuse + configure | OpenClaw, Claude Agent SDK |

**Layer 2: Model**

| Path | Role | Cost | Notes |
|---|---|---|---|
| OpenRouter (BYOK) | Default. Any hosted model via one API key | User pays provider | Strong model for the loop; cheap models for trivial steps |
| Ollama | Fully local, offline | Free, needs hardware | Devstral 24B, Qwen-Coder, DeepSeek-Coder |
| Direct provider key | Anthropic / OpenAI directly | User pays provider | Same config slot |

Subscription auth is explicitly excluded. Anthropic's terms restrict Pro/Max OAuth
tokens to Claude Code and claude.ai; a third-party app may not log users in with their
Claude subscription. BYOK API keys are fine. This is a licensing constraint, not a
technical one, and it is the reason the default is BYOK rather than "use your Claude plan."

**Layer 3: MCP tool servers**

| # | Server | Tier | Role | Rests on | License | Build/Reuse | Swap target |
|---|---|---|---|---|---|---|---|
| 1 | RAG docs | CORE | Inject Genesis/SGDK knowledge into context | mcp-local-rag + curated corpus | open | Build corpus, reuse server | any RAG MCP server |
| 2 | SGDK build | CORE | Compile C + assets to ROM | SGDK 2.11, GCC m68k-elf 13.2, Java, rescomp | MIT (SGDK) | Build wrapper | MarsDev toolchain |
| 3 | Emulator | CORE | Run ROM, live view, headless verify | Genteel (primary) | MIT | Build sidecar adapter | BlastEm (GPLv3), GPGX (non-comm) |
| 4 | ComfyUI sprites | ENH | Generate palette-legal sprites locally | ComfyUI + Pixel Art Diffusion XL + PixydustQuantizer | GPL-3.0 / open | Reuse (comfyui-mcp) + tune workflow | different model / image MCP |
| 5 | MML music | ENH | Text MML to VGM | ctrmml (C++), SGDK XGM driver | open | Build wrapper | mml2vgm (Windows), Furnace headless |
| 6 | Sprite edit | ENH | Programmatic cleanup, animation | LibreSprite (scriptable) | GPLv2 | Reuse | Aseprite CLI |

### 3.5 The RAG knowledge base (CORE)

This is the most important asset you create, because it is what makes a generic model
competent at Genesis. It is data, not code, and it ships with the app.

Server: `mcp-local-rag` (local-first, semantic + keyword search, embeds with a small
local model such as all-MiniLM-L6-v2, stores in a file-based vector DB, no external
service). It exposes `query_documents` and related tools over MCP.

Corpus to ingest and index:

- SGDK API documentation and the `rescomp` reference (resource types: SPRITE, TILESET,
  TILEMAP, MAP, the XGM music format).
- Genesis VDP hardware reference: sprite limits, palette rules, plane and scroll model,
  memory map, DMA, vblank/NMI timing.
- A curated set of openly-licensed SGDK example projects, lightly commented, as
  intent-to-code reference patterns.
- A house "best practices" file: project layout, asset naming, how sprites and music are
  wired through `resources.res`.
- The MML command reference (added in the ENH music phase, not v1).

Injection policy: relevant chunks are retrieved and prepended to the agent's working
context on every build task, not just on explicit questions. The agent should never write
Genesis code without the hardware constraints in context.

### 3.6 SGDK build server and its sub-dependencies (CORE)

SGDK is not standalone. It depends on a GCC m68k-elf cross-compiler (built against
newlib), Java (for `rescomp` and other tools), and the `rescomp` resource compiler.
Hand-installing a cross-compiler is the single worst onboarding step in the whole stack.

Decision: ship the SGDK toolchain as a Docker image (the community `docker-sgdk` images
provide a Linux-native m68k-elf GCC 13.2 toolchain with all tools). The SGDK build MCP
server invokes the build inside the container. This makes the build reproducible across
macOS, Windows, and Linux, and isolates the Java and cross-compiler dependencies from the
user's machine. Swap target if Docker is unacceptable: the MarsDev environment.

The build server exposes MCP tools: `build_rom(project_path)`, `clean(project_path)`,
`read_build_log()`. It returns compiler stdout/stderr verbatim so the agent can fix errors.

### 3.7 Emulator server: a sidecar adapter, Genteel first (CORE)

The key abstraction. Do not couple to one emulator. Define a sidecar adapter interface
(`run_rom`, `capture_frame`, `send_input`, `read_state`) and run the emulator as a native
process the shell launches via Tauri's sidecar mechanism. Render the streamed framebuffer
in the right pane; do not run a WASM emulator inside the webview (it needs cross-origin
isolation headers, takes an asyncify performance penalty, and is browser-engine dependent
across the three OS webviews).

Emulator choice, by license and fit:

- Genteel (MIT): primary. An instrumentable Rust Genesis emulator built for automated
  testing by humans and AI, with headless operation, scripted inputs, screenshot capture,
  GDB, and a debug suite (VDP/tile/palette/CPU/memory viewers). MIT is the cleanest
  license in the stack. It is a single-maintainer project under active development as of
  April 2026, so Phase 0 must validate its accuracy and its live-framebuffer path.
- BlastEm (GPLv3): accuracy fallback. The most cycle-accurate Genesis emulator, with a
  CLI debugger. Run only as a separate process so its copyleft stays at arm's length from
  the Tauri app (mere aggregation, not linking).
- Genesis Plus GX (non-commercial): optional only. High compatibility, but the
  non-commercial license forecloses any commercial future and is risky to redistribute.
  Not a default. Include only behind an explicit user opt-in if at all.

One emulator (Genteel) covers both the live view and the headless verify, which removes a
component from v1 versus the v1 plan that split the two roles. Keep the adapter interface
so BlastEm or any libretro core can be swapped in.

### 3.8 ComfyUI sprite server (ENH, deferred to Phase 4)

Not on the v1 critical path. v1 uses bundled sprite assets so the loop can be proven
without the least-reliable generator.

When added: a local ComfyUI instance (run as a separate process; it is GPL-3.0) driven
through `comfyui-mcp`. Realistic constraints from the research:

- SDXL is not built for clean pixels. Below 32x32 it produces muddy output, and Genesis
  tiles are 8x8. Do not try to generate 8x8 tiles directly.
- Generate at the 32px+ sprite scale (the model's sweet spot), then nearest-neighbor
  downscale. Bilinear/bicubic blurs and ruins the result.
- Prefer a dedicated pixel checkpoint (Pixel Art Diffusion XL) over the bare Pixel Art XL
  LoRA for cleaner sprites.
- Quantize to a 16-color palette line with `ComfyUI-PixydustQuantizer` or
  `ComfyUI-PixelArt-Detector`; reserve color index 0 for transparency; respect the 4x4
  tile (32x32) hardware sprite limit.

Output is a PNG plus its palette, handed to `rescomp` as a SPRITE resource. The tuned
ComfyUI graph (a JSON file) is something you build and ship. Hitting clean tile-legal
output reliably is an open risk, which is exactly why it is deferred off the v1 path.

### 3.9 MML music server (ENH, deferred to Phase 4)

Not on the v1 critical path. v1 plays a bundled CC0 VGM loop through SGDK's XGM driver,
which is trivial and proven. AI music composition comes later.

When added: the model writes music as text in MML, the same way it writes code, with the
MML reference in context. Primary compiler is ctrmml (C++, builds cross-platform), not
mml2vgm (a C#/.NET Windows tool that is wrong for a cross-platform app and clean
automation). Pipeline: MML text -> ctrmml -> VGM -> SGDK XGM driver (5 FM + 4 PSG + 4 PCM
channels). The server exposes `compile_music(mml_text)` returning a VGM asset for
`rescomp`. Ship a small library of known-good FM instrument presets, because unaided
patch design is where MML quality is weakest. Swap target: a headless Furnace build.

### 3.10 What you build versus what you reuse

Reuse as-is: Tauri, OpenCode, Ollama/OpenRouter, mcp-local-rag, SGDK + docker-sgdk,
Genteel, BlastEm, and (in Phase 4) ComfyUI + comfyui-mcp + palette nodes, ctrmml,
LibreSprite.

Build:

1. The Tauri two-pane app shell (chat, live emulator viewport, settings, project
   management) and its OpenCode HTTP/SSE client.
2. Two custom MCP servers for v1: SGDK build, and the emulator sidecar adapter. (The MML
   music server is built in Phase 4.)
3. The RAG corpus: gather, clean, and index the Genesis/SGDK documentation and example
   projects.
4. A small bundled asset pack for v1: a few sprites and one or two VGM loops.
5. The orchestration layer: the system prompt, the agent skill files, and the
   build-and-verify loop logic. This is the hard 80 percent of the product.
6. Phase 4 only: the ComfyUI palette workflow (the tuned JSON graph).

### 3.11 Application UI

The doc the user sees is the product. Target experience, comparable in feel to Lovable or
Bolt but for Genesis ROMs.

Main window, two panes:

- Left pane: conversation/terminal. Message history, the agent's current step, streamed
  tool actions ("writing player.c", "building ROM", "running"). An input box at the
  bottom. Collapsible file tree of the current project. A build status indicator
  (idle / building / running / error).
- Right pane: live emulator viewport rendering the current ROM via the Genteel sidecar.
  Transport controls: run, pause, reset, and a control-mapping panel so the user can play
  with keyboard or gamepad. A frame/FPS readout for debugging.

Top bar: project name, model selector (shows the active provider and model), build/run
buttons, export ROM.

Settings page (its own view, clean and minimal, monastic orange/black aesthetic):

- Model: provider (OpenRouter / Ollama / direct), API key field, model dropdown, a
  "test connection" button.
- Tools: enable/disable and configure each MCP server; show health status per server;
  show the emulator in use; (Phase 4) set the ComfyUI endpoint.
- Knowledge base: show indexed corpus, re-index button, add custom docs.
- Build: SGDK version, Docker toolchain status, output directory.
- Appearance: theme.

Onboarding flow: first launch checks dependencies (Docker; Ollama if local; ComfyUI only
when the sprite enhancement is enabled), walks the user through pasting an OpenRouter key
or selecting a local model, indexes the default corpus, and opens a starter project that
already builds to a blank Genesis screen. The first win should be "a ROM is running in the
right pane" within minutes, before the user types anything.

---

## 4. Constraints

### 4.1 Genesis hardware (the rules the agent must always respect)

- CPU: Motorola 68000 at 7.67 MHz. Sound co-CPU: Zilog Z80 at 3.58 MHz.
- Sound: Yamaha YM2612 (6 FM channels) plus SN76489 (4 PSG channels).
- Resolution: 320x224 (H40) or 256x224 (H32).
- Tiles: 8x8 pixels, each pixel a 4-bit palette index (0-15).
- Palette: 4 palette lines of 16 colors each, 64 colors on screen, from a master palette
  of 512. Index 0 of each line is transparent.
- Sprites: up to 80 on screen, max 20 per scanline. Each hardware sprite is up to 4x4
  tiles (32x32 px) and uses one 16-color palette line.
- Planes: two scrolling planes (A, B) plus a window plane.

These numbers go into the RAG corpus verbatim and bound the sprite-generation workflow.

### 4.2 Product and platform constraints

- No subscription relay. BYOK or local only (see 3.4, Layer 2).
- License hygiene across the stack. Keep copyleft and non-commercial code as separate
  processes, never linked into the Tauri binary. Genteel (MIT) is the clean default;
  BlastEm (GPLv3) runs only as a sidecar process; Genesis Plus GX (non-commercial) is
  opt-in only; ComfyUI (GPL-3.0) runs as a separate process. The Drive16 app code itself
  can then carry a permissive license.
- Local model performance. Small local coding models are slow and weak on the long context
  this agent needs. Local is supported but is not the recommended path for the agent brain
  in v1. A strong model via OpenRouter is the realistic default for development and for a
  usable hosted experience.
- Hardware load. The fully-local path (Ollama brain + local ComfyUI in Phase 4) is
  demanding: target a machine with a capable GPU and 32 GB+ RAM. The BYOK path offloads
  the model and lowers local requirements.
- IP hygiene. Retrieve only on the 68000/Genesis hardware references, the open toolchain
  docs, and openly-licensed homebrew. No disassembled commercial ROMs in the corpus, ever.
  Keep "Sega" out of the product name and imply no official affiliation.
- Java dependency. SGDK's `rescomp` needs Java; the Docker toolchain contains it so the
  user never installs it directly.

### 4.3 Known soft spots (flagged, not blocking)

- Genteel accuracy and live-view. Primary emulator, MIT, but single-maintainer and young.
  Phase 0 must confirm it runs SGDK ROMs accurately and can stream a framebuffer for the
  live pane. The sidecar adapter keeps BlastEm ready as a fallback.
- ComfyUI tile-legal output (ENH). SDXL struggles below 32x32; reliably hitting per-sprite
  size and palette limits needs a tuned workflow. Deferred to Phase 4 for this reason.
- MML music quality (ENH). Open whether a model writes pleasant MML with only the
  reference plus presets. Deferred to Phase 4; v1 uses bundled loops.
- Orchestration reliability. Getting dependable build -> read-error -> fix loops is the
  genuine engineering effort. Everything else is plumbing by comparison.
- Dependency surface. Even rescoped, this stack has many moving parts. The CORE set is
  deliberately small (Tauri, OpenCode, mcp-local-rag, SGDK/Docker, Genteel) so v1 has the
  fewest possible failure points.

---

## 5. Phased Build

Each phase has an exit criterion. Do not advance until it is met. The ordering front-loads
the riskiest unknowns (the toolchain and the build loop) so failure is cheap and early,
and defers the riskiest asset generators until the core is proven.

### Phase 0: Manual spike (no agent)

Goal: prove the toolchain by hand before any AI is involved.

- Stand up the docker-sgdk toolchain. Build the SGDK "hello world" to a ROM by command
  line.
- Run that ROM in Genteel; confirm accuracy on a known-good homebrew ROM; capture a
  screenshot from Genteel headless; confirm a framebuffer can be streamed for a live view.
- Wire a bundled VGM loop through the XGM driver and hear it in the ROM.
- Import a bundled sprite via rescomp and see it on screen, controllable by input.

Exit: a hand-built ROM shows a controllable sprite and plays a bundled loop, verified by a
Genteel screenshot, with the live-view path confirmed. This kills the Genteel risk and
the toolchain risk before any integration.

### Phase 1: The agent build loop (text only)

Goal: an agent that can write C and build a ROM, no assets yet.

- Wrap the SGDK build as an MCP server (`build_rom`, `read_build_log`).
- Wrap the emulator as a sidecar adapter and MCP server (`run_rom`, `capture_frame`,
  `send_input`, `read_state`) using Genteel.
- Stand up mcp-local-rag and index the SGDK + VDP docs.
- Run `opencode serve`, configure it with an OpenRouter model and the servers above.
- Drive it from a plain CLI: "make the screen blue", "draw a white box at center".

Exit: from a text prompt, the agent writes C, builds the ROM, runs it, reads a screenshot,
and self-corrects a deliberate compile error. This is the core loop working end to end.

### Phase 2: Core assets via bundled pack

Goal: the v1 content bar, without any AI asset generation.

- Add a bundled asset pack (a few sprites, one or two VGM loops).
- Teach the agent (via skill files) to reference bundled assets through `resources.res`,
  wire a controllable sprite, and attach a music loop.

Exit: from a prompt, the agent produces a ROM with a controllable bundled sprite and a
playing bundled loop. This meets the rescoped v1 content criterion with CORE tools only.

### Phase 3: The Drive16 application

Goal: wrap the working system in the two-pane Tauri app.

- Build the Tauri shell: left conversation pane as an OpenCode HTTP/SSE client, right pane
  rendering the Genteel sidecar framebuffer.
- Build the settings page, model selector, MCP server health panel, project management,
  and export-ROM.
- Build onboarding: dependency check, key entry, corpus indexing, starter project.

Exit: a non-developer launches the app, sees a blank ROM running, types "make a sprite I
can move left and right with music", and gets a working ROM in the right pane using
bundled assets. This is the v1 success criterion.

### Phase 4: Enhancements (AI sprites and music)

Goal: add the deferred generators now that the core is proven.

- Wrap ComfyUI via comfyui-mcp; ship the tuned Genesis palette workflow; generate at 32px+
  with nearest-neighbor downscale and a dedicated pixel checkpoint.
- Wrap ctrmml as the MML music MCP server; ship the FM preset library; add the MML
  reference to the RAG corpus.
- Gate both behind settings toggles so the CORE experience never depends on them.

Exit: from a prompt, the agent can optionally generate a palette-legal sprite and a short
MML track in place of bundled assets, and still builds a working ROM.

### Phase 5: Hardening and the local path

Goal: make it robust and prove the free/offline story.

- Tune the orchestration prompts and skills for reliable multi-step builds.
- Add input/controller mapping, save/load projects, ROM export polish, project templates.
- Validate the fully-local path: Ollama brain + local ComfyUI; document the hardware floor.
- Optional: collect execution-verified (intent, C) pairs from real sessions as the seed
  corpus for a future fine-tuned small local model.

Exit: the full loop runs locally with no paid service on a documented hardware target, and
the hosted BYOK path is stable enough to share.

### Later (explicitly out of scope for now)

- Fine-tuned local Genesis model trained on the verified pairs from Phase 5.
- Additional platforms (NES via cc65, Game Boy via GBDK) by swapping the platform-specific
  tool servers while keeping the shell, spine, and loop. The architecture is already
  platform-agnostic above Layer 3.
- A marketplace for community templates, sprite/music packs, and platform packs.

---

## 6. Open Questions

Resolved in v2: spine embedding (OpenCode headless server over HTTP/SSE) and live emulator
embedding (native sidecar, not WASM). Still open:

1. Default agent model. Which specific OpenRouter model is the v1 default for the loop,
   balancing cost against multi-step reliability? Needs a bake-off once Phase 1 runs.
2. Does the agent need any fine-tuning for v1, or does a strong hosted model plus RAG clear
   the bar? Current position: no fine-tuning for v1. Validate in Phase 1.
3. Genteel live-view feasibility. Confirmed-or-not that Genteel can stream a framebuffer
   cleanly into the Tauri pane at full speed. Decided in Phase 0; BlastEm is the fallback.
4. ComfyUI as a dependency (Phase 4). Bundle a managed ComfyUI, or require the user to run
   their own and point Drive16 at it? Affects onboarding friction heavily.
5. Project format. What is a "Drive16 project" on disk (SGDK project layout plus a
   manifest)? Define before Phase 3 so export and templates are clean.
6. Agent autonomy in v1. Guided step-approval versus longer autonomous runs. Current
   position: guided, with the human approving steps.
7. Drive16 app license. Given GPLv3 (BlastEm, LibreSprite) and GPL-3.0 (ComfyUI) in the
   stack, confirm a permissive license for the app is defensible by keeping all copyleft
   components as separate processes. Validate before any release.

---

## 7. Dependency Quick Reference

Pin and watch these. Each can update independently; the interface column is what keeps a
new version from breaking the rest.

| Project | Layer | Tier | Interface to Drive16 | License |
|---|---|---|---|---|
| Tauri 2.x | 0 shell | CORE | is the app | MIT / Apache-2.0 |
| OpenCode | 1 spine | CORE | local HTTP + SSE (`opencode serve`, SDK) | MIT |
| OpenRouter | 2 model | CORE | provider config | service (BYOK) |
| Ollama | 2 model | CORE | provider config | MIT |
| mcp-local-rag | 3 tool | CORE | MCP | open |
| SGDK 2.11 | 3 tool | CORE | via build MCP wrapper | MIT |
| docker-sgdk | 3 tool | CORE | container the build wrapper calls | open |
| GCC m68k-elf 13.2 | 3 sub-dep | CORE | inside docker-sgdk | GPL |
| Genteel | 3 tool | CORE | sidecar adapter + MCP | MIT |
| BlastEm | 3 tool | CORE (fallback) | sidecar adapter (separate process) | GPLv3 |
| Genesis Plus GX | 3 tool | opt-in only | libretro / sidecar | non-commercial |
| ComfyUI | 3 tool | ENH | via comfyui-mcp (separate process) | GPL-3.0 |
| Pixel Art Diffusion XL | 3 sub-dep | ENH | ComfyUI checkpoint | open (CreativeML) |
| ComfyUI-PixydustQuantizer | 3 sub-dep | ENH | ComfyUI node | open |
| comfyui-mcp | 3 tool | ENH | MCP | open |
| ctrmml | 3 tool | ENH | via music MCP wrapper | open |
| LibreSprite | 3 tool | ENH (opt) | scriptable CLI | GPLv2 |
