# Drive16 Worklog

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
