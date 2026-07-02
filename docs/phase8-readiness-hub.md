# Phase 8 Slice 2 - Readiness / First-Run Hub

Status: implemented and verified for Phase 8 Slice 2.

## What changed

Drive16 now has a compact readiness hub in the project menu, reachable from the
top-level `Setup` button or the project menu button.

The hub consolidates the app's current truth instead of running new hidden
checks:

- ROM proof path: shows whether Verify/Capture Proof is ready, preview-only, or
  failing.
- Interactive Play core: shows user core, dev CDN, missing, user-action, or
  unsupported states.
- OpenRouter chat: shows live, missing key, or test-needed states.
- Ollama: explicitly remains readiness-only; live replies are not wired.
- OpenCode and local tools: combines OpenCode status with native preflight
  status.
- ComfyUI sprites and MML music: show optional enhancement readiness without
  implying they are required.
- Release blockers: keeps missing `LICENSE`, disabled bundling, null CSP, and
  public Play core policy visible as public-release blockers.

## Boundaries

- No API keys are persisted.
- No emulator cores are bundled or downloaded.
- No packaging, signing, notarization, CSP, or license decision was changed.
- OpenRouter freeform replies and the CORE local proof route from Phase 8 Slice
  1 remain unchanged.
- Ollama live generation remains out of scope.

## Verification plan

The existing browser smoke now opens the hub, verifies the required status
labels and release blockers are visible, and checks the hub at a narrow
viewport for horizontal overflow.

Full verification for this slice is the normal Drive16 loop:

```sh
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check
cargo test --manifest-path app/src-tauri/Cargo.toml
scripts/verify-phase6-loop.sh --browser
```

Secret hygiene remains required before final sign-off.

## Evidence

- `pnpm --dir app build`: passed.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check`: passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml`: passed with 51 passed,
  0 failed, 4 ignored.
- In-app Browser check: `Setup` opened the hub, required statuses were visible,
  no checked-viewport horizontal overflow, and console warnings/errors were
  `0`.
- Full browser loop: `scripts/verify-phase6-loop.sh --browser` passed with
  evidence under `artifacts/phase6/verify-loop/20260702-152451`.
- Secret scan: no `sk-or-v1-` key pattern in the repo scan.
- Tracked artifact scan: no tracked `.wasm`, `.zip`, `.safetensors`, `.ckpt`,
  `.bin`, `.gen`, or `.smd` files.
