# Drive16 Release Readiness

Date: 2026-07-10

## Verified locally

- Tauri release bundling is enabled.
- The local package is ad-hoc signed as a complete bundle; strict verification
  covers its executable, Info.plist, and packaged resources.
- The release `.app` embeds the Drive16 agent, assets, corpus, starter projects,
  MCP servers, patches, scripts, OpenCode configuration, and an executable
  arm64 Genteel verifier.
- On first release launch, support files are copied to the app-data runtime and
  the active project is created there. The installed app does not write inside
  its signed bundle or require the git checkout for project storage.
- The packaged frontend uses an explicit CSP.
- Direct-download builds enable the Nostalgist streamed Genesis core for Play
  and permit its pinned jsDelivr origin in the CSP. The core is fetched on
  demand rather than bundled; a user-supplied local core remains supported.
- The packaged native window opens, connects to OpenCode, shows the first-run
  workspace, and opens Settings.
- The packaged app launches a Drive16-owned OpenCode process rooted in the
  writable runtime even when another healthy OpenCode server owns port 4096.
- Native Verify shows the recovered Tetris frame, proves same-frame scripted
  input changed 0.333% of pixels, captures non-silent audio (`maxAbs=10922`),
  and reports `Ready` without compiling Genteel at first use.
- Browser-first interactive testing loads the real recovered Tetris ROM,
  renders a visible frame, and records Right/Up input through the shared React
  and Nostalgist player code.
- **Release blocker:** packaged macOS interactive Play starts RetroArch and
  records Right/Up input, but the WKWebView canvas remains black. The screen
  probe now times out and reports the failure instead of spinning forever.
- Common Settings and Build activity keep endpoint, file-path, and raw
  connection diagnostics inside Advanced setup.
- Native tests, frontend build, browser smoke, agent contract, project-memory
  gates, SGDK MCP validation, and the model-bakeoff report pass.
- The DMG verification smoke installs into a canonical isolated location,
  launches with an empty home, and proves both the writable runtime and active
  starter project are created.

## Evidence paths

- App bundle: `app/src-tauri/target/release/bundle/macos/Drive16.app`
- DMG: `app/src-tauri/target/release/bundle/dmg/Drive16_0.1.0_aarch64.dmg`
- DMG SHA-256: `0a1594c08d0cb0bc964ea962537f1517f0ee6adbbdc7c6459f50a35f54c53ca5`
- Packaged resources: `Drive16.app/Contents/Resources/drive16-support/`
- Bundled verifier: `Drive16.app/Contents/Resources/drive16-support/bin/genteel`
- Writable runtime: `~/Library/Application Support/dev.drive16.desktop/runtime/`
- Recovered Tetris proof: `artifacts/phase9/tetris-recovery/`
- Local Qwen pass: `artifacts/phase9/model-bakeoff/runs/local-qwen-snake-audit-tool-proof/run-record.json`
- Native ComfyUI auto-start proof: the enabled release app reached
  `http://127.0.0.1:8188` readiness in nine seconds.
- Local sprite proof:
  `artifacts/phase4/live-comfyui-sprite/bf0c3413-13dd-45db-8e78-a41f883347c7/drive16_genesis_sprite_00014_-sgdk.png`

## Distribution decision

- The owner confirmed the MIT license; the repository includes `LICENSE`.
- Drive16 targets source and direct-download distribution, not the App Store.
- The streamed Genesis Plus GX path is not bundled and is limited to free,
  non-commercial use under the core's upstream license. Revisit the player
  choice before monetization.
- The current DMG is intentionally ad-hoc signed rather than Apple notarized.
- A quarantined internet download may require **Open Anyway** in macOS Privacy
  & Security on first launch. Developer ID signing/notarization remains optional
  future install polish for direct downloads, not a release gate.
- A broader clean-machine game-build pass remains useful follow-up evidence,
  but the isolated empty-home install/runtime smoke already passes.

Describe the current artifact as a verified ad-hoc-signed direct-download test
build. Do not describe interactive Play as working in the packaged macOS app,
and do not describe it as Apple notarized or App Store distributed.
