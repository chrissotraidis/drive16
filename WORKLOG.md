# Drive16 Worklog

## 2026-06-29 - ITERATION 24 - Phase 2 agent-loop gate evidence

Plan:

- Task: run and record the Phase 2 prompt-driven gate now that OpenRouter is
  configured.
- Files: `docs/phase2-evidence.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the Phase 2 agent-loop harness with OpenCode, rerun the
  verify-only artifact check, inspect the screenshots, run the sprite movement
  validator, scan the workspace for the pasted OpenRouter key, and run
  `git diff --check`.

Did:

- Ran the Phase 2 OpenCode validation with CORE tools only.
- Confirmed the generated project uses `drive16_player` and `drive16_loop`.
- Confirmed the agent repaired an initial asset path build failure and rebuilt
  successfully.
- Confirmed Genteel produced neutral and Right-input screenshots for the
  generated ROM.
- Confirmed the emulator MCP audio evidence is non-silent.
- Added the Phase 2 evidence packet and marked the Phase 2 gate ready for
  human sign-off.

Evidence:

- `DRIVE16_PHASE2_MODEL=openrouter/anthropic/claude-sonnet-4.6
  scripts/validate-phase2-agent-loop.py --run-agent` passed with:
  `Phase 2 agent-loop ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase2/agent-loop/verification-right.png`.
- `scripts/validate-phase2-agent-loop.py --verify-only` passed with:
  `Phase 2 agent-loop artifacts ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase2/agent-loop/verification-right.png`.
- `scripts/validate-sprite-movement.py
  artifacts/phase2/agent-loop/verification-neutral.png
  artifacts/phase2/agent-loop/verification-right.png --direction right
  --min-delta 24 --min-changed 40` passed with:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- The OpenCode log at `artifacts/phase2/agent-loop/opencode-run.jsonl`
  includes `query_documents`, `build_rom`, `run_rom`, `capture_frame`,
  `send_input`, and `capture_audio`.
- `capture_audio` reported `nonSilent: true` and `maxAbsSample: 10922`.
- A workspace scan for the pasted OpenRouter key returned no files.

Gate:

Phase 2 gate reached. Human sign-off is required before Phase 3.

Next:

- Request human sign-off for Phase 2 before starting Phase 3.

## 2026-06-29 - ITERATION 23 - Sprite movement screenshot validator

Plan:

- Task: strengthen Phase 2 controllable-sprite evidence beyond byte-different
  screenshots.
- Files: `scripts/validate-sprite-movement.py`,
  `scripts/validate-phase2-core-assets.sh`,
  `scripts/validate-phase2-agent-loop.py`, `scripts/README.md`,
  `docs/phase2-agent-loop.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: compile the new validator and Phase 2 harness, run the
  movement validator against existing Phase 2 screenshots, rerun the Phase 2
  fixture validator, rerun the Phase 2 harness in gate mode, and run
  `git diff --check`.

Did:

- Added `scripts/validate-sprite-movement.py`, a dependency-free PNG decoder
  and movement-signal validator.
- Replaced byte-only screenshot comparison in the Phase 2 fixture and agent
  harness with the new movement validator.

Evidence:

- `python3 -m py_compile scripts/validate-sprite-movement.py
  scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-sprite-movement.py
  artifacts/phase2/core-assets/phase2-core-assets.png
  artifacts/phase2/core-assets/phase2-core-assets-right.png --direction right
  --min-delta 24 --min-changed 40` passed with:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- `scripts/validate-phase2-core-assets.sh` passed and now includes:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- `git diff --check` passed.

Gate:

None.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 22 - Phase 2 final-run audio prompt

Plan:

- Task: align the Phase 2 agent instructions with the harness check that the
  latest emulator MCP state includes audio evidence.
- Files: `agent/skills/phase2-core-assets.md`,
  `scripts/validate-phase2-agent-loop.py`, `docs/phase2-agent-loop.md`, and
  `WORKLOG.md`.
- Verification: run the Phase 2 agent-context validator, compile and run the
  Phase 2 agent-loop harness in gate mode, and run `git diff --check`.

Did:

- Tightened the Phase 2 skill and harness prompt so the final Right-input
  `run_rom` call must use `dump_audio`.
- Clarified the validation error when the latest emulator MCP state has no
  audio dump.

Evidence:

- `scripts/validate-phase2-agent-context.sh` passed with:
  `Phase 2 agent context ok: /Users/chrissotraidis/Documents/GitHub/drive16/agent/skills/phase2-core-assets.md`.
- `python3 -m py_compile scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- `git diff --check` passed.

Gate:

None.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 21 - Emulator MCP audio evidence

Plan:

- Task: expose audio evidence through the CORE emulator MCP server for Phase 2.
- Files: `mcp-servers/emulator/server.py`,
  `scripts/validate-emulator-audio-mcp.py`,
  `scripts/validate-emulator-mcp.py`,
  `mcp-servers/emulator/README.md`,
  `agent/skills/phase2-core-assets.md`,
  `scripts/validate-phase2-agent-context.sh`,
  `scripts/validate-phase2-agent-loop.py`,
  `docs/phase2-agent-loop.md`, `scripts/README.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: compile the touched Python validators and server, run the base
  emulator MCP validator, run the new audio MCP validator against the Phase 2
  asset ROM, rerun the Phase 2 agent-context validator, rerun the Phase 2
  harness in gate mode, and run `git diff --check`.

Did:

- Added `dump_audio` support to the emulator MCP `run_rom` tool.
- Added `capture_audio`, which inspects the latest WAV dump and reports
  non-silent audio stats.
- Added `scripts/validate-emulator-audio-mcp.py`.
- Updated the Phase 2 skill and harness to require `capture_audio`.

Evidence:

- `python3 -m py_compile mcp-servers/emulator/server.py
  scripts/validate-emulator-mcp.py scripts/validate-emulator-audio-mcp.py
  scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-emulator-mcp.py` passed with:
  `Emulator MCP ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- `scripts/validate-emulator-audio-mcp.py` passed with:
  `Emulator audio MCP ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-audio.wav max_abs=10922`.
- `artifacts/phase1/emulator/state.json` recorded `"audioDumpPath"` for
  `examples/phase2-core-assets/out/rom.bin`.
- `scripts/validate-phase2-agent-context.sh` passed with:
  `Phase 2 agent context ok: /Users/chrissotraidis/Documents/GitHub/drive16/agent/skills/phase2-core-assets.md`.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- `git diff --check` passed.

Gate:

None.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 20 - Phase 2 agent-loop harness

Plan:

- Task: add the Phase 2 prompt-driven validation harness.
- Files: `scripts/validate-phase2-agent-loop.py`,
  `docs/phase2-agent-loop.md`, `scripts/README.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: compile the Python harness, run it without credentials to
  confirm it prepares the SGDK project and opens a validation request, rerun
  the Phase 2 core asset fixture validator, and run `git diff --check`.

Did:

- Added `scripts/validate-phase2-agent-loop.py`.
- The harness prepares `artifacts/phase2/agent-loop/project`, embeds the Phase
  2 skill file into a plain OpenCode prompt, and gates the real run behind
  `--run-agent`, `DRIVE16_PHASE2_MODEL`, and an OpenRouter credential.
- The post-agent verifier checks project files, MCP state, OpenCode tool-call
  markers, neutral and Right-input Genteel screenshots, and non-silent audio.
- Added `docs/phase2-agent-loop.md`.

Evidence:

- `python3 -m py_compile scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- The harness prepared:
  `artifacts/phase2/agent-loop/project`.
- The harness wrote the prompt to:
  `artifacts/phase2/agent-loop/prompt.md`.
- `scripts/validate-phase2-core-assets.sh` passed with:
  `Audio dump is non-silent: max abs sample 10922`.
- `git diff --check` passed.

VALIDATION REQUEST:

Configure OpenRouter outside the repo, choose a Phase 2 OpenRouter model, then
run:

```sh
export DRIVE16_PHASE2_MODEL=openrouter/<provider-model>
export OPENROUTER_API_KEY=...
scripts/validate-phase2-agent-loop.py --run-agent
```

Expected result: the harness reports `Phase 2 agent-loop ok:
artifacts/phase2/agent-loop/verification-right.png`.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 19 - Phase 2 agent asset instructions

Plan:

- Task: teach the agent how to wire the Phase 2 bundled sprite and music loop.
- Files: `agent/README.md`, `agent/skills/phase2-core-assets.md`,
  `scripts/validate-phase2-agent-context.sh`, `scripts/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: run the Phase 2 agent-context validator, which checks the skill
  file for required asset/tool terms, refreshes the RAG corpus, queries for the
  Phase 2 bundled asset symbols, and run `git diff --check`.

Did:

- Added `agent/skills/phase2-core-assets.md` with the CORE-only asset wiring
  recipe for Phase 2.
- Added `scripts/validate-phase2-agent-context.sh`.
- Recorded the `agent/skills/` convention in `DECISIONS.md`.

Evidence:

- `scripts/validate-phase2-agent-context.sh` passed with:
  `Phase 2 agent context ok: /Users/chrissotraidis/Documents/GitHub/drive16/agent/skills/phase2-core-assets.md`.
- The validator confirmed the skill file contains `drive16_player`,
  `drive16_loop`, `resources.res`, `XGM_startPlay`, `SPR_addSprite`,
  `send_input`, and `capture_frame`.
- The validator refreshed the RAG corpus and confirmed a Phase 2 query returns
  `drive16_player`, `drive16_loop`, `SPRITE`, and `XGM`.
- `git diff --check` passed.

Gate:

None.

Next:

- Add a Phase 2 validation harness for a prompt-driven asset ROM.

## 2026-06-29 - ITERATION 18 - Phase 2 CORE asset fixture

Plan:

- Task: add the Phase 2 reference SGDK fixture that uses the CORE bundled asset
  pack through `resources.res`.
- Files: `examples/phase2-core-assets/`,
  `scripts/validate-phase2-core-assets.sh`, `scripts/README.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the fixture validator, which validates the core assets,
  builds the ROM through docker-sgdk, captures neutral and Right-input
  screenshots in Genteel, checks the screenshots differ, checks the audio dump
  is non-silent, and run `git diff --check`.

Did:

- Added `examples/phase2-core-assets` as the Phase 2 reference fixture.
- The fixture references `drive16_player` and `drive16_loop` from
  `assets/core/` through `res/resources.res`.
- Added `scripts/validate-phase2-core-assets.sh`.

Evidence:

- `scripts/validate-phase2-core-assets.sh` passed.
- The validator ran `scripts/validate-core-assets.py` with:
  `Core assets ok: /Users/chrissotraidis/Documents/GitHub/drive16/assets/core`.
- SGDK built:
  `examples/phase2-core-assets/out/rom.bin`.
- Genteel captured the neutral screenshot:
  `artifacts/phase2/core-assets/phase2-core-assets.png`.
- Genteel captured the scripted Right-input screenshot:
  `artifacts/phase2/core-assets/phase2-core-assets-right.png`.
- The screenshot byte comparison confirmed the Right-input run changed the
  frame from the neutral run.
- The audio dump check passed with:
  `Audio dump is non-silent: max abs sample 10922`.
- Visual inspection shows the neutral screenshot contains `Drive16 Phase 2`,
  the bundled sprite, and `Core VGM loop plays`; the Right-input screenshot
  shows the sprite moved to the right edge.
- `git diff --check` passed.

Gate:

None.

Next:

- Teach the agent, via RAG or skill context, to wire the bundled sprite and
  music loop from a prompt.

## 2026-06-29 - ITERATION 17 - Phase 2 CORE asset pack

Plan:

- Task: begin Phase 2 by establishing the CORE bundled asset pack contract.
- Files: `assets/core/`, `assets/README.md`,
  `scripts/validate-core-assets.py`, `scripts/README.md`,
  `corpus/drive16/sgdk-project-patterns.md`,
  `corpus/vdp/genesis-vdp-core.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: run the core asset validator, compile it, regenerate the RAG
  index so the Phase 2 asset notes are searchable, and run `git diff --check`.

Did:

- Recorded the human Phase 1 approval and moved the ledger to Phase 2.
- Promoted the original Drive16 sprite and VGM loop into `assets/core/`.
- Added `assets/core/manifest.json` with stable symbols `drive16_player` and
  `drive16_loop`.
- Added `scripts/validate-core-assets.py` to validate the PNG, VGM, and
  manifest contract.
- Updated the RAG project-pattern notes with Phase 2 asset wiring guidance.

Evidence:

- `python3 -m py_compile scripts/validate-core-assets.py` passed.
- `scripts/validate-core-assets.py` passed with:
  `Core assets ok: /Users/chrissotraidis/Documents/GitHub/drive16/assets/core`.
- `scripts/validate-rag-corpus.sh` passed with:
  `Succeeded: 15`, `Failed: 0`, `Total chunks: 1514`, and status
  `{"documentCount":15,"chunkCount":1514,"memoryUsage":60.45647430419922,"uptime":0.437156875,"ftsIndexEnabled":true,"searchMode":"hybrid"}`.
- `git diff --check` passed.

Gate:

None.

Next:

- Add and verify a Phase 2 CORE asset fixture project that references the pack
  through `resources.res`.

## 2026-06-29 - ITERATION 16 - Phase 1 agent-loop gate run

Plan:

- Task: run the real Phase 1 OpenRouter-backed agent-loop validation.
- Files: `PROGRESS.md`, `WORKLOG.md`, and `docs/phase1-evidence.md`.
- Verification: run `scripts/validate-phase1-agent-loop.py --run-agent` with
  an OpenRouter model and credential outside the repo, inspect the captured
  screenshot, confirm no pasted key was written to files, and run
  `git diff --check`.

Did:

- Ran the Phase 1 validation harness with
  `DRIVE16_PHASE1_MODEL=openrouter/anthropic/claude-sonnet-4.6`.
- OpenCode worked from the generated plain text prompt under
  `artifacts/phase1/agent-loop/prompt.md`.
- The agent queried RAG, repaired the deliberate compile error, built the SGDK
  project, ran the ROM in Genteel, captured a screenshot, and reported success.
- Added the Phase 1 evidence packet.

Evidence:

- `scripts/validate-phase1-agent-loop.py --run-agent` passed with:
  `Phase 1 agent-loop ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- `artifacts/phase1/agent-loop/project/src/main.c` now draws
  `Drive16 Phase 1` and `Agent loop OK` on a blue background.
- `artifacts/phase1/sgdk-build/last-build.json` recorded `"ok": true` for
  `artifacts/phase1/agent-loop/project/out/rom.bin`.
- `artifacts/phase1/emulator/state.json` recorded `"ok": true` for the same
  ROM and screenshot path.
- Visual inspection of `artifacts/phase1/emulator/last-frame.png` shows the
  expected blue screen with `Drive16 Phase 1` and `Agent loop OK`.
- The OpenCode JSON log at `artifacts/phase1/agent-loop/opencode-run.jsonl`
  contained the expected `query_documents`, `build_rom`, `read_build_log`,
  `run_rom`, and `capture_frame` calls.
- A workspace scan for the pasted OpenRouter key returned no files.

Gate:

Phase 1 gate reached. Human sign-off is required before Phase 2 begins.

Next:

- Request Phase 1 sign-off, then begin Phase 2 after approval.

## 2026-06-29 - ITERATION 15 - Phase 1 agent-loop validation harness

Plan:

- Task: add the exact Phase 1 CLI validation harness for the credential-gated
  OpenCode text loop.
- Files: `scripts/validate-phase1-agent-loop.py`,
  `docs/phase1-agent-loop.md`, `docs/phase1-opencode.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: compile the Python harness, run it without credentials to
  confirm it prepares the broken SGDK project and opens a validation request,
  rerun the OpenCode config validator, rerun the SGDK build MCP smoke test,
  rerun the emulator MCP smoke test, and run `git diff --check`.

Did:

- Added `scripts/validate-phase1-agent-loop.py`.
- The harness prepares `artifacts/phase1/agent-loop/project` with a deliberate
  `DRIVE16_COMPILE_ERROR_SENTINEL` compile error.
- The harness writes the exact OpenCode prompt to
  `artifacts/phase1/agent-loop/prompt.md`.
- The real agent run is guarded behind `--run-agent`,
  `DRIVE16_PHASE1_MODEL=openrouter/<provider-model>`, and an OpenRouter
  credential outside the repo.
- Added `docs/phase1-agent-loop.md` and linked it from
  `docs/phase1-opencode.md`.

Evidence:

- `python3 -m py_compile scripts/validate-phase1-agent-loop.py
  scripts/validate-opencode-config.py scripts/validate-sgdk-build-mcp.py
  scripts/validate-emulator-mcp.py` passed.
- `scripts/validate-phase1-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 1 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE1_MODEL is not set.`
- `scripts/validate-opencode-config.py` passed with:
  `OpenCode config ok`
  `VALIDATION REQUEST: configure OpenRouter with opencode providers login or OPENROUTER_API_KEY before the agent loop can be run.`
- `scripts/validate-sgdk-build-mcp.py` passed with:
  `SGDK build MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/examples/sgdk-hello-world/out/rom.bin`.
- `scripts/validate-emulator-mcp.py` passed with:
  `Emulator MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- `git diff --check` passed.

VALIDATION REQUEST:

Configure OpenRouter outside the repo, choose a Phase 1 OpenRouter model, then
run:

```sh
export DRIVE16_PHASE1_MODEL=openrouter/<provider-model>
export OPENROUTER_API_KEY=...
scripts/validate-phase1-agent-loop.py --run-agent
```

Expected result: the harness reports `Phase 1 agent-loop ok:
artifacts/phase1/emulator/last-frame.png`.

Next:

- Run the Phase 1 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 14 - OpenCode MCP project config

Plan:

- Task: configure OpenCode with the Phase 1 MCP servers without committing any
  credentials.
- Files: `opencode.json`, `scripts/validate-opencode-config.py`,
  `docs/phase1-opencode.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: compile the validator, confirm OpenCode resolves the three MCP
  servers from project config, smoke-test `opencode serve`, and report the
  OpenRouter credential gate.

Did:

- Added project-level `opencode.json` wiring `drive16-sgdk-build`,
  `drive16-emulator`, and `drive16-rag`.
- Added `docs/phase1-opencode.md` with the non-secret setup and OpenRouter
  credential gate.
- Added `scripts/validate-opencode-config.py` to verify OpenCode config
  resolution and headless server startup.

Evidence:

- `opencode --version` reported `1.14.33`.
- `npm view opencode-ai version bin license --json` reported latest npm
  version `1.17.11`, binary `opencode`, and license `MIT`.
- `python3 -m py_compile scripts/validate-opencode-config.py` passed.
- `scripts/validate-opencode-config.py` passed with:
  `OpenCode config ok`
  `VALIDATION REQUEST: configure OpenRouter with opencode providers login or OPENROUTER_API_KEY before the agent loop can be run.`
- `git diff --check` passed.

VALIDATION REQUEST:

Configure OpenRouter outside the repo before the Phase 1 agent loop can be run:

```sh
opencode providers login
```

or:

```sh
export OPENROUTER_API_KEY=...
```

After that, run the first CLI text-loop prompt.

Next:

- Run the plain CLI text-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 13 - RAG corpus and local index

Plan:

- Task: stand up the Phase 1 local RAG path and index SGDK plus VDP documents.
- Files: `scripts/mcp-local-rag.sh`, `scripts/fetch-rag-corpus.sh`,
  `scripts/validate-rag-corpus.sh`, `corpus/README.md`,
  `corpus/sources.json`, `corpus/drive16/sgdk-project-patterns.md`,
  `corpus/vdp/genesis-vdp-core.md`, fetched SGDK corpus files under
  `corpus/sgdk/`, `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: syntax-check the shell scripts, fetch pinned SGDK v2.11 docs,
  install and run `mcp-local-rag@0.15.3` with Node 22 or newer, ingest the
  corpus into ignored LanceDB storage, and query for SGDK and VDP terms.

Did:

- Added a local wrapper that installs `mcp-local-rag@0.15.3` under
  `artifacts/phase1/mcp-local-rag/` and runs it with a Node 22+ runtime.
- Added a fetch script for pinned SGDK v2.11 documentation and API headers.
- Added Drive16-authored VDP and SGDK project-pattern notes for the text-only
  Phase 1 loop.
- Added a corpus source manifest and RAG validation script.
- Confirmed SGDK headers are stored as `.txt` corpus documents so
  `mcp-local-rag` indexes them.

Evidence:

- `npm view mcp-local-rag version license bin --json` reported version
  `0.15.3`, license `MIT`, and binary `dist/index.js`.
- System `node --version` reported `v21.1.0`; `mcp-local-rag@0.15.3` failed
  under `npx` because it requires Node 22 or newer.
- Bundled Codex Node reported `v24.14.0` and successfully ran the locally
  installed `mcp-local-rag` CLI.
- `bash -n scripts/mcp-local-rag.sh scripts/fetch-rag-corpus.sh
  scripts/validate-rag-corpus.sh` passed.
- `scripts/fetch-rag-corpus.sh` fetched SGDK v2.11 docs and headers into
  `corpus/sgdk/`.
- `scripts/validate-rag-corpus.sh` passed with:
  `Succeeded: 15`, `Failed: 0`, `Total chunks: 1503`, and status
  `{"documentCount":15,"chunkCount":1503,"memoryUsage":66.1068344116211,"uptime":0.448918375,"ftsIndexEnabled":true,"searchMode":"hybrid"}`.
- `git diff --check` passed.

Gate:

None.

Next:

- Configure `opencode serve` with OpenRouter and the Phase 1 MCP servers.

## 2026-06-29 - ITERATION 12 - Genteel emulator MCP wrapper

Plan:

- Task: wrap the proven Genteel sidecar path as the Phase 1 emulator MCP
  server.
- Files: `mcp-servers/emulator/server.py`,
  `scripts/validate-emulator-mcp.py`, `mcp-servers/emulator/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: syntax-check the Python files, exercise the MCP server over
  stdio by listing tools, writing a Genteel input script, running the
  hello-world ROM headlessly, returning the captured PNG frame, and validating
  the RGB565 frame stream.

Did:

- Added a dependency-free Python stdio MCP server exposing `run_rom`,
  `capture_frame`, `send_input`, and `read_state`.
- Wired `run_rom` to the pinned Genteel binary from `scripts/build-genteel.sh`.
- Made `capture_frame` return the latest PNG frame as MCP image content plus a
  file path.
- Made `send_input` write sparse Genteel CSV input scripts for the next
  emulator run.
- Added a reusable validator that talks to the server as an MCP client.

Evidence:

- `python3 -m py_compile mcp-servers/emulator/server.py
  scripts/validate-emulator-mcp.py` passed.
- `scripts/validate-emulator-mcp.py` passed with:
  `Emulator MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- Visual inspection of
  `artifacts/phase1/emulator/last-frame.png` shows the expected
  `Drive16 Phase 0` and `Hello from SGDK` text.
- `scripts/validate-frame-stream.py artifacts/phase1/emulator/last-frames.rgb565
  --min-frames 3` passed with:
  `Frame stream ok: 3 frames, indices 0..60, nonzero pixels 5520`.
- `git diff --check` passed.

Gate:

None.

Next:

- Stand up `mcp-local-rag` and index the SGDK plus VDP docs.

## 2026-06-29 - ITERATION 11 - SGDK build MCP wrapper

Plan:

- Task: start Phase 1 by wrapping the proven docker-sgdk build path as the
  SGDK build MCP server.
- Files: `mcp-servers/sgdk-build/server.py`,
  `scripts/validate-sgdk-build-mcp.py`, `mcp-servers/sgdk-build/README.md`,
  `scripts/build-sgdk.sh`, `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: syntax-check the Python and shell files, then exercise the MCP
  server over stdio by listing tools, cleaning the hello-world project, building
  the ROM, and reading the captured build log.

Did:

- Moved the ledger into Phase 1 after human sign-off for Phase 0.
- Added a dependency-free Python stdio MCP server exposing `build_rom`,
  `clean`, and `read_build_log`.
- Captured build output and metadata under
  `artifacts/phase1/sgdk-build/`.
- Added a reusable validator that talks to the server as an MCP client.
- Updated `scripts/build-sgdk.sh` so the `clean` target succeeds without
  expecting an output ROM.

Evidence:

- `python3 -m py_compile mcp-servers/sgdk-build/server.py
  scripts/validate-sgdk-build-mcp.py` passed.
- `bash -n scripts/build-sgdk.sh` passed.
- `scripts/validate-sgdk-build-mcp.py` passed with:
  `SGDK build MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/examples/sgdk-hello-world/out/rom.bin`.
- `git diff --check` passed.

Gate:

None.

Next:

- Add the Genteel emulator sidecar adapter and MCP server.

## 2026-06-29 - ITERATION 10 - Phase 0 evidence packet

Plan:

- Task: package the Phase 0 gate evidence without advancing to Phase 1.
- Files: `docs/phase0-evidence.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: re-check frame stream parsing, generated asset metadata,
  validation script syntax, audio dump metadata, and Markdown hygiene.

Did:

- Added `docs/phase0-evidence.md`, mapping each Phase 0 requirement to the
  exact command and artifact that proves it.
- Updated `PROGRESS.md` to point at the evidence packet while keeping the Phase
  0 gate closed pending human sign-off.

Evidence:

- `scripts/validate-frame-stream.py artifacts/phase0/phase0-assets.frames
  --min-frames 6` passed with:
  `Frame stream ok: 6 frames, indices 0..150, nonzero pixels 5364`.
- `scripts/generate-phase0-assets.py --check` passed.
- `bash -n` passed for Phase 0 shell validators.
- Audio dump check reported stereo, 16-bit, 53267 Hz, 161210 frames, max
  absolute sample `10922`.

Gate:

Phase 0 is still awaiting explicit human sign-off. No Phase 1 work was started.

Next:

- Request Phase 0 sign-off.
- After sign-off, begin Phase 1 with the SGDK build MCP server wrapper.

## 2026-06-29 - ITERATION 9 - Genteel RGB565 frame stream proof

Plan:

- Task: prove the Phase 0 live-framebuffer path with the smallest local Genteel
  adapter that does not vendor or link emulator code into Drive16.
- Files: `patches/genteel/phase0-frame-stream.patch`,
  `scripts/build-genteel.sh`, `scripts/validate-frame-stream.py`,
  `scripts/validate-genteel-frame-stream.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `DECISIONS.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: apply the patch through `scripts/build-genteel.sh`, build
  Genteel, build the Phase 0 asset ROM, run it headlessly while streaming
  frames, parse the raw stream records, inspect the screenshot cross-check, run
  script syntax checks, and run `git diff --check`.

Did:

- Added a Drive16-owned patch for pinned Genteel commit
  `8043061f50782d6066cd39925f0f808f06d665ea`.
- Patched Genteel adds `--stream-frames <file>` and `--stream-every <n>`.
- Added `scripts/validate-frame-stream.py` to parse and validate the raw
  `D16F` RGB565 stream records.
- Added `scripts/validate-genteel-frame-stream.sh` to build the patched Genteel
  binary, build the Phase 0 asset ROM, stream frames, and validate the stream.
- Updated the Phase 0 runbook with the frame-stream validation command.

Evidence:

- `scripts/build-genteel.sh` built the patched Genteel binary successfully.
- `scripts/validate-genteel-frame-stream.sh` built
  `examples/phase0-assets/out/rom.bin`, ran it for 180 frames, wrote
  `artifacts/phase0/phase0-assets.frames`, and saved
  `artifacts/phase0/phase0-stream-proof.png`.
- `scripts/validate-frame-stream.py` reported:
  `Frame stream ok: 6 frames, indices 0..150, nonzero pixels 5364`.
- Visual inspection of `artifacts/phase0/phase0-stream-proof.png` shows the
  Phase 0 text and bundled sprite.

Gate:

Phase 0 exit criterion is now evidenced. Do not start Phase 1 until the human
confirms Phase 0 is complete.

Next:

- Request Phase 0 sign-off.
- After sign-off, begin Phase 1 with the SGDK build MCP server wrapper.

## 2026-06-29 - ITERATION 8 - Live-framebuffer gate

Plan:

- Task: record the remaining Phase 0 live-framebuffer gap and stop for a human
  decision before changing the emulator plan.
- Files: `DECISIONS.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: inspect the pinned Genteel source for framebuffer, screenshot,
  stream, and CLI support; run `git diff --check`.

Did:

- Audited the pinned Genteel source for live-framebuffer clues.
- Confirmed the build exposes headless screenshot capture, input scripting,
  audio dump, GUI rendering, and internal `vdp.framebuffer`.
- Did not find a documented continuous framebuffer stream CLI or sidecar
  protocol in `README.md`, `ARCHITECTURE.md`, `docs/`, or `src/`.
- Added a proposed decision with three paths: add a frame adapter, use Genteel
  GUI as the Phase 0 live-view proof and defer stream adapter work to Phase 1,
  or choose a fallback emulator for live view.

Evidence:

- `rg` in pinned Genteel source found `src/main.rs::save_screenshot`,
  `--screenshot`, `--dump-audio`, input script commands, `src/vdp/mod.rs`
  `framebuffer`, and GUI conversion via `frontend::rgb565_to_rgba8`.
- The same search found no documented streaming CLI comparable to the
  architecture's needed live sidecar path.

VALIDATION REQUEST:

Please choose the live-framebuffer path before Phase 1:

1. Build a tiny Genteel frame adapter over stdout/socket/shared memory.
2. Accept Genteel GUI rendering as the Phase 0 live-view proof and defer the
   stream adapter to Phase 1.
3. Use a fallback emulator for live view while keeping Genteel for headless
   verification.

Next:

- Implement or run the selected smallest proof.
- If the proof succeeds, request Phase 0 sign-off.

## 2026-06-29 - ITERATION 7 - Phase 0 ROM build and asset validation

Plan:

- Task: use the now-running Docker and built Genteel binary to validate the
  Drive16 hello-world ROM and asset ROM.
- Files: `examples/phase0-assets/res/resources.res`,
  `scripts/validate-phase0-assets.sh`, `docs/phase0-validation.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: build the SGDK hello-world ROM, screenshot it in Genteel, build
  the asset ROM, screenshot it in Genteel, drive the sprite with a Genteel input
  script, dump audio, confirm the audio is non-silent, inspect screenshots, and
  run script/style checks.

Did:

- Started Docker Desktop successfully; Docker daemon reported version 29.2.1.
- Built `examples/sgdk-hello-world/out/rom.bin` with docker-sgdk v2.11.
- Ran the Drive16 hello-world ROM in Genteel and captured
  `artifacts/phase0/genteel-hello.png`.
- Fixed the asset ROM `resources.res` paths so `rescomp` resolves repo-level
  `assets/phase0` correctly from the `res/` directory.
- Built `examples/phase0-assets/out/rom.bin` with docker-sgdk v2.11.
- Ran the asset ROM in Genteel and captured
  `artifacts/phase0/phase0-assets.png`.
- Drove the asset ROM with a scripted Right input and captured
  `artifacts/phase0/phase0-assets-right.png`.
- Dumped asset ROM audio to `artifacts/phase0/phase0-assets.wav`.
- Updated `scripts/validate-phase0-assets.sh` to reproduce the scripted input
  and non-silent audio checks.

Evidence:

- docker-sgdk image digest:
  `sha256:327ab838fbdf6bc741c6a7a11ee3c937cf1aaf1dc07a475995e89b741b6a830d`.
- Hello-world build ended with:
  `Built ROM: .../examples/sgdk-hello-world/out/rom.bin`.
- Genteel hello-world run saved `artifacts/phase0/genteel-hello.png` at about
  615 fps; visual inspection shows `Drive16 Phase 0` and `Hello from SGDK`.
- Asset ROM build ended with:
  `Built ROM: .../examples/phase0-assets/out/rom.bin`.
- Genteel asset run saved `artifacts/phase0/phase0-assets.png`; visual
  inspection shows the Phase 0 text and bundled sprite.
- Scripted Right input run saved `artifacts/phase0/phase0-assets-right.png`;
  visual inspection shows the sprite moved to the right edge.
- Audio dump metadata: stereo 16-bit WAV at 53267 Hz, 161210 frames.
- `scripts/validate-phase0-assets.sh` reported
  `Audio dump is non-silent: max abs sample 10922`.

VALIDATION REQUEST:

Only the live-framebuffer path remains open for the Phase 0 gate. Confirm
whether Genteel can expose a continuous framebuffer stream suitable for the
future Tauri pane, or report that the pinned build only exposes screenshots and
GUI rendering.

Next:

- If the live-framebuffer path is confirmed, record the exact command/API and
  request Phase 0 sign-off.
- If it is not available, record a proposed architecture change in
  `DECISIONS.md` before choosing a fallback.

## 2026-06-29 - ITERATION 6 - Buildable Genteel pin and screenshot proof

Plan:

- Task: make Genteel validation reproducible locally and close only the
  known-good screenshot/accuracy part of Phase 0.
- Files: `scripts/build-genteel.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: build pinned Genteel from source with a temporary Rust toolchain
  under ignored `artifacts/`, run the pinned known-good SGDK ROM through it,
  inspect the screenshot, syntax-check scripts, and run `git diff --check`.

Did:

- Cloned Genteel into ignored `artifacts/phase0/genteel-src`.
- Installed Rust 1.96.0 into ignored `artifacts/phase0/rustup` and
  `artifacts/phase0/cargo`, leaving the global Rust 1.74.0 untouched.
- Confirmed Genteel current `main` at
  `bd4fc05b2020a6889b323815f22ae577c70e52fa` fails to compile locally because
  `src/main.rs` references missing `audio::samples_per_frame_for_rate_and_region`.
- Built Genteel successfully from commit
  `8043061f50782d6066cd39925f0f808f06d665ea`.
- Added `scripts/build-genteel.sh` to reproduce that pinned source build.
- Ran the pinned known-good SGDK hello-world ROM through the built Genteel
  binary and captured a screenshot.

Evidence:

- `scripts/build-genteel.sh` produced
  `artifacts/phase0/genteel-src/target/release/genteel`.
- `GENTEEL_BIN="$PWD/artifacts/phase0/genteel-src/target/release/genteel"
  scripts/validate-known-good-homebrew.sh` passed.
- Genteel output reported `Running 180 frames headless`, saved
  `artifacts/phase0/known-good-homebrew.png`, and completed at about 622 fps.
- `file artifacts/phase0/known-good-homebrew.png` reported a 320 x 240 PNG.
- Visual inspection confirmed the screenshot shows `Hello world !` near screen
  center.
- `GENTEEL_BIN="$(scripts/build-genteel.sh)"
  scripts/validate-known-good-homebrew.sh` passed.
- `bash -n scripts/build-genteel.sh`, `bash -n scripts/validate-genteel.sh`,
  `bash -n scripts/validate-known-good-homebrew.sh`, and
  `bash -n scripts/validate-phase0-assets.sh` passed.
- `git diff --check` passed.
- `scripts/build-sgdk.sh examples/sgdk-hello-world` still stops at the local
  environment gate: "Docker is installed, but the Docker daemon is not
  reachable."

VALIDATION REQUEST:

Docker validation is still open. After Docker Desktop is running, run:

```sh
export GENTEEL_BIN="$(scripts/build-genteel.sh)"
scripts/build-sgdk.sh examples/sgdk-hello-world
scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin artifacts/phase0/genteel-hello.png
scripts/validate-phase0-assets.sh
```

Expected result:

- The Drive16 hello-world ROM builds and screenshots in Genteel.
- The Phase 0 asset ROM builds, screenshots, plays the bundled loop, and moves
  the bundled sprite.

Next:

- Wait for Docker validation and live-framebuffer evidence.
- If Genteel's live-framebuffer path is unavailable in the pinned build, record
  the conflict before changing the emulator plan.

## 2026-06-29 - ITERATION 5 - Genteel CLI alignment

Plan:

- Task: replace the provisional Genteel screenshot command with the real
  upstream CLI shape.
- Files: `scripts/validate-genteel.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: inspect upstream `segin/genteel` README, input scripting docs,
  and `src/main.rs`; syntax-check scripts; run `git diff --check`; keep runtime
  validation gated because no Genteel binary is installed locally.

Did:

- Confirmed the likely intended Genteel repository is `segin/genteel`.
- Confirmed its README describes an instrumentable Sega Mega Drive / Genesis
  emulator with headless screenshots and AI-oriented instrumentation.
- Patched `scripts/validate-genteel.sh` to call:
  `genteel --headless <frames> --screenshot <path> <ROM>`.
- Recorded observed Genteel source commit
  `bd4fc05b2020a6889b323815f22ae577c70e52fa` in the runbook.

Evidence:

- `gh repo view segin/genteel` reported the description matching the Drive16
  architecture and a repository push timestamp of 2026-06-28.
- `src/main.rs` usage text lists `--headless <n>` and `--screenshot <path>`.
- `src/main.rs` parser tests include
  `genteel --headless 1200 --screenshot final.png rom.bin`.
- `docs/input_scripting.md` documents
  `genteel --script my_tas.txt --headless 1000 <ROM_PATH>`.
- No local Genteel binary was found on PATH.

VALIDATION REQUEST:

After building or installing Genteel, rerun:

```sh
scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin artifacts/phase0/genteel-hello.png
```

Expected result:

- The script runs Genteel headlessly for 180 frames.
- `artifacts/phase0/genteel-hello.png` exists and shows the hello-world ROM.

Next:

- Wait for Docker and Genteel validation evidence.
- If the upstream live-framebuffer path is not available, record the conflict
  in `DECISIONS.md` before changing the emulator plan.

## 2026-06-29 - ITERATION 4 - Known-good homebrew validator

Plan:

- Task: make the Phase 0 Genteel accuracy check reproducible with a pinned open
  homebrew ROM source.
- Files: `scripts/validate-known-good-homebrew.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: fetch the pinned upstream SGDK sample ROM, verify SHA-256,
  record source/license metadata, syntax-check the script, run `git diff --check`,
  and keep the Genteel run gated until a binary is available.

Did:

- Added `scripts/validate-known-good-homebrew.sh`.
- The script downloads SGDK's pinned `sample/basics/hello-world` ROM into
  ignored `artifacts/phase0/known-good/` storage, verifies the hash, writes
  metadata, and then calls `scripts/validate-genteel.sh`.
- Updated the Phase 0 runbook to use the script instead of asking for an
  unspecified homebrew ROM.

Evidence:

- Downloaded the pinned ROM from SGDK commit
  `846b1a3c8551392eebbab33182b80cf4291fd2e8`.
- SHA-256 verified:
  `bb92580661f957cbe1286c047a91614b3716d7c174bf3dede95b9df3477ac916`.
- `file` identified the downloaded artifact as a Sega Mega Drive / Genesis ROM
  image with title `SAMPLE PROGRAM`.
- SGDK `license.txt` at the pinned commit states MIT license.
- `scripts/validate-known-good-homebrew.sh --fetch-only` passed.
- `bash -n scripts/validate-known-good-homebrew.sh` passed.
- `git diff --check` passed.

VALIDATION REQUEST:

After a Genteel binary is available, run:

```sh
scripts/validate-known-good-homebrew.sh
```

Expected result:

- `artifacts/phase0/known-good-homebrew.png` exists.
- The screenshot shows SGDK's expected "Hello world !" output.

Next:

- Wait for Docker and Genteel validation evidence.
- If the known-good ROM runs correctly, mark the Genteel accuracy checklist item
  complete in `PROGRESS.md` and record the screenshot evidence here.

## 2026-06-29 - ITERATION 3 - Phase 0 validation runbook

Plan:

- Task: add a complete Phase 0 human validation runbook and align the ledger
  with the architecture's known-good homebrew accuracy check.
- Files: `docs/phase0-validation.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: check Markdown/text style, confirm referenced scripts exist,
  run `git diff --check`, and keep the Phase 0 gate open.

Did:

- Added `docs/phase0-validation.md` with the required manual evidence for
  docker-sgdk, Genteel screenshots, known-good open homebrew accuracy, live
  framebuffer availability, audible VGM playback, and controllable sprite input.
- Updated `PROGRESS.md` so the known-good homebrew accuracy check is an explicit
  Phase 0 checklist item.

Evidence:

- `docs/phase0-validation.md` references checked-in scripts:
  `scripts/build-sgdk.sh`, `scripts/validate-genteel.sh`, and
  `scripts/validate-phase0-assets.sh`.
- `git diff --check` passed.

VALIDATION REQUEST:

Please follow `docs/phase0-validation.md` and paste back the evidence block from
the end of the runbook. Phase 0 cannot close until that evidence exists.

Next:

- Wait for Phase 0 validation evidence.
- If validation fails, repair the exact failed script, fixture, or emulator
  command and rerun the relevant section.

## 2026-06-29 - ITERATION 2 - Phase 0 bundled asset fixture

Plan:

- Task: add a Phase 0 asset-backed SGDK fixture without advancing beyond the
  manual spike.
- Files: `scripts/build-sgdk.sh`, `scripts/generate-phase0-assets.py`,
  `scripts/validate-phase0-assets.sh`, `assets/phase0/`,
  `examples/phase0-assets/`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: use upstream SGDK resource samples and headers as syntax
  references, generate original assets, verify asset metadata locally,
  syntax-check scripts, run `git diff --check`, and run the SGDK build wrapper
  to confirm the remaining local gate is Docker Desktop.

Did:

- Updated `scripts/build-sgdk.sh` so projects inside the repo can reference
  shared repo-level assets while still building inside docker-sgdk.
- Added `scripts/generate-phase0-assets.py` to generate original validation
  assets: a 32x32 indexed PNG sprite and a one-second PSG-only VGM loop.
- Added `examples/phase0-assets/`, which wires `SPRITE phase0_player` and
  `XGM phase0_loop` through `res/resources.res`.
- Added a simple SGDK ROM that starts the XGM loop and moves the sprite with
  the D-pad.
- Added `scripts/validate-phase0-assets.sh` as the single command for the
  eventual build plus Genteel screenshot validation.

Evidence:

- SGDK upstream sample/resource references checked:
  `sample/advanced/sprites-sharing-tiles/res/res_sprite.res`,
  `sample/basics/pools/res/resources.res`, `sample/snd/sound-test/res/resources.res`,
  `inc/sprite_eng.h`, `inc/snd/xgm.h`, and `tools/xgm2tool/.../VGM.java`.
- `scripts/generate-phase0-assets.py --check` passed.
- `file assets/phase0/player.png assets/phase0/loop.vgm` reported
  `player.png` as a 32 x 32, 8-bit colormap PNG and `loop.vgm` as VGM v1.5
  with SN76489 PSG.
- `bash -n scripts/build-sgdk.sh`, `bash -n scripts/validate-genteel.sh`, and
  `bash -n scripts/validate-phase0-assets.sh` passed.
- `git diff --check` passed.
- `scripts/build-sgdk.sh examples/phase0-assets` stopped with the expected
  local environment gate: "Docker is installed, but the Docker daemon is not
  reachable."

VALIDATION REQUEST:

Please run this from the repo root after starting Docker Desktop:

```sh
scripts/validate-phase0-assets.sh
```

Expected result:

- `examples/phase0-assets/out/rom.bin` is built by docker-sgdk.
- Genteel captures `artifacts/phase0/phase0-assets.png`.
- In a normal Genteel window, the D-pad moves the bundled sprite and the PSG
  loop is audible.

If the Genteel command shape differs, paste the `validate-genteel.sh` output so
the adapter command can be corrected.

Next:

- Wait for the Docker and Genteel validation results.
- If validation passes, close the Phase 0 manual spike checklist and request the
  phase gate sign-off before starting Phase 1.

## 2026-06-29 - ITERATION 1 - Bootstrap and Phase 0 validation request

Plan:

- Task: bootstrap the repo and create the first Phase 0 manual toolchain spike.
- Files: `README.md`, `.gitignore`, `PROGRESS.md`, `WORKLOG.md`,
  `DECISIONS.md`, `scripts/`, `mcp-servers/`, `app/`, `corpus/`, `assets/`,
  and `examples/sgdk-hello-world/`.
- Verification: read `drive16-architecture.md`, verify docker-sgdk v2.11 image
  metadata, syntax-check scripts, and open a validation request for Docker and
  Genteel because Docker Desktop is not running in this session and Genteel CLI
  availability is unconfirmed.

Did:

- Read `drive16-architecture.md` in full.
- Seeded `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Created the repo skeleton for Phase 0 through later app/corpus/MCP work.
- Added a pinned SGDK 2.11 Docker build script.
- Added a minimal SGDK hello-world project.
- Added a provisional Genteel validation script that checks for a screenshot-capable
  CLI before marking emulator validation complete.

Evidence:

- `docker manifest inspect registry.gitlab.com/doragasu/docker-sgdk:v2.11`
  passed and returned manifest digest
  `sha256:327ab838fbdf6bc741c6a7a11ee3c937cf1aaf1dc07a475995e89b741b6a830d`.
- Container config metadata reports `GDK=/sgdk`, PATH includes `/sgdk/bin`,
  entrypoint is `make -f /sgdk/makefile.gen`, working directory is `/m68k`,
  and default user is `m68k`.
- `bash -n scripts/build-sgdk.sh` passed.
- `bash -n scripts/validate-genteel.sh` passed.
- `git diff --check` passed.
- `scripts/build-sgdk.sh examples/sgdk-hello-world` stopped with the expected
  local environment gate: "Docker is installed, but the Docker daemon is not
  reachable."
- Local Docker build could not be run: Docker CLI exists, but the daemon socket
  `/Users/chrissotraidis/.docker/run/docker.sock` is not available.

VALIDATION REQUEST:

Please run these from the repo root on a machine with Docker Desktop running:

```sh
scripts/build-sgdk.sh examples/sgdk-hello-world
ls -lh examples/sgdk-hello-world/out/rom.bin
```

Expected result:

- Docker pulls or reuses `registry.gitlab.com/doragasu/docker-sgdk:v2.11`.
- SGDK builds the hello-world project without errors.
- `examples/sgdk-hello-world/out/rom.bin` exists.

Then run the emulator validation once a Genteel binary is available:

```sh
GENTEEL_BIN=/path/to/genteel scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin
```

Expected result:

- The ROM runs headlessly for 180 frames.
- A screenshot is written to `artifacts/phase0/genteel-hello.png`.
- If the script reports that the Genteel CLI shape is different, paste that
  output back so the adapter command can be corrected.

Next:

- Wait for the Docker/Genteel validation result before marking those checklist
  items complete.
- If validation passes, begin the bundled VGM loop unit.
