# Scripts

Toolchain and validation scripts live here.

- `build-sgdk.sh`: builds an SGDK project with the pinned docker-sgdk image.
- `build-genteel.sh`: clones and builds the pinned Genteel source revision into
  ignored `artifacts/` storage for Phase 0 validation.
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
