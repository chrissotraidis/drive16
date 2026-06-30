# Phase 6 Emulator Core Selection

Phase 6 starts the Interactive ROM Player work. The goal is to let a user play
an imported or Drive16-generated Genesis / Mega Drive ROM inside the app while
keeping the existing Genteel proof path for deterministic validation.

## Requirements

The selected direction must:

- Run inside the Tauri webview or have a clean path to do so.
- Load a ROM from local Drive16 storage.
- Support keyboard input now.
- Leave a plausible path for controller support later.
- Keep the ROM viewport visually dominant.
- Avoid turning Drive16 into a generic emulator frontend.
- Avoid committing commercial ROMs, imported ROMs, emulator core binaries with
  unresolved licensing, or large runtime assets.
- Preserve Genteel as the proof and capture tool.

## Candidates

### Nostalgist.js plus RetroArch Emscripten cores

Status: selected as the browser adapter direction, with licensing guardrails.

Evidence:

- Repository: `https://github.com/arianrhodsandlot/nostalgist`
- Package version inspected locally: `nostalgist@0.21.1`
- Package license inspected locally: MIT
- The README describes Nostalgist as a browser library for retro emulators,
  including Sega Genesis, and shows programmatic launch APIs.
- The package's TypeScript declarations include
  `Nostalgist.megadrive(...)`, documented as using `genesis_plus_gx`.
- The runtime resolves RetroArch Emscripten core JS/WASM separately, so core
  delivery can be made explicit instead of bundled blindly.

Pros:

- Browser-first and Tauri-webview-friendly.
- Programmatic enough for Drive16's React shell.
- Supports ROM launch, save state APIs, and RetroArch config.
- Lets Drive16 build a restrained player UI instead of embedding a full generic
  emulator frontend.

Risks:

- The wrapper's MIT license does not settle the core license.
- The default Mega Drive core is Genesis Plus GX, whose libretro documentation
  and binary package metadata identify it as non-commercial.
- Default CDN core loading is not appropriate as the only product path for a
  local-first app.

Decision:

Use Nostalgist as the first adapter target for an embedded browser player, but
do not commit Genesis Plus GX binaries or imply the distributed app has a fully
settled commercial core license. The first player architecture must allow core
delivery to be configured or replaced.

### EmulatorJS

Status: rejected for the first Drive16 integration.

Evidence:

- Package inspected locally: `@emulatorjs/emulatorjs@4.2.3`
- Package license inspected locally: GPL-3.0
- README advertises broad system support including Sega Mega Drive.

Pros:

- Mature player surface with many systems and controls.
- Has a complete emulator UI.

Risks:

- GPL-3.0 is not a good fit for Drive16's current permissive-license posture
  unless the project intentionally changes distribution terms.
- The built-in UI is heavier than Drive16 needs and would fight the goal of a
  tasteful ROM-first workbench.

Decision:

Do not use EmulatorJS for the first Phase 6 player.

### romdevtools / retroemu

Status: useful reference and possible future native sidecar, not the embedded
player for this phase.

Evidence:

- `romdevtools@0.71.1` inspected locally.
- `retroemu@0.3.0` inspected locally.
- `retroemu` documents truecolor terminal rendering, SDL audio, keyboard
  fallback, and controller support.
- `romdev-core-gpgx@0.12.0` metadata identifies its bundled Genesis Plus GX
  core as non-commercial.

Pros:

- Strong local retro tooling story.
- Has real controller and audio direction through SDL paths.
- Useful model for future native sidecar or MCP/tool integration.

Risks:

- It is not an embedded Tauri-webview player.
- The Genesis core license issue remains.
- Bringing it in directly would add a separate terminal/native player surface
  instead of the in-app playfield requested for Phase 6.

Decision:

Use as a reference and possible later native sidecar, but do not choose it as
the first embedded player path.

### Extending Genteel into the interactive player

Status: rejected for Phase 6's first implementation path.

Pros:

- Drive16 already uses Genteel for proof capture.
- It preserves continuity with the existing validation harness.

Risks:

- Genteel is currently used as a finite headless capture tool.
- Building persistent audio/video/input around it is a larger emulator
  engineering task than Phase 6 needs for the first user-facing player.
- It would blur Play and Verify again unless carefully isolated.

Decision:

Keep Genteel for Verify/Capture Proof. Do not make it the human Play surface
unless a later phase explicitly adds a persistent sidecar protocol.

## Selected Direction

Phase 6 will add an interactive player boundary with a provider adapter:

- `proof-preview`: existing captured-frame path used when no interactive core
  is available.
- `nostalgist-retroarch`: browser player adapter target for local/dev play.
- Future adapter slots may support a native sidecar or another emulator core.

The app UI should be built around Drive16's own player controls rather than an
embedded generic emulator chrome:

- Play/Pause
- Reset
- Stop
- Mute/Unmute when audio is supported
- Focus/theater mode
- Input focused state
- Keyboard-ready state
- Controller-ready foundation without claiming controller support yet

## License Boundary

For Phase 6 implementation:

- Do not commit Genesis Plus GX core binaries.
- Do not commit EmulatorJS data bundles.
- Do not commit imported ROMs.
- Keep core delivery configurable.
- Document when an interactive adapter is using a non-commercial or copyleft
  core.
- A future distributable build needs either a compatible bundled core, explicit
  user-supplied core installation, or a project licensing decision.

## Next Unit

Build the player architecture boundary:

- Active ROM source model.
- Player provider state.
- Input action model.
- UI labels that distinguish Play from Verify/Capture Proof.
- No emulator core integration until the boundary is in place.
