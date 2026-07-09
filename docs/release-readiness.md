# Drive16 Release Readiness

Date: 2026-07-09

## Verified locally

- Tauri release bundling is enabled.
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

## Evidence paths

- App bundle: `app/src-tauri/target/release/bundle/macos/Drive16.app`
- DMG: `app/src-tauri/target/release/bundle/dmg/Drive16_0.1.0_aarch64.dmg`
- DMG SHA-256: `aa428967ae93347e6d9cf25a622d27a0a1bc264eeca58694d883dababfdfe944`
- Packaged resources: `Drive16.app/Contents/Resources/drive16-support/`
- Writable runtime: `~/Library/Application Support/dev.drive16.desktop/runtime/`
- Local Qwen pass: `artifacts/phase9/model-bakeoff/runs/local-qwen-snake-audit-tool-proof/run-record.json`

## Owner-controlled release gates

- Confirm the proposed MIT license before adding `LICENSE`.
- Provide an Apple Developer ID identity and notarization credentials.
- Sign/notarize the app and rebuild the DMG with the release identity.
- Test install, first launch, user-supplied core setup, and one real game build
  from a clean macOS account or machine.

Until those gates are complete, describe the current artifact as a verified
unsigned local release bundle, not a public release.
