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
  checkpoint, LoRA, Pixydust, or workflow-class prerequisites stop before
  enqueueing.
- `check-phase4-comfyui-readiness.py`: checks the local ComfyUI API,
  committed workflow classes, SDXL base checkpoint, Pixel Art XL LoRA, and
  Pixydust Quantizer node before live sprite generation. Set
  `DRIVE16_COMFYUI_CHECKPOINT` or `DRIVE16_COMFYUI_LORA` when compatible local
  files use different filenames. When required files are missing, the report
  includes nearby local hints without accepting them automatically.
- `launch-phase4-comfyui-api.sh`: fetches a pinned ComfyUI source checkout
  into ignored artifacts and launches it against the local ComfyUI data folder.
- `validate-phase4-comfyui-api-smoke.sh`: starts the local ComfyUI API
  temporarily when needed, runs readiness, and proves API, workflow-class, and
  Pixydust availability without requiring the checkpoint.
- `setup-phase4-comfyui-prereqs.sh`: dry-run-first helper for installing the
  Pixydust Quantizer custom node and showing the required model paths for the
  live Phase 4 sprite workflow. It can also install Pixydust's Python
  requirements explicitly and accepts model filename overrides.
- `install-phase4-comfyui-models.sh`: downloads Drive16's default Hugging Face
  ComfyUI model pair after explicit license acceptance: Stability AI SDXL Base
  checkpoint plus the `nerijs/pixel-art-xl` LoRA.
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
  in order: launch local ComfyUI if needed, check readiness, run live sprite
  generation, then run the combined generated-assets ROM proof.
- `validate-known-good-homebrew.sh`: fetches a pinned upstream SGDK sample ROM,
  verifies its hash, records source/license metadata, and runs it through
  Genteel for the Phase 0 accuracy check.
- `check-interactive-play-core.mjs`: reports the current Phase 7 interactive
  Play core posture. It checks the installed Nostalgist wrapper metadata,
  user-supplied core JS/WASM presence and readability, the dev-CDN Genesis core
  fallback path, tracked emulator core binaries, and Verify path availability.
  Pass `--online` to also probe the dev CDN URL.
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
- `verify-agent-contract.mjs`: checks the desktop builder prompt context,
  failed-build repair labeling, and OpenCode event categorization used by the
  chat build log.
- `verify-project-memory.mjs`: audits an active project's `GAME.md`,
  `ASSETS.md`, and `PLAYTEST.md` for contradiction-prone claims such as a
  passing playability gate without audio evidence or unexplained reused assets
  across unrelated roles. Use `--require-pass` after a run that claims the game
  is complete.
- `verify-genre-playability-gates.mjs`: creates temporary Snake, Pong, Tetris,
  and Asteroids-style project fixtures and runs the real project-memory audit
  to prove that pending genre checks are rejected while complete evidence
  passes.
- `verify-audio-evidence-gates.mjs`: creates temporary project-memory fixtures
  for missing audio, captured audio, uncaptured audio, and explicit no-audio
  requests so a passing gate cannot rely on vague or negated sound claims.
- `verify-asset-role-gates.mjs`: creates temporary `ASSETS.md` fixtures so a
  passing project cannot use vague generated-asset rows; ComfyUI/generated rows
  must identify the gameplay role, prompt, crop/slice normalization, and use.
- `check-live-game-audit-readiness.mjs`: writes
  `artifacts/phase9/live-game-audit/readiness.json` with the current app,
  OpenCode, OpenRouter credential, Docker, ComfyUI, agent-contract,
  project-memory, and live-audit verifier status before attempting the native
  generated-game audit. It reports primitive/fallback readiness separately from
  generated-sprite readiness so a missing ComfyUI process cannot look like
  verified AI sprite support.
- `run-live-game-audit-prompt.mjs`: prepares one reproducible native audit run
  packet for `snake-basic`, `pong-basic`, `tetris-basic`, or `asteroids-basic`
  under `artifacts/phase9/live-game-audit/runs/`. It refreshes readiness,
  copies a fresh starter project without stale `out/` artifacts, writes the
  exact prompt and `run-record.json` skeleton, and can optionally run OpenCode
  with `--run-agent`. During a real run it streams OpenCode stdout/stderr to
  `opencode-run.jsonl` and `opencode-run.stderr` immediately, with current
  process state in `opencode-run.status.json`, so a long model turn is
  inspectable before it exits. A failed run can be continued without deleting
  its working project or trace by adding `--resume-run <run-id>`. Use `pnpm
  --dir app prepare:live-game-audit:prompt` for a dry packet and `pnpm --dir
  app run:live-game-audit:prompt -- --prompt snake-basic --model
  openrouter/<model>` for a real run.
- `promote-live-game-audit-runs.mjs`: selects one clean passing run for each
  required prompt, verifies the complete report plus every evidence file, and
  atomically replaces the empty `report.json` template only after that check
  passes. Use `pnpm --dir app promote:live-game-audit -- --run
  snake-basic=<run-id> --run pong-basic=<run-id> --run
  tetris-basic=<run-id> --run asteroids-basic=<run-id>`.
- `verify-opencode-audio-trace.mjs`: checks an OpenCode JSONL trace for the
  preferred `verify_audio` tool call, or the fallback `run_rom` with
  `dump_audio=true` followed by `capture_audio`. It catches the failed-loop
  pattern where the agent says it is checking audio but repeatedly runs the
  emulator without requesting an audio dump. With `--expect-game-progress`, it
  also requires source/resource edits to be followed by `build_rom`, frame
  capture, and input evidence.
- `verify-live-game-audit.mjs`: validates the next live generated-game audit
  packet for Snake, Pong, Tetris, and Asteroids prompts before any model
  bakeoff. It requires each run to record compile, preview, screen, input,
  restart, audio, asset-ledger, gameplay-rule, and project-memory evidence
  instead of treating `out/rom.bin` as enough. Passing runs with captured audio
  or game-progress claims also validate the OpenCode trace so the report cannot
  claim evidence without the actual tool sequence. Use
  `pnpm --dir app prepare:live-game-audit` to refresh readiness and write a
  fresh `report.json` template whose plumbing fields match current machine
  state. Use `pnpm --dir app verify:live-game-audit:report` after native runs
  are recorded; it fails unless all required prompt runs and evidence files are
  present.
- `verify-model-bakeoff-report.mjs`: validates the future model bakeoff report
  schema. It requires DeepSeek V3.1 plus at least two alternatives, the same
  required prompts across all models, plumbing gates, scores, time/cost, and
  project-memory evidence before any recommended default can be trusted. Use
  `pnpm --dir app prepare:model-bakeoff` only after the completed live-audit
  report passes; it refuses to write the bakeoff template first. Use
  `pnpm --dir app verify:model-bakeoff:report` for the real bakeoff packet with
  evidence-file existence checks.
- `promote-model-bakeoff-runs.mjs`: reads a model/run selection manifest,
  derives tool, asset, playability, honesty, time, and cost scores from the
  actual run records and traces, verifies the complete 12-run packet, and only
  then replaces the model bakeoff report.
- `validate-sprite-movement.py`: compares neutral and scripted-input PNG
  screenshots to prove a sprite-like movement signal.
- `verify-phase6-loop.sh`: runs the repeatable Phase 6 verification loop:
  frontend build, native format/tests, optional generated CORE proof, git
  hygiene, and optional browser smoke against a running preview.
- `verify-phase6-browser-smoke.mjs`: Playwright smoke used by the Phase 6/7
  loop to run New Project, Save, Open, import the test ROM, verify the input
  Controls panel/default profile/no-controller state, Play/Pause/Resume/Reset/
  Stop, Verify, Export, and check the mobile layout. It also guards the
  no-ROM truth surface, playtest evidence row, raw build log disclosure, and
  settings persistence. It defaults to the stable missing-core path, accepts
  `--core-status` to verify other Play readiness modes, and accepts
  `--user-core <path>` to import a local core ZIP or pair before Play.
