# Scripts

Toolchain and validation scripts live here.

- `build-sgdk.sh`: builds an SGDK project with the pinned docker-sgdk image.
- `build-genteel.sh`: clones and builds the pinned Genteel source revision into
  ignored `artifacts/` storage for Phase 0 validation.
- `build-ctrmml.sh`: clones and builds the pinned GPL-2.0 `ctrmml` compiler
  into ignored `artifacts/` storage for the Phase 4 MML music path.
- `validate-genteel.sh`: runs a ROM through a Genteel binary and captures a
  screenshot with the upstream `--headless <frames> --screenshot <path>` CLI.
- `validate-genteel-frame-stream.sh`: builds/runs the patched Genteel binary and
  verifies a raw RGB565 frame stream for the Phase 0 live-view proof.
- `validate-frame-stream.py`: parses and validates the raw `D16F` RGB565 frame
  stream records emitted by the Phase 0 Genteel patch.
- `validate-emulator-audio-mcp.py`: verifies the emulator MCP can dump and
  inspect non-silent WAV audio from the Phase 2 CORE asset ROM.
- `comfyui-mcp.sh`: launches the external MIT `comfyui-mcp` stdio server from
  ignored artifacts for the Phase 4 AI sprite path.
- `validate-comfyui-mcp-wrapper.py`: verifies the `comfyui-mcp` wrapper can
  initialize and expose the expected ComfyUI tools.
- `validate-comfyui-workflow.py`: verifies the Phase 4 ComfyUI Genesis sprite
  workflow contract before live generated-sprite validation.
- `validate-generated-sprite.py`: checks a generated ComfyUI PNG against the
  Phase 4 SGDK sprite limits and reports its `SPRITE` resource line.
- `validate-generated-sprite-sgdk-resource.sh`: feeds a validator-accepted
  synthetic generated sprite into an ignored SGDK project, builds it through
  `rescomp`, and captures a Genteel screenshot.
- `run-comfyui-sprite-workflow.py`: enqueues the Phase 4 ComfyUI workflow
  through `drive16-comfyui`, downloads the PNG output, and runs the generated
  sprite validator. It first runs the Phase 4 readiness check so missing API,
  checkpoint, Pixydust, or workflow-class prerequisites stop before enqueueing.
- `check-phase4-comfyui-readiness.py`: checks the local ComfyUI API,
  committed workflow classes, Pixel Art Diffusion XL checkpoint, and Pixydust
  Quantizer node before live sprite generation. Set
  `DRIVE16_COMFYUI_CHECKPOINT` when the compatible checkpoint uses a different
  local filename. When the required checkpoint is missing, the report includes
  nearby local checkpoint hints without accepting them automatically.
- `launch-phase4-comfyui-api.sh`: fetches a pinned ComfyUI source checkout
  into ignored artifacts and launches it against the local ComfyUI data folder.
- `validate-phase4-comfyui-api-smoke.sh`: starts the local ComfyUI API
  temporarily when needed, runs readiness, and proves API, workflow-class, and
  Pixydust availability without requiring the checkpoint.
- `setup-phase4-comfyui-prereqs.sh`: dry-run-first helper for installing the
  Pixydust Quantizer custom node and showing the required checkpoint path for
  the live Phase 4 sprite workflow. It can also install Pixydust's Python
  requirements explicitly and accepts the same checkpoint override.
- `install-phase4-comfyui-checkpoint.sh`: places a user-provided compatible
  checkpoint file or URL into the local ComfyUI checkpoints folder, with an
  optional SHA-256 check and local-file symlink mode for large model weights.
- `validate-mml-music-mcp.py`: verifies the Phase 4 `drive16-mml-music` MCP
  server by compiling a tiny Megadrive MML song to VGM.
- `validate-mml-presets.py`: validates the Phase 4 FM preset manifest and
  compiles each preset through the pinned `ctrmml` compiler.
- `validate-mml-rag-corpus.sh`: validates that the Phase 4 MML reference is in
  the RAG corpus and retrievable with generated-music terms.
- `validate-phase4-generated-music-prompt.sh`: runs the Phase 4 generated-MML
  prompt-path tests and, when Docker is running, builds and verifies the ROM.
- `validate-phase4-generated-assets-fixture-prompt.sh`: temporarily supplies a
  validator-accepted synthetic generated sprite to prove the combined
  generated-sprite plus generated-MML prompt path without closing the live
  ComfyUI gate.
- `validate-phase4-generated-assets-prompt.sh`: runs the combined Phase 4
  generated-sprite plus generated-MML prompt proof when live ComfyUI output and
  Docker are available.
- `validate-phase4-live-generated-assets.sh`: runs the full live Phase 4 gate
  in order: ComfyUI readiness, live sprite generation, then the combined
  generated-assets ROM proof.
- `validate-known-good-homebrew.sh`: fetches a pinned upstream SGDK sample ROM,
  verifies its hash, records source/license metadata, and runs it through
  Genteel for the Phase 0 accuracy check.
- `validate-core-assets.py`: validates the Phase 2 CORE bundled sprite and VGM
  pack.
- `validate-phase0-assets.sh`: builds and runs the Drive16 Phase 0 sprite and
  VGM validation ROM.
- `validate-phase2-core-assets.sh`: builds and runs the Phase 2 CORE asset ROM,
  then checks scripted input and non-silent audio.
- `validate-phase2-agent-context.sh`: checks the Phase 2 agent skill file and
  confirms RAG retrieves the bundled asset symbols.
- `validate-phase2-agent-loop.py`: prepares and optionally runs the OpenCode
  Phase 2 bundled-asset validation gate.
- `validate-sprite-movement.py`: compares neutral and scripted-input PNG
  screenshots to prove a sprite-like movement signal.
