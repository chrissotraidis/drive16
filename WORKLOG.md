# Drive16 Worklog

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
