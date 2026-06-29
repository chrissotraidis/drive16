# SGDK Hello World

This is the first Phase 0 validation fixture. It only proves that the pinned
docker-sgdk toolchain can compile a minimal SGDK ROM.

Build from the repo root:

```sh
scripts/build-sgdk.sh examples/sgdk-hello-world
```

Expected output:

```text
Built ROM: .../examples/sgdk-hello-world/out/rom.bin
```

Run and screenshot with Genteel after the ROM exists:

```sh
GENTEEL_BIN=/path/to/genteel scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin
```
