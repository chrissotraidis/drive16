# Drive16 Worklog

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
