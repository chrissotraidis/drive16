# Phase 0 Validation Runbook

Phase 0 proves the manual toolchain before any agent loop exists. Do not start
Phase 1 until every evidence item below is captured and recorded in
`WORKLOG.md`.

## Prerequisites

- Docker Desktop is running.
- A Genteel binary is available.
- Optional but required before closing Phase 0: one openly licensed, known-good
  Genesis / Mega Drive homebrew ROM with documented expected behavior. Record
  its source URL, license, and local path in the validation notes.

Set the Genteel path once per shell:

```sh
export GENTEEL_BIN=/path/to/genteel
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
- The screenshot visibly shows the Phase 0 text and bundled sprite.

## 4. Confirm Input And Music

Run the asset ROM in a normal Genteel window:

```sh
$GENTEEL_BIN examples/phase0-assets/out/rom.bin
```

Expected evidence:

- The D-pad moves the bundled sprite.
- The PSG music loop is audible and loops cleanly.
- Note the exact Genteel command used if the CLI differs from the line above.

## 5. Confirm Known-Good Homebrew Accuracy

Use an openly licensed homebrew ROM with documented expected behavior:

```sh
scripts/validate-genteel.sh /path/to/known-good-homebrew.bin artifacts/phase0/known-good-homebrew.png
```

Expected evidence:

- `artifacts/phase0/known-good-homebrew.png` exists.
- The screenshot and behavior match the ROM's documented expected output.
- The source URL and license for the ROM are recorded in `WORKLOG.md`.

Do not use commercial ROMs, disassemblies, or unlicensed downloads.

## 6. Confirm Live-Framebuffer Path

Use the current Genteel build's documented live or debug framebuffer command.
Record the exact command because the Drive16 sidecar adapter will need to match
the real CLI.

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
