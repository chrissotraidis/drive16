# Phase 0 Validation Runbook

Phase 0 proves the manual toolchain before any agent loop exists. Do not start
Phase 1 until every evidence item below is captured and recorded in
`WORKLOG.md`.

## Prerequisites

- Docker Desktop is running.
- A Genteel binary is available. The expected upstream source is
  `https://github.com/segin/genteel`. Current `main` at observed commit
  `bd4fc05b2020a6889b323815f22ae577c70e52fa` did not compile locally on
  2026-06-29, so Phase 0 validation is pinned to buildable commit
  `8043061f50782d6066cd39925f0f808f06d665ea`.
- Network access for the known-good homebrew fetch. The checked-in validator
  downloads a pinned upstream SGDK hello-world ROM into ignored `artifacts/`
  storage, verifies its SHA-256 hash, and records source/license metadata.

Set the Genteel path once per shell:

```sh
export GENTEEL_BIN="$(scripts/build-genteel.sh)"
```

The checked-in validator expects the current upstream CLI shape:

```sh
genteel --headless 180 --screenshot artifacts/phase0/example.png path/to/rom.bin
```

## 1. Build The Hello-World ROM

```sh
scripts/build-sgdk.sh examples/sgdk-hello-world
ls -lh examples/sgdk-hello-world/out/rom.bin
```

Expected evidence:

- `examples/sgdk-hello-world/out/rom.bin` exists.
- The build log has no compiler or `rescomp` errors.

## 2. Run Hello-World In Genteel

```sh
scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin artifacts/phase0/genteel-hello.png
```

Expected evidence:

- `artifacts/phase0/genteel-hello.png` exists.
- The screenshot visibly shows the Drive16 hello-world text.

## 3. Build And Run The Asset ROM

```sh
scripts/validate-phase0-assets.sh
```

Expected evidence:

- `examples/phase0-assets/out/rom.bin` exists.
- `artifacts/phase0/phase0-assets.png` exists.
- `artifacts/phase0/phase0-assets-right.png` exists and shows the sprite moved
  right via a Genteel input script.
- `artifacts/phase0/phase0-assets.wav` exists and the validator reports
  non-silent audio from the bundled VGM loop.
- The neutral screenshot visibly shows the Phase 0 text and bundled sprite.

## 4. Confirm Input And Music

Run the asset ROM in a normal Genteel window:

```sh
$GENTEEL_BIN examples/phase0-assets/out/rom.bin
```

Expected evidence:

- The D-pad moves the bundled sprite in interactive play.
- The PSG music loop is audible and loops cleanly.
- Note the exact Genteel command used if the CLI differs from the line above.

## 5. Confirm Known-Good Homebrew Accuracy

Use the pinned MIT-licensed SGDK hello-world sample ROM:

```sh
scripts/validate-known-good-homebrew.sh
```

Expected evidence:

- `artifacts/phase0/known-good-homebrew.png` exists.
- `artifacts/phase0/known-good/sgdk-hello-world.txt` records the source URL,
  source-code URL, MIT license URL, pinned commit, and SHA-256.
- The screenshot visibly shows the expected SGDK "Hello world !" output.

Do not use commercial ROMs, disassemblies, or unlicensed downloads.

## 6. Confirm Live-Framebuffer Path

Use the current Genteel build's documented live or debug framebuffer command.
As of observed Genteel commit `8043061f50782d6066cd39925f0f808f06d665ea`,
headless screenshots and input scripts are documented, but a continuous
framebuffer stream still needs explicit human confirmation. Record the exact
command because the Drive16 sidecar adapter will need to match the real CLI.

Expected evidence:

- A framebuffer stream or equivalent live-frame source is available outside the
  GUI window.
- The command can run the Phase 0 asset ROM and expose frames suitable for the
  future Tauri pane.
- If Genteel cannot expose this path, record the failure and evaluate the
  architecture fallback before Phase 1.

## Evidence To Paste Back

Paste this block back into the Drive16 worklog loop:

```text
Docker SGDK hello-world build:
Genteel hello-world screenshot:
Docker SGDK asset ROM build:
Genteel asset screenshot:
Asset ROM input result:
Asset ROM music result:
Known-good homebrew source and license:
Known-good homebrew screenshot:
Live-framebuffer command and result:
Unexpected errors:
```
