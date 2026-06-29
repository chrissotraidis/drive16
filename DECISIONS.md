# Drive16 Decisions

## 2026-06-29 - Proposed app license: MIT

Context:

Drive16 needs a permissive license posture while isolating copyleft and
non-commercial dependencies as separate sidecar processes. The architecture
requires Genteel as the MIT default emulator, BlastEm only as a GPLv3 sidecar,
Genesis Plus GX only as explicit opt-in, and ComfyUI only as a separate Phase 4
process.

Decision:

Propose MIT for the Drive16 app code. Do not finalize a `LICENSE` file until the
human confirms this choice.

Consequence:

The repo can document the intended license stance now, while release licensing
remains a human confirmation gate. Any copyleft or non-commercial component must
stay outside the linked app binary.

## 2026-06-29 - Phase 0 validation fixture location

Context:

The architecture intentionally leaves the final Drive16 project format open
until before Phase 3, but Phase 0 needs a concrete SGDK project to validate the
manual toolchain.

Decision:

Place manual spike fixtures under `examples/`, starting with
`examples/sgdk-hello-world/`. These fixtures are validation assets, not the final
Drive16 project format.

Consequence:

Phase 0 can produce exact build commands now without prematurely deciding the
future app project layout.
