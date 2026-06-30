# Drive16 Progress

Current phase: Phase 4, enhancements

Exit criterion: from a prompt, the agent can optionally generate a
palette-legal sprite and a short MML track in place of bundled assets, and
still builds a working ROM.

## Phase 4 Checklist

- [x] Human sign-off: Phase 3 approved.
- [x] Add default-off enhancement toggles so the CORE path remains independent.
- [x] Add ComfyUI endpoint configuration and health probing behind the AI
  sprites toggle.
- [x] Wrap ComfyUI via `comfyui-mcp`.
- [x] Ship the tuned Genesis palette ComfyUI workflow.
- [ ] Validate generated sprites as palette-legal SGDK SPRITE resources.
- [x] Wrap ctrmml as the MML music MCP server.
- [x] Ship the FM preset library.
- [x] Add the MML reference to the RAG corpus.
- [ ] Wire the optional prompt path to use generated sprite and music assets.
- [ ] Build the generated-asset ROM and verify it still works.

## Current Task

The generated-MML ROM proof now passes with Docker, SGDK, and Genteel. Full
generated-asset ROM proof is awaiting live ComfyUI sprite output. The local
Pixydust Quantizer custom node is installed at the pinned Phase 4 revision;
the remaining local prerequisites are a reachable ComfyUI API and a Pixel Art
Diffusion XL compatible checkpoint.

## Next Up

VALIDATION REQUEST: place the Pixel Art Diffusion XL compatible checkpoint,
start ComfyUI on `http://127.0.0.1:8188`, make
`scripts/check-phase4-comfyui-readiness.py` pass, then run
`COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py`,
then run `scripts/validate-phase4-generated-assets-prompt.sh`.

## Completed Phase 4 Work

- [x] Phase 3 approval received from the human.
- [x] Settings now include default-off toggles for AI sprites and MML music.
- [x] Phase 4 enhancement-toggle evidence recorded in
  `docs/phase4-enhancement-toggles.md`.
- [x] Native ComfyUI endpoint health probing added behind the AI sprites
  toggle.
- [x] Phase 4 ComfyUI endpoint evidence recorded in
  `docs/phase4-comfyui-endpoint.md`.
- [x] Optional `drive16-comfyui` MCP server configured through
  `scripts/comfyui-mcp.sh`.
- [x] Phase 4 ComfyUI MCP wrapper evidence recorded in
  `docs/phase4-comfyui-mcp.md`.
- [x] Tuned Genesis palette ComfyUI workflow committed under
  `assets/enhancements/comfyui/`.
- [x] Phase 4 ComfyUI workflow evidence recorded in
  `docs/phase4-comfyui-workflow.md`.
- [x] Generated-sprite PNG validator added at
  `scripts/validate-generated-sprite.py`.
- [x] Phase 4 generated-sprite validator evidence recorded in
  `docs/phase4-generated-sprite-validator.md`.
- [x] Live ComfyUI sprite runner added at
  `scripts/run-comfyui-sprite-workflow.py`.
- [x] Phase 4 live ComfyUI validation request recorded in
  `docs/phase4-live-comfyui-runner.md`.
- [x] Optional `drive16-mml-music` MCP server configured through
  `mcp-servers/mml-music/server.py`.
- [x] Phase 4 MML music MCP evidence recorded in
  `docs/phase4-mml-music-mcp.md`.
- [x] Original FM preset library added under `assets/enhancements/mml/`.
- [x] Phase 4 MML FM preset evidence recorded in
  `docs/phase4-mml-presets.md`.
- [x] MML reference added to the RAG corpus under
  `corpus/mml/ctrmml-megadrive.md`.
- [x] Phase 4 MML RAG evidence recorded in
  `docs/phase4-mml-rag-corpus.md`.
- [x] App prompt path calls generated-MML music when `MML music` is enabled.
- [x] Phase 4 generated-music prompt evidence and validation request recorded
  in `docs/phase4-generated-music-prompt.md`.
- [x] Generated-MML prompt path requires a live validated ComfyUI PNG before
  using generated sprite assets.
- [x] Phase 4 generated-sprite prompt gate evidence recorded in
  `docs/phase4-generated-sprite-prompt-gate.md`.
- [x] Combined generated-sprite plus generated-MML validation harness added at
  `scripts/validate-phase4-generated-assets-prompt.sh`.
- [x] Phase 4 generated-assets validation evidence recorded in
  `docs/phase4-generated-assets-validation.md`.
- [x] Generated-MML ROM proof passed with Docker, SGDK, Genteel screenshots,
  Right-input sprite movement, and non-silent generated audio.
- [x] Phase 4 ComfyUI readiness check added at
  `scripts/check-phase4-comfyui-readiness.py`.
- [x] Phase 4 ComfyUI readiness evidence recorded in
  `docs/phase4-comfyui-readiness.md`.
- [x] Dry-run ComfyUI prerequisite setup helper added at
  `scripts/setup-phase4-comfyui-prereqs.sh`.
- [x] Phase 4 ComfyUI prerequisite setup evidence recorded in
  `docs/phase4-comfyui-prereq-setup.md`.
- [x] Local Pixydust Quantizer prerequisite installed at the pinned revision
  and recorded in `docs/phase4-comfyui-pixydust-local.md`.

## Completed Phase 3 Work

- [x] Phase 3 approval received from the human.
- [x] Phase 2 approval received from the human.
- [x] Tauri 2 shell scaffolded under `app/src-tauri/`.
- [x] React and Vite frontend scaffolded under `app/src/`.
- [x] Two-pane Drive16 shell added with conversation, tool stream, project
  files, blank ROM preview, transport controls, tool health, and local
  interaction state.
- [x] Phase 3 app shell evidence recorded in `docs/phase3-app-shell.md`.
- [x] Native Tauri preflight command added for OpenCode, Docker, SGDK script,
  Genteel, RAG corpus, and CORE asset checks.
- [x] Refreshable health panel wired to native preflight with a browser-preview
  fallback.
- [x] Phase 3 preflight evidence recorded in `docs/phase3-preflight.md`.
- [x] Dedicated blank starter SGDK fixture added at
  `examples/app-starter-blank`.
- [x] Native Tauri `launch_starter_rom` command added to build the starter ROM
  when needed, run it through Genteel, and return a captured PNG data URL.
- [x] Right-pane ROM panel wired to the starter preview result with a
  browser-preview fallback.
- [x] Phase 3 starter ROM evidence recorded in
  `docs/phase3-starter-rom.md`.
- [x] Native starter launch now returns sampled RGB565 framebuffer records
  from the Genteel stream.
- [x] Right pane renders those framebuffer records through a pixelated canvas
  with pause/resume animation state.
- [x] Phase 3 framebuffer evidence recorded in
  `docs/phase3-framebuffer.md`.
- [x] Native OpenCode bridge added for health checks, server launch, session
  creation, and no-reply message posting.
- [x] Left pane wired to OpenCode SSE events and composer message posting with
  a browser-preview fallback.
- [x] Phase 3 OpenCode bridge evidence recorded in
  `docs/phase3-opencode-bridge.md`.
- [x] Model settings drawer added for provider selection, OpenRouter key entry,
  model selection, and connection testing.
- [x] Phase 3 model settings evidence recorded in
  `docs/phase3-model-settings.md`.
- [x] Native project summary and export-ROM commands added for the starter
  project.
- [x] Left file panel and top-bar export action wired to project/export state.
- [x] Phase 3 project export evidence recorded in
  `docs/phase3-project-export.md`.
- [x] Native v1 prompt command added to build and verify the CORE bundled
  sprite/music ROM.
- [x] Chat composer wired so the v1-style request loads the generated CORE ROM
  state into the right pane.
- [x] Phase 3 v1 prompt evidence recorded in
  `docs/phase3-v1-prompt.md`.

## Phase 3 Gate Evidence

Evidence packet: `docs/phase3-evidence.md`.

Core prompt proof: `docs/phase3-v1-prompt.md`.

- [x] App loads with the blank starter ROM state in the right pane.
- [x] Chat request path accepts the v1 prompt.
- [x] Native v1 prompt command builds the CORE bundled sprite/music ROM.
- [x] Genteel captures a neutral frame stream for the generated ROM.
- [x] Genteel captures a Right-input screenshot for the generated ROM.
- [x] Sprite movement validator proves Right-input movement.
- [x] Audio dump is non-silent.
- [x] Browser preview shows the generated CORE ROM state in the right pane.

Phase gate status: evidence assembled. Human sign-off is required before
advancing to Phase 4.

## Completed Phase 2 Gate

Evidence packet: `docs/phase2-evidence.md`.

- [x] OpenCode ran from a plain prompt with the Phase 2 CORE MCP servers.
- [x] RAG was queried before asset wiring and Genesis C edits.
- [x] The agent fixed an initial resource-path build failure and rebuilt.
- [x] The generated SGDK project built to `out/rom.bin`.
- [x] Genteel ran the generated ROM and captured neutral and Right-input
  screenshots.
- [x] Scripted input moved the bundled sprite right.
- [x] The emulator MCP audio dump was non-silent.

## Completed Phase 2 Work

- [x] Phase 1 approval received from the human.
- [x] Core pack added at `assets/core/` with `drive16_player` and
  `drive16_loop`.
- [x] Core pack validator added at `scripts/validate-core-assets.py`.
- [x] RAG project-pattern notes updated with Phase 2 asset symbols and wiring
  guidance.
- [x] Phase 2 reference fixture added at `examples/phase2-core-assets`.
- [x] Fixture validator added at `scripts/validate-phase2-core-assets.sh`.
- [x] Phase 2 asset wiring skill added at
  `agent/skills/phase2-core-assets.md`.
- [x] Agent context validator added at
  `scripts/validate-phase2-agent-context.sh`.
- [x] Phase 2 prompt-driven validation harness added at
  `scripts/validate-phase2-agent-loop.py`.
- [x] Emulator MCP audio capture added so Phase 2 can prove music through CORE
  tools.
- [x] Sprite movement validator added so scripted input evidence is stronger
  than a byte-level screenshot difference.
- [x] Phase 2 agent-loop validation passed with OpenCode, SGDK build MCP,
  Genteel emulator MCP, scripted input, screenshot verification, and non-silent
  audio evidence.

## Completed Phase 1 Gate

Evidence packet: `docs/phase1-evidence.md`.

- [x] OpenCode ran from a plain text prompt with the Phase 1 MCP servers.
- [x] RAG was queried before Genesis C edits.
- [x] The deliberate compile error was repaired by the agent loop.
- [x] The generated SGDK project built to `out/rom.bin`.
- [x] Genteel ran the generated ROM and captured a screenshot.
- [x] Screenshot shows `Drive16 Phase 1` on a blue background.

## Completed Phase 0 Gate

Evidence packet: `docs/phase0-evidence.md`.

- [x] Bootstrap repo skeleton and living project files.
- [x] Add a pinned docker-sgdk build script for SGDK 2.11.
- [x] Add a minimal SGDK hello-world validation project.
- [x] Add original Phase 0 sprite and VGM validation assets.
- [x] Add an SGDK asset ROM fixture wiring the sprite and VGM through `rescomp`.
- [x] Add a pinned known-good open homebrew validator for Genteel accuracy.
- [x] Align the Genteel screenshot validator with the observed upstream CLI.
- [x] Add a pinned Genteel source-build helper.
- [x] Local validation: docker-sgdk builds the hello-world ROM.
- [x] Local validation: Genteel runs the hello-world ROM.
- [x] Local validation: Genteel captures a screenshot of the hello-world ROM.
- [x] Local validation: Genteel captures a headless screenshot from a known-good ROM.
- [x] Local validation: Genteel accuracy is checked with a known-good open homebrew ROM.
- [x] Local validation: Genteel live-framebuffer path streams RGB565 frame records.
- [x] Local validation: docker-sgdk builds the Phase 0 asset ROM.
- [x] Local validation: the Phase 0 asset ROM emits non-silent audio from the bundled VGM loop.
- [x] Local validation: the Phase 0 asset ROM shows a controllable bundled sprite through scripted input.
- [x] Add a complete Phase 0 human validation runbook.
