# Drive16 Release Readiness

Date: 2026-07-10

## Verified locally

- Tauri release bundling is enabled.
- The local package is ad-hoc signed as a complete bundle; strict verification
  covers its executable, Info.plist, and packaged resources.
- The release `.app` embeds the Drive16 agent, assets, corpus, starter projects,
  MCP servers, patches, scripts, and OpenCode configuration.
- On first release launch, support files are copied to the app-data runtime and
  the active project is created there. The installed app does not write inside
  its signed bundle or require the git checkout for project storage.
- The packaged frontend uses an explicit CSP.
- Release builds require a user-supplied interactive Genesis core. The
  Nostalgist CDN fallback is restricted to development or an explicit debug
  override.
- The packaged native window opens, connects to OpenCode, shows the first-run
  workspace, opens Settings, and reports the release-safe core state.
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
- DMG SHA-256: `f8271b70dff77cd6659e7ba0d27f3f467cf2584d1b04439139d20934bfccc989`
- Packaged resources: `Drive16.app/Contents/Resources/drive16-support/`
- Writable runtime: `~/Library/Application Support/dev.drive16.desktop/runtime/`
- Local Qwen pass: `artifacts/phase9/model-bakeoff/runs/local-qwen-snake-audit-tool-proof/run-record.json`

## Distribution decision

- The owner confirmed the MIT license; the repository includes `LICENSE`.
- Drive16 targets source and direct-download distribution, not the App Store.
- The current DMG is intentionally ad-hoc signed rather than Apple notarized.
- A quarantined internet download may require **Open Anyway** in macOS Privacy
  & Security on first launch. Developer ID signing/notarization remains optional
  future install polish for direct downloads, not a release gate.
- A broader clean-machine game-build pass remains useful follow-up evidence,
  but the isolated empty-home install/runtime smoke already passes.

Describe the current artifact as a verified ad-hoc-signed direct-download
release. Do not describe it as Apple notarized or App Store distributed.
