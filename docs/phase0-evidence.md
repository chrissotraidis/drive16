# Phase 0 Evidence Packet

Date: 2026-06-29

Phase 0 exit criterion:

> A hand-built ROM shows a controllable sprite and plays a bundled loop,
> verified by a Genteel screenshot, with the live-view path confirmed.

Status: evidenced locally. Human sign-off is required before Phase 1 begins.

## Toolchain

Requirement: stand up docker-sgdk and build the SGDK hello-world ROM.

Evidence:

- Command: `scripts/build-sgdk.sh examples/sgdk-hello-world`
- Output artifact: `examples/sgdk-hello-world/out/rom.bin`
- docker-sgdk image digest:
  `sha256:327ab838fbdf6bc741c6a7a11ee3c937cf1aaf1dc07a475995e89b741b6a830d`

## Genteel Headless Screenshot

Requirement: run the hello-world ROM in Genteel and capture a screenshot.

Evidence:

- Command:
  `GENTEEL_BIN="$(scripts/build-genteel.sh)" scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin artifacts/phase0/genteel-hello.png`
- Output artifact: `artifacts/phase0/genteel-hello.png`
- Visual result: screenshot shows `Drive16 Phase 0` and `Hello from SGDK`.

## Known-Good Homebrew Accuracy

Requirement: confirm Genteel accuracy on a known-good open homebrew ROM.

Evidence:

- Command:
  `GENTEEL_BIN="$(scripts/build-genteel.sh)" scripts/validate-known-good-homebrew.sh`
- Source ROM:
  `https://raw.githubusercontent.com/Stephane-D/SGDK/846b1a3c8551392eebbab33182b80cf4291fd2e8/sample/basics/hello-world/out/release/rom.bin`
- License source:
  `https://raw.githubusercontent.com/Stephane-D/SGDK/846b1a3c8551392eebbab33182b80cf4291fd2e8/license.txt`
- SHA-256:
  `bb92580661f957cbe1286c047a91614b3716d7c174bf3dede95b9df3477ac916`
- Output artifact: `artifacts/phase0/known-good-homebrew.png`
- Visual result: screenshot shows SGDK `Hello world !`.

## Bundled Asset ROM

Requirement: wire a bundled VGM loop through SGDK's XGM driver and import a
bundled sprite through `rescomp`.

Evidence:

- Command: `scripts/validate-phase0-assets.sh`
- Output ROM: `examples/phase0-assets/out/rom.bin`
- Neutral screenshot: `artifacts/phase0/phase0-assets.png`
- Scripted input screenshot: `artifacts/phase0/phase0-assets-right.png`
- Audio dump: `artifacts/phase0/phase0-assets.wav`
- Visual result: neutral screenshot shows Phase 0 text and the bundled sprite;
  scripted Right input moves the sprite to the right edge.
- Audio result: WAV metadata is stereo, 16-bit, 53267 Hz, 161210 frames, with
  max absolute sample `10922`.

## Live-Framebuffer Path

Requirement: confirm a framebuffer can be streamed for a live view.

Evidence:

- Command: `scripts/validate-genteel-frame-stream.sh`
- Genteel patch: `patches/genteel/phase0-frame-stream.patch`
- Stream artifact: `artifacts/phase0/phase0-assets.frames`
- Screenshot cross-check: `artifacts/phase0/phase0-stream-proof.png`
- Stream validator output:
  `Frame stream ok: 6 frames, indices 0..150, nonzero pixels 5364`
- Format: repeated `D16F` records containing version, 320x240 dimensions,
  RGB565 format marker, frame index, payload length, and raw RGB565 pixels.

## Phase Gate

Phase 0 is ready for human sign-off. Do not begin Phase 1 until sign-off is
given.
