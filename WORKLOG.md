# Drive16 Worklog

## 2026-07-10 - ITERATION 118 - signed local package and clean-install smoke

Did:

- Replaced the misleading `--no-sign` package path with Tauri's ad-hoc signing
  identity for local Apple Silicon artifacts.
- Added one release command that builds the `.app` and `.dmg`, then runs the
  release smoke automatically.
- Added an isolated DMG smoke that verifies the disk image and strict bundle
  signature, copies the app outside the repository, launches with an empty
  home, and checks the writable support runtime plus active project.
- Added precise packaged resource/app-data path errors at native startup.

Evidence:

- `pnpm --dir app verify:release:macos` passed against the rebuilt DMG.
- The `.app` passes `codesign --verify --deep --strict` before and after the
  DMG copy.
- The isolated first launch created all eight support entries and
  `artifacts/phase3/active-project/Makefile` under its clean app-data runtime.
- DMG SHA-256:
  `ed26497c3405f175c7c6d3e3ae9b02fd8b5f3c9daf1461a3532ecd02cde3595b`.

Note:

- Two macOS crash dialogs during development were caused by an invalid smoke
  location under `/tmp`, which is a symlink on macOS. Tauri intentionally
  rejects symlinked executable ancestors. The corrected smoke uses canonical
  `/private/tmp` and passes; the live browser app was not involved.

Next:

- Confirm the proposed MIT license and provide the Apple Developer ID plus
  notarization credentials, then rebuild and repeat the smoke on the final
  public artifact from a clean account or machine.

## 2026-07-09 - ITERATION 117 - local model closure and packaged runtime

Did:

- Added an `audit_project_memory` MCP tool and required the builder to run it
  after updating the three project-memory files.
- Fixed camelCase `nonSilent=true` evidence handling and isolated emulator
  input scripts so a prior run cannot supply restart evidence to a new game.
- Completed one bounded local-Qwen Snake proof with every runtime, audio,
  genre, trace, and project-memory check passing.
- Added the live Ollama model dropdown, tested Qwen and GPT-OSS locally, and
  moved the Ollama endpoint behind Advanced setup.
- Enabled Tauri release bundling with an explicit CSP and bundled Drive16
  support resources.
- Added release runtime initialization that copies support files into
  Application Support while preserving writable project artifacts there.
- Changed packaged Play policy to require a user-supplied core; the dev CDN is
  now available only in development or an explicitly flagged debug bundle.
- Replaced the optional ComfyUI raw endpoint error in common settings with
  concise setup guidance; technical configuration remains under Advanced.

Evidence:

- Local Qwen proof run `local-qwen-snake-audit-tool-proof` reports `status:
  pass` with all eleven checks true.
- `cargo test --manifest-path app/src-tauri/Cargo.toml`: 68 passed, 5 ignored,
  0 failed.
- Frontend build, browser smoke, project-memory gates, agent contract, SGDK MCP
  validation, and the 12-run model-bakeoff report all passed.
- Release bundle built at
  `app/src-tauri/target/release/bundle/macos/Drive16.app` (16 MB), with 3.7 MB
  of bundled support files and executable build scripts.
- The release app initialized its active project under
  `~/Library/Application Support/dev.drive16.desktop/runtime` and the native
  UI showed OpenCode connected plus `No user core` for release-safe Play.

Next:

- Confirm the proposed MIT license, sign/notarize with the owner's Apple
  Developer ID, build the final DMG, and smoke it on a clean macOS account.

## 2026-07-09 - ITERATION 116 - guided first run and quieter operations UI

Did:

- Replaced the empty ROM screen with a guided first-run card centered on
  describing a game, trying Snake/Pong/Tetris/Asteroids, or opening a project.
- Wired example buttons into the existing controlled chat composer instead of
  creating a second prompt path.
- Kept the real dependency state concise on the first screen; optional AI
  sprites no longer dominate the starting experience.
- Removed duplicate Save/Export actions from the project menu and translated
  internal artifact paths into plain project states.
- Kept provider/model/build options visible in Settings while moving ComfyUI
  endpoint/model values, tool paths, and diagnostics behind Advanced.
- Updated browser smoke for the new no-ROM contract, example handoff, advanced
  settings persistence, and simplified project menu.

Evidence:

- `pnpm --dir app build` passed.
- `pnpm --dir app verify:phase6:browser` passed.
- Rebuilt and opened the native debug app; the real 1440x900 window shows the
  guided first run with `Ready to build locally. AI sprites are optional.`

Next:

- Raise the generated-game visual/game-feel quality contract before beginning
  the cross-model bakeoff.

## 2026-07-09 - ITERATION 115 - reliability checkpoint and four-prompt live audit

Did:

- Reviewed and committed the builder reliability/playability pass as
  `9ead63d` after native tests, frontend build, browser smoke, contract tests,
  and verifier self-tests passed.
- Completed the missing Asteroids audit through a failed first run and an
  in-place repair continuation that preserved its working project and trace.
- Added non-silent MML/VGM audio to the Asteroids run, rebuilt the ROM, and
  recorded fresh screen, input, restart, and audio evidence.
- Fixed the project-memory audio negation matcher so unrelated `no errors`
  copy cannot negate a later captured/non-silent audio record.
- Added explicit seeded-source provenance and required the original run plan
  before the final report verifier may waive a source edit.
- Added atomic promotion for one passing Snake, Pong, Tetris, and Asteroids run
  into the main live-audit report.

Evidence:

- `pnpm --dir app verify:live-game-audit:report` passed with four runs.
- Promoted runs have no listed issues and every required check is true.
- Audio evidence fixtures still reject missing, uncaptured, and self-omitted
  sound while accepting the Asteroids non-silent proof wording.

Next:

- Improve the first-run workspace and simplify common versus advanced
  settings before beginning the cross-model bakeoff.

## 2026-07-05 - ITERATION 114 - one chat path in the desktop app, project structure formalized

Did:

- Desktop chat now has exactly one route: the build agent. The freeform
  OpenRouter fallback and its gate messages ("Freeform model replies are
  paused", "X is check") no longer exist in the Tauri app; they remain only
  in the browser preview (with fixed copy). The agent path reconnects to
  OpenCode on demand and reports real, actionable errors (bridge down, no
  key, Ollama not wired).
- Silent provider failures surfaced: OpenCode returns an empty assistant
  stub when a provider rejects a request; the bridge now converts that into
  a clear re-test-your-key error instead of an endless spinner.
- New Project now resets the agent workspace (`reset_active_project`
  command) so a fresh project does not inherit the previous game.
- Project structure formalized and documented in
  `docs/project-structure.md`; the starter template ships a `res/` scaffold;
  the project menu shows the Workspace folder; the agent skill gained an
  identity/capabilities section and a no-tools-for-greetings rule (identity
  knowledge verified by direct probe).

## 2026-07-05 - ITERATION 113 - fix in-app agent auth, feedback visibility, native Play

Did, from live user testing of the rebuilt app:

- Root cause of "The agent request failed": OpenCode only activates a
  provider's model catalog at server start, so the BYOK key handed over at
  runtime never took effect. `set_opencode_auth` now verifies the provider is
  connected and automatically restarts the OpenCode server when needed.
- `connect_opencode` reports connected providers; a key saved in OpenCode's
  auth store marks OpenRouter ready on launch, so the app no longer "forgets"
  the API key between restarts (the key lives in OpenCode, not the webview).
- Tauri invoke errors are strings; error handling now preserves the real
  reason instead of a generic message, and agent failures set a visible
  notice. Empty-body model replies (bad key) return a clear error.
- Added a visible toast for every action notice; Save/Export/Play feedback
  was previously screen-reader-only in the rebuilt shell.
- Play ROM now works in the native app: the streamed-CDN Genesis core
  fallback is allowed in the desktop app (was Vite-dev-only), with the
  release caveat tracked in the overhaul plan.
- Provider switching no longer wipes a ready OpenRouter state; Settings got
  a "Settings apply immediately" note and a Done button; enabled
  enhancements are auto-tested when Settings opens.

## 2026-07-05 - ITERATION 112 - overhaul: real agent loop, player audio, UI rebuild

Plan:

- Task: execute `docs/overhaul-plan.md` tracks A/B/C plus hardening: wire the
  real OpenCode agent loop into chat, add player audio, rebuild the UI shell,
  and add timeouts/size caps.
- Files: `app/src-tauri/src/{opencode,project,starter_rom,main}.rs`,
  `app/src/agent/opencodeSession.ts`, `app/src/App.tsx`,
  `app/src/components/*`, `app/src/styles.css`, `app/src/player/nostalgist.ts`,
  `agent/skills/drive16-app-builder.md`, `opencode.json`,
  `scripts/verify-phase6-browser-smoke.mjs`.
- Verification: cargo tests, app build, browser smoke, live agent runs via the
  OpenCode API, Genteel audio dump.

Did:

- Chat now routes to the real OpenCode agent (model-selected, long-timeout,
  chunked HTTP) with the MCP tool belt; BYOK key handed over via
  `set_opencode_auth`; agent works in `artifacts/phase3/active-project` and
  the built ROM auto-plays. The `isV1Prompt` string-match is fallback-only and
  the overclaim regex guards are gone.
- Verified live: "make the screen background bright red" (24 s) and "add a
  short upbeat looping background song" (117 s) both edited the project,
  built through Docker SGDK, and produced truthful replies; the composed
  4-channel MML song is non-silent in a Genteel audio dump (max_abs 14043).
- Player audio: RetroArch OpenAL context resumed on Play/click, mute toggle
  in the player pane; `PlayerAudioState` is finally real.
- UI rebuilt: chat-left/game-right shell, components extracted, App.tsx
  6,014 -> ~3,600 lines, styles.css rewritten (~1,500 lines), jargon purged;
  smoke selectors updated and passing.
- Hardening: run_command_with_timeout kills hung Docker/Genteel calls;
  base64 import size caps for ROMs and Play cores.
- Builder skill extended with music (MML presets -> compile_music -> XGM)
  and sprite (ComfyUI workflow -> validator -> SPRITE resource) recipes; all
  6 MML presets re-validated locally.

## 2026-07-03 - ITERATION 111 - move provider detail out of chat

Plan:

- Task: remove the bulky `OpenRouter live` status from the chat rail and keep
  provider detail in Settings.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `scripts/verify-phase6-browser-smoke.mjs`,
  `docs/phase8-ui-repair-slice7.md`, `PROGRESS.md`, `README.md`,
  `WORKLOG.md`, `docs/phase8-next-agent-handoff.md`,
  `docs/phase8-ui-optimization-checkpoint.md`, and
  `docs/ui-repair-control-map.md`.
- Verification: app build, browser smoke, rendered browser check, diff hygiene,
  and secret scan.

Did:

- Removed the provider-status strip from the bottom of the conversation rail.
- Changed the composer label to neutral `Message`.
- Kept provider/key/model details in Agent Settings.
- Updated browser smoke to fail if `OpenRouter live` leaks back into the chat
  pane after provider setup.

Gate:

Provider setup remains visible in Settings, and freeform chat still works after
OpenRouter is tested. Chat no longer carries a persistent provider info panel.

## 2026-07-03 - ITERATION 110 - OpenRouter session key retention

Plan:

- Task: stop the OpenRouter BYOK key from disappearing during normal app use
  and refreshes.
- Files: `app/src/App.tsx`, `scripts/verify-phase6-browser-smoke.mjs`,
  `PROGRESS.md`, `WORKLOG.md`, `README.md`,
  `docs/phase8-next-agent-handoff.md`, and
  `docs/ui-repair-control-map.md`.
- Verification: app build, browser smoke with reload persistence assertion,
  script syntax, diff hygiene, and secret scan.

Did:

- Persisted the OpenRouter key in browser/native session storage for the
  current app window.
- Kept the key out of committed files, docs, localStorage, and project state.
- Updated app copy so it no longer says keys are forgotten after reload.
- Extended browser smoke to fill the key, reload the app, reopen Settings, and
  assert the key is still present before testing OpenRouter.

Gate:

The key should remain available through refreshes while the app window is open.
Closing the app/window still clears the session-scoped key.

## 2026-07-03 - ITERATION 109 - native visible-button trust pass

Plan:

- Task: finish the remaining native visible-button trust audit after the
  file-picker open/cancel pass.
- Files: `docs/phase8-ui-repair-slice6.md`, `PROGRESS.md`, `WORKLOG.md`,
  `README.md`, `docs/phase8-next-agent-handoff.md`,
  `docs/phase8-ui-optimization-checkpoint.md`, and
  `docs/ui-repair-control-map.md`.
- Verification: inspect the current native app state, confirm the compact
  default shell, click through Save/Open/Export, Settings, Controls, details,
  and conversation collapse/restore, then rerun build/test/diff/secret checks.

Did:

- Confirmed the native app is the current Phase 8 shell with ROM details
  collapsed by default.
- Verified `Save` creates a snapshot and reports the path.
- Verified `Export` copies the active ROM and reports the path.
- Verified `Open Project` loads the latest saved snapshot after Save.
- Verified Settings opens, provider switching hides irrelevant fields, and
  provider state remains inside Settings.
- Verified Controls opens, Reset defaults saves the default profile locally,
  and the panel closes cleanly.
- Verified `Show Details` / `Hide ROM details` and `Hide conversation pane` /
  `Show conversation pane`.

Evidence:

- Native desktop inspection showed `Phase 8 readiness hub` and compact
  `ROM details collapsed` state.
- Save path observed under `artifacts/phase3/projects`.
- Export path observed under `artifacts/phase3/exports`.
- Open Project loaded the saved snapshot
  `drive16-app-starter-blank-1783075370701`.
- Controls feedback showed `Input profile reset to defaults` and returned to
  compact player controls.
- Details and conversation panes collapsed and restored without losing the ROM
  player state.

Gate:

Native visible-button trust pass is complete for the available local paths.
Remaining work is now specifically valid-file ingestion and release policy:
valid user ROM import, valid user Play-core setup, size/error guardrails,
license, public core policy, signing, notarization, and CSP.

## 2026-07-03 - ITERATION 108 - native app freshness and file-picker trust

Plan:

- Task: continue the UI repair pass by proving the current native app is not a
  stale Phase 7 bundle, then verify native Import and Set Up Play paths.
- Files: `app/src/App.tsx`, `app/src/player/coreReadiness.ts`,
  `app/package.json`, `scripts/launch-drive16-native.sh`,
  `docs/phase8-ui-repair-slice5.md`, `PROGRESS.md`, `WORKLOG.md`,
  `README.md`, `docs/phase8-next-agent-handoff.md`,
  `docs/phase8-ui-optimization-checkpoint.md`, and
  `docs/ui-repair-control-map.md`.
- Verification: rebuild the native debug app bundle, inspect the desktop
  window, click through native Import Test ROM, Import ROM, Set Up Play, run
  frontend build, script syntax, smoke-script syntax, and diff hygiene.

Did:

- Found that macOS was reopening an old debug `.app` bundle with embedded
  Phase 7 UI even though the browser preview and source were current.
- Rebuilt the debug app bundle from the current frontend and confirmed the
  native window now shows the Phase 8 readiness hub.
- Added `scripts/launch-drive16-native.sh` plus an app package script so
  future native reviews rebuild and reopen the current debug `.app`.
- Verified `Import Test ROM` imports the repo-generated ROM, switches the
  player to Imported ROM, and captures proof.
- Verified `Import ROM` and `Set Up Play` open the macOS file picker and return
  visible feedback after cancel.
- Shortened missing Play-core copy so player/status surfaces do not turn into
  clipped paragraphs.

Evidence:

- `pnpm --dir app tauri build --debug --bundles app` passed and rebuilt
  `app/src-tauri/target/debug/bundle/macos/Drive16.app`.
- Native desktop inspection showed `Phase 8 readiness hub` in the rebuilt app.
- Native click-through verified:
  - `Import Test ROM` -> `Imported ROM` plus `Test ROM imported and proof
    captured`;
  - `Set Up Play` -> macOS Open dialog, then `Choose Play core`;
  - `Import ROM` -> macOS Open dialog, then `Choose ROM file`;
  - `Play ROM` without a core -> `Play setup needed` with concise setup copy.
- `pnpm --dir app build` passed.
- `bash -n scripts/launch-drive16-native.sh` passed.
- `node --check scripts/verify-phase6-browser-smoke.mjs` passed.
- `git diff --check` passed.
- `node scripts/verify-phase6-browser-smoke.mjs --url
  'http://127.0.0.1:1420/?core-status=dev-only' --out
  artifacts/phase8/browser-smoke-native-trust-20260703 --core-status dev-only`
  passed.

Gate:

Native file-picker open/cancel trust pass is complete. Valid user-core import
still requires a compatible local core file, and the broader visible-button
trust audit remains open for save/open/export and Settings detail paths.

## 2026-07-03 - ITERATION 107 - UI trust repair slice 4

Plan:

- Task: address the reported "OpenRouter says the ROM was built but nothing
  visibly happens" trust failure and reduce left-rail chat bloat.
- Files: `app/src/App.tsx`, `app/src/agent/openrouter.ts`,
  `app/src/player/coreReadiness.ts`, `app/src/styles.css`,
  `scripts/verify-phase6-browser-smoke.mjs`,
  `docs/phase8-ui-repair-slice4.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `README.md`.
- Verification: app build, browser rendered check, browser smoke with mocked
  OpenRouter overclaim, script syntax check, and diff hygiene.

Did:

- Added an app-side guard that blocks OpenRouter replies claiming local ROM
  build/proof/play completion without a local proof result.
- Tightened the OpenRouter system prompt to prohibit claims that it built,
  compiled, verified, exported, ran, or played a ROM.
- Made chat message cards denser.
- Changed missing interactive-Play copy toward `Set Up Play` and clarified
  that Verify still works without the interactive Play core.
- Updated the browser smoke to cover mocked model overclaims and repaired stale
  selectors from the older UI.

Evidence:

- `pnpm --dir app build` passed.
- `node --check scripts/verify-phase6-browser-smoke.mjs` passed.
- `git diff --check` passed.
- Browser preview rendered at `http://127.0.0.1:1420/?core-status=dev-only`
  with no console warnings or errors.
- Rendered style check confirmed compact chat card values: `10px` message
  padding and `13px` message body text.
- `node scripts/verify-phase6-browser-smoke.mjs --url
  'http://127.0.0.1:1420/?core-status=dev-only' --out
  artifacts/phase8/browser-smoke-ui-trust-20260703 --core-status dev-only`
  passed.

Gate:

Passed for browser-preview UI trust repair. Native OS file-picker click-through
for `Import ROM` and `Set Up Play` remains open.

## 2026-07-02 - ITERATION 106 - handoff checkpoint and publish prep

Plan:

- Task: document the current Phase 8 UI repair state so another agent can pick
  up from the exact pause point, then prepare the current progress for GitHub.
- Files: `docs/phase8-next-agent-handoff.md`, `README.md`, `PROGRESS.md`,
  `WORKLOG.md`, `docs/phase8-ui-optimization-checkpoint.md`, and
  `docs/post-v1-backlog.md`.
- Verification: app build, diff hygiene, and secret scan before commit/push.

Did:

- Added a next-agent handoff doc with current truth, verified checks, native
  gaps, release decisions, provider/secret rules, and the first resume slice.
- Linked the handoff from README and the progress ledger.
- Preserved the current next step: finish native file-picker click-through for
  `Import ROM` and `Choose Core` / `Set Up Play` before returning to feature
  work.

Evidence:

- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Strict repo secret scan found no actual OpenRouter key-shaped values.
- Staged diff hygiene check passed.
- Staged secret scan found no actual OpenRouter key-shaped values.

Gate:

No phase gate. This is a handoff and GitHub sync checkpoint.

## 2026-07-02 - ITERATION 105 - UI repair slice 3

Plan:

- Task: continue the UI/IA repair track by making the default desktop shell
  calmer and verifying normal-window behavior.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase8-ui-repair-slice3.md`, `docs/ui-repair-control-map.md`,
  `docs/phase8-ui-optimization-checkpoint.md`, `PROGRESS.md`, `WORKLOG.md`,
  and `README.md`.
- Verification: frontend build, diff hygiene, browser responsive checks, and
  browser interaction checks for chat, player feedback, Setup, Settings, and
  details expansion.

Did:

- Moved provider/session truth from the top of the conversation to a compact
  row above the composer.
- Defaulted ROM/tool details to collapsed so the player and controls are the
  default workspace.
- Compressed the player session strip to current ROM, Play, Input, and `More`.
- Moved Verify/core/controller/audio status behind the player `More`
  disclosure.
- Fixed normal-window wrapping in the composer session row and compact status
  summary.
- Recorded Slice 3 evidence and updated the UI repair checkpoint/control map.

Evidence:

- Browser checks at `1440x900`, `1180x780`, and `1040x740` found no horizontal
  overflow and no detected clipped visible button/message/session/status text.
- Sending `hey` with no session OpenRouter key rendered a normal `You` message
  and a `Drive16` setup reply, not a proof result.
- `Play ROM` showed browser-preview import-or-desktop feedback near the player.
- `Verify Right` completed with `Right proof passed` and appended a
  `Proof result`.
- `Show Details` expanded the ROM/tool inspector.
- `Setup` opened with Actions as the first visible section and readiness
  details collapsed.
- Agent Settings opened with secondary sections collapsed; switching to Ollama
  hid OpenRouter fields and changed the composer to `Ollama readiness only`.
- Browser console warning/error log was empty.
- `pnpm --dir app build` passed.
- `git diff --check` passed.

Gate:

Passed for browser-preview Slice 3. Direct native file-picker click-through
remains open for `Import ROM` and `Choose Core` / `Set Up Play`.

Pause:

- Native OS file-picker verification was started but deliberately stopped when
  the user needed the computer.
- The current native dev window had visually shown the Slice 3 UI before the
  native click-through attempt.
- A coordinate click was not trusted after macOS focus moved to another
  foreground app, so no native file-picker completion should be considered
  verified from that attempt.
- Resume with the remaining native-only checks: `Import ROM` and `Choose Core`
  / `Set Up Play`.

## 2026-07-02 - ITERATION 104 - UI repair slice 2

Plan:

- Task: continue the UI/IA repair track by verifying button trust and current
  native-window state.
- Files: `app/src/App.tsx`, `docs/ui-repair-control-map.md`,
  `docs/phase8-ui-repair-slice2.md`,
  `docs/phase8-ui-optimization-checkpoint.md`, `PROGRESS.md`, `WORKLOG.md`,
  and `README.md`.
- Verification: browser responsive checks, browser interaction checks, native
  current-window visual verification, frontend build, and diff hygiene.

Did:

- Fixed `Verify Right` so successful scripted proof returns the app header to
  `Ready` instead of staying stuck on `Verifying`.
- Changed browser-preview `Play ROM` feedback to explain that disk-backed ROMs
  need either a browser-session import or the desktop app.
- Added stable test hooks for Agent Settings, the composer mode label, and the
  settings panel.
- Expanded the control map with current actual action, feedback, and status.
- Found and stopped stale Drive16 windows that were still showing the old Phase
  7 UI, then relaunched the current Tauri dev app.
- Verified the current native desktop window shows the repaired Phase 8 shell.

Evidence:

- Browser checks at `1440x900`, `1180x780`, and `1040x740` found no horizontal
  overflow, no detected clipped button/message/status text, and correct
  `Drive16` / `You` / `Proof result` message identity.
- Browser interaction checks verified `Play ROM`, `Verify Right`, Agent
  Settings, OpenRouter/Ollama switching, Settings collapse defaults, and
  action-first Setup/project drawer behavior.
- Browser console warning/error log was empty after the interaction pass.
- Native window check verified the current raw dev process at `1440x900` and
  captured the Phase 8 repair UI in the desktop window.
- `pnpm --dir app build` passed.
- `git diff --check` passed.

Gate:

Passed for browser interaction and native visual verification. Direct native
file-picker click-through remains open for `Import ROM` and `Choose Core`.

## 2026-07-02 - ITERATION 103 - UI repair slice 1

Plan:

- Task: start the approved UI/IA repair track without adding backend features.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `docs/ui-repair-control-map.md`, `docs/phase8-ui-repair-slice1.md`,
  `docs/phase8-ui-optimization-checkpoint.md`, `PROGRESS.md`, `WORKLOG.md`,
  and `README.md`.
- Verification: frontend build, whitespace diff check, and rendered browser
  checks at realistic desktop window sizes.

Did:

- Added a visible-control map for primary shell, conversation, ROM workspace,
  project drawer, and settings controls.
- Separated normal chat, setup/gating replies, proof results, and OpenRouter
  model replies.
- Moved provider/session truth into the composer area so missing in-memory
  OpenRouter keys are visible where chat happens.
- Collapsed proof events and project files out of the main conversation rail.
- Reordered the project menu so actions come before readiness details.
- Collapsed Settings detail groups by default and hid irrelevant provider
  fields after switching providers.
- Reworked player/status rows so normal desktop windows do not destroy meaning
  through truncation.

Evidence:

- `pnpm --dir app build` passed.
- `git diff --check` passed.
- In-app browser checks at `1440x900`, `1100x760`, and `900x760` found no
  horizontal overflow, no detected meaning-destroying clipped text, and no
  console warnings/errors.
- Sending `hey` with no session OpenRouter key rendered a `You` message and a
  `Drive16` setup reply, not a false proof result.
- Project menu actions rendered before collapsed readiness details.
- Settings provider switching hid OpenRouter fields when Ollama was selected,
  and secondary sections were collapsed by default.

Gate:

Passed for browser-preview UI repair Slice 1. Native Tauri-window click-through
and the full every-visible-button trust audit remain open before the UI repair
track is complete.

## 2026-07-02 - ITERATION 102 - UI optimization planning checkpoint

Plan:

- Task: pause feature work, document the current Phase 8 state, and plan the
  UI/IA repair track before making further app changes.
- Files: `docs/phase8-ui-optimization-checkpoint.md`, `PROGRESS.md`, and
  `WORKLOG.md`.

Did:

- Added a checkpoint doc with the verified Phase 8 state and the unresolved
  decisions to return to after UI repair.
- Recorded the user-observed UI problems: confusing chat/proof identity,
  provider/key state confusion, poor normal-window scaling, excessive menu
  sprawl, truncated status chips, and scattered control feedback.
- Marked the next work as a UI/IA repair track rather than another feature
  phase.

Gate:

Planning only. No UI implementation started in this iteration.

## 2026-07-02 - ITERATION 101 - Phase 8 readiness / first-run hub

Plan:

- Task: implement the approved Phase 8 Slice 2 readiness / first-run truth hub.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `scripts/verify-phase6-browser-smoke.mjs`, `README.md`, `PROGRESS.md`,
  `WORKLOG.md`, `DECISIONS.md`, `docs/post-v1-backlog.md`,
  `docs/review/README.md`, and `docs/phase8-readiness-hub.md`.
- Verification: frontend build, native checks, full browser loop, and secret
  hygiene.

Did:

- Added a top-level `Setup` action that opens the project menu.
- Added a compact readiness hub to the project menu.
- Consolidated ROM proof, interactive Play core, OpenRouter chat, Ollama
  readiness-only status, OpenCode/local tools, ComfyUI sprites, MML music, and
  release blockers into one first-run surface.
- Kept release blockers visible without changing license, packaging, CSP,
  signing, public core policy, or emulator-core distribution.
- Extended the browser smoke to open the hub, assert required statuses and
  release blockers, and check mobile-width hub overflow.

Evidence so far:

- `pnpm --dir app build` passed.
- `node --check scripts/verify-phase6-browser-smoke.mjs` passed.
- In-app Browser rendered check passed: `Setup` opened the readiness hub,
  required status labels were visible, no horizontal overflow was reported in
  the checked viewport, and console warnings/errors were `0`.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 51 passed,
  0 failed, 4 ignored.
- `scripts/verify-phase6-loop.sh --browser` passed with evidence under
  `artifacts/phase6/verify-loop/20260702-152451`.
- Explicit secret scan found no `sk-or-v1-` key pattern.
- Tracked artifact scan found no tracked `.wasm`, `.zip`, `.safetensors`,
  `.ckpt`, `.bin`, `.gen`, or `.smd` files.

Gate:

Passed for Phase 8 Slice 2.

## 2026-07-02 - ITERATION 100 - Phase 8 OpenRouter freeform replies

Plan:

- Task: implement the approved Phase 8 Slice 1 loop for real OpenRouter
  freeform replies.
- Files: `app/src/App.tsx`, `app/src/agent/openrouter.ts`,
  `scripts/verify-phase6-browser-smoke.mjs`, `README.md`, `PROGRESS.md`,
  `WORKLOG.md`, `DECISIONS.md`, `docs/post-v1-backlog.md`, and
  `docs/phase8-openrouter-freeform-replies.md`.
- Verification: frontend build, browser smoke for no-key gate/mocked reply/CORE
  route, native checks, full browser loop, live one-shot OpenRouter test, and
  secret hygiene.

Did:

- Added a small OpenRouter chat-completions client.
- Set `deepseek/deepseek-chat-v3.1` as the default OpenRouter model for the
  first live-reply slice.
- Wired tested OpenRouter freeform prompts to produce real non-streaming model
  replies.
- Kept the CORE sprite/music prompt on the local proof path.
- Kept Ollama generation out of scope with truthful paused copy.
- Made OpenCode no-reply logging best-effort so it does not block live hosted
  replies.
- Extended browser smoke to cover no-key gate, mocked OpenRouter reply, and
  CORE prompt routing.

Evidence so far:

- `pnpm --dir app build` passed.
- `node --check scripts/verify-phase6-browser-smoke.mjs` passed.
- Focused browser smoke passed with evidence under
  `artifacts/phase8/browser-smoke-openrouter-missing-core`.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 51 passed,
  0 failed, 4 ignored.
- Full Phase 6 browser loop passed after the Phase 8 label fix with evidence
  under `artifacts/phase6/verify-loop/20260702-143052`.
- Live OpenRouter one-shot passed on `deepseek/deepseek-chat-v3.1` with reply
  `drive16-phase8-live-ok` and 34 total tokens. The temporary key was supplied
  through a silent stdin prompt and was not written to repo files or artifacts.
- Headless app-level live OpenRouter test passed: Agent Settings accepted the
  temporary key, conversation mode switched to `OpenRouter live`, the rendered
  model reply was `drive16-app-live-ok`, and console errors were `0`.
- Secret scan found no `sk-or-v1-` key pattern in tracked files or generated
  artifacts.
- In-app browser sanity check showed `Phase 8 OpenRouter replies`, DeepSeek
  V3.1, no framework overlay, and no console warnings/errors.

Gate:

Passed for Phase 8 Slice 1.

## 2026-07-02 - ITERATION 99 - Fable audit ingestion

Plan:

- Task: incorporate the returned Fable 5 product audit into Drive16's review
  record and compare its recommendations against the repo before choosing the
  next implementation loop.
- Files: `docs/review`, `docs/post-v1-backlog.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: spot-check the audit's major claims against the current code
  and run docs whitespace hygiene.

Did:

- Added a review-packet index at `docs/review/README.md`.
- Recorded the Fable audit as a decision-support document, not an approved
  implementation plan.
- Updated the post-v1 backlog to show the audit-backed candidate next slice:
  OpenRouter-only live freeform replies with the local proof path untouched.
- Updated `PROGRESS.md` so the current state reflects audit review instead of
  implying controller mapping is still the active implementation slice.
- Independently checked the major audit claims: freeform chat is still
  gated/no-reply, the dev CDN core fallback is gated to development builds,
  bundling remains disabled, CSP is null, and no `LICENSE` file exists while
  Cargo declares MIT.

Evidence:

- `git diff --check` passed after the documentation updates.

Gate:

Ready for human discussion. No implementation decision has been made yet.

## 2026-07-02 - ITERATION 98 - Brand icon and header mark

Plan:

- Task: incorporate the generated Drive16 image set into the desktop icon,
  browser favicon, and in-app header.
- Files: `app/src/assets/brand`, `app/public`, `app/src-tauri/icons`,
  `app/src/App.tsx`, `app/src/styles.css`, `app/index.html`,
  `app/src-tauri/tauri.conf.json`, `DECISIONS.md`, and `WORKLOG.md`.
- Verification: frontend build and visual check of the header mark.

Did:

- Rebuilt the app icon as a black-backed orange D16 cartridge mark with real
  transparency outside the trimmed logo shape.
- Used the same D16 cartridge mark as the in-app toolbar logo.
- Kept the Drive16 wordmark as real text instead of using the generated bitmap
  wordmark.
- Generated the Tauri icon set, browser favicon, and React brand assets from
  the corrected black/orange mark.

Evidence:

- `pnpm --dir app build` passed.
- `pnpm --dir app tauri build --debug --bundles app --no-sign` passed and
  produced `app/src-tauri/target/debug/bundle/macos/Drive16.app`.
- Browser render check showed the new header mark, new favicon path, no
  console errors, and no horizontal overflow.

Gate:

Passed for the brand asset refresh.

## 2026-07-01 - ITERATION 97 - Phase 7 input profiles and controller mapping

Plan:

- Task: implement the Phase 7 Slice 3 Controls/Input surface, local input
  profile, and controller-ready mapping path.
- Files: `app/src/App.tsx`, `app/src/player`, `app/src/styles.css`,
  `scripts/verify-phase6-browser-smoke.mjs`, `README.md`, `PROGRESS.md`,
  `DECISIONS.md`, `scripts/README.md`, `docs/phase6-controller-foundation.md`,
  `docs/phase7-input-profiles.md`, `docs/phase7-user-core-flow.md`, and
  `docs/post-v1-backlog.md`.
- Verification: frontend build, native format/tests, user-core browser smoke,
  missing-core browser smoke, and git hygiene.

Did:

- Added a shared input profile for keyboard and controller bindings.
- Kept the default keyboard controls visible: arrows, `Z`, `X`, `C`, Enter.
- Persisted the profile in localStorage and added Reset defaults.
- Added a compact Controls panel beside Play/Verify, not inside Agent
  Settings.
- Added Gamepad API/controller detection with truthful readiness labels.
- Wired detected standard-gamepad button/D-pad transitions into the same player
  action path used by keyboard input.
- Extended browser smoke to verify default mappings, Controls open/close,
  Reset defaults persistence, and no-controller truthfulness.

Evidence:

- `pnpm --dir app build` passed.
- `cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 51 passed,
  4 ignored.
- User-core browser smoke passed with evidence under
  `artifacts/phase7/browser-smoke-input-profile-user-core`.
- Missing-core browser smoke passed with evidence under
  `artifacts/phase7/browser-smoke-input-profile-missing-core`.

Gate:

Passed for Phase 7 Slice 3.

Next:

- Decide whether the next player slice should be a full remapping editor,
  multi-controller handling, packaged controller QA, or a different post-v1
  product area.

## 2026-07-01 - ITERATION 96 - Phase 7 user-supplied core flow

Plan:

- Task: implement the Phase 7 Slice 2 user-supplied interactive core setup
  flow.
- Files: `app/src/App.tsx`, `app/src/player`, `app/src-tauri/src`,
  `app/package.json`, `scripts/check-interactive-play-core.mjs`,
  `scripts/verify-phase6-browser-smoke.mjs`, `README.md`, `PROGRESS.md`,
  `DECISIONS.md`, `scripts/README.md`, and `docs/phase7-user-core-flow.md`.
- Verification: frontend build, native project tests, core checker, user-core
  browser smoke, missing-core browser smoke, and git hygiene.

Did:

- Added `Set Up Play` / `Choose Core` as a project/player action.
- Accepted compatible `.zip` archives or `.js + .wasm` pairs for the Genesis
  RetroArch/libretro Emscripten core.
- Stored normalized user core files under ignored
  `artifacts/phase7/interactive-core`.
- Added Tauri commands and tests for core status, import, and readback.
- Made `Play ROM` prefer the user-supplied core and use the dev CDN only as a
  development fallback.
- Extended the core checker to report local core presence/readability, tracked
  core-binary hygiene, and Verify availability.
- Extended browser smoke so it can import a real user core ZIP and prove Play
  uses it.

Evidence:

- `pnpm --dir app build` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml project::` passed.
- `scripts/check-interactive-play-core.mjs --online` passed.
- User-core browser smoke passed with evidence under
  `artifacts/phase7/browser-smoke-user-core`.
- Missing-core browser smoke passed with evidence under
  `artifacts/phase7/browser-smoke-missing-core`.

Gate:

Passed for Phase 7 Slice 2.

Next:

- Controller mapping and persistent input configuration are the next logical
  player slice.

## 2026-07-01 - ITERATION 95 - Phase 7 interactive core policy

Plan:

- Task: make interactive Play core distribution explicit after Product V1.
- Files: `app/src/player`, `app/src/App.tsx`, `app/src/styles.css`,
  `scripts/check-interactive-play-core.mjs`,
  `scripts/verify-phase6-browser-smoke.mjs`, `README.md`, `PROGRESS.md`,
  `DECISIONS.md`, `scripts/README.md`, and
  `docs/phase7-interactive-core-distribution.md`.
- Verification: wrapper/core policy check, Play-ready browser smoke,
  missing-core browser smoke, frontend build, and git hygiene.

Did:

- Chose the Phase 7 Slice 1 posture: current interactive Play is a
  local-development `Dev CDN` adapter through Nostalgist/RetroArch, not a
  bundled release-settled Genesis core.
- Added a shared readiness contract for `available`, `dev-only`, `missing`,
  `needs-user-action`, and `unsupported`.
- Added a ROM-control readiness pill and an `Interactive Play` item in Tools.
- Kept Genteel as Verify/Capture Proof when Play setup is missing.
- Added a local setup/check script and a browser smoke core-status override.

Evidence:

- `docs/phase7-interactive-core-distribution.md`.
- `scripts/check-interactive-play-core.mjs` passed.
- `pnpm --dir app build` passed.
- `scripts/verify-phase6-loop.sh --browser` passed with evidence under
  `artifacts/phase6/verify-loop/20260701-135734`.
- `scripts/verify-phase6-browser-smoke.mjs --core-status dev-only` passed with
  evidence under `artifacts/phase7/core-readiness/dev-only-final`.
- `scripts/verify-phase6-browser-smoke.mjs --core-status missing` passed with
  evidence under `artifacts/phase7/core-readiness/missing-final`.
- Native spot-check found `Play ready`, `Dev CDN`, `Interactive Play`, and
  Verify/Genteel setup hints in the desktop app.

Gate:

Passed for the first Phase 7 slice.

Next:

- Decide whether the next post-v1 slice should be user-supplied core selection,
  controller mapping, or live freeform agent replies.

## 2026-07-01 - ITERATION 94 - Product V1 release handoff

Plan:

- Task: prepare the Product V1 closure set for publishing to `main` and choose
  the first post-v1 slice.
- Files: `README.md`, `PROGRESS.md`, `WORKLOG.md`,
  `docs/post-v1-backlog.md`, and the Product V1 closure files already updated.
- Verification: final git hygiene, native app review pass, commit, and push.

Did:

- Selected emulator/core distribution policy as the first post-v1 slice.
- Kept Genteel as the Verify/Capture Proof boundary for that slice.
- Prepared the Product V1 closure changes for commit and push to `main`.

Evidence:

- Product V1 closure evidence remains in `docs/product-v1-evidence.md`.
- Post-v1 selection is recorded in `docs/post-v1-backlog.md`.

Gate:

Ready to commit and push `main`.

Next:

- Commit and push Product V1 closure.

## 2026-07-01 - ITERATION 93 - Product V1 lifecycle and native Play proof

Plan:

- Task: tighten active-project lifecycle behavior and close the native
  generated-ROM Play evidence gap.
- Files: `app/src/App.tsx`, `app/src-tauri/src/main.rs`,
  `app/src-tauri/src/project.rs`, `scripts/verify-phase6-browser-smoke.mjs`,
  `docs/product-v1-evidence.md`, `docs/phase6-evidence.md`, `PROGRESS.md`,
  and `WORKLOG.md`.
- Verification: frontend build, native format check, native test suite,
  browser verification loop, generated CORE proof loop, in-app browser
  rendered check, and native Tauri click-through.

Did:

- Save Project now snapshots the active repo-local project path instead of
  always saving the starter project.
- Open Project now restores the saved snapshot as the active project summary.
- Verify and Export now use the active ROM source rather than silently falling
  back to the original starter path.
- Browser smoke now covers New Project, Save, Open, Import, Play, keyboard
  Right, Pause/Resume/Reset/Stop, Verify, Export, and mobile overflow.
- Native Tauri generated-ROM Play was clicked through from the visible app:
  prompt, `Play ROM`, ArrowRight, Pause, Resume, Reset, and Stop.

Evidence:

- `scripts/verify-phase6-loop.sh --browser` passed with evidence under
  `artifacts/phase6/verify-loop/20260701-131904`.
- `scripts/verify-phase6-loop.sh --no-browser --with-v1-proof` passed with
  evidence under `artifacts/phase6/verify-loop/20260701-131922`.
- Native generated-ROM screenshots are under
  `artifacts/product-v1/native-click-through/20260701-1324`.
- In-app browser rendered check passed: correct URL/title, no console
  warnings/errors, no horizontal overflow, and Play/Verify/menu controls
  present.

Provider evidence:

- Missing-provider path showed `ROM proof only` and freeform replies paused.
- Configured OpenRouter path reported `Connected` and `OpenRouter key accepted`
  in Agent Settings.
- Browser preview was reloaded after the provider test so the pasted key did
  not remain in transient app state.

Gate:

Product V1 closure is complete for the local review scope. Remaining work is
separated in `docs/post-v1-backlog.md`.

Next:

- Review Product V1 locally, then choose a post-v1 slice.

## 2026-07-01 - ITERATION 92 - Product V1 closure docs

Plan:

- Task: update internal documentation so the next loop targets Product V1
  closure instead of implying the earlier CORE proof is the whole product.
- Files: `README.md`, `PROGRESS.md`, `docs/product-v1-evidence.md`,
  `docs/phase6-to-product-v1-goal.md`, and `WORKLOG.md`.
- Verification: documentation consistency review and whitespace check.

Did:

- Added the Product V1 evidence packet.
- Updated the README to separate the completed CORE proof from open Product V1
  closure work.
- Pointed PROGRESS at the Product V1 evidence packet.
- Added working files to the Product V1 goal loop so future runs know where to
  record status.

Evidence:

- `docs/product-v1-evidence.md`.
- `docs/phase6-to-product-v1-goal.md`.

Gate:

Product V1 remains open. The first blocker remains the native generated-ROM
`Play ROM` click-through.

Next:

- Run the Product V1 closure loop and record pass/fail evidence.

## 2026-06-30 - ITERATION 91 - Phase 6 evidence packet

Plan:

- Task: assemble Phase 6 evidence without overclaiming native-window automation.
- Files: `docs/phase6-evidence.md`, `PROGRESS.md`, `README.md`, and
  `WORKLOG.md`.
- Verification: tracked-file hygiene scan, branch parity, and evidence review.

Did:

- Added the Phase 6 evidence packet.
- Recorded imported-ROM player smoke, generated CORE fixture smoke, keyboard
  input, player controls, and command verification.
- Recorded the native-window click-through as the remaining human review item.
- Confirmed `main` matched `origin/main` before this evidence commit.
- Confirmed tracked files did not include Genesis cores, WASM cores, model
  weights, OpenRouter keys, or obvious secrets.

Evidence:

- `docs/phase6-evidence.md`.

Gate:

Phase 6 is ready for human review, but not marked fully complete until the
native-window click-through passes.

Next:

- Human-review native Drive16 window: generated CORE ROM -> Play ROM ->
  ArrowRight -> Pause/Resume/Stop.

## 2026-06-30 - ITERATION 90 - Phase 6 generated ROM play check

Plan:

- Task: verify that a generated Drive16 ROM artifact can use the same embedded
  player path.
- Files: `docs/phase6-generated-rom-play.md`, `PROGRESS.md`, `README.md`, and
  `WORKLOG.md`.
- Verification: run the ignored V1/CORE proof harness explicitly and play the
  generated CORE ROM fixture in the embedded player.

Did:

- Ran the V1/CORE generated ROM proof harness explicitly.
- Confirmed the proof harness passed and git stayed clean afterward.
- Played `examples/phase2-core-assets/out/rom.bin` through the embedded player.
- Confirmed ArrowRight input, Stop feedback, and zero console warnings/errors.
- Documented that direct native-window click automation is blocked by missing
  macOS Accessibility permission for the shell process.

Evidence:

- `docs/phase6-generated-rom-play.md`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture` passed.
- Browser player smoke for the generated CORE fixture passed with zero console
  warnings/errors.

Gate:

Generated ROM artifacts are wired into the same player path in code, and the
generated CORE fixture plays through the embedded player. Final Phase 6
regression should still include a native-window click-through when available.

Next:

- Run final Phase 6 regression and assemble the evidence packet.

## 2026-06-30 - ITERATION 89 - Phase 6 embedded player adapter

Plan:

- Task: turn the prepared active-ROM payload into a real embedded interactive
  player without crowding the ROM viewport or blurring Play versus Verify.
- Files: `app/src/player/nostalgist.ts`, `app/src/App.tsx`,
  `app/src/styles.css`, `app/index.html`, `app/package.json`,
  `app/pnpm-lock.yaml`, Phase 6 evidence docs, `PROGRESS.md`, `README.md`,
  `DECISIONS.md`, and `WORKLOG.md`.
- Verification: frontend build, browser import/play smoke, keyboard input,
  pause/resume/reset/stop controls, and console check.

Did:

- Added `nostalgist@0.21.1`.
- Added a Nostalgist/RetroArch adapter behind the Drive16 player boundary.
- Embedded the interactive player canvas inside the existing ROM viewport.
- Wired imported ROM bytes into the player launch path.
- Sent keyboard down/up events into the running adapter.
- Added compact Pause/Resume, Reset, and Stop controls that only appear while a
  player runtime exists.
- Kept audio labeled as gated and controller support labeled as future.
- Added a favicon data URL to avoid false browser 404 noise in QA.

Evidence:

- `docs/phase6-interactive-player-adapter.md`.
- `docs/phase6-keyboard-input.md`.
- `docs/phase6-player-controls.md`.
- `docs/phase6-audio.md`.
- `docs/phase6-controller-foundation.md`.
- `pnpm --dir app build` passed.
- Browser QA imported `examples/app-starter-blank/out/rom.bin`, clicked
  `Play ROM`, confirmed `Interactive player started`, sent ArrowRight, paused,
  resumed, stopped, and ended with zero console warnings/errors.

Gate:

Imported-ROM interactive play is working in browser preview. Phase 6 remains
open until generated-ROM play, native app verification, and the final
regression/evidence pass are complete.

Next:

- Verify a Drive16-generated ROM artifact through the same player path.
- Run the native Tauri app path against the embedded player.
- Assemble final Phase 6 evidence after the generated-ROM play path passes.

## 2026-06-30 - ITERATION 88 - Phase 6 interactive loading prep

Plan:

- Task: start wiring active ROMs into the interactive player path without
  overclaiming playback before a core is configured.
- Files: `app/src-tauri/src/project.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase6-interactive-loading.md`, `PROGRESS.md`, `README.md`, and
  `WORKLOG.md`.
- Verification: native tests, frontend build, browser Play feedback check, and
  diff whitespace check.

Did:

- Added native `read_rom_bytes` for safe repo-local ROM byte reads.
- Added tests for successful ROM reads, outside-repo rejection, and
  unsupported-extension rejection.
- Added `Play ROM` to the ROM controls.
- Preserved imported file bytes as a temporary player blob in the browser
  session.
- Wired desktop Play prep to native `read_rom_bytes`.
- Added visible `Player core needed` and `Play setup failed` feedback states.

Evidence:

- `docs/phase6-interactive-loading.md`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 44 passed
  and 4 ignored.
- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser QA confirmed `Play ROM` exists and reports an honest preview read
  failure without console warnings/errors.

Gate:

Phase 6 Unit 4 is partially complete. Active ROM payload prep is wired, but
live interactive playback still requires the configured emulator core adapter.

Next:

- Configure the player adapter core and pass the prepared ROM blob URL into it.

## 2026-06-30 - ITERATION 87 - Phase 6 UI language cleanup

Plan:

- Task: clean up UI language so Play is reserved for interactive sessions and
  the current Genteel path is labeled Verify/Proof.
- Files: `app/src/App.tsx`, `docs/phase6-ui-language.md`, `PROGRESS.md`,
  `README.md`, and `WORKLOG.md`.
- Verification: frontend build, browser label checks, keyboard focus check, and
  diff whitespace check.

Did:

- Changed the top ROM action from Run to Verify.
- Changed the phase label to Phase 6 player.
- Changed the right pane from Live ROM to ROM Player.
- Changed captured-frame toolbar labels to proof-preview and capture language.
- Changed the scripted movement proof action to Verify Right.
- Updated prompt/action messages so they say proof preview or captured proof
  when the app is using Genteel.

Evidence:

- `docs/phase6-ui-language.md`.
- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser QA at `http://127.0.0.1:1420/` confirmed:
  - one `verify-rom` control with visible text `Verify`,
  - `Phase 6 player`, `ROM Player`, and `Proof preview` present,
  - old visible labels absent,
  - zero console warnings/errors,
  - keyboard focus still updates last input and the player-session strip.

Gate:

Phase 6 Unit 3 is complete. Phase 6 remains open.

Next:

- Wire imported ROMs into the interactive player adapter path.

## 2026-06-30 - ITERATION 86 - Phase 6 player architecture

Plan:

- Task: add the player architecture boundary before integrating a live emulator
  core.
- Files: `app/src/App.tsx`, `app/src/styles.css`, `app/src/player/*`,
  `docs/phase6-player-architecture.md`, `PROGRESS.md`, `README.md`, and
  `WORKLOG.md`.
- Verification: TypeScript/Vite build and diff whitespace check.

Did:

- Added player types for active ROM source, provider state, player session
  state, audio state, input action, and input focus/readiness.
- Added a shared keyboard input map for D-pad, A/B/C, and Start.
- Derived the active ROM source from starter, imported, or generated ROM state.
- Added a compact player-session strip above the ROM viewport.
- Kept the future interactive player provider separate from the existing
  Genteel proof path.

Evidence:

- `docs/phase6-player-architecture.md`.
- `pnpm --dir app build` passed after the player model integration.
- `git diff --check` passed.
- Browser QA at `http://127.0.0.1:1420/` confirmed:
  - page title `Drive16`,
  - one `interactive-player-session` strip,
  - zero console warnings/errors,
  - keyboard focus changed the strip to `Keyboard captured`,
  - Z key updated last input to `A`.

Gate:

Phase 6 Unit 2 is complete. Phase 6 remains open.

Next:

- Clean up UI language so Play and Verify/Capture Proof are distinct.

## 2026-06-30 - ITERATION 85 - Phase 6 emulator core selection

Plan:

- Task: start Phase 6 by evaluating embedded Genesis player options and
  recording a licensing-safe direction before UI or runtime integration.
- Files: `docs/phase6-emulator-core-selection.md`, `DECISIONS.md`,
  `PROGRESS.md`, `README.md`, and `WORKLOG.md`.
- Verification: inspect candidate package metadata and current project ledgers.

Did:

- Read the Phase 6 objective from the attached goal prompt.
- Inspected the current clean `main` worktree and Phase 5 evidence state.
- Reviewed Nostalgist, EmulatorJS, romdevtools, retroemu, and direct Genteel
  options.
- Selected an adapter-based player direction with Nostalgist/RetroArch as the
  first browser adapter target.
- Kept Genesis core binaries out of git and documented the unresolved
  non-commercial/copyleft core-license boundary.
- Updated the phase ledger from Phase 5 review to Phase 6 active work.

Evidence:

- `nostalgist@0.21.1` package metadata reports MIT and its README describes
  browser emulation including Sega Genesis.
- Nostalgist package declarations expose `Nostalgist.megadrive(...)` and note
  the default `genesis_plus_gx` core.
- `romdev-core-gpgx@0.12.0` metadata reports Genesis Plus GX as
  non-commercial.
- `@emulatorjs/emulatorjs@4.2.3` metadata reports GPL-3.0.
- `retroemu@0.3.0` metadata reports MIT and documents keyboard/controller
  concepts, but as a terminal/native player rather than an embedded Drive16
  webview.

Gate:

Phase 6 Unit 1 is complete. Phase 6 remains open.

Next:

- Add the player architecture boundary and active ROM source model.

## 2026-06-30 - ITERATION 84 - Phase 5 evidence packet

Plan:

- Task: assemble the Phase 5 evidence packet for human review.
- Files: `docs/phase5-evidence.md`, `PROGRESS.md`, `README.md`, and
  `WORKLOG.md`.
- Verification: confirm Phase 5 evidence index, run final build/test checks,
  and ensure docs are ready for review.

Did:

- Added a single Phase 5 evidence packet that links Units 1 through 9.
- Summarized current behavior, local validation, verification commands, git and
  artifact hygiene, exit criteria, and review notes.
- Marked the Phase 5 evidence checklist item complete.
- Updated README to point to human review as the next step.

Evidence:

- Phase 5 evidence packet: `docs/phase5-evidence.md`.
- Unit evidence docs remain linked from the packet.
- Phase 5 is ready for human review with documented caveats for live freeform
  model replies and full manual controller input.

Gate:

Phase 5 implementation work is complete enough for human review.

Next:

- Human review and sign-off, or a focused Phase 5 patch pass if review finds
  issues.

## 2026-06-30 - ITERATION 83 - Phase 5 local path validation

Plan:

- Task: implement Phase 5 Unit 9 by validating and documenting the local
  Ollama plus local ComfyUI setup path without mixing it with OpenRouter BYOK.
- Files: `DECISIONS.md`, `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-local-path-validation.md`.
- Verification: check local Ollama HTTP readiness, installed Ollama models,
  local ComfyUI API readiness, ComfyUI model/checkpoint state, and setup docs.

Did:

- Checked Ollama CLI and HTTP readiness.
- Checked whether the app default Ollama model is installed.
- Checked local ComfyUI API endpoints.
- Ran the Phase 4 ComfyUI readiness script.
- Updated README with separate setup paths for OpenRouter, Ollama, and ComfyUI.
- Recorded exact current blockers and next actions.

Evidence:

- `ollama --version` found `/usr/local/bin/ollama` and reported client
  `0.30.10`.
- `ollama list` reported 15 installed models.
- `http://127.0.0.1:11434/api/tags` became reachable and reported 15 models.
- The app default `qwen2.5-coder:7b` was not installed.
- `ollama ps` reported no running model.
- `http://127.0.0.1:8188/system_stats` was not reachable.
- `http://127.0.0.1:8188/object_info` was not reachable.
- `scripts/check-phase4-comfyui-readiness.py` reported:
  - API connection refused.
  - Workflow classes could not be inspected.
  - SDXL base checkpoint present.
  - Pixel Art XL LoRA present.
  - Pixydust Quantizer present.

Gate:

Phase 5 Unit 9 is complete. Phase 5 remains open.

Next:

- Assemble the Phase 5 evidence packet for human review.

## 2026-06-30 - ITERATION 82 - Phase 5 action feedback polish

Plan:

- Task: implement Phase 5 Unit 8 so Run, Save, Export, and Import feedback is
  visible near the ROM viewport.
- Files: `app/src/App.tsx`, `app/src/styles.css`, `DECISIONS.md`,
  `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-action-feedback.md`.
- Verification: build frontend, run native tests, click Run, Save, Export, and
  Import Test ROM in browser preview, and inspect the near-ROM feedback strip.

Did:

- Added a computed action feedback model for Running, Saving, Exporting,
  Importing, Ready, and Error states.
- Added a ROM action feedback strip below the controls.
- Added compact chips for the active imported ROM path, latest save snapshot,
  and latest export path.
- Tuned feedback strip wrapping for narrow layouts.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 41 tests
  and 4 live-environment tests ignored.
- `pnpm --dir app build` passed.
- Browser proof at `http://127.0.0.1:1420/`:
  - Initial feedback showed `Ready` and the starter ROM run detail.
  - Clicking Run updated feedback to the current starter ROM run detail.
  - Clicking Save added `artifacts/phase3/projects/drive16-starter-preview`.
  - Clicking Export added `artifacts/phase3/exports/drive16-starter-preview.bin`.
  - Clicking Import Test ROM added
    `artifacts/phase5/imports/drive16-import-preview-starter-test-rom.bin`.
  - Project menu status still showed the full imported ROM copy detail.

Gate:

Phase 5 Unit 8 is complete. Phase 5 remains open.

Next:

- Unit 9: validate and document the fully local Ollama plus local ComfyUI path.

## 2026-06-30 - ITERATION 81 - Phase 5 enhancement readiness clarity

Plan:

- Task: implement Phase 5 Unit 7 so AI sprites and MML music show explicit
  readiness states and next actions.
- Files: `app/src/App.tsx`, `app/src/styles.css`, `DECISIONS.md`,
  `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-enhancement-readiness.md`.
- Verification: build frontend, run native tests, open settings, inspect
  disabled states, toggle MML music, toggle AI sprites, and run the ComfyUI
  test path in browser preview.

Did:

- Added enhancement readiness state helpers for Disabled, Needs setup, Ready,
  Running, and Failed.
- Replaced AI sprites `On/Off` summary with explicit readiness labels.
- Added an AI sprite readiness row with detail and next action.
- Added checkpoint and LoRA summary rows above the ComfyUI config fields.
- Replaced MML music `On/Off` summary with Disabled or Ready.
- Added an MML readiness row that explains the generated-MML prompt path.
- Added styling for readiness badges, rows, and model summary text.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 41 tests
  and 4 live-environment tests ignored.
- `pnpm --dir app build` passed.
- Browser proof at `http://127.0.0.1:1420/`:
  - AI sprites initially showed `Disabled` with `AI sprites are intentionally
    off`.
  - MML music initially showed `Disabled` with `MML generation is intentionally
    off`.
  - Toggling MML music changed readiness to `Ready`.
  - Toggling AI sprites changed readiness to `Needs setup`.
  - AI sprites showed checkpoint `sd_xl_base_1.0.safetensors` and LoRA
    `pixel-art-xl.safetensors`.
  - Running the browser ComfyUI test changed AI sprites to `Failed` with
    `ComfyUI check failed: Failed to fetch` and a next action to check setup
    and run Test again.

Gate:

Phase 5 Unit 7 is complete. Phase 5 remains open.

Next:

- Unit 8: improve Run, Save, Export, Import, and tool-health feedback.

## 2026-06-30 - ITERATION 80 - Phase 5 ROM-first layout

Plan:

- Task: implement Phase 5 Unit 6 so the ROM viewport can take priority without
  permanently crowding it with conversation and tool panels.
- Files: `app/src/App.tsx`, `app/src/styles.css`, `DECISIONS.md`,
  `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-rom-first-layout.md`.
- Verification: build frontend, run native tests, click conversation/status
  collapse controls, check focused mode, restore panels, and test a narrow
  viewport for overflow.

Did:

- Added emulator-toolbar controls to hide/show the conversation rail.
- Added emulator-toolbar controls to hide/show ROM detail panels.
- Added a compact status strip with current ROM and tool summary when details
  are collapsed or focused mode is active.
- Tuned focused/status-collapsed layout so the ROM viewport gets more vertical
  room.
- Preserved full status cards behind a one-click `Show Details` restore.
- Added responsive wrapping for compact status and ROM controls.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 41 tests
  and 4 live-environment tests ignored.
- `pnpm --dir app build` passed.
- Browser proof at `http://127.0.0.1:1420/`:
  - Clicking `Hide conversation pane` set left pane display to `none`.
  - Clicking `Hide ROM details` hid the status grid and showed compact status.
  - Compact status included the ROM path, tool summary, and `Show Details`.
  - Focused emulator mode kept compact status visible and hid full status
    cards.
  - `Show Details` restored the full status grid and exited focused mode.
  - `Show conversation pane` restored the left pane.
- Narrow viewport check at 390x760:
  - ROM controls wrapped.
  - No horizontal overflow was detected.

Gate:

Phase 5 Unit 6 is complete. Phase 5 remains open.

Next:

- Unit 7: clarify AI sprites and MML music readiness states.

## 2026-06-30 - ITERATION 79 - Phase 5 ROM controls and input mapping

Plan:

- Task: implement Phase 5 Unit 5 so the ROM viewport has visible controls,
  keyboard mapping, focus state, and an honest tested input path.
- Files: `app/src/App.tsx`, `app/src/styles.css`, `DECISIONS.md`,
  `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-rom-controls.md`.
- Verification: build frontend, run native tests, click the ROM viewport,
  press mapped keys in the browser preview, click the Right proof action, and
  run the native CORE Right-input proof test through Genteel.

Did:

- Added a ROM controls strip below the emulator viewport.
- Added visible keyboard mapping for Arrows, Z, X, C, and Enter.
- Made the ROM viewport focusable with `Click ROM to control` and
  `Input focused` states.
- Captured local key events and wrote the latest local input into the controls
  strip and event feed.
- Added `Run Right Proof`, which reuses the existing CORE prompt proof path
  instead of claiming full live manual controller support.
- Cleared imported-ROM active state when a generated CORE proof becomes the
  active ROM.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 41 tests
  and 4 live-environment tests ignored.
- `pnpm --dir app build` passed.
- Browser proof at `http://127.0.0.1:1420/`:
  - ROM controls rendered under the viewport.
  - Clicking the viewport changed controls to `Input focused`.
  - Pressing ArrowRight logged `input.local.right` and updated local input.
  - Pressing Z logged `input.local.a` and updated local input.
  - Clicking `Run Right Proof` changed last input to `Right proof passed`.
  - Runtime metadata showed `Right input verified` and non-silent audio.
- Native scripted proof:
  - `cargo test --manifest-path app/src-tauri/Cargo.toml
    v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored
    --nocapture` passed.

Gate:

Phase 5 Unit 5 is complete. Phase 5 remains open.

Next:

- Unit 6: add collapsible or resizable ROM-first layout.

## 2026-06-30 - ITERATION 78 - Phase 5 imported ROM flow

Plan:

- Task: implement Phase 5 Unit 4 so local Genesis ROM imports become an active
  app state instead of a prepared folder.
- Files: `app/src/App.tsx`, `app/src-tauri/src/main.rs`,
  `app/src-tauri/src/project.rs`, `app/src-tauri/src/starter_rom.rs`,
  `DECISIONS.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `docs/phase5-rom-import-flow.md`.
- Verification: run native tests, build the frontend, import the repo-generated
  starter ROM through the browser UI, run/export the active imported ROM, run an
  ignored imported ROM copy through Genteel, and confirm git does not track
  imported ROM artifacts.

Did:

- Added native ROM import requests that copy selected file bytes into
  `artifacts/phase5/imports`.
- Validated `.bin`, `.gen`, `.md`, and `.smd` extensions and sanitized imported
  file names before writing local storage.
- Added native export of a specific active ROM path with repo-bound path
  validation.
- Added active-ROM launching so Genteel can run an imported ROM path instead of
  only the starter ROM path.
- Added a standard app file input for Import ROM and a repo-generated Import
  Test ROM action for safe verification without commercial ROMs.
- Updated the project/menu/runtime UI to show `Imported ROM` and to make Run,
  rerun, and Export follow the imported ROM path.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 41 tests
  and 4 live-environment tests ignored.
- `pnpm --dir app build` passed.
- Browser proof at `http://127.0.0.1:1420/`:
  - Project menu showed `Import Test ROM`.
  - Clicking it changed action status to `Imported ROM active`.
  - Project summary changed to `Imported ROM`.
  - Runtime metadata pointed at
    `artifacts/phase5/imports/drive16-import-preview-starter-test-rom.bin`.
  - Run logged `run.started` with the imported ROM path.
  - Export reported `artifacts/phase3/exports/drive16-import-preview.bin`.
- Local Genteel proof:
  - Copied `examples/app-starter-blank/out/rom.bin` into ignored
    `artifacts/phase5/imports/drive16-import-cli-starter-test.bin`.
  - Ran that imported copy through Genteel for 180 frames.
  - Produced `artifacts/phase5/import-verification/imported-test-frame.png`,
    a valid 320x240 PNG.
  - Produced
    `artifacts/phase5/import-verification/imported-test-frames.rgb565`.
- `git status --short --ignored artifacts/phase5/imports
  artifacts/phase5/import-verification` showed ignored `artifacts/` only.

Gate:

Phase 5 Unit 4 is complete. Phase 5 remains open.

Next:

- Unit 5: add visible ROM controls and keyboard/controller mapping.

## 2026-06-30 - ITERATION 77 - Project menu actions and import entry point

Plan:

- Task: make the project menu the home for project and ROM actions.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `app/src-tauri/src/main.rs`, `app/src-tauri/src/project.rs`,
  `DECISIONS.md`, `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-project-menu-actions.md`.
- Verification: run native project tests, build the frontend, open the menu in
  browser preview, click each project action, and capture evidence.

Did:

- Added native saved-project snapshot listing for
  `artifacts/phase3/projects`.
- Added native import-storage preparation under ignored
  `artifacts/phase5/imports`.
- Added Open Project and Import ROM actions to the project menu.
- Added an action status panel so every menu action gives visible feedback.
- Made Save Project populate a recent saved snapshot row.
- Made Open Project select the latest saved snapshot or explain that a save is
  needed first.
- Made Import ROM show the import folder and accepted Genesis ROM extensions.
- Fixed project-list row layout so saved project names do not collapse.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml project -- --nocapture`
  passed with 7 tests.
- `pnpm --dir app build` passed.
- Browser proof at `http://127.0.0.1:1420/` loaded with title `Drive16`, no
  framework overlay, and no console warnings or errors.
- Menu actions present: New Project, Save Project, Open Project, Import ROM,
  Export ROM, and Agent Settings.
- Open before save showed `No saved projects yet`.
- Save added a `drive16-starter-preview` recent project row.
- Open after save selected the snapshot path.
- Import ROM showed `artifacts/phase5/imports` and extensions
  `.bin, .gen, .md, .smd`.
- Export ROM updated action status and export path.
- Screenshot saved at `/tmp/drive16-phase5-unit3/project-menu-actions.png`.

Gate:

Phase 5 Unit 3 is complete. Phase 5 remains open.

Next:

- Unit 4: import a local generated test ROM into ignored storage and run it.

## 2026-06-30 - ITERATION 76 - Agent truthfulness and chat state

Plan:

- Task: clarify the conversation surface so local proof responses are not
  confused with live model-backed inference.
- Files: `app/src/App.tsx`, `app/src/styles.css`, `DECISIONS.md`,
  `PROGRESS.md`, `README.md`, `WORKLOG.md`, and
  `docs/phase5-agent-truthfulness.md`.
- Verification: build the frontend, run focused OpenCode native tests, reload
  the app, send a general prompt, send a ROM-changing prompt, and capture
  browser evidence.

Did:

- Added a conversation mode row under the inference settings row.
- Labeled local proof messages as `Local proof` instead of generic `Agent`.
- Gated freeform prompts when the selected provider is not tested.
- Kept ROM-changing prompts available through the verified local proof path.
- Made the message history auto-scroll to the newest response.
- Updated the top run status when the ROM proof completes.
- Recorded the no-reply freeform boundary as a Drive16 decision.

Evidence:

- `pnpm --dir app build` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml opencode -- --nocapture`
  passed.
- Browser proof at `http://127.0.0.1:1420/` loaded with title `Drive16`, no
  framework overlay, and no console warnings or errors.
- Initial mode row showed `ROM proof only` and said freeform model replies were
  paused because `Claude Sonnet Latest` was not tested.
- Sending `What can you do?` produced a `Local proof` reply explaining that
  freeform replies are paused while ROM-changing prompts still use the
  verified local build path.
- Sending `Make a sprite I can move left and right with music.` produced a
  `Local proof` ROM proof response and updated the top status to
  `CORE ROM proof completed.`
- Screenshot saved at
  `/tmp/drive16-phase5-unit2/conversation-truthfulness.png`.

Gate:

Phase 5 Unit 2 is complete. Phase 5 remains open.

Next:

- Unit 3: add project menu actions for Load/Open Project and Import ROM.

## 2026-06-30 - ITERATION 75 - Phase 5 provider settings cleanup

Plan:

- Task: start Phase 5 with the provider settings mismatch the user found in
  the app.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `app/src-tauri/src/main.rs`, `app/src-tauri/src/ollama.rs`,
  `DECISIONS.md`, `PROGRESS.md`, `README.md`, and
  `docs/phase5-provider-settings.md`.
- Verification: run native formatting and Ollama tests, build the frontend,
  reload the app, click through provider switching, and capture screenshots.

Did:

- Split Agent Settings into mutually exclusive OpenRouter and Ollama panels.
- Kept OpenRouter API key and hosted model controls out of the Ollama view.
- Added local Ollama endpoint and model fields with no API key requirement.
- Added a native Tauri `check_ollama_endpoint` command that only probes local
  HTTP endpoints through `/api/tags`.
- Made browser preview report that Ollama is checked by the native app instead
  of pretending a browser fetch proves local model readiness.
- Updated the conversation inference chip, project menu inference row, and app
  header to reflect the active Phase 5 provider state.
- Recorded the provider boundary as a Drive16 decision and Phase 5 evidence
  doc.

Evidence:

- `cargo fmt --manifest-path app/src-tauri/Cargo.toml --check` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml ollama -- --nocapture`
  passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 33 tests
  and 4 live-environment tests ignored.
- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser proof at `http://127.0.0.1:1420/` showed OpenRouter and Ollama
  panels switching cleanly with no console warnings or errors.
- Ollama mode showed endpoint and model fields, footer action `Test Ollama`,
  and browser-preview detail `Native app checks Ollama locally`.
- Project menu showed the selected provider as
  `Inference Ollama Qwen2.5 Coder 7b`.
- Screenshots saved at `/tmp/drive16-phase5-unit1/ollama-settings.png` and
  `/tmp/drive16-phase5-unit1/project-menu-ollama.png`.

Gate:

Phase 5 Unit 1 is complete. Phase 5 remains open.

Next:

- Unit 2: clarify chat and agent truthfulness so scripted proof responses and
  live model-backed inference cannot be confused.

## 2026-06-30 - ITERATION 74 - Live generated sprite transparency repair

Plan:

- Task: close the live ComfyUI sprite validation failure where raw generated
  PNGs had no transparent pixels.
- Files: `scripts/validate-generated-sprite.py`,
  `scripts/run-comfyui-sprite-workflow.py`, `DECISIONS.md`, `PROGRESS.md`,
  `README.md`, and Phase 4 evidence docs.
- Verification: repair the actual failed live PNG, rerun the generated sprite
  self-test, run the generated-assets ROM proof, then run the full
  `scripts/validate-phase4-live-generated-assets.sh` wrapper.

Did:

- Added a validator repair mode that writes an indexed PNG with palette index
  0 transparent by treating the dominant edge color as the generated
  background.
- Updated the live ComfyUI runner to keep the raw PNG but use the repaired
  SGDK-ready PNG when raw output lacks transparency.
- Installed the default SDXL Base checkpoint and Pixel Art XL LoRA locally
  after human license acceptance.
- Started Docker Desktop when the ROM proof reported the daemon was not
  reachable.
- Recorded the background-repair behavior as a Drive16 decision.
- Updated Phase 4 progress and evidence from an open live gate to a human
  sign-off gate.

Evidence:

- `scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check`
  installed:
  `~/Documents/ComfyUI/models/checkpoints/sd_xl_base_1.0.safetensors` and
  `~/Documents/ComfyUI/models/loras/pixel-art-xl.safetensors`.
- The installer readiness check initially exited `68` only because the ComfyUI
  API was not running.
- `scripts/validate-generated-sprite.py artifacts/phase4/live-comfyui-sprite/82d0c7e3-fef5-402b-979f-0bcb0d24a8a6/drive16_genesis_sprite_00001_.png --symbol drive16_player --repair-background-output artifacts/phase4/live-comfyui-sprite/82d0c7e3-fef5-402b-979f-0bcb0d24a8a6/drive16_genesis_sprite_00001_-sgdk-test.png`
  passed with 16 palette slots and 537 transparent pixels.
- `python3 -m py_compile scripts/validate-generated-sprite.py scripts/run-comfyui-sprite-workflow.py`
  passed.
- `scripts/validate-generated-sprite.py --self-test` passed.
- First rerun of `scripts/validate-phase4-live-generated-assets.sh` passed
  ComfyUI readiness and live sprite validation, then stopped at the generated
  ROM proof because Docker Desktop was not running.
- `open -a Docker` plus `docker info --format '{{.ServerVersion}}'` confirmed
  Docker daemon version `29.5.3`.
- `scripts/validate-phase4-generated-assets-prompt.sh` passed.
- Final `scripts/validate-phase4-live-generated-assets.sh` passed end to end.
  It launched ComfyUI, reached readiness, generated prompt id
  `66752e6a-a6bd-44ae-92f1-fe5e4fa893bc`, wrote
  `artifacts/phase4/live-comfyui-sprite/66752e6a-a6bd-44ae-92f1-fe5e4fa893bc/drive16_genesis_sprite_00003_-sgdk.png`,
  validated it as 32x32 with 16 palette slots and 360 transparent pixels, and
  printed `Phase 4 live generated-assets proof ok`.

Gate:

Phase 4 evidence is ready for human sign-off. Do not begin Phase 5 until the
human approves Phase 4 complete.

Next:

- Present the Phase 4 evidence and ask for sign-off before Phase 5 hardening.

## 2026-06-30 - ITERATION 73 - ComfyUI model dependency selection

Plan:

- Task: replace the unclear Pixel Art Diffusion XL checkpoint dependency with
  a researched default ComfyUI model pair and install path.
- Files: `assets/enhancements/comfyui/`, `scripts/`, `app/src/App.tsx`,
  `app/src-tauri/src/comfyui.rs`, `app/src-tauri/src/phase4_prompt.rs`,
  `README.md`, `docs/phase4-comfyui-model-selection.md`, `DECISIONS.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: check upstream model metadata, validate direct Hugging Face
  file URLs by header request only, run the workflow validator, compile the
  readiness scripts, build the frontend, run native ComfyUI tests, and check
  shell syntax.

Did:

- Researched Hugging Face alternatives to the previous Civitai-style dedicated
  Pixel Art Diffusion XL checkpoint.
- Chose Stability AI SDXL Base plus `nerijs/pixel-art-xl` LoRA as the default
  dependency pair.
- Updated the ComfyUI workflow to load SDXL Base through
  `CheckpointLoaderSimple` and apply `pixel-art-xl.safetensors` through
  `LoraLoader`.
- Added `scripts/install-phase4-comfyui-models.sh`, which downloads the default
  model pair only after `--accept-model-licenses`.
- Updated Python and native readiness checks to require API, checkpoint, LoRA,
  Pixydust, and workflow classes.
- Updated the app settings drawer to show both `SDXL checkpoint` and
  `Pixel art LoRA` fields.
- Updated the live runner, setup helper, README, prompt validation request, and
  model-selection evidence docs.
- Recorded the architecture deviation as a decision so the model-pair default
  does not silently drift from the older dedicated-checkpoint preference.

Evidence:

- Hugging Face metadata reported `stabilityai/stable-diffusion-xl-base-1.0`
  with license tag `openrail++` and file `sd_xl_base_1.0.safetensors`.
- Hugging Face metadata reported `nerijs/pixel-art-xl` with license tag
  `creativeml-openrail-m`, base model
  `stabilityai/stable-diffusion-xl-base-1.0`, and file
  `pixel-art-xl.safetensors`.
- Header checks confirmed both default file URLs resolve without downloading
  weights: SDXL Base about 6.94 GB and Pixel Art XL LoRA about 171 MB.
- `scripts/install-phase4-comfyui-models.sh --dry-run` prints the default
  install plan without downloading.
- `scripts/validate-comfyui-workflow.py` passed.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py scripts/run-comfyui-sprite-workflow.py` passed.
- `bash -n scripts/install-phase4-comfyui-models.sh scripts/install-phase4-comfyui-checkpoint.sh scripts/setup-phase4-comfyui-prereqs.sh scripts/validate-phase4-generated-assets-prompt.sh scripts/validate-phase4-live-generated-assets.sh scripts/validate-phase4-comfyui-api-smoke.sh` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture`
  passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt -- --nocapture`
  passed with 5 tests and 2 live-environment tests ignored.
- `pnpm --dir app build` passed.
- Browser QA at `http://127.0.0.1:1420/` opened Agent Settings, enabled
  `AI sprites`, and confirmed the rendered defaults
  `sd_xl_base_1.0.safetensors` and `pixel-art-xl.safetensors`.
- Browser console warnings and errors were empty on initial load, after opening
  settings, and after the narrow-width settings check.
- `git diff --check` passed.

Gate:

No Phase 4 generated-sprite gate closed. The remaining validation request is
to run the installer with explicit model-license acceptance, then run
`scripts/validate-phase4-live-generated-assets.sh`.

Next:

- Install the default model pair or point Drive16 at compatible local files,
  then run the live generated-assets proof.

## 2026-06-30 - ITERATION 72 - App navigation hardening

Plan:

- Task: respond to the UI audit by adding a project menu, save surface,
  agent-local inference placement, clearer chat feedback, and tighter
  responsive layout.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `app/src-tauri/src/main.rs`, `app/src-tauri/src/project.rs`,
  `docs/app-navigation-hardening.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: rebuild the frontend, run the focused native project tests,
  click the menu/settings/save/chat flows in the in-app browser, check desktop
  and mobile layout metrics, and check the diff for whitespace errors.

Did:

- Added a hamburger project menu in the top-left chrome.
- Moved `New Project`, `Save Project`, `Export ROM`, recent project selection,
  inference state, and tool attention into the project menu.
- Added a native `save_current_project` Tauri command that snapshots the
  starter project under ignored Phase 3 artifacts.
- Kept the top bar to compact `Run`, `Save`, and `Export` actions.
- Moved the active inference label into the conversation pane near
  `Agent Settings`.
- Changed freeform chat feedback so the app explains local ROM prompt handling
  and the need for a tested model before expecting live replies.
- Added dark scrollbar styling and phone-width header rules.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml project -- --nocapture`
  passed with 5 tests.
- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser desktop pass opened the project menu, clicked `Save Project`, opened
  `Agent Settings` from the menu, clicked top `Save`, sent `what can you do?`,
  and observed the new explanatory agent reply.
- Desktop browser console warnings and errors were empty.
- Desktop metrics showed the top bar at 58 px tall, compact top buttons, and no
  top-bar model selector.
- Mobile browser pass opened and closed the project menu, then reported body
  client width and scroll width both at 316 px.
- Mobile browser console warnings and errors were empty.

Gate:

No new Phase 4 gate. The existing validation request remains: provide or
install a compatible Pixel Art Diffusion XL checkpoint, then run
`scripts/validate-phase4-live-generated-assets.sh`.

Next:

- Continue app UX hardening on deeper project persistence and live model reply
  streaming, or return to the Phase 4 live checkpoint gate.

## 2026-06-30 - ITERATION 71 - App control hardening

Plan:

- Task: click through the running app and wire the most visible inert or
  unclear controls.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `docs/app-control-hardening.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: use the in-app browser to click the visible controls, check
  DOM state and console health, test a mobile viewport, and run the frontend
  production build.

Did:

- Audited the app at `http://127.0.0.1:1420/`.
- Confirmed the previous top-level `Run` button had no rendered state change.
- Wired the top action to `Run ROM` and added visible action feedback.
- Added `New Project` to reset to a fresh starter-template conversation and
  preview state.
- Turned the fullscreen icon into a real focused-emulator mode with an exit
  state.
- Added action feedback for pause, resume, starter reset, export, and tool
  health.
- Changed browser-preview tool health from generic `Needs attention` to
  `Preview checks limited`.
- Added support for per-tool setup hints in the health list.
- Added button titles for icon controls.

Evidence:

- Browser page identity was `http://127.0.0.1:1420/` with title `Drive16`.
- Browser console warnings and errors were empty before and after the
  interaction pass.
- The visible controls were unique: `New Project`, `Run ROM`, `Export ROM`,
  `Pause emulator`, `Launch starter ROM`, `Focus emulator`,
  `Agent settings`, and `Refresh tool health`.
- `Run ROM` appended `run.started` and changed the top action hint.
- `New Project` reset the conversation and appended `project.new`.
- `Focus emulator` applied `app-shell emulator-focused`, then
  `Exit focused emulator` restored `app-shell`.
- Pause and resume changed button labels and appended matching events.
- `Refresh tool health` changed the action hint to the browser-preview
  limitation message.
- `Export ROM` appended `export.preview` and showed the preview export path.
- `Agent settings` opened the settings panel and `Close settings` closed it.
- A mobile viewport check showed `New Project`, `Run ROM`, and `Export ROM`
  wrapping without horizontal overflow.
- `pnpm --dir app build` passed.

Gate:

No new Phase 4 gate. The existing validation request remains: provide or
install a compatible Pixel Art Diffusion XL checkpoint, then run
`scripts/validate-phase4-live-generated-assets.sh`.

Next:

- Continue app-control hardening on deeper settings and generated-asset flows,
  or return to the Phase 4 live checkpoint gate.

## 2026-06-30 - ITERATION 70 - README project state refresh

Plan:

- Task: update the README so the current project state and next action are
  obvious before pushing `main` to GitHub.
- Files: `README.md` and `WORKLOG.md`.
- Verification: inspect the README diff, check whitespace, scan the diff for
  repo-style punctuation and secret-shaped text, and confirm local `main` is
  not behind `origin/main`.

Did:

- Rewrote the README's current-state section.
- Marked core v1 as complete and evidenced through the Phase 3 app flow.
- Clarified that Phase 4 is optional enhancement work and remains open only on
  live ComfyUI sprite output from a user-selected compatible checkpoint.
- Added the next recommended command sequence for the checkpoint install helper
  and live Phase 4 proof wrapper.
- Added local app preview and validation commands.
- Added asset and model hygiene notes for ROMs, keys, large artifacts, and
  model weights.

Evidence:

- `git diff -- README.md` showed the README now points to
  `docs/phase3-evidence.md`, `docs/phase3-v1-prompt.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- `git diff --check` passed.
- Markdown punctuation and secret scans found no matches in the diff.
- `git rev-list --left-right --count origin/main...HEAD` returned `0 69`
  before this commit, so the local branch was ahead of GitHub and not behind.

Gate:

No new Phase 4 gate. The existing validation request remains: provide or
install a compatible Pixel Art Diffusion XL checkpoint, then run
`scripts/validate-phase4-live-generated-assets.sh`.

Next:

- Commit the README refresh and push `main` to GitHub.

## 2026-06-30 - ITERATION 69 - Live proof wrapper API launch

Plan:

- Task: teach the live generated-assets proof wrapper to launch local ComfyUI
  when the API is not already reachable.
- Files: `scripts/validate-phase4-live-generated-assets.sh`,
  `scripts/README.md`, `docs/phase4-live-generated-assets-proof.md`,
  `docs/phase4-evidence.md`, related Phase 4 validation docs,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: syntax-check the wrapper, run it in the current
  missing-checkpoint state, confirm it stops at the checkpoint gate, and run
  hygiene scans.

Did:

- Added a Step 0 to `scripts/validate-phase4-live-generated-assets.sh`.
- The wrapper now checks `/system_stats` before readiness.
- If the local API is not reachable, it launches
  `scripts/launch-phase4-comfyui-api.sh`, waits for the API, and stores the
  launch log under ignored Phase 4 artifacts.
- If the wrapper launches ComfyUI, it stops that process on exit.
- Non-local unreachable endpoints remain an explicit validation request.

Evidence:

- `bash -n scripts/validate-phase4-live-generated-assets.sh` passed.
- `scripts/validate-phase4-live-generated-assets.sh` exited `68` in the
  current missing-checkpoint state.
- The wrapper printed Step 0, launched local ComfyUI, and reached Step 1
  readiness.
- `artifacts/phase4/comfyui-readiness/latest.json` recorded `api.ok: true`,
  `workflowClasses.ok: true`, and `pixydustQuantizer.ok: true`.
- The same readiness report recorded `checkpoint.ok: false` for
  `pixel-art-diffusion-xl.safetensors`.
- After the wrapper exited, `http://127.0.0.1:8188/system_stats` was no longer
  reachable, confirming the wrapper stopped the process it launched.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live generated-assets proof wrapper.

Next:

- Install the compatible checkpoint and run
  `scripts/validate-phase4-live-generated-assets.sh`; this should now handle
  local ComfyUI startup itself.

## 2026-06-30 - ITERATION 68 - Current ComfyUI API smoke refresh

Plan:

- Task: refresh the Phase 4 evidence for the current local ComfyUI API smoke
  state.
- Files: `PROGRESS.md`, `WORKLOG.md`, `docs/phase4-evidence.md`, and
  `docs/phase4-comfyui-api-smoke.md`.
- Verification: rerun the API smoke, inspect the readiness JSON, and run
  hygiene scans on the docs-only change.

Did:

- Reran `scripts/validate-phase4-comfyui-api-smoke.sh`.
- Confirmed the script can start local ComfyUI from the pinned source checkout,
  run readiness while the API is live, and stop the process it launched.
- Recorded that API, workflow classes, and Pixydust are ready in the current
  setup.
- Narrowed the remaining validation request to the compatible checkpoint.

Evidence:

- `scripts/validate-phase4-comfyui-api-smoke.sh` exited `0`.
- `artifacts/phase4/comfyui-api-smoke/latest.json` recorded `ok: true`,
  `apiOk: true`, `workflowClassesOk: true`, `pixydustOk: true`,
  `checkpointOk: false`, and remaining gate `Pixel Art Diffusion XL compatible
  checkpoint`.
- `artifacts/phase4/comfyui-readiness/latest.json` recorded `api.ok: true`,
  `workflowClasses.ok: true`, and `pixydustQuantizer.ok: true`.
- The readiness report still recorded `checkpoint.ok: false` for
  `pixel-art-diffusion-xl.safetensors`.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live generated-assets proof wrapper.

Next:

- Install the compatible checkpoint, run
  `scripts/validate-phase4-live-generated-assets.sh`, and use its output as the
  Phase 4 gate evidence.

## 2026-06-30 - ITERATION 67 - Live generated-assets proof wrapper

Plan:

- Task: add a one-command wrapper for the remaining live Phase 4 gate sequence.
- Files: `scripts/validate-phase4-live-generated-assets.sh`,
  `scripts/README.md`, `docs/phase4-live-generated-assets-proof.md`,
  `docs/phase4-generated-assets-validation.md`, `docs/phase4-evidence.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run shell syntax checks, execute the wrapper in the current
  not-ready state, confirm it stops at readiness, and run hygiene scans.

Did:

- Added `scripts/validate-phase4-live-generated-assets.sh`.
- The wrapper runs ComfyUI readiness, live sprite generation, then the
  generated-assets ROM proof in order.
- It respects `COMFYUI_URL` and `DRIVE16_COMFYUI_CHECKPOINT`.
- Existing scripts still own the readiness checks, live sprite validation, ROM
  proof, and validation-request exit codes.

Evidence:

- `bash -n scripts/validate-phase4-live-generated-assets.sh` passed.
- `scripts/validate-phase4-live-generated-assets.sh` exited `68` in the
  current not-ready environment.
- The wrapper printed the three-step live proof sequence, then stopped at
  Step 1, `ComfyUI readiness`.
- The readiness output reported the local ComfyUI API was not reachable, the
  selected compatible checkpoint was missing, and nearby checkpoint hints were
  listed without being accepted automatically.
- `git diff --check` passed.
- Markdown punctuation and secret scans found no matches in the diff.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live ComfyUI sprite workflow and the
real generated-assets ROM proof.

Next:

- Install the compatible checkpoint, run the live generated-assets proof
  wrapper, and use its output as the Phase 4 gate evidence.

## 2026-06-30 - ITERATION 66 - Live sprite runner readiness preflight

Plan:

- Task: make the live ComfyUI sprite runner reuse the Phase 4 readiness gate
  before enqueueing a generation workflow.
- Files: `scripts/run-comfyui-sprite-workflow.py`, `scripts/README.md`,
  `docs/phase4-live-comfyui-runner.md`,
  `docs/phase4-comfyui-readiness.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: compile the Python scripts, run the live runner without
  ComfyUI/checkpoint, inspect the live-run record, and run hygiene scans.

Did:

- Added a readiness preflight to `scripts/run-comfyui-sprite-workflow.py`.
- The runner now invokes `scripts/check-phase4-comfyui-readiness.py` with the
  selected ComfyUI URL and checkpoint before it calls `drive16-comfyui`.
- If readiness fails, the runner writes a validation-request record with the
  readiness exit code, report path, stdout, and stderr.
- The runner does not enqueue the ComfyUI workflow until readiness passes.

Evidence:

- `python3 -m py_compile scripts/run-comfyui-sprite-workflow.py scripts/check-phase4-comfyui-readiness.py` passed.
- `scripts/run-comfyui-sprite-workflow.py` exited `2` with a validation
  request because Phase 4 readiness did not pass.
- The runner output included the readiness report path and nearby checkpoint
  hints.
- `artifacts/phase4/live-comfyui-sprite/last-run.json` recorded `ok: false`,
  reason `Phase 4 ComfyUI readiness did not pass, so the live sprite workflow
  was not enqueued.`, readiness exit code `68`, readiness report
  `artifacts/phase4/comfyui-readiness/latest.json`, and readiness stdout with
  nearby checkpoint hints.
- `scripts/validate-phase4-generated-assets-prompt.sh` exited `66` at the
  expected live ComfyUI sprite gate after focused Phase 4 prompt tests passed.
- `git diff --check` passed.
- Markdown punctuation and secret scans found no matches in the diff.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live ComfyUI sprite workflow and the
real generated-assets ROM proof.

Next:

- Install the compatible checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 65 - App readiness checkpoint hints

Plan:

- Task: surface checkpoint hints through the native app readiness rows while
  keeping the selected-checkpoint gate strict.
- Files: `app/src-tauri/src/comfyui.rs`, `app/src/App.tsx`,
  `app/src/styles.css`, `docs/phase4-comfyui-readiness.md`,
  `docs/phase4-comfyui-endpoint.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run focused native ComfyUI tests, frontend production build,
  rendered browser settings check, full native tests, and hygiene scans.

Did:

- Added optional readiness-row hints to the native ComfyUI endpoint status.
- The native command now keeps checkpoint and Pixydust filesystem rows visible
  even when the ComfyUI API is down.
- The checkpoint row reports nearby local checkpoint hints without accepting
  them as ready.
- The settings drawer renders readiness hints under the relevant row when the
  native command provides them.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture`
  passed with 13 tests.
- `npm run build` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture` passed
  with 26 passed and 4 ignored.
- Browser preview at `http://127.0.0.1:1420/` reloaded with title `Drive16`
  and no console warnings or errors.
- In the browser preview, Agent Settings opened, `AI sprites` was enabled,
  `Test` was clicked, and the clean failed API status plus `API` readiness row
  rendered.
- Browser preview cannot inspect native filesystem hints, so checkpoint hint
  rendering is covered by the native tests.
- Mobile viewport `390x844` initially exposed horizontal overflow from the
  responsive shell. The shell was updated to use container width with a
  horizontal overflow guard.
- The mobile settings flow was rerun after the fix. It rendered the same clean
  failed API status and `API` readiness row, browser console warnings and
  errors were empty, and `documentElement` plus `body` reported no horizontal
  overflow.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live ComfyUI sprite workflow and the
real generated-assets ROM proof.

Next:

- Install the compatible checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 64 - Checkpoint installer symlink mode

Plan:

- Task: add an explicit local-file symlink mode to the Phase 4 checkpoint
  installer so large user-selected model weights do not have to be copied.
- Files: `scripts/install-phase4-comfyui-checkpoint.sh`,
  `docs/phase4-comfyui-checkpoint-install.md`, `scripts/README.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run shell syntax checks, fixture copy install, fixture symlink
  install, wrong-hash rejection, URL link rejection, and hygiene scans.

Did:

- Added `--link` to `scripts/install-phase4-comfyui-checkpoint.sh`.
- The option only accepts explicit local source files.
- SHA-256 verification works before a linked checkpoint is accepted.
- Existing copy and URL download behavior stays default.

Evidence:

- `bash -n scripts/install-phase4-comfyui-checkpoint.sh scripts/setup-phase4-comfyui-prereqs.sh` passed.
- Fixture copy install passed with SHA-256
  `ece4f1f583d4a4d713808dfd9a31f3f885dbb2aff10cd58864bf17b7222b726c`.
- Fixture symlink install passed with the same SHA-256.
- The linked fixture at
  `artifacts/phase4/checkpoint-install-link-test/comfyui-link/models/checkpoints/linked-pixel.safetensors`
  is a symlink to the explicit local source fixture.
- Wrong-hash symlink install exited nonzero with `Checkpoint SHA-256 mismatch`.
- URL plus `--link` exited nonzero with
  `--link requires a local source file, not a URL`.
- `git diff --check` passed.
- Markdown punctuation and secret scans found no matches in the diff.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live ComfyUI sprite workflow and the
real generated-assets ROM proof.

Next:

- Install the compatible checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 63 - ComfyUI readiness checkpoint hints

Plan:

- Task: make the ComfyUI readiness report show nearby local checkpoint hints
  while still requiring the selected compatible checkpoint.
- Files: `scripts/check-phase4-comfyui-readiness.py`, `scripts/README.md`,
  `docs/phase4-comfyui-readiness.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: compile the Python script, rerun readiness without the
  checkpoint, inspect the report, run hygiene checks, and confirm the gate
  stays open.

Did:

- Added a nearby checkpoint hint scan to the readiness checker.
- The scan looks in local ComfyUI, Fooocus, and DiffusionBee model folders.
- The selected checkpoint still must be present or available through ComfyUI
  API before the checkpoint check can pass.
- Updated docs and progress with the stricter hint behavior.

Evidence:

- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py` passed.
- `scripts/check-phase4-comfyui-readiness.py` exited `68`, preserving the
  validation request.
- The readiness output still reports the API refused on `127.0.0.1:8188` and
  the selected checkpoint missing from the checked local ComfyUI paths.
- The readiness output now lists nearby hints:
  `juggernautXL_version6Rundiffusion.safetensors`,
  `CyberRealistic__v3.1_CyberRealistic__v3.1.safetensors`, and
  `ReV_Animated_1.2.2_ReV_Animated_1.2.2.safetensors`.
- The readiness JSON records `ok: false`, `checkpoint.ok: false`, three
  `nearbyCandidates`, and `nearbyCandidatesAreHintsOnly: true`.
- `scripts/validate-phase4-comfyui-api-smoke.sh` passed after the hint change,
  proving the live API smoke still starts ComfyUI, sees workflow classes and
  Pixydust, and keeps only the checkpoint as the remaining gate.
- `git diff --check` passed.
- Markdown punctuation and secret scans found no matches in the diff.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live ComfyUI sprite workflow and the
real generated-assets ROM proof.

Next:

- Install the compatible checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 62 - ComfyUI checkpoint source audit

Plan:

- Task: audit the likely Pixel Art Diffusion XL source before treating it as a
  normal Phase 4 install target.
- Files: `docs/phase4-comfyui-checkpoint-source-audit.md`, `DECISIONS.md`,
  `docs/phase4-evidence.md`, `docs/phase4-comfyui-checkpoint-install.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: inspect local checkpoint candidates, inspect current upstream
  model metadata, run Markdown and secret hygiene checks, and keep the live
  generated-sprite gate open.

Did:

- Searched the local machine for checkpoint files and Pixel Art Diffusion XL
  candidates.
- Found general image checkpoints, including a Fooocus SDXL checkpoint, but no
  dedicated Pixel Art Diffusion XL checkpoint in the local ComfyUI model
  folders.
- Checked the Civitai API metadata for model `277680`.
- Recorded the metadata conflict with the architecture appendix's open
  CreativeML assumption.
- Kept Drive16 on an explicit user-selected checkpoint install path.

Evidence:

- Local model scan found no Pixel Art Diffusion XL checkpoint under
  `/Users/chrissotraidis/Documents/ComfyUI`.
- `curl -L --fail --silent --show-error https://civitai.com/api/v1/models/277680`
  returned model name `Pixel Art Diffusion XL`, type `Checkpoint`, and base
  model `SDXL 1.0`.
- The current primary file is
  `pixelArtDiffusionXL_spriteShaper.safetensors` with SHA-256
  `7ADFFA28D4003A773C2D4E5F10AE1BA63C33573967864A7F9A4A3BE9C9F04A93`.
- The metadata reports restricted commercial use, no derivatives, no different
  license, and restricted redistribution outside Civitai.
- `docs/phase4-comfyui-checkpoint-source-audit.md` records the findings.

Gate:

VALIDATION REQUEST remains: provide or install a compatible checkpoint as a
user-selected external model, then run the live ComfyUI sprite workflow and the
real generated-assets ROM proof.

Next:

- Install the compatible checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 61 - ComfyUI API smoke gate narrowing

Plan:

- Task: add a repeatable smoke test that starts local ComfyUI temporarily and
  proves API, workflow classes, and Pixydust before the live checkpoint gate.
- Files: `scripts/validate-phase4-comfyui-api-smoke.sh`,
  `docs/phase4-comfyui-api-smoke.md`,
  `docs/phase4-comfyui-api-launch.md`, `docs/phase4-evidence.md`,
  `scripts/README.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the new smoke script, inspect its report and readiness
  output, confirm the launched process is stopped afterward, run the real
  generated-assets gate, run hygiene scans, and confirm smoke artifacts are
  ignored.

Did:

- Added `scripts/validate-phase4-comfyui-api-smoke.sh`.
- The script starts ComfyUI only if `/system_stats` is not already reachable.
- It runs the Phase 4 readiness check while the API is live.
- It requires API, workflow classes, and Pixydust to pass, but allows the
  checkpoint to remain the validation request.
- It stops any ComfyUI process it starts.
- Updated the Phase 4 docs and ledger with the narrower remaining gate.

Evidence:

- `scripts/validate-phase4-comfyui-api-smoke.sh` passed.
- Smoke report:
  `artifacts/phase4/comfyui-api-smoke/latest.json`.
- The smoke report recorded `apiOk: true`, `workflowClassesOk: true`,
  `pixydustOk: true`, and `checkpointOk: false`.
- The readiness report recorded all required workflow classes available:
  `CLIPTextEncode`, `CheckpointLoaderSimple`, `EmptyLatentImage`,
  `ImageScale`, `KSampler`, `Quantizer`, `SaveImage`, and `VAEDecode`.
- The smoke launch log recorded ComfyUI 0.26.0 serving
  `http://127.0.0.1:8188` from the pinned source checkout and loading
  `ComfyUI-PixydustQuantizer`.
- After the smoke script exited, `http://127.0.0.1:8188/system_stats` was no
  longer reachable, confirming the script stopped the process it launched.
- `scripts/validate-phase4-generated-assets-prompt.sh` still exits `66` after
  focused Phase 4 prompt tests pass, preserving the real live sprite gate.
- `bash -n` passed for the API smoke, launch, and readiness scripts.
- `git diff --check` passed.
- Secret scan and Markdown punctuation scan found no matches.
- Smoke logs, readiness output, and live-run records are ignored by git.
- Local preview at `http://127.0.0.1:1420/` responded with HTTP 200.

Gate:

VALIDATION REQUEST remains: install a real Pixel Art Diffusion XL compatible
checkpoint from an explicit source, start local ComfyUI, pass
`scripts/check-phase4-comfyui-readiness.py`, run the live sprite workflow, then
rerun the real generated-assets proof.

Next:

- Install the real checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 60 - Phase 4 evidence packet

Plan:

- Task: assemble a single Phase 4 evidence packet that distinguishes completed
  proof from the remaining live ComfyUI gate.
- Files: `docs/phase4-evidence.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: rerun the real readiness and generated-assets gate scripts,
  check local model presence, run Markdown style and secret scans, confirm
  generated artifacts are ignored, and run `git diff --check`.

Did:

- Added `docs/phase4-evidence.md`.
- Listed completed Phase 4 evidence by requirement and linked each supporting
  doc.
- Recorded the open live gate separately from fixture evidence.
- Added the exact validation commands required to close Phase 4.

Evidence:

- `docs/phase4-evidence.md` records that Phase 4 is not complete.
- It points to the completed evidence docs for toggles, ComfyUI wrapper,
  workflow, validator, SGDK resource proof, MML wrapper, generated-MML ROM
  proof, app prompt gate, fixture combined prompt proof, and live validation
  scripts.
- It identifies the remaining gate as real live ComfyUI sprite output.
- Local model scan found no `.safetensors`, `.ckpt`, or `.pt` files under
  `/Users/chrissotraidis/Documents/ComfyUI`.
- `scripts/check-phase4-comfyui-readiness.py` exited `68`: ComfyUI API is not
  reachable on `127.0.0.1:8188`, the default checkpoint is not present in the
  checked model paths, and workflow classes cannot be inspected without the
  API.
- `scripts/validate-phase4-generated-assets-prompt.sh` exited `66`: focused
  Phase 4 prompt tests passed, 5 passed and 2 ignored, then the ignored live
  generated-assets proof stopped because no successful live sprite run is
  recorded.
- Local preview at `http://127.0.0.1:1420/` responded with HTTP 200.

Gate:

VALIDATION REQUEST remains: install a real Pixel Art Diffusion XL compatible
checkpoint from an explicit source, start local ComfyUI, pass
`scripts/check-phase4-comfyui-readiness.py`, run the live sprite workflow, then
rerun the real generated-assets proof.

Next:

- Install the real checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 59 - Explicit checkpoint install helper

Plan:

- Task: provide an exact helper for placing a user-provided compatible
  checkpoint into the local ComfyUI checkpoints folder.
- Files: `scripts/install-phase4-comfyui-checkpoint.sh`,
  `scripts/setup-phase4-comfyui-prereqs.sh`, `scripts/README.md`,
  `docs/phase4-comfyui-checkpoint-install.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: syntax-check the helper, install a tiny ignored fixture with
  SHA-256 verification, prove wrong-hash rejection, rerun the real ComfyUI
  readiness check, run hygiene scans, and confirm generated artifacts are
  ignored.

Did:

- Added `scripts/install-phase4-comfyui-checkpoint.sh`.
- Kept model source explicit: the helper requires `--source <path-or-url>` and
  has no baked-in model URL.
- Added optional SHA-256 verification.
- Added `--check` so the helper can immediately run the Phase 4 readiness
  check after placement.
- Updated the prerequisite setup output and docs to point to the helper.

Evidence:

- Local fixture install passed:
  `artifacts/phase4/checkpoint-install-test/comfyui/models/checkpoints/test-pixel.safetensors`.
- Fixture SHA-256 verified:
  `2de2cfee082e137f29a01565a6f3c20f114a8f004dc6ad0313cc4ab5ab57a0bc`.
- Wrong-hash install attempt exited `66` with `Checkpoint SHA-256 mismatch`.
- The fixture stayed under ignored `artifacts/phase4/checkpoint-install-test/`
  and was not treated as a real Phase 4 checkpoint.
- `bash -n` passed for the checkpoint install helper and prerequisite setup
  helper.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py` passed.
- `scripts/setup-phase4-comfyui-prereqs.sh` reported the existing ComfyUI root,
  found Pixydust, and printed the new checkpoint install helper command.
- `scripts/check-phase4-comfyui-readiness.py` still exits `68`: ComfyUI API is
  not reachable on `127.0.0.1:8188`, the default checkpoint is not present in
  the checked model paths, and workflow classes cannot be inspected without
  the API.
- `git diff --check` passed.
- Secret scan and Markdown punctuation scan found no matches.
- Checkpoint install fixture artifacts and readiness output are ignored by
  git.

Gate:

VALIDATION REQUEST remains: install a real Pixel Art Diffusion XL compatible
checkpoint from an explicit source, start local ComfyUI, pass
`scripts/check-phase4-comfyui-readiness.py`, run the live sprite workflow, then
rerun the real generated-assets proof.

Next:

- Install the real checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 58 - Combined generated-assets fixture proof

Plan:

- Task: prove the combined generated-sprite plus generated-MML prompt path
  without claiming live ComfyUI output exists.
- Files: `scripts/validate-phase4-generated-assets-fixture-prompt.sh`,
  `scripts/README.md`, `docs/phase4-generated-assets-fixture-prompt.md`,
  `docs/phase4-generated-assets-validation.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: run the new fixture proof, inspect the generated resource
  contract and artifacts, visually check the Genteel screenshot, rerun the real
  live-gated generated-assets validator, then run hygiene scans and ignored
  artifact checks.

Did:

- Added a fixture-only validation script that temporarily supplies a
  validator-accepted synthetic generated sprite to the live-run contract.
- Ran the same ignored native combined generated-assets prompt proof with
  `use_generated_sprite: true`.
- Restored the prior live ComfyUI run record after the fixture run, preserving
  the real live gate.
- Marked the optional prompt-path wiring checklist item complete, while
  keeping live generated-sprite validation and final live ROM proof open.

Evidence:

- `scripts/validate-phase4-generated-assets-fixture-prompt.sh` passed.
- The generated-sprite validator accepted the fixture PNG: 32x32, 4 palette
  slots, and 704 transparent pixels.
- Focused Phase 4 prompt tests passed: 5 passed, 2 ignored.
- Ignored combined generated-assets proof passed: 1 passed.
- The generated project referenced both
  `SPRITE drive16_player "../../../../../artifacts/phase4/generated-assets-fixture/generated-sprite.png" 4 4 NONE 0`
  and `XGM drive16_generated_music "generated_music.vgm"`.
- Generated ROM:
  `artifacts/phase4/generated-music-prompt/project/out/rom.bin`.
- Genteel neutral screenshot:
  `artifacts/phase4/generated-music-prompt/phase4-music-neutral.png`.
- Genteel Right-input screenshot:
  `artifacts/phase4/generated-music-prompt/phase4-music-right.png`.
- Generated audio dump:
  `artifacts/phase4/generated-music-prompt/phase4-music-audio.wav`.
- Visual sanity check: the neutral screenshot shows `Drive16 Phase 4`,
  `Generated sprite`, the generated sprite, and `Generated MML music`.
- The prior failed live ComfyUI run record was restored after the fixture run.
- `scripts/validate-phase4-generated-assets-prompt.sh` still exits `66` at
  the expected live ComfyUI sprite gate.
- `scripts/check-phase4-comfyui-readiness.py` still exits `68`: ComfyUI API
  is not reachable on `127.0.0.1:8188`, the default checkpoint is not present
  in the checked model paths, and workflow classes cannot be inspected without
  the API.
- `bash -n` passed for the fixture, live generated-assets, and generated-music
  validation scripts.
- `git diff --check` passed.
- Secret scan and Markdown punctuation scan found no matches.
- Fixture PNG, generated ROM, screenshots, audio dump, and live-run records are
  ignored by git.
- Local preview at `http://127.0.0.1:1420/` responded with HTTP 200.

Gate:

VALIDATION REQUEST remains: place a Pixel Art Diffusion XL compatible
checkpoint, start local ComfyUI, pass `scripts/check-phase4-comfyui-readiness.py`,
run the live sprite workflow, then rerun the real generated-assets proof.

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof with real live ComfyUI output.

## 2026-06-30 - ITERATION 57 - Generated sprite SGDK resource proof

Plan:

- Task: prove a validator-accepted generated-sprite PNG can be consumed by
  SGDK `rescomp` as a `SPRITE` resource and rendered by a ROM.
- Files: `scripts/validate-generated-sprite-sgdk-resource.sh`,
  `scripts/README.md`, `docs/phase4-generated-sprite-sgdk-resource.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the new SGDK resource harness, inspect the Genteel
  screenshot, run script syntax checks, run focused generated-sprite tests,
  rerun the generated-assets gate, run hygiene scans, and check ignored
  artifact coverage.

Did:

- Added a validation harness that creates an ignored SGDK project from the
  generated-sprite validator's accepted synthetic PNG fixture.
- Wrote a `SPRITE drive16_player "generated-sprite.png" 4 4 NONE 0` resource
  entry and minimal SGDK display program into ignored artifacts.
- Built the project through the pinned Docker SGDK path, which runs `rescomp`.
- Ran the resulting ROM through Genteel and captured a screenshot.
- Recorded the evidence and kept the main live generated-sprite gate open.

Evidence:

- `scripts/validate-generated-sprite-sgdk-resource.sh` passed.
- The generated-sprite validator accepted the synthetic 32x32 indexed PNG with
  4 palette slots and 704 transparent pixels.
- SGDK `rescomp` accepted the sprite resource and reported 1 VDP sprite and 6
  tiles.
- `scripts/build-sgdk.sh` built
  `artifacts/phase4/generated-sprite-sgdk-resource/project/out/rom.bin`.
- Genteel captured
  `artifacts/phase4/generated-sprite-sgdk-resource/generated-sprite-resource.png`.
- Visual sanity check: the screenshot shows `Drive16 Phase 4`,
  `Generated SPRITE`, and the generated sprite on screen.
- `bash -n scripts/validate-generated-sprite-sgdk-resource.sh` passed.
- `scripts/validate-generated-sprite.py --self-test` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` at the expected live ComfyUI sprite
  gate.
- `scripts/check-phase4-comfyui-readiness.py` exited `68`: ComfyUI API was not
  reachable on `127.0.0.1:8188`, the default checkpoint was not found under
  local model paths, and workflow classes could not be inspected without the
  API.
- `git diff --check` passed.
- Secret scan and Markdown punctuation scan found no matches.
- Generated SGDK project, ROM, screenshot, reports, and sample PNG artifacts
  are ignored by git.

Gate:

VALIDATION REQUEST remains: place a Pixel Art Diffusion XL compatible
checkpoint, start local ComfyUI, pass `scripts/check-phase4-comfyui-readiness.py`,
run the live sprite workflow, then rerun the combined generated-assets proof.

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 56 - Settings checkpoint override

Plan:

- Task: let the app settings ComfyUI test use a user-entered compatible
  checkpoint filename, matching the existing Phase 4 script override path.
- Files: `app/src/App.tsx`, `app/src-tauri/src/comfyui.rs`,
  `docs/phase4-comfyui-endpoint.md`,
  `docs/phase4-comfyui-readiness.md`,
  `docs/phase4-comfyui-checkpoint-override.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: focused native ComfyUI tests, frontend build, full native
  tests, generated-assets validation harness, live ComfyUI readiness check,
  secret scan, Markdown punctuation check, ignored artifact check, and
  `git diff --check`.

Did:

- Added a `Checkpoint` field to the ComfyUI settings panel behind the
  `AI sprites` toggle.
- Sent the nonblank settings checkpoint value to the native
  `check_comfyui_endpoint` command.
- Preserved the existing fallback order: settings checkpoint, then
  `DRIVE16_COMFYUI_CHECKPOINT`, then the workflow manifest default.
- Added a native test proving an alternate request checkpoint can make the
  checkpoint readiness row pass.
- Updated the Phase 4 evidence docs and progress ledger.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture`
  passed: 12 passed.
- `npm run build` in `app/` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture` passed:
  25 passed, 4 ignored.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` at the expected live ComfyUI sprite
  gate.
- `scripts/check-phase4-comfyui-readiness.py` exited `68` with the current
  local gate: ComfyUI API was not reachable on `127.0.0.1:8188`, the default
  `pixel-art-diffusion-xl.safetensors` checkpoint was not found under the
  local ComfyUI model paths, and workflow classes could not be inspected
  without the API. Pixydust was found under the local ComfyUI custom node
  directory.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the filename differs, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

or type that compatible filename into the app's `Checkpoint` field before
clicking `Test`.

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 55 - Browser readiness-row QA

Plan:

- Task: verify the new ComfyUI readiness rows in the rendered settings drawer
  and keep the browser-preview failure path useful for local QA.
- Files: `app/src/App.tsx`, `docs/phase4-comfyui-endpoint.md`,
  `docs/phase4-comfyui-readiness.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: in-app browser desktop flow, in-app browser mobile-width flow,
  frontend build, focused native ComfyUI tests, full native tests,
  generated-assets validation harness, live ComfyUI readiness check, secret
  scan, Markdown punctuation check, ignored artifact check, and
  `git diff --check`.

Did:

- Added a browser-preview API readiness row when ComfyUI endpoint testing fails
  before the native Tauri command is available.
- Cleared stale ComfyUI readiness rows when the `AI sprites` toggle is turned
  off.
- Verified the settings drawer flow in the in-app browser at default and mobile
  widths.
- Updated Phase 4 endpoint/readiness evidence and the progress ledger.

Evidence:

- In-app browser at `http://127.0.0.1:1420/` loaded with title `Drive16`.
- Default viewport: Agent Settings opened, `AI sprites` enabled, `Test`
  clicked, failed ComfyUI status and `API` readiness row rendered. Console
  warnings/errors: 0. Horizontal overflow: false.
- Mobile viewport `390x844`: same failed ComfyUI status and `API` readiness row
  rendered. Console warnings/errors: 0. Horizontal overflow: false. The
  temporary viewport override was reset.
- `npm run build` in `app/` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture`
  passed: 11 passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture` passed:
  24 passed, 4 ignored.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` at the expected live ComfyUI sprite
  gate.
- `scripts/check-phase4-comfyui-readiness.py` exited `68` with the current
  local gate: ComfyUI API was not reachable on `127.0.0.1:8188`, and the
  default `pixel-art-diffusion-xl.safetensors` checkpoint was not found.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the filename differs, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 54 - In-app ComfyUI readiness rows

Plan:

- Task: surface checkpoint-aware ComfyUI sprite readiness in the app settings
  drawer behind the `AI sprites` toggle.
- Files: `app/src-tauri/src/comfyui.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase4-comfyui-endpoint.md`,
  `docs/phase4-comfyui-readiness.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: focused native ComfyUI tests, frontend build, full native
  tests, generated-assets validation harness, live ComfyUI readiness check,
  secret scan, Markdown punctuation check, ignored artifact check, and
  `git diff --check`.

Did:

- Extended the native `check_comfyui_endpoint` command so endpoint testing also
  checks Phase 4 sprite prerequisites: API, selected checkpoint, Pixydust
  Quantizer, and committed workflow classes.
- Added `DRIVE16_COMFYUI_CHECKPOINT` and `COMFYUI_ROOT` awareness to the native
  app-side readiness path.
- Added compact readiness rows to the ComfyUI settings card after the user
  enables `AI sprites` and clicks `Test`.
- Updated the endpoint and readiness evidence docs and the Phase 4 ledger.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture`
  passed: 11 passed.
- `npm run build` in `app/` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture` passed:
  24 passed, 4 ignored.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` at the expected live ComfyUI sprite
  gate.
- `scripts/check-phase4-comfyui-readiness.py` exited `68` with the current
  local gate: ComfyUI API was not reachable on `127.0.0.1:8188`, and the
  default `pixel-art-diffusion-xl.safetensors` checkpoint was not found.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the filename differs, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 53 - App-side AI sprite gate guidance

Plan:

- Task: refresh the app-side generated-sprite prompt gate so a user who
  enables `AI sprites` gets the same checkpoint-aware ComfyUI readiness path
  as the generated-assets validation harness.
- Files: `app/src-tauri/src/phase4_prompt.rs`,
  `docs/phase4-generated-sprite-prompt-gate.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: focused Phase 4 native tests, generated-assets validation
  harness, full native tests, live ComfyUI readiness check, secret scan,
  Markdown punctuation check, ignored artifact check, and `git diff --check`.

Did:

- Updated the native generated-sprite validation request to include the default
  Pixel Art Diffusion XL checkpoint path, optional
  `DRIVE16_COMFYUI_CHECKPOINT`, local ComfyUI launcher, readiness check, and
  live sprite runner.
- Tightened the generated-sprite gate tests so both missing and failed live
  ComfyUI records assert the checkpoint-aware command sequence.
- Updated Phase 4 prompt-gate evidence and `PROGRESS.md`.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt -- --nocapture`
  passed: 5 passed, 2 ignored.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` at the expected live ComfyUI gate.
  The ignored generated-assets prompt failure now includes the checkpoint-aware
  app-side validation request.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture` passed:
  20 passed, 4 ignored.
- `scripts/check-phase4-comfyui-readiness.py` exited `68` with the current
  local gate: ComfyUI API was not reachable on `127.0.0.1:8188`, and the
  default `pixel-art-diffusion-xl.safetensors` checkpoint was not found.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the filename differs, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 52 - Generated-assets readiness gate

Plan:

- Task: refresh the combined generated-assets validation request so the next
  operator action includes the current checkpoint-aware ComfyUI readiness path.
- Files: `scripts/validate-phase4-generated-assets-prompt.sh`,
  `docs/phase4-generated-assets-validation.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: shell syntax check, generated-assets validation harness, live
  ComfyUI readiness check, secret scan, Markdown punctuation check, ignored
  artifact check, and `git diff --check`.

Did:

- Updated `scripts/validate-phase4-generated-assets-prompt.sh` so the
  missing-live-sprite gate names the default Pixel Art Diffusion XL checkpoint
  path, optional `DRIVE16_COMFYUI_CHECKPOINT`, local API launcher, readiness
  check, and live sprite runner.
- Updated the generated-sprite-validator rejection gate to ask for readiness
  before rerunning live generation.
- Updated `docs/phase4-generated-assets-validation.md` and `PROGRESS.md` with
  the checkpoint-aware validation sequence.

Evidence:

- `bash -n scripts/validate-phase4-generated-assets-prompt.sh` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the expected validation
  request. The request now includes the default checkpoint path, optional
  `DRIVE16_COMFYUI_CHECKPOINT`, `scripts/launch-phase4-comfyui-api.sh`,
  `scripts/check-phase4-comfyui-readiness.py`, and
  `scripts/run-comfyui-sprite-workflow.py`.
- `scripts/check-phase4-comfyui-readiness.py` exited `68` with the current
  local gate: ComfyUI API was not reachable on `127.0.0.1:8188`, and the
  default `pixel-art-diffusion-xl.safetensors` checkpoint was not found.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the filename differs, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 51 - ComfyUI checkpoint override

Plan:

- Task: make the remaining ComfyUI checkpoint gate accept a compatible local
  checkpoint filename without editing committed workflow JSON.
- Files: `scripts/check-phase4-comfyui-readiness.py`,
  `scripts/run-comfyui-sprite-workflow.py`,
  `scripts/setup-phase4-comfyui-prereqs.sh`, `scripts/README.md`,
  `docs/phase4-comfyui-checkpoint-override.md`,
  `docs/phase4-live-comfyui-runner.md`,
  `docs/phase4-comfyui-readiness.md`,
  `docs/phase4-comfyui-api-launch.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: script syntax, Python compilation, static workflow validation,
  override readiness run, override live-runner validation request, full native
  tests, frontend build, generated-assets harness, secret scan, Markdown
  punctuation check, ignored artifact check, and `git diff --check`.

Did:

- Added `--checkpoint` and `DRIVE16_COMFYUI_CHECKPOINT` support to
  `scripts/check-phase4-comfyui-readiness.py`.
- Readiness now records the selected checkpoint name, manifest default, and
  whether the selected name is a runtime override.
- Added the same checkpoint override to
  `scripts/run-comfyui-sprite-workflow.py`.
- The live runner now rewrites `CheckpointLoaderSimple.ckpt_name` in memory
  before enqueueing through `drive16-comfyui`.
- Added `--checkpoint` and `DRIVE16_COMFYUI_CHECKPOINT` support to
  `scripts/setup-phase4-comfyui-prereqs.sh`.
- Documented the runtime-only override in
  `docs/phase4-comfyui-checkpoint-override.md`.

Evidence:

- `bash -n scripts/setup-phase4-comfyui-prereqs.sh
  scripts/launch-phase4-comfyui-api.sh` passed.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py
  scripts/run-comfyui-sprite-workflow.py scripts/validate-comfyui-workflow.py`
  passed.
- `scripts/setup-phase4-comfyui-prereqs.sh --checkpoint alternate-pixel.safetensors --check`
  exited `68` and printed the selected checkpoint path under
  `~/Documents/ComfyUI/models/checkpoints/alternate-pixel.safetensors`.
- `DRIVE16_COMFYUI_CHECKPOINT=alternate-pixel.safetensors scripts/check-phase4-comfyui-readiness.py`
  exited `68` and wrote a readiness report with `checkpoint.name:
  alternate-pixel.safetensors`, `checkpoint.manifestName:
  pixel-art-diffusion-xl.safetensors`, and `checkpoint.override: true`.
- `COMFYUI_URL=http://127.0.0.1:65535 DRIVE16_COMFYUI_CHECKPOINT=alternate-pixel.safetensors scripts/run-comfyui-sprite-workflow.py`
  exited `2` with the expected validation request, and the ignored run record
  preserved the selected checkpoint override in the command.
- `scripts/validate-comfyui-workflow.py` passed and kept the committed
  workflow on the manifest default checkpoint.
- A short launch probe with `scripts/launch-phase4-comfyui-api.sh` returned
  ComfyUI `/system_stats`.
- The live readiness probe recorded `api.ok: true`,
  `pixydustQuantizer.ok: true`, `workflowClasses.ok: true`, and
  `checkpoint.ok: false`.
- The launcher now passes an explicit SQLite database URL under
  `~/Documents/ComfyUI/user/comfyui.db`; the follow-up launch log had no
  database initialization warning.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 4 ignored.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the live ComfyUI validation
  request because no live generated sprite has completed successfully.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

If the filename differs, set:

```sh
export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 50 - ComfyUI API launcher

Plan:

- Task: add a repeatable launcher for the local ComfyUI API so Phase 4 no
  longer depends on Comfy Desktop bundle internals.
- Files: `scripts/launch-phase4-comfyui-api.sh`,
  `scripts/setup-phase4-comfyui-prereqs.sh`, `scripts/README.md`,
  `docs/phase4-comfyui-api-launch.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: inspect local ComfyUI paths and logs, prepare pinned ComfyUI
  source, install explicit requirements, start the API, run readiness while
  the API is live, run native tests, frontend build, secret scan, Markdown
  punctuation check, ignored artifact check, and `git diff --check`.

Did:

- Confirmed `~/Documents/ComfyUI` is a data folder, not a runnable source
  checkout.
- Confirmed Comfy Desktop exists, but the old Desktop log referenced a stale
  `/Applications/ComfyUI.app` path that is no longer present.
- Added `scripts/launch-phase4-comfyui-api.sh`.
- The launcher clones ComfyUI source into ignored `artifacts/` storage and
  pins it to `785141051163612f0e471a242c1f33341f60b9bd`.
- The launcher generates a clean Drive16 extra-models config under ignored
  artifacts so stale Desktop paths do not break startup.
- Added explicit Pixydust requirements installation to
  `scripts/setup-phase4-comfyui-prereqs.sh`.
- Installed the ComfyUI runtime requirements and Pixydust requirements into
  the local ComfyUI Python environment.
- Started the local API on `127.0.0.1:8188`, proved `/system_stats` responds,
  ran readiness while the API was live, and then stopped the server.

Evidence:

- `find /Users/chrissotraidis/Documents/ComfyUI -maxdepth 2` showed a data
  folder with `.venv`, `models`, `custom_nodes`, `input`, `output`, and `user`
  but no `main.py`.
- `tail` of the Comfy Desktop log showed the Desktop command had used
  `/Applications/ComfyUI.app/Contents/Resources/ComfyUI/main.py` and failed in
  ComfyUI Manager; that path no longer exists locally.
- `git ls-remote https://github.com/comfyanonymous/ComfyUI.git HEAD` returned
  `785141051163612f0e471a242c1f33341f60b9bd`.
- `bash -n scripts/launch-phase4-comfyui-api.sh` passed.
- `scripts/launch-phase4-comfyui-api.sh --prepare-only` cloned the pinned
  source into
  `artifacts/phase4/comfyui-api/src-785141051163612f0e471a242c1f33341f60b9bd`.
- A first launch attempt failed because the old Desktop extra-models config
  referenced missing `/Applications/ComfyUI.app/.../custom_nodes`.
- After the launcher generated its own config, the next launch reached ComfyUI
  startup but Pixydust failed to import because `sklearn` was missing.
- `scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust-requirements --check`
  installed Pixydust dependencies, including `scikit-learn` and
  `scikit-image`.
- A final short launch probe returned ComfyUI `/system_stats` from
  `http://127.0.0.1:8188`.
- The live readiness report recorded `api.ok: true`,
  `pixydustQuantizer.ok: true`, and `workflowClasses.ok: true`.
- The live readiness report still recorded `checkpoint.ok: false`.
- `bash -n scripts/launch-phase4-comfyui-api.sh
  scripts/setup-phase4-comfyui-prereqs.sh` passed.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py
  scripts/run-comfyui-sprite-workflow.py scripts/validate-comfyui-workflow.py`
  passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 4 ignored.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the live ComfyUI validation
  request because no live generated sprite has completed successfully.
- Secret scan returned no matches for OpenRouter key patterns.
- Markdown punctuation and emoji guard returned no matches.
- Ignored-artifact checks confirmed `app/dist/`,
  `artifacts/phase4/comfyui-api`,
  `artifacts/phase4/comfyui-readiness/latest.json`, and
  `artifacts/phase4/live-comfyui-sprite/last-run.json` are ignored.
- `git diff --check` passed.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

Then run:

```sh
scripts/launch-phase4-comfyui-api.sh
```

In another shell, run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, run the live sprite workflow, then run the
  generated-assets ROM proof.

## 2026-06-30 - ITERATION 49 - Local Pixydust prerequisite

Plan:

- Task: install and verify the pinned Pixydust Quantizer custom node in the
  local ComfyUI folder.
- Files: `docs/phase4-comfyui-pixydust-local.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: run the committed setup helper with `--install-pixydust
  --check`, inspect the installed revision, rerun readiness, run focused
  generated-assets validation, full native tests, frontend build, secret scan,
  Markdown punctuation check, ignored artifact check, and `git diff --check`.

Did:

- Ran `scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust --check`.
- Installed Pixydust Quantizer into the local ComfyUI custom node folder:
  `/Users/chrissotraidis/Documents/ComfyUI/custom_nodes/ComfyUI-PixydustQuantizer`.
- Verified the local install is pinned to
  `6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`.
- Left model checkpoint acquisition explicit.
- Documented the local prerequisite state in
  `docs/phase4-comfyui-pixydust-local.md`.

Evidence:

- `find /Users/chrissotraidis/Documents/ComfyUI -maxdepth 3 -type d`
  showed local `custom_nodes` and `models/checkpoints` folders.
- Before install, `scripts/check-phase4-comfyui-readiness.py` exited `68`
  and reported missing API, checkpoint, and Pixydust.
- `scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust --check`
  cloned Pixydust and then exited `68`, as expected, because the checkpoint
  and live API are still missing.
- `git -C /Users/chrissotraidis/Documents/ComfyUI/custom_nodes/ComfyUI-PixydustQuantizer rev-parse HEAD`
  returned `6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`.
- `git -C /Users/chrissotraidis/Documents/ComfyUI/custom_nodes/ComfyUI-PixydustQuantizer status --short`
  returned no output.
- `artifacts/phase4/comfyui-readiness/latest.json` now records
  `pixydustQuantizer.ok: true`.
- `scripts/check-phase4-comfyui-readiness.py` still exited `68`; the remaining
  readiness issues are the unreachable ComfyUI API, missing checkpoint, and
  API-dependent workflow class inspection.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py
  scripts/run-comfyui-sprite-workflow.py scripts/validate-comfyui-workflow.py`
  passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 4 ignored.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the live ComfyUI validation
  request because the live sprite run record is not successful.
- Secret scan returned no matches for OpenRouter key patterns.
- Markdown punctuation and emoji guard returned no matches.
- Ignored-artifact checks confirmed `app/dist/`,
  `artifacts/phase4/comfyui-readiness/latest.json`, and
  `artifacts/phase4/live-comfyui-sprite/last-run.json` are ignored.
- `git diff --check` passed.

Gate:

VALIDATION REQUEST: place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

Start ComfyUI on `http://127.0.0.1:8188`, then run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Place the checkpoint, start ComfyUI, then run the live sprite workflow.

## 2026-06-30 - ITERATION 48 - ComfyUI prerequisite setup helper

Plan:

- Task: add a dry-run-first helper for preparing the remaining local ComfyUI
  sprite prerequisites.
- Files: `scripts/setup-phase4-comfyui-prereqs.sh`, `scripts/README.md`,
  `docs/phase4-comfyui-prereq-setup.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: upstream Pixydust commit lookup, shell syntax check, dry run,
  readiness check, full native test suite, frontend build, secret scan,
  Markdown punctuation check, ignored artifact check, and `git diff --check`.

Did:

- Added `scripts/setup-phase4-comfyui-prereqs.sh`.
- The helper is dry-run by default.
- `--install-pixydust` clones Pixydust Quantizer into the local ComfyUI
  `custom_nodes` folder and pins it to
  `6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`.
- Existing Pixydust custom-node directories are left untouched.
- The helper prints the required Pixel Art Diffusion XL checkpoint path rather
  than downloading model weights automatically.
- Documented the setup helper in `scripts/README.md` and
  `docs/phase4-comfyui-prereq-setup.md`.

Evidence:

- `git ls-remote https://github.com/sousakujikken/ComfyUI-PixydustQuantizer.git HEAD`
  returned `6ffbb1ca23637f61559c3bd13f7be2b37d1dae03`.
- `bash -n scripts/setup-phase4-comfyui-prereqs.sh` passed.
- `scripts/setup-phase4-comfyui-prereqs.sh` dry run printed the local ComfyUI
  root, Pixydust install command, and checkpoint validation request.
- `scripts/check-phase4-comfyui-readiness.py` still exited `68`, confirming
  the live ComfyUI API, checkpoint, and Pixydust node are not ready yet.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 4 ignored.
- `npm run build` in `app/` passed.
- Secret scan returned no matches for OpenRouter key patterns.
- Markdown punctuation and emoji guard returned no matches.
- Ignored-artifact checks confirmed `app/dist/`,
  `artifacts/phase4/comfyui-readiness/latest.json`, and
  `artifacts/phase4/live-comfyui-sprite/last-run.json` are ignored.
- `git diff --check` passed.

Gate:

VALIDATION REQUEST: run:

```sh
scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust --check
```

Place a Pixel Art Diffusion XL compatible checkpoint at:

```text
~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors
```

Then start ComfyUI on `http://127.0.0.1:8188` and run:

```sh
scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Prepare local ComfyUI prerequisites, then run the live sprite workflow.

## 2026-06-30 - ITERATION 47 - ComfyUI readiness check

Plan:

- Task: add a focused readiness check for the remaining live ComfyUI sprite
  gate.
- Files: `scripts/check-phase4-comfyui-readiness.py`, `scripts/README.md`,
  `docs/phase4-comfyui-readiness.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: readiness check, script syntax, full native test suite,
  frontend build, secret scan, Markdown punctuation check, ignored artifact
  check, and `git diff --check`.

Did:

- Added `scripts/check-phase4-comfyui-readiness.py`.
- The script checks the local ComfyUI API, workflow node classes,
  `pixel-art-diffusion-xl.safetensors`, and the Pixydust `Quantizer` node.
- The script writes
  `artifacts/phase4/comfyui-readiness/latest.json`.
- Documented the readiness check in `scripts/README.md` and
  `docs/phase4-comfyui-readiness.md`.

Evidence:

- `scripts/check-phase4-comfyui-readiness.py` exited `68` with a validation
  request.
- The readiness report showed the local ComfyUI API was not reachable at
  `127.0.0.1:8188`.
- The readiness report showed no
  `pixel-art-diffusion-xl.safetensors` checkpoint under
  `~/Documents/ComfyUI/models/checkpoints`.
- The readiness report showed no Pixydust Quantizer custom node under
  `~/Documents/ComfyUI/custom_nodes`.
- `python3 -m py_compile scripts/check-phase4-comfyui-readiness.py
  scripts/run-comfyui-sprite-workflow.py scripts/validate-comfyui-workflow.py`
  passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 4 ignored.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the live ComfyUI validation
  request because the live sprite run record is not successful.
- Ignored-artifact checks confirmed `app/dist/`,
  `artifacts/phase4/comfyui-readiness/latest.json`, and
  `artifacts/phase4/live-comfyui-sprite/last-run.json` are ignored.

Gate:

VALIDATION REQUEST: make this command pass:

```sh
scripts/check-phase4-comfyui-readiness.py
```

Expected result: the readiness report records `ok: true`.

Then run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
scripts/validate-phase4-generated-assets-prompt.sh
```

Next:

- Install or start a local ComfyUI server with the Pixel Art Diffusion XL
  checkpoint and Pixydust Quantizer node, then run the live sprite workflow.

## 2026-06-30 - ITERATION 46 - Generated MML ROM proof

Plan:

- Task: rerun the generated-MML ROM proof now that Docker Desktop can be
  started locally, then record the remaining Phase 4 gate.
- Files: `docs/phase4-generated-music-prompt.md`,
  `docs/phase4-generated-assets-validation.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: generated-music validation script, generated-assets validation
  script, artifact inspection, sprite movement validator, audio amplitude
  check, secret scan, Markdown punctuation check, ignored artifact check, and
  `git diff --check`.

Did:

- Started Docker Desktop from the local machine and confirmed `docker info`
  returned a running daemon.
- Reran the generated-MML prompt validation.
- Confirmed the generated-MML proof now builds the SGDK project, runs the ROM
  in Genteel, captures neutral and Right-input screenshots, proves sprite
  movement, and records non-silent generated audio.
- Tried to launch local ComfyUI through Comfy Desktop. The local API still did
  not bind to `127.0.0.1:8188`, so the combined generated-assets proof remains
  correctly gated on live ComfyUI sprite output.

Evidence:

- `scripts/validate-phase4-generated-music-prompt.sh` passed and printed
  `Phase 4 generated music prompt ok`.
- The generated ROM exists at
  `artifacts/phase4/generated-music-prompt/project/out/rom.bin` and `file`
  identifies it as a Sega Mega Drive / Genesis ROM image.
- Genteel screenshots exist at
  `artifacts/phase4/generated-music-prompt/phase4-music-neutral.png` and
  `artifacts/phase4/generated-music-prompt/phase4-music-right.png`.
- Generated audio exists at
  `artifacts/phase4/generated-music-prompt/phase4-music-audio.wav`.
- `scripts/validate-sprite-movement.py` reported
  `direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- The audio amplitude check reported `audio_max_abs 14043`.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the live ComfyUI validation
  request because the live sprite run record is not successful.
- Secret scan returned no matches for OpenRouter key patterns.
- Markdown punctuation and emoji guard returned no matches.
- Ignored-artifact checks confirmed the generated ROM, generated screenshots,
  generated audio, and live ComfyUI run log are ignored.
- `git diff --check` passed.

Gate:

VALIDATION REQUEST: start local ComfyUI on `http://127.0.0.1:8188`, then run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

Expected result: the live runner records `ok: true` and a downloaded PNG under
`artifacts/phase4/live-comfyui-sprite/` that passes
`scripts/validate-generated-sprite.py --symbol drive16_player`.

Then run:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Expected result: the ignored native test builds the generated-assets SGDK
project, runs it in Genteel, captures neutral and Right-input screenshots,
proves Right-input sprite movement, and verifies non-silent generated music.

Next:

- Get local ComfyUI serving on `127.0.0.1:8188`, run the live sprite workflow,
  then rerun `scripts/validate-phase4-generated-assets-prompt.sh`.

## 2026-06-30 - ITERATION 45 - Generated assets validation harness

Plan:

- Task: add a single validation command for the full generated sprite plus
  generated MML prompt path.
- Files: `app/src-tauri/src/phase4_prompt.rs`,
  `scripts/validate-phase4-generated-assets-prompt.sh`,
  `scripts/README.md`, `docs/phase4-generated-assets-validation.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: new generated-assets validation script, full native test
  suite, frontend build, existing generated-music validation script gate
  check, script syntax check, secret scan, Markdown punctuation check, ignored
  artifact check, and `git diff --check`.

Did:

- Added ignored native test
  `phase4_generated_assets_prompt_runs_when_tools_are_available`.
- Added `scripts/validate-phase4-generated-assets-prompt.sh` as the final
  generated-assets proof command.
- The script runs focused Phase 4 prompt tests, then runs the ignored native
  proof that requires a live validated ComfyUI sprite, generated MML music,
  SGDK ROM build, Genteel screenshots, sprite movement proof, and non-silent
  audio.
- The script prints distinct validation requests for missing live ComfyUI
  output, generated sprite validator rejection, and Docker Desktop not running.
- Documented the script in `scripts/README.md` and
  `docs/phase4-generated-assets-validation.md`.

Evidence:

- `bash -n scripts/validate-phase4-generated-assets-prompt.sh` passed.
- `scripts/validate-phase4-generated-assets-prompt.sh` ran the focused tests:
  5 passed, 2 ignored. It then exited `66` with the live ComfyUI validation
  request because the latest live sprite run record is not successful.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 4 ignored.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-music-prompt.sh` reran the focused tests,
  then exited `65` with the Docker Desktop validation request.
- Secret scan returned no matches for OpenRouter key patterns.
- Markdown punctuation and emoji guard returned no matches.
- Ignored-artifact checks confirmed `app/dist/`,
  `artifacts/phase4/generated-music-prompt/project/res/generated_music.vgm`,
  and `artifacts/phase4/live-comfyui-sprite/last-run.json` are ignored.
- `git diff --check` passed.

Gate:

VALIDATION REQUEST: start local ComfyUI on `http://127.0.0.1:8188`, then run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

Expected result: the live runner records `ok: true` and a downloaded PNG under
`artifacts/phase4/live-comfyui-sprite/` that passes
`scripts/validate-generated-sprite.py --symbol drive16_player`.

VALIDATION REQUEST: start Docker Desktop, then run:

```sh
scripts/validate-phase4-generated-assets-prompt.sh
```

Expected result: the ignored native test builds the generated-assets SGDK
project, runs it in Genteel, captures neutral and Right-input screenshots,
proves Right-input sprite movement, and verifies non-silent generated music.

The generated-sprite validation, broad prompt-path, and generated-ROM checklist
items remain open until this command passes with real ComfyUI and Docker.

Next:

- Run the live ComfyUI sprite workflow when local ComfyUI is available, then
  run `scripts/validate-phase4-generated-assets-prompt.sh` after Docker Desktop
  is available.

## 2026-06-30 - ITERATION 44 - Generated sprite prompt artifact gate

Plan:

- Task: teach the generated-MML prompt path to consume a generated sprite only
  after live ComfyUI output has been validated.
- Files: `app/src-tauri/src/phase4_prompt.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `docs/phase4-generated-sprite-prompt-gate.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: focused Phase 4 native tests, full native test suite,
  frontend build, generated-music validation script gate check, secret scan,
  Markdown punctuation check, and `git diff --check`.

Did:

- Changed `run_phase4_music_prompt` to accept a structured request with
  `prompt` and `useGeneratedSprite`.
- Kept the bundled sprite path unchanged when `AI sprites` is off.
- Added a generated-sprite gate that requires the live ComfyUI runner record to
  report `ok: true`, resolves the downloaded PNG inside the repo, and reruns
  the generated-sprite validator before writing `resources.res`.
- Updated the React prompt path so the combined generated sprite and generated
  MML path is selected only when both Phase 4 toggles are enabled.
- Updated project summary labels so generated music remains visible in the
  combined generated-assets path.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt --
  --nocapture` passed: 5 passed, 1 ignored.
- `cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture`
  passed: 20 passed, 3 ignored.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-music-prompt.sh` reran the focused tests,
  then exited `65` with the Docker Desktop validation request below.
- The ignored full-system generated-MML test reached the SGDK build step but
  failed because Docker was installed and the Docker daemon was not reachable.
- Secret scan returned no matches for OpenRouter key patterns.
- Markdown punctuation and emoji guard returned no matches.
- Ignored-artifact checks confirmed `app/dist/`,
  `artifacts/phase4/generated-music-prompt/project/res/generated_music.vgm`,
  and `artifacts/phase4/live-comfyui-sprite/last-run.json` are ignored.
- `git diff --check` passed.

Gate:

VALIDATION REQUEST: start local ComfyUI on `http://127.0.0.1:8188`, then run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

Expected result: the live runner records `ok: true` and a downloaded PNG under
`artifacts/phase4/live-comfyui-sprite/` that passes
`scripts/validate-generated-sprite.py --symbol drive16_player`.

VALIDATION REQUEST: start Docker Desktop, then run:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Expected result: the ignored native test builds the generated SGDK project,
runs it in Genteel, captures neutral and Right-input screenshots, proves
Right-input sprite movement, and verifies non-silent audio.

The generated-sprite validation, broad prompt-path, and generated-ROM checklist
items remain open until both validation requests pass.

Next:

- Run the live ComfyUI sprite workflow when local ComfyUI is available, then
  rerun the generated-ROM proof after Docker Desktop is available.

## 2026-06-30 - ITERATION 43 - Generated MML music prompt path

Plan:

- Task: wire the optional prompt path to use generated MML music when the
  `MML music` toggle is enabled.
- Files: `app/src-tauri/src/phase4_prompt.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `scripts/validate-phase4-generated-music-prompt.sh`,
  `docs/phase4-generated-music-prompt.md`, `scripts/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: focused Rust tests, frontend build, generated MML to VGM
  artifact check, full native SGDK and Genteel test when Docker is available,
  secret scan, Markdown punctuation check, and `git diff --check`.

Did:

- Added `run_phase4_music_prompt` as a native command for the MML music
  enhancement path.
- The command writes an ignored generated SGDK project, compiles generated MML
  with the pinned `ctrmml` sidecar, and wires `drive16_generated_music` into
  SGDK resources.
- Updated the React send path so the default CORE prompt remains unchanged
  when `MML music` is off, while `MML music` on selects the generated music
  path.
- Added a validation script for the full generated-MML ROM proof.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml phase4_prompt --
  --nocapture` passed: 2 tests passed and 1 ignored full-system test remained.
- `npm run build` in `app/` passed.
- `scripts/validate-phase4-generated-music-prompt.sh` ran the focused tests,
  then exited `65` with the Docker Desktop validation request below.
- The ignored full-system test reached the SGDK build step but failed because
  Docker was installed and the Docker daemon was not reachable.
- The generated prompt path wrote
  `artifacts/phase4/generated-music-prompt/project/res/generated_music.mml`.
- The generated prompt path wrote
  `artifacts/phase4/generated-music-prompt/project/res/generated_music.vgm`.
- `file` identified the generated VGM as VGM v1.61 with PSG and YM2612 chips.
- Full non-ignored native test suite passed: 17 passed, 3 ignored.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.
- Frontend build output and generated Phase 4 prompt artifacts were ignored.

Gate:

VALIDATION REQUEST: start Docker Desktop, then run:

```sh
scripts/validate-phase4-generated-music-prompt.sh
```

Expected result: the ignored native test builds the generated-MML SGDK project,
runs it in Genteel, captures neutral and Right-input screenshots, proves
Right-input sprite movement, and verifies non-silent audio.

The broad prompt-path checklist item remains open until this generated-music
ROM proof passes and the generated-sprite path has a real validated ComfyUI
PNG.

Next:

- Run the generated-music prompt validation after Docker Desktop is available.

## 2026-06-30 - ITERATION 42 - MML RAG corpus reference

Plan:

- Task: add the `ctrmml` Megadrive MML reference to the RAG corpus.
- Files: `corpus/mml/ctrmml-megadrive.md`, `corpus/sources.json`,
  `corpus/README.md`, `scripts/validate-mml-rag-corpus.sh`,
  `docs/phase4-mml-rag-corpus.md`, `scripts/README.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: local corpus term checks, preset manifest term checks, full
  RAG ingest and query, targeted generated-MML RAG query, secret scan,
  Markdown punctuation check, and `git diff --check`.

Did:

- Added a Drive16-authored `ctrmml` Megadrive MML crib sheet to the corpus.
- Recorded the note in `corpus/sources.json` as Drive16-authored material.
- Added a validator that checks required terms, refreshes the RAG index, and
  queries for generated-MML terms.

Evidence:

- `bash -n scripts/validate-mml-rag-corpus.sh` passed.
- `python3 -m json.tool corpus/sources.json` passed.
- `scripts/validate-mml-rag-corpus.sh` passed.
- RAG ingest found 16 corpus files, inserted 1537 chunks, and reported
  `documentCount: 16`, `chunkCount: 1537`, and `ftsIndexEnabled: true`.
- The targeted generated-MML query returned
  `corpus/mml/ctrmml-megadrive.md` and included `drive16_round_bass`,
  `compile_music`, and `XGM_startPlay`.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.
- RAG index, model cache, and package artifacts under `artifacts/phase1/` were
  ignored.

Gate:

None for this unit. The live ComfyUI generated-sprite validation request
remains open.

Next:

- Wire the optional prompt path to use generated sprite and music assets.

## 2026-06-30 - ITERATION 41 - MML FM preset library

Plan:

- Task: ship a small original FM preset library for generated Megadrive MML.
- Files: `assets/enhancements/mml/fm-presets.mml`,
  `assets/enhancements/mml/manifest.json`,
  `assets/enhancements/mml/README.md`, `scripts/validate-mml-presets.py`,
  `docs/phase4-mml-presets.md`, `assets/enhancements/README.md`,
  `assets/README.md`, `scripts/README.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: manifest validation, compile every preset through pinned
  `ctrmml`, Python syntax check, secret scan, Markdown punctuation check, and
  `git diff --check`.

Did:

- Added six original YM2612 FM starter voices for `ctrmml`.
- Added a manifest with stable preset IDs, instrument numbers, roles, default
  FM channels, volume hints, octaves, and sample phrases.
- Added a validator that compiles each preset sample to VGM through the pinned
  compiler.

Evidence:

- `scripts/validate-mml-presets.py` passed and compiled all six presets.
- Validation produced VGM outputs for `drive16_round_bass`,
  `drive16_clear_lead`, `drive16_soft_pad`, `drive16_chip_pluck`,
  `drive16_bright_bell`, and `drive16_brass_stab`.
- Generated preset VGMs ranged from 688 to 757 bytes.
- Every generated preset VGM reported version `0x00000161` and YM2612 clock
  `7670454`.
- `python3 -m py_compile scripts/validate-mml-presets.py` passed.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.
- Generated preset MML and VGM artifacts under `artifacts/phase4/mml-presets/`
  were ignored.

Gate:

None for this unit. The live ComfyUI generated-sprite validation request
remains open.

Next:

- Add the MML reference to the RAG corpus.

## 2026-06-30 - ITERATION 40 - MML music MCP wrapper

Plan:

- Task: wrap `ctrmml` as the optional Phase 4 MML music MCP server.
- Files: `scripts/build-ctrmml.sh`, `mcp-servers/mml-music/server.py`,
  `mcp-servers/mml-music/README.md`, `scripts/validate-mml-music-mcp.py`,
  `opencode.json`, `scripts/validate-opencode-config.py`,
  `mcp-servers/README.md`, `scripts/README.md`,
  `docs/phase4-mml-music-mcp.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: pinned `ctrmml` build, MCP handshake and sample compile,
  OpenCode config validation, secret scan, Markdown punctuation check, and
  `git diff --check`.

Did:

- Added a pinned `ctrmml` builder that clones upstream commit
  `ca87769a5e73d69a514401e15a8d8bb193a3c0ef` into ignored artifacts and builds
  `mmlc`.
- Added `drive16-mml-music` with `compile_music` and `read_music_state`.
- Added a validator that compiles a tiny `#platform megadrive` MML song to VGM
  through the MCP server.
- Added `drive16-mml-music` to OpenCode config validation.

Evidence:

- `make -C artifacts/phase4/ctrmml-src RELEASE=1 mmlc` built upstream
  `ctrmml` manually during discovery.
- A tiny Megadrive MML file compiled to a 619 byte VGM with header `Vgm `.
- `scripts/validate-mml-music-mcp.py` passed and compiled the tiny sample
  through the MCP server to a 619 byte VGM.
- Validation metadata reported VGM version `0x00000161`, YM2612 clock
  `7670454`, loop offset `409`, loop samples `44100`, and `hasLoop: true`.
- `python3 scripts/validate-opencode-config.py` passed OpenCode config
  validation and still reported the existing model-credential validation
  request before full agent-loop runs.
- `python3 -m py_compile mcp-servers/mml-music/server.py
  scripts/validate-mml-music-mcp.py` passed.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.
- Generated ctrmml and VGM artifacts under `artifacts/phase4/` were ignored.

Gate:

None for this unit. The live ComfyUI generated-sprite validation request
remains open.

Next:

- Ship the FM preset library.

## 2026-06-30 - ITERATION 39 - Live ComfyUI sprite runner

Plan:

- Task: add the live runner that executes the ComfyUI sprite workflow through
  `drive16-comfyui` and validates the downloaded PNG.
- Files: `scripts/run-comfyui-sprite-workflow.py`,
  `scripts/comfyui-mcp.sh`, `docs/phase4-live-comfyui-runner.md`,
  `assets/enhancements/comfyui/README.md`, `scripts/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: runner offline behavior, ComfyUI MCP wrapper validation,
  generated sprite validator self-test, Python syntax checks, secret scan,
  Markdown punctuation check, and `git diff --check`.

Did:

- Added a live runner that calls `get_system_stats` and `enqueue_workflow`
  through the `drive16-comfyui` MCP wrapper.
- The runner polls ComfyUI history, downloads the first PNG output, and runs
  `scripts/validate-generated-sprite.py` on it.
- Hardened `scripts/comfyui-mcp.sh` to disable `comfyui-mcp` auto-update by
  default and reinstall the pinned package version if ignored artifacts drift.

Evidence:

- Local ComfyUI probing failed with `Connection refused` for
  `http://127.0.0.1:8188/system_stats`.
- `scripts/run-comfyui-sprite-workflow.py` printed a `VALIDATION REQUEST`
  because local ComfyUI was unavailable.
- `scripts/validate-comfyui-mcp-wrapper.py` passed after the wrapper enforced
  the pinned package version.
- `scripts/validate-generated-sprite.py --self-test` passed.
- `scripts/validate-comfyui-workflow.py` passed.
- The ignored `comfyui-mcp` artifact reported package version `0.21.0` after
  wrapper pin enforcement.
- `python3 -m py_compile scripts/run-comfyui-sprite-workflow.py
  scripts/validate-generated-sprite.py` passed.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.
- Run artifacts under `artifacts/phase4/live-comfyui-sprite/` were ignored.

Gate:

VALIDATION REQUEST: start local ComfyUI on `http://127.0.0.1:8188` with the
Pixel Art Diffusion XL checkpoint and Pixydust Quantizer custom node installed,
then run:

```sh
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py
```

Expected result: the command enqueues through `drive16-comfyui`, downloads a
PNG under ignored artifacts, and `scripts/validate-generated-sprite.py` prints
`Generated sprite ok`.

Next:

- Wrap ctrmml as the MML music MCP server while the live ComfyUI validation
  request is open.

## 2026-06-30 - ITERATION 38 - Generated sprite validator

Plan:

- Task: add the local PNG validator for generated ComfyUI sprites.
- Files: `scripts/validate-generated-sprite.py`,
  `docs/phase4-generated-sprite-validator.md`,
  `assets/enhancements/comfyui/manifest.json`,
  `assets/enhancements/comfyui/README.md`, `scripts/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: validator self-test with synthetic accepted and rejected PNGs,
  Python syntax check, secret scan, Markdown punctuation check, and
  `git diff --check`.

Did:

- Added a generated sprite PNG validator that parses PNG data directly.
- The validator enforces 32x32 output, 4x4 tile maximum, binary transparency,
  and at most 16 palette slots including transparency.
- The validator reports the SGDK `SPRITE` resource line for accepted output.
- Added a self-test that accepts a synthetic valid sprite and rejects a
  synthetic over-palette sprite under ignored artifacts.

Evidence:

- `scripts/validate-generated-sprite.py --self-test` passed and accepted the
  synthetic valid 32x32 sprite while rejecting the 18-slot invalid fixture.
- `python3 -m py_compile scripts/validate-generated-sprite.py` passed.
- `scripts/validate-comfyui-workflow.py` still passed after adding the
  validator metadata to the ComfyUI manifest.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.

Gate:

None. The Phase 4 generated-sprite checklist item remains open until a live
ComfyUI output is validated.

Next:

- Run the ComfyUI workflow and validate a live generated sprite PNG.

## 2026-06-30 - ITERATION 37 - ComfyUI Genesis sprite workflow

Plan:

- Task: ship the tuned Genesis palette ComfyUI workflow contract.
- Files: `assets/enhancements/comfyui/manifest.json`,
  `assets/enhancements/comfyui/drive16-genesis-sprite.workflow.json`,
  `assets/enhancements/comfyui/README.md`,
  `assets/enhancements/README.md`, `scripts/validate-comfyui-workflow.py`,
  `docs/phase4-comfyui-workflow.md`, `assets/README.md`,
  `scripts/README.md`, `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: structural workflow validator, Markdown punctuation check,
  secret scan, and `git diff --check`.

Did:

- Added a ComfyUI API-format workflow for a local Pixel Art Diffusion XL style
  checkpoint, 32x32 nearest-neighbor output, and Pixydust 16-color
  quantization.
- Added a manifest that records the MCP tool, local-only runtime, output size,
  palette limit, transparency reservation, and SGDK `SPRITE` resource shape.
- Added a local validator that checks the workflow contract without requiring
  a live GPU or ComfyUI process.

Evidence:

- `scripts/validate-comfyui-workflow.py` passed and reported `ComfyUI workflow
  ok: 9 nodes, 32x32, 16 colors`.
- The validator confirmed the graph is ComfyUI API format for
  `enqueue_workflow`, not UI format.
- The validator confirmed `ImageScale` uses nearest-neighbor 32x32 output and
  Pixydust `Quantizer` uses 16 colors with dithering off.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.

Gate:

None. Live generated-sprite validation remains the next Phase 4 unit.

Next:

- Validate generated sprites as palette-legal SGDK `SPRITE` resources.

## 2026-06-30 - ITERATION 36 - ComfyUI MCP wrapper

Plan:

- Task: wrap ComfyUI through `comfyui-mcp` as an optional OpenCode MCP server.
- Files: `scripts/comfyui-mcp.sh`,
  `scripts/validate-comfyui-mcp-wrapper.py`, `opencode.json`,
  `scripts/validate-opencode-config.py`, `mcp-servers/README.md`,
  `scripts/README.md`, `docs/phase4-comfyui-mcp.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: npm package metadata check, wrapper MCP handshake, OpenCode
  config validation, secret scan, Markdown punctuation check, and
  `git diff --check`.

Did:

- Added a `comfyui-mcp` launcher that installs the external MIT package into
  ignored Phase 4 artifacts and runs it with Node.js 22 or newer.
- Added `drive16-comfyui` to `opencode.json`.
- Added a validator that initializes the wrapper over stdio and verifies the
  expected ComfyUI tools are exposed.
- Updated OpenCode config validation so the new MCP server is part of project
  truth.

Evidence:

- `npm view comfyui-mcp@0.21.0 name version license bin engines --json` reported
  package `comfyui-mcp`, version `0.21.0`, license `MIT`, binary
  `comfyui-mcp`, and Node.js requirement `>=22.0.0`.
- `scripts/validate-comfyui-mcp-wrapper.py` passed and reported
  `ComfyUI MCP wrapper ok: 113 tools`.
- The wrapper exposed `enqueue_workflow`, `generate_image`, and
  `get_system_stats`.
- `python3 scripts/validate-opencode-config.py` passed OpenCode config
  validation and still reported the existing model-credential validation
  request before full agent-loop runs.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.

Gate:

None.

Next:

- Ship the tuned Genesis palette ComfyUI workflow.

## 2026-06-30 - ITERATION 35 - ComfyUI endpoint health check

Plan:

- Task: add ComfyUI endpoint configuration and health probing behind the AI
  sprites toggle.
- Files: `app/src-tauri/src/comfyui.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase4-comfyui-endpoint.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: focused native ComfyUI tests, frontend build, rendered
  settings flow in the in-app browser, secret scan, Markdown punctuation
  check, and `git diff --check`.

Did:

- Added native `check_comfyui_endpoint` with local-only endpoint normalization
  and `GET /system_stats` probing.
- Added an endpoint field and `Test` action that appear only when `AI sprites`
  is enabled.
- Kept browser-preview behavior honest by reporting a failed state when no
  local ComfyUI server is available.
- Recorded the official ComfyUI `/system_stats` route source in
  `docs/phase4-comfyui-endpoint.md`.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture`
  passed with five focused tests.
- `pnpm --dir app build` passed.
- Browser check at `http://127.0.0.1:1420/` showed title `Drive16`, app
  content, and no framework error overlay.
- Agent Settings kept the ComfyUI config hidden while `AI sprites` was off.
- Enabling `AI sprites` revealed the endpoint field with
  `http://127.0.0.1:8188`.
- Clicking `Test` changed the ComfyUI status to a clean failed state because
  no local ComfyUI server was running in browser preview.
- Browser console warnings and errors were empty.
- Browser viewport had no horizontal overflow.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- Final `pnpm --dir app build` passed.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.

Gate:

None.

Next:

- Wrap ComfyUI via `comfyui-mcp`.

## 2026-06-30 - ITERATION 34 - Phase 4 enhancement toggles

Plan:

- Task: record Phase 3 approval and begin Phase 4 with default-off settings
  toggles for the deferred generators.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase4-enhancement-toggles.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: frontend build, rendered settings check in the in-app browser,
  secret scan, Markdown punctuation check, and `git diff --check`.

Did:

- Recorded the human's Phase 3 approval and moved `PROGRESS.md` to Phase 4.
- Added default-off `AI sprites` and `MML music` toggles to Agent Settings.
- Kept the toggles as UI state only so ComfyUI, `comfyui-mcp`, ctrmml, and the
  generated-asset prompt path remain follow-up work behind explicit gates.
- Added `docs/phase4-enhancement-toggles.md` and a decision entry for the
  default-off enhancement boundary.

Evidence:

- `pnpm --dir app build` passed.
- Browser check at `http://127.0.0.1:1420/` showed title `Drive16` and the
  `Phase 4 enhancements` header.
- Agent Settings rendered the `Enhancements` section.
- `AI sprites` and `MML music` were off by default after reload.
- Clicking both toggles changed their visible statuses to `On`.
- A final reload returned both toggles to off by default.
- Browser console warnings and errors were empty.
- Browser viewport had no horizontal overflow.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.

Gate:

None.

Next:

- Add ComfyUI endpoint configuration and health probing behind the AI sprites
  toggle.

## 2026-06-29 - ITERATION 33 - Phase 3 gate evidence packet

Plan:

- Task: consolidate the Phase 3 gate evidence into one review packet for
  human sign-off.
- Files: `docs/phase3-evidence.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: check the evidence against the Phase 3 exit criterion, run
  Markdown style checks for forbidden punctuation, scan for pasted secrets, and
  run `git diff --check`.

Did:

- Added `docs/phase3-evidence.md`, mapping every Phase 3 exit requirement to
  the exact proof document, command result, browser check, and artifact path
  already captured.
- Updated `PROGRESS.md` so the Phase 3 gate points to the consolidated packet
  while preserving `docs/phase3-v1-prompt.md` as the core prompt proof.
- Kept the caveat explicit: the v1 prompt command prefers the existing Phase 2
  agent-produced CORE project when present, with a committed fixture fallback.

Evidence:

- Reviewed the Phase 3 architecture exit criterion and current progress ledger.
- Verified the gate packet references the recorded Phase 3 proof set:
  app shell, preflight, starter ROM, framebuffer, OpenCode bridge, model
  settings, project export, and v1 prompt proof.
- Markdown punctuation and emoji guard returned no matches.
- Secret scan returned no matches for OpenRouter key patterns.
- `git diff --check` passed.
- Local app preview at `http://127.0.0.1:1420/` returned `HTTP 200`, and
  OpenCode health at `http://127.0.0.1:4096/global/health` returned healthy.

Gate:

Phase 3 gate remains reached. Human sign-off is required before advancing to
Phase 4.

Next:

- Request human sign-off for Phase 3.

## 2026-06-29 - ITERATION 32 - V1 prompt app proof

Plan:

- Task: drive the v1 prompt through the app and verify the bundled sprite and
  music ROM in the right pane.
- Files: `app/src-tauri/src/v1_prompt.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `docs/phase3-v1-prompt.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: focused v1 prompt tests, native ignored v1 prompt proof, frame
  stream validation, sprite movement validation, audio non-silence check,
  browser prompt flow, mobile overflow check, full Rust tests, Rust check,
  frontend build, Tauri debug build, secret scan, and `git diff --check`.

Did:

- Added native `run_v1_prompt`, which prefers the Phase 2 agent-produced CORE
  project when present, otherwise falls back to the committed CORE reference
  fixture.
- The native command validates the CORE source/resource contract, validates
  bundled assets, builds the ROM, runs Genteel, captures framebuffer data,
  validates Right-input sprite movement, and checks non-silent audio.
- Wired the chat composer so the v1-style sprite/music prompt loads the
  generated CORE ROM state into the right pane.
- Added browser-preview behavior with honest copy that native verification runs
  inside the Tauri app.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml v1_prompt -- --nocapture`
  passed with three focused tests and one ignored native run.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  v1_prompt_runs_core_asset_rom_when_tools_are_available -- --ignored --nocapture`
  passed.
- The local Phase 2 agent project was present.
- `scripts/validate-frame-stream.py
  artifacts/phase3/v1-prompt/v1-frames.rgb565 --min-frames 6` passed with six
  frames, indices `0..150`, and `15760` nonzero pixels.
- `scripts/validate-sprite-movement.py artifacts/phase3/v1-prompt/v1-neutral.png
  artifacts/phase3/v1-prompt/v1-right.png --direction right --min-delta 24
  --min-changed 40` passed with `changed_pixels=768` and `delta=155`.
- Audio dump check found `audio max abs: 10922` across `322386` samples.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with ten
  non-ignored tests and two ignored sidecar/native-run tests.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app build` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Browser validation at `http://127.0.0.1:1420/` accepted the prompt
  `make a sprite I can move left and right with music`, changed the project
  summary to `Generated CORE ROM`, updated Movement to `Right input verified`,
  updated Audio to `Non-silent 1` in preview mode, recorded `v1.ready`, and had
  no console warnings or errors.
- Mobile browser viewport `390` by `844` kept the generated CORE ROM state
  visible, had no horizontal overflow, and had no console warnings or errors.
- Browser screenshots were saved to:
  `artifacts/phase3/v1-prompt-browser/browser-after-prompt.png` and
  `artifacts/phase3/v1-prompt-browser/browser-mobile.png`.

Gate:

Phase 3 gate reached. Human sign-off is required before advancing to Phase 4.

Next:

- Request human sign-off for Phase 3.

## 2026-06-29 - ITERATION 31 - Project summary and ROM export

Plan:

- Task: add project management and export-ROM wiring for the current starter
  project.
- Files: `app/src-tauri/src/project.rs`, `app/src-tauri/src/main.rs`,
  `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase3-project-export.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: focused Rust tests for project summary and export copy, full
  Rust tests, Rust check, frontend build, Tauri debug build, browser export UI
  check, mobile overflow check, secret scan, and `git diff --check`.

Did:

- Added native project summary and export-ROM commands.
- Implemented export by copying the current starter ROM into ignored
  `artifacts/phase3/exports/`.
- Wired the top-bar `Export ROM` button to the export command, with a browser
  preview fallback.
- Replaced the static file list with project-summary file entries and file
  status.
- Added runtime metadata for the export directory or exported ROM byte count.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml project -- --nocapture`
  passed with two focused project/export tests.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with seven
  non-ignored tests and one ignored sidecar test.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app build` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Browser validation at `http://127.0.0.1:1420/` found title `Drive16`,
  `OpenCode live`, project summary `Starter Project`, export metadata, an
  `Export ROM` action, and no console warnings or errors.
- Browser export interaction updated runtime metadata to `0 B exported` in
  preview mode and recorded `export.preview` in the event feed.
- Mobile browser viewport `390` by `844` kept the project summary visible,
  kept export metadata present, had no horizontal overflow, and had no console
  warnings or errors.
- Browser screenshots were saved to:
  `artifacts/phase3/project-export/browser-after-export.png` and
  `artifacts/phase3/project-export/browser-mobile.png`.

Gate:

None.

Next:

- Drive the v1 prompt through the app and verify the bundled sprite and music
  ROM in the right pane.

## 2026-06-29 - ITERATION 30 - Model settings connection test

Plan:

- Task: add settings for model provider, OpenRouter key entry, model selector,
  and connection test.
- Files: `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase3-model-settings.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: confirm the OpenRouter key endpoint supports local preview
  CORS, build the frontend, test the settings dialog and OpenRouter key check
  in the in-app Browser, verify mobile layout, scan for the pasted key, and run
  the Tauri debug build.

Did:

- Added an `Agent Settings` drawer opened from the top model button or the
  left-pane gear.
- Added provider controls for OpenRouter and Ollama.
- Loaded OpenRouter model options from the live model list endpoint, with a
  small fallback list.
- Added a password-masked OpenRouter key field that stays only in React state.
- Added `Test connection`, which calls OpenRouter's key endpoint and renders a
  safe connected or failed status without printing the key.

Evidence:

- OpenRouter `OPTIONS https://openrouter.ai/api/v1/key` from the local preview
  origin returned `HTTP/2 204` with `access-control-allow-origin: *`.
- `pnpm --dir app build` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with five
  non-ignored tests and one ignored sidecar test.
- Browser validation at `http://127.0.0.1:1420/` opened the settings dialog,
  loaded six OpenRouter model options, selected the current Sonnet alias, and
  kept browser console warnings and errors empty.
- Browser connection test with the provided OpenRouter key returned
  `Connected` and `OpenRouter key accepted`; the key input remained masked and
  the event feed recorded `model.ready`.
- Mobile browser viewport `390` by `844` reopened settings after reload with
  runtime key length `0`, no horizontal overflow, and no console warnings or
  errors.
- Browser screenshots were saved to:
  `artifacts/phase3/model-settings/browser-connected.png` and
  `artifacts/phase3/model-settings/browser-mobile.png`.

Gate:

None.

Next:

- Add project management and export-ROM wiring.

## 2026-06-29 - ITERATION 29 - OpenCode HTTP/SSE bridge

Plan:

- Task: connect the left conversation pane to OpenCode HTTP/SSE.
- Files: `app/src-tauri/src/opencode.rs`, `app/src-tauri/src/main.rs`,
  `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock`,
  `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase3-opencode-bridge.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: discover the current OpenCode HTTP/SSE endpoints, run focused
  Rust tests and full app checks, validate message posting and event streaming
  in the in-app Browser, scan for the pasted OpenRouter key, and run
  `git diff --check`.

Did:

- Added a native OpenCode bridge that checks `/global/health`, launches
  `opencode serve` when needed, creates sessions, and posts no-reply user
  messages.
- Registered `connect_opencode` and `send_opencode_message` as Tauri commands.
- Wired the left pane to show OpenCode connection state, subscribe to
  `/global/event`, render recent SSE events, and post composer messages into an
  OpenCode session.
- Kept live model replies behind the next settings/key unit so this slice does
  not consume or store provider credentials.
- Added browser-preview fallback behavior for Vite preview.

Evidence:

- `opencode --version` reported `1.14.33`.
- `curl --max-time 5 http://127.0.0.1:4096/global/health` returned
  `{"healthy":true,"version":"1.14.33"}`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml opencode -- --nocapture`
  passed with two focused OpenCode bridge tests.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with five
  non-ignored tests and one ignored sidecar test.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app build` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Browser validation at `http://127.0.0.1:1420/` found title `Drive16`,
  `OpenCode live`, connected SSE events, no console warnings or errors, and an
  enabled composer.
- Browser message send posted `OpenCode bridge final bundle smoke test`,
  created an OpenCode session, rendered the no-reply post confirmation in the
  left pane, retained `message.posted` in the event feed, kept the top status
  at `Running`, and kept browser console warnings and errors empty.
- Mobile browser viewport `390` by `844` showed `OpenCode live`, kept the
  composer visible, and had no horizontal overflow.
- Browser screenshots were saved to:
  `artifacts/phase3/opencode-bridge/browser-after-send.png` and
  `artifacts/phase3/opencode-bridge/browser-mobile.png`.

Gate:

None.

Next:

- Add settings for model provider, OpenRouter key entry, model selector, and
  connection test.

## 2026-06-29 - ITERATION 28 - Genteel framebuffer canvas

Plan:

- Task: render the Genteel framebuffer stream in the right pane.
- Files: `app/src-tauri/src/starter_rom.rs`, `app/src/App.tsx`,
  `app/src/styles.css`, `docs/phase3-framebuffer.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: parse and test RGB565 frame records, rerun the native sidecar
  launch test, validate the stream artifact, build and check the app, validate
  the rendered canvas in the in-app Browser at desktop and mobile viewports,
  scan for the pasted OpenRouter key, and run `git diff --check`.

Did:

- Extended `launch_starter_rom` to parse Genteel `D16F` frame records and
  return base64 RGB565 frame payloads with stream metadata.
- Added focused Rust coverage for the RGB565 stream reader.
- Replaced the right-pane screenshot-only rendering path with a canvas that
  decodes RGB565 frames into RGBA pixels.
- Wired pause and resume to the canvas frame advancement.
- Added browser-preview framebuffer samples so the canvas path can be visually
  checked without native Tauri commands.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with three
  non-ignored tests and one ignored sidecar test.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  starter_rom_launches_existing_rom_when_assets_are_present -- --ignored`
  passed.
- `scripts/validate-frame-stream.py
  artifacts/phase3/starter-rom/starter-frames.rgb565 --min-frames 6` passed
  with six frames and `358400` nonzero pixels.
- `pnpm --dir app build` passed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Browser validation at `http://127.0.0.1:1420/` found title `Drive16`, a
  nonblank `Drive16 Agent` DOM, no framework overlay, and no console warnings
  or errors.
- Browser canvas check found one `framebuffer-canvas` at `320` by `240`.
- Browser frame samples moved between indices `30` and `0` while running.
- Browser pause interaction found one `Pause emulator` control and changed the
  screen state to `paused framebuffer`.
- Default browser viewport was `1280` by `720`, with no document overflow and
  screen bounds clear of the status panel.
- Mobile browser viewport was `390` by `844`, had no horizontal overflow, and
  showed the framebuffer canvas correctly after scrolling.
- Browser screenshots were saved to:
  `artifacts/phase3/framebuffer/browser-default.png`,
  `artifacts/phase3/framebuffer/browser-mobile-top.png`, and
  `artifacts/phase3/framebuffer/browser-mobile-framebuffer.png`.

Gate:

None.

Next:

- Connect the left conversation pane to OpenCode HTTP/SSE.

## 2026-06-29 - ITERATION 27 - Starter blank ROM preview

Plan:

- Task: launch a starter blank ROM path for the app preview.
- Files: `examples/app-starter-blank/`, `app/src-tauri/src/starter_rom.rs`,
  `app/src-tauri/src/main.rs`, `app/src-tauri/Cargo.toml`,
  `app/src-tauri/Cargo.lock`, `app/src/App.tsx`, `app/src/styles.css`,
  `docs/phase3-starter-rom.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: build the starter ROM with SGDK, run the native starter launch
  test through Genteel, validate the emitted frame stream, build and test the
  app, validate the rendered browser preview at desktop and mobile viewports,
  scan for the pasted OpenRouter key, and run `git diff --check`.

Did:

- Added `examples/app-starter-blank`, a dedicated Phase 3 blank starter ROM
  fixture.
- Added native Tauri `launch_starter_rom`, which builds the starter ROM when
  needed, runs Genteel as a sidecar process, validates the captured PNG and
  RGB565 frame stream, and returns a PNG data URL to the frontend.
- Wired the right pane to display the captured frame inside Tauri, with a clear
  browser-preview fallback under Vite preview.
- Replaced the fake controls panel with ROM metadata for the starter path.
- Fixed the 1280 by 720 preview sizing so the emulator screen no longer crowds
  the status panels.

Evidence:

- `scripts/build-sgdk.sh examples/app-starter-blank` passed and built:
  `examples/app-starter-blank/out/rom.bin`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  starter_paths_stay_in_expected_locations` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml
  starter_rom_launches_existing_rom_when_assets_are_present -- --ignored`
  passed.
- `scripts/validate-frame-stream.py
  artifacts/phase3/starter-rom/starter-frames.rgb565 --min-frames 6` passed
  with six frames and `358400` nonzero pixels.
- Starter screenshot: `artifacts/phase3/starter-rom/starter-frame.png`.
- `pnpm --dir app build` passed.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Browser validation at `http://127.0.0.1:1420/` found title `Drive16`, a
  nonblank `Drive16 Agent` DOM, no framework overlay, and no console warnings
  or errors.
- Browser interaction check found exactly one `Launch starter ROM` button and
  kept the expected preview fallback state.
- Default browser viewport was `1280` by `720`, with no horizontal or vertical
  document overflow and screen bounds clear of the status panel.
- Mobile browser viewport was `390` by `844`, had no horizontal overflow, and
  showed the ROM pane correctly after scrolling.
- Browser screenshots were saved to:
  `artifacts/phase3/starter-rom/browser-default.png`,
  `artifacts/phase3/starter-rom/browser-mobile-top.png`, and
  `artifacts/phase3/starter-rom/browser-mobile-rom.png`.

Gate:

None.

Next:

- Render the Genteel live framebuffer in the right pane.

## 2026-06-29 - ITERATION 26 - App-side tool preflight

Plan:

- Task: add app-side dependency and CORE tool health preflight checks.
- Files: `app/src-tauri/src/preflight.rs`, `app/src-tauri/src/main.rs`,
  `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock`,
  `app/src/App.tsx`, `app/src/styles.css`, `docs/phase3-preflight.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the focused Rust preflight test, build the React frontend,
  check the Tauri Rust shell, build the Tauri shell without bundling, validate
  the rendered health panel in the in-app Browser at default and mobile
  viewports, scan for the pasted OpenRouter key, and run `git diff --check`.

Did:

- Added native Tauri `run_preflight`.
- The preflight checks OpenCode, Docker, `scripts/build-sgdk.sh`, the pinned
  Genteel sidecar binary, the Drive16 RAG corpus, and CORE bundled assets.
- Replaced the static tool-health rows with a refreshable health panel.
- Added a browser-preview fallback so the web preview explains that command
  checks run inside the native Tauri app.
- Fixed a default 1280 by 720 viewport issue where the emulator preview crowded
  the health panel.
- Fixed mobile width and wrapping rules for top controls, messages, and health
  rows.

Evidence:

- `cargo test --manifest-path app/src-tauri/Cargo.toml
  preflight_reports_expected_core_checks` passed.
- `pnpm --dir app build` passed.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- In-app Browser validation loaded `http://127.0.0.1:1420/` with title
  `Drive16`.
- Browser DOM snapshot contained `Drive16 Agent`, no framework overlay was
  detected, and console warnings/errors were empty.
- Refreshing `data-testid="refresh-health"` showed `Needs attention` and
  `Preview mode` in browser preview, with OpenCode and Docker as `Check` and
  SGDK build and Genteel as `Ready`.
- Default viewport metrics returned `scrollWidth: 1280`, `innerWidth: 1280`,
  `scrollHeight: 720`, and `innerHeight: 720`.
- Mobile viewport metrics returned `scrollWidth: 390`, `innerWidth: 390`,
  `scrollHeight: 1632`, and `innerHeight: 844`.
- In-app Browser screenshots were saved to:
  `artifacts/phase3/preflight/browser-default.png`,
  `artifacts/phase3/preflight/browser-mobile-top.png`, and
  `artifacts/phase3/preflight/browser-mobile-health.png`.

Gate:

None.

Next:

- Launch a starter blank ROM path for the app preview.

## 2026-06-29 - ITERATION 25 - Phase 3 Tauri app shell

Plan:

- Task: begin Phase 3 with a runnable two-pane app shell.
- Files: `app/`, `docs/phase3-app-shell.md`, `PROGRESS.md`, `WORKLOG.md`,
  `DECISIONS.md`, and `README.md`.
- Verification: install app dependencies with the bundled Node runtime, build
  the React frontend, check and build the Tauri Rust shell, launch the local
  preview, capture desktop and mobile screenshots, run a browser interaction
  check, scan for the pasted OpenRouter key, and run `git diff --check`.

Did:

- Recorded Phase 2 human approval and moved `PROGRESS.md` to Phase 3.
- Added a Tauri 2 shell under `app/src-tauri/`.
- Added a React and Vite frontend under `app/src/`.
- Built the first Drive16 two-pane app screen with conversation, tool stream,
  project files, blank ROM preview, transport controls, tool health, model
  selector, and export affordance.
- Added local UI behavior for sending a message, pause and resume, reset, and
  Right/Left sprite marker movement.
- Fixed the first mobile responsive bug where the top bar overlapped the
  workspace.
- Refreshed the local Rust stable toolchain to `rustc 1.96.0` so current Tauri
  dependencies with Rust 2024-edition crates could compile.

Evidence:

- `pnpm --dir app install` passed after approving the `esbuild` build script
  in `app/pnpm-workspace.yaml`.
- `pnpm --dir app build` passed with Vite output under ignored `app/dist/`.
- `cargo check --manifest-path app/src-tauri/Cargo.toml` passed.
- `pnpm --dir app tauri build --debug --no-bundle` passed and built:
  `app/src-tauri/target/debug/drive16`.
- Preview server ran at `http://127.0.0.1:1420/`.
- Chrome automation captured:
  `artifacts/phase3/app-shell/desktop.png` and
  `artifacts/phase3/app-shell/mobile.png`.
- Desktop viewport check returned `scrollWidth: 1440`, `innerWidth: 1440`,
  `scrollHeight: 900`, and `innerHeight: 900`.
- Mobile responsive check returned matching top-bar bottom and workspace top:
  `149.6875`.
- Interaction check passed: message count became 5, pause and resume toggled
  the emulator viewport, and Right moved the sprite marker from `402.875px` to
  `464.859px`.

Gate:

None.

Next:

- Add app-side dependency and tool health preflight checks.

## 2026-06-29 - ITERATION 24 - Phase 2 agent-loop gate evidence

Plan:

- Task: run and record the Phase 2 prompt-driven gate now that OpenRouter is
  configured.
- Files: `docs/phase2-evidence.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the Phase 2 agent-loop harness with OpenCode, rerun the
  verify-only artifact check, inspect the screenshots, run the sprite movement
  validator, scan the workspace for the pasted OpenRouter key, and run
  `git diff --check`.

Did:

- Ran the Phase 2 OpenCode validation with CORE tools only.
- Confirmed the generated project uses `drive16_player` and `drive16_loop`.
- Confirmed the agent repaired an initial asset path build failure and rebuilt
  successfully.
- Confirmed Genteel produced neutral and Right-input screenshots for the
  generated ROM.
- Confirmed the emulator MCP audio evidence is non-silent.
- Added the Phase 2 evidence packet and marked the Phase 2 gate ready for
  human sign-off.

Evidence:

- `DRIVE16_PHASE2_MODEL=openrouter/anthropic/claude-sonnet-4.6
  scripts/validate-phase2-agent-loop.py --run-agent` passed with:
  `Phase 2 agent-loop ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase2/agent-loop/verification-right.png`.
- `scripts/validate-phase2-agent-loop.py --verify-only` passed with:
  `Phase 2 agent-loop artifacts ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase2/agent-loop/verification-right.png`.
- `scripts/validate-sprite-movement.py
  artifacts/phase2/agent-loop/verification-neutral.png
  artifacts/phase2/agent-loop/verification-right.png --direction right
  --min-delta 24 --min-changed 40` passed with:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- The OpenCode log at `artifacts/phase2/agent-loop/opencode-run.jsonl`
  includes `query_documents`, `build_rom`, `run_rom`, `capture_frame`,
  `send_input`, and `capture_audio`.
- `capture_audio` reported `nonSilent: true` and `maxAbsSample: 10922`.
- A workspace scan for the pasted OpenRouter key returned no files.

Gate:

Phase 2 gate reached. Human sign-off is required before Phase 3.

Next:

- Request human sign-off for Phase 2 before starting Phase 3.

## 2026-06-29 - ITERATION 23 - Sprite movement screenshot validator

Plan:

- Task: strengthen Phase 2 controllable-sprite evidence beyond byte-different
  screenshots.
- Files: `scripts/validate-sprite-movement.py`,
  `scripts/validate-phase2-core-assets.sh`,
  `scripts/validate-phase2-agent-loop.py`, `scripts/README.md`,
  `docs/phase2-agent-loop.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: compile the new validator and Phase 2 harness, run the
  movement validator against existing Phase 2 screenshots, rerun the Phase 2
  fixture validator, rerun the Phase 2 harness in gate mode, and run
  `git diff --check`.

Did:

- Added `scripts/validate-sprite-movement.py`, a dependency-free PNG decoder
  and movement-signal validator.
- Replaced byte-only screenshot comparison in the Phase 2 fixture and agent
  harness with the new movement validator.

Evidence:

- `python3 -m py_compile scripts/validate-sprite-movement.py
  scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-sprite-movement.py
  artifacts/phase2/core-assets/phase2-core-assets.png
  artifacts/phase2/core-assets/phase2-core-assets-right.png --direction right
  --min-delta 24 --min-changed 40` passed with:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- `scripts/validate-phase2-core-assets.sh` passed and now includes:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- `git diff --check` passed.

Gate:

None.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 22 - Phase 2 final-run audio prompt

Plan:

- Task: align the Phase 2 agent instructions with the harness check that the
  latest emulator MCP state includes audio evidence.
- Files: `agent/skills/phase2-core-assets.md`,
  `scripts/validate-phase2-agent-loop.py`, `docs/phase2-agent-loop.md`, and
  `WORKLOG.md`.
- Verification: run the Phase 2 agent-context validator, compile and run the
  Phase 2 agent-loop harness in gate mode, and run `git diff --check`.

Did:

- Tightened the Phase 2 skill and harness prompt so the final Right-input
  `run_rom` call must use `dump_audio`.
- Clarified the validation error when the latest emulator MCP state has no
  audio dump.

Evidence:

- `scripts/validate-phase2-agent-context.sh` passed with:
  `Phase 2 agent context ok: /Users/chrissotraidis/Documents/GitHub/drive16/agent/skills/phase2-core-assets.md`.
- `python3 -m py_compile scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- `git diff --check` passed.

Gate:

None.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 21 - Emulator MCP audio evidence

Plan:

- Task: expose audio evidence through the CORE emulator MCP server for Phase 2.
- Files: `mcp-servers/emulator/server.py`,
  `scripts/validate-emulator-audio-mcp.py`,
  `scripts/validate-emulator-mcp.py`,
  `mcp-servers/emulator/README.md`,
  `agent/skills/phase2-core-assets.md`,
  `scripts/validate-phase2-agent-context.sh`,
  `scripts/validate-phase2-agent-loop.py`,
  `docs/phase2-agent-loop.md`, `scripts/README.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: compile the touched Python validators and server, run the base
  emulator MCP validator, run the new audio MCP validator against the Phase 2
  asset ROM, rerun the Phase 2 agent-context validator, rerun the Phase 2
  harness in gate mode, and run `git diff --check`.

Did:

- Added `dump_audio` support to the emulator MCP `run_rom` tool.
- Added `capture_audio`, which inspects the latest WAV dump and reports
  non-silent audio stats.
- Added `scripts/validate-emulator-audio-mcp.py`.
- Updated the Phase 2 skill and harness to require `capture_audio`.

Evidence:

- `python3 -m py_compile mcp-servers/emulator/server.py
  scripts/validate-emulator-mcp.py scripts/validate-emulator-audio-mcp.py
  scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-emulator-mcp.py` passed with:
  `Emulator MCP ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- `scripts/validate-emulator-audio-mcp.py` passed with:
  `Emulator audio MCP ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-audio.wav max_abs=10922`.
- `artifacts/phase1/emulator/state.json` recorded `"audioDumpPath"` for
  `examples/phase2-core-assets/out/rom.bin`.
- `scripts/validate-phase2-agent-context.sh` passed with:
  `Phase 2 agent context ok: /Users/chrissotraidis/Documents/GitHub/drive16/agent/skills/phase2-core-assets.md`.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- `git diff --check` passed.

Gate:

None.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 20 - Phase 2 agent-loop harness

Plan:

- Task: add the Phase 2 prompt-driven validation harness.
- Files: `scripts/validate-phase2-agent-loop.py`,
  `docs/phase2-agent-loop.md`, `scripts/README.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: compile the Python harness, run it without credentials to
  confirm it prepares the SGDK project and opens a validation request, rerun
  the Phase 2 core asset fixture validator, and run `git diff --check`.

Did:

- Added `scripts/validate-phase2-agent-loop.py`.
- The harness prepares `artifacts/phase2/agent-loop/project`, embeds the Phase
  2 skill file into a plain OpenCode prompt, and gates the real run behind
  `--run-agent`, `DRIVE16_PHASE2_MODEL`, and an OpenRouter credential.
- The post-agent verifier checks project files, MCP state, OpenCode tool-call
  markers, neutral and Right-input Genteel screenshots, and non-silent audio.
- Added `docs/phase2-agent-loop.md`.

Evidence:

- `python3 -m py_compile scripts/validate-phase2-agent-loop.py` passed.
- `scripts/validate-phase2-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE2_MODEL is not set.`
- The harness prepared:
  `artifacts/phase2/agent-loop/project`.
- The harness wrote the prompt to:
  `artifacts/phase2/agent-loop/prompt.md`.
- `scripts/validate-phase2-core-assets.sh` passed with:
  `Audio dump is non-silent: max abs sample 10922`.
- `git diff --check` passed.

VALIDATION REQUEST:

Configure OpenRouter outside the repo, choose a Phase 2 OpenRouter model, then
run:

```sh
export DRIVE16_PHASE2_MODEL=openrouter/<provider-model>
export OPENROUTER_API_KEY=...
scripts/validate-phase2-agent-loop.py --run-agent
```

Expected result: the harness reports `Phase 2 agent-loop ok:
artifacts/phase2/agent-loop/verification-right.png`.

Next:

- Run the Phase 2 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 19 - Phase 2 agent asset instructions

Plan:

- Task: teach the agent how to wire the Phase 2 bundled sprite and music loop.
- Files: `agent/README.md`, `agent/skills/phase2-core-assets.md`,
  `scripts/validate-phase2-agent-context.sh`, `scripts/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: run the Phase 2 agent-context validator, which checks the skill
  file for required asset/tool terms, refreshes the RAG corpus, queries for the
  Phase 2 bundled asset symbols, and run `git diff --check`.

Did:

- Added `agent/skills/phase2-core-assets.md` with the CORE-only asset wiring
  recipe for Phase 2.
- Added `scripts/validate-phase2-agent-context.sh`.
- Recorded the `agent/skills/` convention in `DECISIONS.md`.

Evidence:

- `scripts/validate-phase2-agent-context.sh` passed with:
  `Phase 2 agent context ok: /Users/chrissotraidis/Documents/GitHub/drive16/agent/skills/phase2-core-assets.md`.
- The validator confirmed the skill file contains `drive16_player`,
  `drive16_loop`, `resources.res`, `XGM_startPlay`, `SPR_addSprite`,
  `send_input`, and `capture_frame`.
- The validator refreshed the RAG corpus and confirmed a Phase 2 query returns
  `drive16_player`, `drive16_loop`, `SPRITE`, and `XGM`.
- `git diff --check` passed.

Gate:

None.

Next:

- Add a Phase 2 validation harness for a prompt-driven asset ROM.

## 2026-06-29 - ITERATION 18 - Phase 2 CORE asset fixture

Plan:

- Task: add the Phase 2 reference SGDK fixture that uses the CORE bundled asset
  pack through `resources.res`.
- Files: `examples/phase2-core-assets/`,
  `scripts/validate-phase2-core-assets.sh`, `scripts/README.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: run the fixture validator, which validates the core assets,
  builds the ROM through docker-sgdk, captures neutral and Right-input
  screenshots in Genteel, checks the screenshots differ, checks the audio dump
  is non-silent, and run `git diff --check`.

Did:

- Added `examples/phase2-core-assets` as the Phase 2 reference fixture.
- The fixture references `drive16_player` and `drive16_loop` from
  `assets/core/` through `res/resources.res`.
- Added `scripts/validate-phase2-core-assets.sh`.

Evidence:

- `scripts/validate-phase2-core-assets.sh` passed.
- The validator ran `scripts/validate-core-assets.py` with:
  `Core assets ok: /Users/chrissotraidis/Documents/GitHub/drive16/assets/core`.
- SGDK built:
  `examples/phase2-core-assets/out/rom.bin`.
- Genteel captured the neutral screenshot:
  `artifacts/phase2/core-assets/phase2-core-assets.png`.
- Genteel captured the scripted Right-input screenshot:
  `artifacts/phase2/core-assets/phase2-core-assets-right.png`.
- The screenshot byte comparison confirmed the Right-input run changed the
  frame from the neutral run.
- The audio dump check passed with:
  `Audio dump is non-silent: max abs sample 10922`.
- Visual inspection shows the neutral screenshot contains `Drive16 Phase 2`,
  the bundled sprite, and `Core VGM loop plays`; the Right-input screenshot
  shows the sprite moved to the right edge.
- `git diff --check` passed.

Gate:

None.

Next:

- Teach the agent, via RAG or skill context, to wire the bundled sprite and
  music loop from a prompt.

## 2026-06-29 - ITERATION 17 - Phase 2 CORE asset pack

Plan:

- Task: begin Phase 2 by establishing the CORE bundled asset pack contract.
- Files: `assets/core/`, `assets/README.md`,
  `scripts/validate-core-assets.py`, `scripts/README.md`,
  `corpus/drive16/sgdk-project-patterns.md`,
  `corpus/vdp/genesis-vdp-core.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: run the core asset validator, compile it, regenerate the RAG
  index so the Phase 2 asset notes are searchable, and run `git diff --check`.

Did:

- Recorded the human Phase 1 approval and moved the ledger to Phase 2.
- Promoted the original Drive16 sprite and VGM loop into `assets/core/`.
- Added `assets/core/manifest.json` with stable symbols `drive16_player` and
  `drive16_loop`.
- Added `scripts/validate-core-assets.py` to validate the PNG, VGM, and
  manifest contract.
- Updated the RAG project-pattern notes with Phase 2 asset wiring guidance.

Evidence:

- `python3 -m py_compile scripts/validate-core-assets.py` passed.
- `scripts/validate-core-assets.py` passed with:
  `Core assets ok: /Users/chrissotraidis/Documents/GitHub/drive16/assets/core`.
- `scripts/validate-rag-corpus.sh` passed with:
  `Succeeded: 15`, `Failed: 0`, `Total chunks: 1514`, and status
  `{"documentCount":15,"chunkCount":1514,"memoryUsage":60.45647430419922,"uptime":0.437156875,"ftsIndexEnabled":true,"searchMode":"hybrid"}`.
- `git diff --check` passed.

Gate:

None.

Next:

- Add and verify a Phase 2 CORE asset fixture project that references the pack
  through `resources.res`.

## 2026-06-29 - ITERATION 16 - Phase 1 agent-loop gate run

Plan:

- Task: run the real Phase 1 OpenRouter-backed agent-loop validation.
- Files: `PROGRESS.md`, `WORKLOG.md`, and `docs/phase1-evidence.md`.
- Verification: run `scripts/validate-phase1-agent-loop.py --run-agent` with
  an OpenRouter model and credential outside the repo, inspect the captured
  screenshot, confirm no pasted key was written to files, and run
  `git diff --check`.

Did:

- Ran the Phase 1 validation harness with
  `DRIVE16_PHASE1_MODEL=openrouter/anthropic/claude-sonnet-4.6`.
- OpenCode worked from the generated plain text prompt under
  `artifacts/phase1/agent-loop/prompt.md`.
- The agent queried RAG, repaired the deliberate compile error, built the SGDK
  project, ran the ROM in Genteel, captured a screenshot, and reported success.
- Added the Phase 1 evidence packet.

Evidence:

- `scripts/validate-phase1-agent-loop.py --run-agent` passed with:
  `Phase 1 agent-loop ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- `artifacts/phase1/agent-loop/project/src/main.c` now draws
  `Drive16 Phase 1` and `Agent loop OK` on a blue background.
- `artifacts/phase1/sgdk-build/last-build.json` recorded `"ok": true` for
  `artifacts/phase1/agent-loop/project/out/rom.bin`.
- `artifacts/phase1/emulator/state.json` recorded `"ok": true` for the same
  ROM and screenshot path.
- Visual inspection of `artifacts/phase1/emulator/last-frame.png` shows the
  expected blue screen with `Drive16 Phase 1` and `Agent loop OK`.
- The OpenCode JSON log at `artifacts/phase1/agent-loop/opencode-run.jsonl`
  contained the expected `query_documents`, `build_rom`, `read_build_log`,
  `run_rom`, and `capture_frame` calls.
- A workspace scan for the pasted OpenRouter key returned no files.

Gate:

Phase 1 gate reached. Human sign-off is required before Phase 2 begins.

Next:

- Request Phase 1 sign-off, then begin Phase 2 after approval.

## 2026-06-29 - ITERATION 15 - Phase 1 agent-loop validation harness

Plan:

- Task: add the exact Phase 1 CLI validation harness for the credential-gated
  OpenCode text loop.
- Files: `scripts/validate-phase1-agent-loop.py`,
  `docs/phase1-agent-loop.md`, `docs/phase1-opencode.md`, `PROGRESS.md`,
  `WORKLOG.md`, and `DECISIONS.md`.
- Verification: compile the Python harness, run it without credentials to
  confirm it prepares the broken SGDK project and opens a validation request,
  rerun the OpenCode config validator, rerun the SGDK build MCP smoke test,
  rerun the emulator MCP smoke test, and run `git diff --check`.

Did:

- Added `scripts/validate-phase1-agent-loop.py`.
- The harness prepares `artifacts/phase1/agent-loop/project` with a deliberate
  `DRIVE16_COMPILE_ERROR_SENTINEL` compile error.
- The harness writes the exact OpenCode prompt to
  `artifacts/phase1/agent-loop/prompt.md`.
- The real agent run is guarded behind `--run-agent`,
  `DRIVE16_PHASE1_MODEL=openrouter/<provider-model>`, and an OpenRouter
  credential outside the repo.
- Added `docs/phase1-agent-loop.md` and linked it from
  `docs/phase1-opencode.md`.

Evidence:

- `python3 -m py_compile scripts/validate-phase1-agent-loop.py
  scripts/validate-opencode-config.py scripts/validate-sgdk-build-mcp.py
  scripts/validate-emulator-mcp.py` passed.
- `scripts/validate-phase1-agent-loop.py` passed in gate mode and printed:
  `VALIDATION REQUEST: Phase 1 agent-loop validation is ready but cannot run yet.`
  `DRIVE16_PHASE1_MODEL is not set.`
- `scripts/validate-opencode-config.py` passed with:
  `OpenCode config ok`
  `VALIDATION REQUEST: configure OpenRouter with opencode providers login or OPENROUTER_API_KEY before the agent loop can be run.`
- `scripts/validate-sgdk-build-mcp.py` passed with:
  `SGDK build MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/examples/sgdk-hello-world/out/rom.bin`.
- `scripts/validate-emulator-mcp.py` passed with:
  `Emulator MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- `git diff --check` passed.

VALIDATION REQUEST:

Configure OpenRouter outside the repo, choose a Phase 1 OpenRouter model, then
run:

```sh
export DRIVE16_PHASE1_MODEL=openrouter/<provider-model>
export OPENROUTER_API_KEY=...
scripts/validate-phase1-agent-loop.py --run-agent
```

Expected result: the harness reports `Phase 1 agent-loop ok:
artifacts/phase1/emulator/last-frame.png`.

Next:

- Run the Phase 1 agent-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 14 - OpenCode MCP project config

Plan:

- Task: configure OpenCode with the Phase 1 MCP servers without committing any
  credentials.
- Files: `opencode.json`, `scripts/validate-opencode-config.py`,
  `docs/phase1-opencode.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: compile the validator, confirm OpenCode resolves the three MCP
  servers from project config, smoke-test `opencode serve`, and report the
  OpenRouter credential gate.

Did:

- Added project-level `opencode.json` wiring `drive16-sgdk-build`,
  `drive16-emulator`, and `drive16-rag`.
- Added `docs/phase1-opencode.md` with the non-secret setup and OpenRouter
  credential gate.
- Added `scripts/validate-opencode-config.py` to verify OpenCode config
  resolution and headless server startup.

Evidence:

- `opencode --version` reported `1.14.33`.
- `npm view opencode-ai version bin license --json` reported latest npm
  version `1.17.11`, binary `opencode`, and license `MIT`.
- `python3 -m py_compile scripts/validate-opencode-config.py` passed.
- `scripts/validate-opencode-config.py` passed with:
  `OpenCode config ok`
  `VALIDATION REQUEST: configure OpenRouter with opencode providers login or OPENROUTER_API_KEY before the agent loop can be run.`
- `git diff --check` passed.

VALIDATION REQUEST:

Configure OpenRouter outside the repo before the Phase 1 agent loop can be run:

```sh
opencode providers login
```

or:

```sh
export OPENROUTER_API_KEY=...
```

After that, run the first CLI text-loop prompt.

Next:

- Run the plain CLI text-loop validation after OpenRouter is configured.

## 2026-06-29 - ITERATION 13 - RAG corpus and local index

Plan:

- Task: stand up the Phase 1 local RAG path and index SGDK plus VDP documents.
- Files: `scripts/mcp-local-rag.sh`, `scripts/fetch-rag-corpus.sh`,
  `scripts/validate-rag-corpus.sh`, `corpus/README.md`,
  `corpus/sources.json`, `corpus/drive16/sgdk-project-patterns.md`,
  `corpus/vdp/genesis-vdp-core.md`, fetched SGDK corpus files under
  `corpus/sgdk/`, `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: syntax-check the shell scripts, fetch pinned SGDK v2.11 docs,
  install and run `mcp-local-rag@0.15.3` with Node 22 or newer, ingest the
  corpus into ignored LanceDB storage, and query for SGDK and VDP terms.

Did:

- Added a local wrapper that installs `mcp-local-rag@0.15.3` under
  `artifacts/phase1/mcp-local-rag/` and runs it with a Node 22+ runtime.
- Added a fetch script for pinned SGDK v2.11 documentation and API headers.
- Added Drive16-authored VDP and SGDK project-pattern notes for the text-only
  Phase 1 loop.
- Added a corpus source manifest and RAG validation script.
- Confirmed SGDK headers are stored as `.txt` corpus documents so
  `mcp-local-rag` indexes them.

Evidence:

- `npm view mcp-local-rag version license bin --json` reported version
  `0.15.3`, license `MIT`, and binary `dist/index.js`.
- System `node --version` reported `v21.1.0`; `mcp-local-rag@0.15.3` failed
  under `npx` because it requires Node 22 or newer.
- Bundled Codex Node reported `v24.14.0` and successfully ran the locally
  installed `mcp-local-rag` CLI.
- `bash -n scripts/mcp-local-rag.sh scripts/fetch-rag-corpus.sh
  scripts/validate-rag-corpus.sh` passed.
- `scripts/fetch-rag-corpus.sh` fetched SGDK v2.11 docs and headers into
  `corpus/sgdk/`.
- `scripts/validate-rag-corpus.sh` passed with:
  `Succeeded: 15`, `Failed: 0`, `Total chunks: 1503`, and status
  `{"documentCount":15,"chunkCount":1503,"memoryUsage":66.1068344116211,"uptime":0.448918375,"ftsIndexEnabled":true,"searchMode":"hybrid"}`.
- `git diff --check` passed.

Gate:

None.

Next:

- Configure `opencode serve` with OpenRouter and the Phase 1 MCP servers.

## 2026-06-29 - ITERATION 12 - Genteel emulator MCP wrapper

Plan:

- Task: wrap the proven Genteel sidecar path as the Phase 1 emulator MCP
  server.
- Files: `mcp-servers/emulator/server.py`,
  `scripts/validate-emulator-mcp.py`, `mcp-servers/emulator/README.md`,
  `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: syntax-check the Python files, exercise the MCP server over
  stdio by listing tools, writing a Genteel input script, running the
  hello-world ROM headlessly, returning the captured PNG frame, and validating
  the RGB565 frame stream.

Did:

- Added a dependency-free Python stdio MCP server exposing `run_rom`,
  `capture_frame`, `send_input`, and `read_state`.
- Wired `run_rom` to the pinned Genteel binary from `scripts/build-genteel.sh`.
- Made `capture_frame` return the latest PNG frame as MCP image content plus a
  file path.
- Made `send_input` write sparse Genteel CSV input scripts for the next
  emulator run.
- Added a reusable validator that talks to the server as an MCP client.

Evidence:

- `python3 -m py_compile mcp-servers/emulator/server.py
  scripts/validate-emulator-mcp.py` passed.
- `scripts/validate-emulator-mcp.py` passed with:
  `Emulator MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase1/emulator/last-frame.png`.
- Visual inspection of
  `artifacts/phase1/emulator/last-frame.png` shows the expected
  `Drive16 Phase 0` and `Hello from SGDK` text.
- `scripts/validate-frame-stream.py artifacts/phase1/emulator/last-frames.rgb565
  --min-frames 3` passed with:
  `Frame stream ok: 3 frames, indices 0..60, nonzero pixels 5520`.
- `git diff --check` passed.

Gate:

None.

Next:

- Stand up `mcp-local-rag` and index the SGDK plus VDP docs.

## 2026-06-29 - ITERATION 11 - SGDK build MCP wrapper

Plan:

- Task: start Phase 1 by wrapping the proven docker-sgdk build path as the
  SGDK build MCP server.
- Files: `mcp-servers/sgdk-build/server.py`,
  `scripts/validate-sgdk-build-mcp.py`, `mcp-servers/sgdk-build/README.md`,
  `scripts/build-sgdk.sh`, `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Verification: syntax-check the Python and shell files, then exercise the MCP
  server over stdio by listing tools, cleaning the hello-world project, building
  the ROM, and reading the captured build log.

Did:

- Moved the ledger into Phase 1 after human sign-off for Phase 0.
- Added a dependency-free Python stdio MCP server exposing `build_rom`,
  `clean`, and `read_build_log`.
- Captured build output and metadata under
  `artifacts/phase1/sgdk-build/`.
- Added a reusable validator that talks to the server as an MCP client.
- Updated `scripts/build-sgdk.sh` so the `clean` target succeeds without
  expecting an output ROM.

Evidence:

- `python3 -m py_compile mcp-servers/sgdk-build/server.py
  scripts/validate-sgdk-build-mcp.py` passed.
- `bash -n scripts/build-sgdk.sh` passed.
- `scripts/validate-sgdk-build-mcp.py` passed with:
  `SGDK build MCP ok:
  /Users/chrissotraidis/Documents/GitHub/drive16/examples/sgdk-hello-world/out/rom.bin`.
- `git diff --check` passed.

Gate:

None.

Next:

- Add the Genteel emulator sidecar adapter and MCP server.

## 2026-06-29 - ITERATION 10 - Phase 0 evidence packet

Plan:

- Task: package the Phase 0 gate evidence without advancing to Phase 1.
- Files: `docs/phase0-evidence.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: re-check frame stream parsing, generated asset metadata,
  validation script syntax, audio dump metadata, and Markdown hygiene.

Did:

- Added `docs/phase0-evidence.md`, mapping each Phase 0 requirement to the
  exact command and artifact that proves it.
- Updated `PROGRESS.md` to point at the evidence packet while keeping the Phase
  0 gate closed pending human sign-off.

Evidence:

- `scripts/validate-frame-stream.py artifacts/phase0/phase0-assets.frames
  --min-frames 6` passed with:
  `Frame stream ok: 6 frames, indices 0..150, nonzero pixels 5364`.
- `scripts/generate-phase0-assets.py --check` passed.
- `bash -n` passed for Phase 0 shell validators.
- Audio dump check reported stereo, 16-bit, 53267 Hz, 161210 frames, max
  absolute sample `10922`.

Gate:

Phase 0 is still awaiting explicit human sign-off. No Phase 1 work was started.

Next:

- Request Phase 0 sign-off.
- After sign-off, begin Phase 1 with the SGDK build MCP server wrapper.

## 2026-06-29 - ITERATION 9 - Genteel RGB565 frame stream proof

Plan:

- Task: prove the Phase 0 live-framebuffer path with the smallest local Genteel
  adapter that does not vendor or link emulator code into Drive16.
- Files: `patches/genteel/phase0-frame-stream.patch`,
  `scripts/build-genteel.sh`, `scripts/validate-frame-stream.py`,
  `scripts/validate-genteel-frame-stream.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `DECISIONS.md`, `PROGRESS.md`, and
  `WORKLOG.md`.
- Verification: apply the patch through `scripts/build-genteel.sh`, build
  Genteel, build the Phase 0 asset ROM, run it headlessly while streaming
  frames, parse the raw stream records, inspect the screenshot cross-check, run
  script syntax checks, and run `git diff --check`.

Did:

- Added a Drive16-owned patch for pinned Genteel commit
  `8043061f50782d6066cd39925f0f808f06d665ea`.
- Patched Genteel adds `--stream-frames <file>` and `--stream-every <n>`.
- Added `scripts/validate-frame-stream.py` to parse and validate the raw
  `D16F` RGB565 stream records.
- Added `scripts/validate-genteel-frame-stream.sh` to build the patched Genteel
  binary, build the Phase 0 asset ROM, stream frames, and validate the stream.
- Updated the Phase 0 runbook with the frame-stream validation command.

Evidence:

- `scripts/build-genteel.sh` built the patched Genteel binary successfully.
- `scripts/validate-genteel-frame-stream.sh` built
  `examples/phase0-assets/out/rom.bin`, ran it for 180 frames, wrote
  `artifacts/phase0/phase0-assets.frames`, and saved
  `artifacts/phase0/phase0-stream-proof.png`.
- `scripts/validate-frame-stream.py` reported:
  `Frame stream ok: 6 frames, indices 0..150, nonzero pixels 5364`.
- Visual inspection of `artifacts/phase0/phase0-stream-proof.png` shows the
  Phase 0 text and bundled sprite.

Gate:

Phase 0 exit criterion is now evidenced. Do not start Phase 1 until the human
confirms Phase 0 is complete.

Next:

- Request Phase 0 sign-off.
- After sign-off, begin Phase 1 with the SGDK build MCP server wrapper.

## 2026-06-29 - ITERATION 8 - Live-framebuffer gate

Plan:

- Task: record the remaining Phase 0 live-framebuffer gap and stop for a human
  decision before changing the emulator plan.
- Files: `DECISIONS.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: inspect the pinned Genteel source for framebuffer, screenshot,
  stream, and CLI support; run `git diff --check`.

Did:

- Audited the pinned Genteel source for live-framebuffer clues.
- Confirmed the build exposes headless screenshot capture, input scripting,
  audio dump, GUI rendering, and internal `vdp.framebuffer`.
- Did not find a documented continuous framebuffer stream CLI or sidecar
  protocol in `README.md`, `ARCHITECTURE.md`, `docs/`, or `src/`.
- Added a proposed decision with three paths: add a frame adapter, use Genteel
  GUI as the Phase 0 live-view proof and defer stream adapter work to Phase 1,
  or choose a fallback emulator for live view.

Evidence:

- `rg` in pinned Genteel source found `src/main.rs::save_screenshot`,
  `--screenshot`, `--dump-audio`, input script commands, `src/vdp/mod.rs`
  `framebuffer`, and GUI conversion via `frontend::rgb565_to_rgba8`.
- The same search found no documented streaming CLI comparable to the
  architecture's needed live sidecar path.

VALIDATION REQUEST:

Please choose the live-framebuffer path before Phase 1:

1. Build a tiny Genteel frame adapter over stdout/socket/shared memory.
2. Accept Genteel GUI rendering as the Phase 0 live-view proof and defer the
   stream adapter to Phase 1.
3. Use a fallback emulator for live view while keeping Genteel for headless
   verification.

Next:

- Implement or run the selected smallest proof.
- If the proof succeeds, request Phase 0 sign-off.

## 2026-06-29 - ITERATION 7 - Phase 0 ROM build and asset validation

Plan:

- Task: use the now-running Docker and built Genteel binary to validate the
  Drive16 hello-world ROM and asset ROM.
- Files: `examples/phase0-assets/res/resources.res`,
  `scripts/validate-phase0-assets.sh`, `docs/phase0-validation.md`,
  `PROGRESS.md`, and `WORKLOG.md`.
- Verification: build the SGDK hello-world ROM, screenshot it in Genteel, build
  the asset ROM, screenshot it in Genteel, drive the sprite with a Genteel input
  script, dump audio, confirm the audio is non-silent, inspect screenshots, and
  run script/style checks.

Did:

- Started Docker Desktop successfully; Docker daemon reported version 29.2.1.
- Built `examples/sgdk-hello-world/out/rom.bin` with docker-sgdk v2.11.
- Ran the Drive16 hello-world ROM in Genteel and captured
  `artifacts/phase0/genteel-hello.png`.
- Fixed the asset ROM `resources.res` paths so `rescomp` resolves repo-level
  `assets/phase0` correctly from the `res/` directory.
- Built `examples/phase0-assets/out/rom.bin` with docker-sgdk v2.11.
- Ran the asset ROM in Genteel and captured
  `artifacts/phase0/phase0-assets.png`.
- Drove the asset ROM with a scripted Right input and captured
  `artifacts/phase0/phase0-assets-right.png`.
- Dumped asset ROM audio to `artifacts/phase0/phase0-assets.wav`.
- Updated `scripts/validate-phase0-assets.sh` to reproduce the scripted input
  and non-silent audio checks.

Evidence:

- docker-sgdk image digest:
  `sha256:327ab838fbdf6bc741c6a7a11ee3c937cf1aaf1dc07a475995e89b741b6a830d`.
- Hello-world build ended with:
  `Built ROM: .../examples/sgdk-hello-world/out/rom.bin`.
- Genteel hello-world run saved `artifacts/phase0/genteel-hello.png` at about
  615 fps; visual inspection shows `Drive16 Phase 0` and `Hello from SGDK`.
- Asset ROM build ended with:
  `Built ROM: .../examples/phase0-assets/out/rom.bin`.
- Genteel asset run saved `artifacts/phase0/phase0-assets.png`; visual
  inspection shows the Phase 0 text and bundled sprite.
- Scripted Right input run saved `artifacts/phase0/phase0-assets-right.png`;
  visual inspection shows the sprite moved to the right edge.
- Audio dump metadata: stereo 16-bit WAV at 53267 Hz, 161210 frames.
- `scripts/validate-phase0-assets.sh` reported
  `Audio dump is non-silent: max abs sample 10922`.

VALIDATION REQUEST:

Only the live-framebuffer path remains open for the Phase 0 gate. Confirm
whether Genteel can expose a continuous framebuffer stream suitable for the
future Tauri pane, or report that the pinned build only exposes screenshots and
GUI rendering.

Next:

- If the live-framebuffer path is confirmed, record the exact command/API and
  request Phase 0 sign-off.
- If it is not available, record a proposed architecture change in
  `DECISIONS.md` before choosing a fallback.

## 2026-06-29 - ITERATION 6 - Buildable Genteel pin and screenshot proof

Plan:

- Task: make Genteel validation reproducible locally and close only the
  known-good screenshot/accuracy part of Phase 0.
- Files: `scripts/build-genteel.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: build pinned Genteel from source with a temporary Rust toolchain
  under ignored `artifacts/`, run the pinned known-good SGDK ROM through it,
  inspect the screenshot, syntax-check scripts, and run `git diff --check`.

Did:

- Cloned Genteel into ignored `artifacts/phase0/genteel-src`.
- Installed Rust 1.96.0 into ignored `artifacts/phase0/rustup` and
  `artifacts/phase0/cargo`, leaving the global Rust 1.74.0 untouched.
- Confirmed Genteel current `main` at
  `bd4fc05b2020a6889b323815f22ae577c70e52fa` fails to compile locally because
  `src/main.rs` references missing `audio::samples_per_frame_for_rate_and_region`.
- Built Genteel successfully from commit
  `8043061f50782d6066cd39925f0f808f06d665ea`.
- Added `scripts/build-genteel.sh` to reproduce that pinned source build.
- Ran the pinned known-good SGDK hello-world ROM through the built Genteel
  binary and captured a screenshot.

Evidence:

- `scripts/build-genteel.sh` produced
  `artifacts/phase0/genteel-src/target/release/genteel`.
- `GENTEEL_BIN="$PWD/artifacts/phase0/genteel-src/target/release/genteel"
  scripts/validate-known-good-homebrew.sh` passed.
- Genteel output reported `Running 180 frames headless`, saved
  `artifacts/phase0/known-good-homebrew.png`, and completed at about 622 fps.
- `file artifacts/phase0/known-good-homebrew.png` reported a 320 x 240 PNG.
- Visual inspection confirmed the screenshot shows `Hello world !` near screen
  center.
- `GENTEEL_BIN="$(scripts/build-genteel.sh)"
  scripts/validate-known-good-homebrew.sh` passed.
- `bash -n scripts/build-genteel.sh`, `bash -n scripts/validate-genteel.sh`,
  `bash -n scripts/validate-known-good-homebrew.sh`, and
  `bash -n scripts/validate-phase0-assets.sh` passed.
- `git diff --check` passed.
- `scripts/build-sgdk.sh examples/sgdk-hello-world` still stops at the local
  environment gate: "Docker is installed, but the Docker daemon is not
  reachable."

VALIDATION REQUEST:

Docker validation is still open. After Docker Desktop is running, run:

```sh
export GENTEEL_BIN="$(scripts/build-genteel.sh)"
scripts/build-sgdk.sh examples/sgdk-hello-world
scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin artifacts/phase0/genteel-hello.png
scripts/validate-phase0-assets.sh
```

Expected result:

- The Drive16 hello-world ROM builds and screenshots in Genteel.
- The Phase 0 asset ROM builds, screenshots, plays the bundled loop, and moves
  the bundled sprite.

Next:

- Wait for Docker validation and live-framebuffer evidence.
- If Genteel's live-framebuffer path is unavailable in the pinned build, record
  the conflict before changing the emulator plan.

## 2026-06-29 - ITERATION 5 - Genteel CLI alignment

Plan:

- Task: replace the provisional Genteel screenshot command with the real
  upstream CLI shape.
- Files: `scripts/validate-genteel.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: inspect upstream `segin/genteel` README, input scripting docs,
  and `src/main.rs`; syntax-check scripts; run `git diff --check`; keep runtime
  validation gated because no Genteel binary is installed locally.

Did:

- Confirmed the likely intended Genteel repository is `segin/genteel`.
- Confirmed its README describes an instrumentable Sega Mega Drive / Genesis
  emulator with headless screenshots and AI-oriented instrumentation.
- Patched `scripts/validate-genteel.sh` to call:
  `genteel --headless <frames> --screenshot <path> <ROM>`.
- Recorded observed Genteel source commit
  `bd4fc05b2020a6889b323815f22ae577c70e52fa` in the runbook.

Evidence:

- `gh repo view segin/genteel` reported the description matching the Drive16
  architecture and a repository push timestamp of 2026-06-28.
- `src/main.rs` usage text lists `--headless <n>` and `--screenshot <path>`.
- `src/main.rs` parser tests include
  `genteel --headless 1200 --screenshot final.png rom.bin`.
- `docs/input_scripting.md` documents
  `genteel --script my_tas.txt --headless 1000 <ROM_PATH>`.
- No local Genteel binary was found on PATH.

VALIDATION REQUEST:

After building or installing Genteel, rerun:

```sh
scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin artifacts/phase0/genteel-hello.png
```

Expected result:

- The script runs Genteel headlessly for 180 frames.
- `artifacts/phase0/genteel-hello.png` exists and shows the hello-world ROM.

Next:

- Wait for Docker and Genteel validation evidence.
- If the upstream live-framebuffer path is not available, record the conflict
  in `DECISIONS.md` before changing the emulator plan.

## 2026-06-29 - ITERATION 4 - Known-good homebrew validator

Plan:

- Task: make the Phase 0 Genteel accuracy check reproducible with a pinned open
  homebrew ROM source.
- Files: `scripts/validate-known-good-homebrew.sh`, `scripts/README.md`,
  `docs/phase0-validation.md`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: fetch the pinned upstream SGDK sample ROM, verify SHA-256,
  record source/license metadata, syntax-check the script, run `git diff --check`,
  and keep the Genteel run gated until a binary is available.

Did:

- Added `scripts/validate-known-good-homebrew.sh`.
- The script downloads SGDK's pinned `sample/basics/hello-world` ROM into
  ignored `artifacts/phase0/known-good/` storage, verifies the hash, writes
  metadata, and then calls `scripts/validate-genteel.sh`.
- Updated the Phase 0 runbook to use the script instead of asking for an
  unspecified homebrew ROM.

Evidence:

- Downloaded the pinned ROM from SGDK commit
  `846b1a3c8551392eebbab33182b80cf4291fd2e8`.
- SHA-256 verified:
  `bb92580661f957cbe1286c047a91614b3716d7c174bf3dede95b9df3477ac916`.
- `file` identified the downloaded artifact as a Sega Mega Drive / Genesis ROM
  image with title `SAMPLE PROGRAM`.
- SGDK `license.txt` at the pinned commit states MIT license.
- `scripts/validate-known-good-homebrew.sh --fetch-only` passed.
- `bash -n scripts/validate-known-good-homebrew.sh` passed.
- `git diff --check` passed.

VALIDATION REQUEST:

After a Genteel binary is available, run:

```sh
scripts/validate-known-good-homebrew.sh
```

Expected result:

- `artifacts/phase0/known-good-homebrew.png` exists.
- The screenshot shows SGDK's expected "Hello world !" output.

Next:

- Wait for Docker and Genteel validation evidence.
- If the known-good ROM runs correctly, mark the Genteel accuracy checklist item
  complete in `PROGRESS.md` and record the screenshot evidence here.

## 2026-06-29 - ITERATION 3 - Phase 0 validation runbook

Plan:

- Task: add a complete Phase 0 human validation runbook and align the ledger
  with the architecture's known-good homebrew accuracy check.
- Files: `docs/phase0-validation.md`, `PROGRESS.md`, and `WORKLOG.md`.
- Verification: check Markdown/text style, confirm referenced scripts exist,
  run `git diff --check`, and keep the Phase 0 gate open.

Did:

- Added `docs/phase0-validation.md` with the required manual evidence for
  docker-sgdk, Genteel screenshots, known-good open homebrew accuracy, live
  framebuffer availability, audible VGM playback, and controllable sprite input.
- Updated `PROGRESS.md` so the known-good homebrew accuracy check is an explicit
  Phase 0 checklist item.

Evidence:

- `docs/phase0-validation.md` references checked-in scripts:
  `scripts/build-sgdk.sh`, `scripts/validate-genteel.sh`, and
  `scripts/validate-phase0-assets.sh`.
- `git diff --check` passed.

VALIDATION REQUEST:

Please follow `docs/phase0-validation.md` and paste back the evidence block from
the end of the runbook. Phase 0 cannot close until that evidence exists.

Next:

- Wait for Phase 0 validation evidence.
- If validation fails, repair the exact failed script, fixture, or emulator
  command and rerun the relevant section.

## 2026-06-29 - ITERATION 2 - Phase 0 bundled asset fixture

Plan:

- Task: add a Phase 0 asset-backed SGDK fixture without advancing beyond the
  manual spike.
- Files: `scripts/build-sgdk.sh`, `scripts/generate-phase0-assets.py`,
  `scripts/validate-phase0-assets.sh`, `assets/phase0/`,
  `examples/phase0-assets/`, `PROGRESS.md`, `WORKLOG.md`, and
  `DECISIONS.md`.
- Verification: use upstream SGDK resource samples and headers as syntax
  references, generate original assets, verify asset metadata locally,
  syntax-check scripts, run `git diff --check`, and run the SGDK build wrapper
  to confirm the remaining local gate is Docker Desktop.

Did:

- Updated `scripts/build-sgdk.sh` so projects inside the repo can reference
  shared repo-level assets while still building inside docker-sgdk.
- Added `scripts/generate-phase0-assets.py` to generate original validation
  assets: a 32x32 indexed PNG sprite and a one-second PSG-only VGM loop.
- Added `examples/phase0-assets/`, which wires `SPRITE phase0_player` and
  `XGM phase0_loop` through `res/resources.res`.
- Added a simple SGDK ROM that starts the XGM loop and moves the sprite with
  the D-pad.
- Added `scripts/validate-phase0-assets.sh` as the single command for the
  eventual build plus Genteel screenshot validation.

Evidence:

- SGDK upstream sample/resource references checked:
  `sample/advanced/sprites-sharing-tiles/res/res_sprite.res`,
  `sample/basics/pools/res/resources.res`, `sample/snd/sound-test/res/resources.res`,
  `inc/sprite_eng.h`, `inc/snd/xgm.h`, and `tools/xgm2tool/.../VGM.java`.
- `scripts/generate-phase0-assets.py --check` passed.
- `file assets/phase0/player.png assets/phase0/loop.vgm` reported
  `player.png` as a 32 x 32, 8-bit colormap PNG and `loop.vgm` as VGM v1.5
  with SN76489 PSG.
- `bash -n scripts/build-sgdk.sh`, `bash -n scripts/validate-genteel.sh`, and
  `bash -n scripts/validate-phase0-assets.sh` passed.
- `git diff --check` passed.
- `scripts/build-sgdk.sh examples/phase0-assets` stopped with the expected
  local environment gate: "Docker is installed, but the Docker daemon is not
  reachable."

VALIDATION REQUEST:

Please run this from the repo root after starting Docker Desktop:

```sh
scripts/validate-phase0-assets.sh
```

Expected result:

- `examples/phase0-assets/out/rom.bin` is built by docker-sgdk.
- Genteel captures `artifacts/phase0/phase0-assets.png`.
- In a normal Genteel window, the D-pad moves the bundled sprite and the PSG
  loop is audible.

If the Genteel command shape differs, paste the `validate-genteel.sh` output so
the adapter command can be corrected.

Next:

- Wait for the Docker and Genteel validation results.
- If validation passes, close the Phase 0 manual spike checklist and request the
  phase gate sign-off before starting Phase 1.

## 2026-06-29 - ITERATION 1 - Bootstrap and Phase 0 validation request

Plan:

- Task: bootstrap the repo and create the first Phase 0 manual toolchain spike.
- Files: `README.md`, `.gitignore`, `PROGRESS.md`, `WORKLOG.md`,
  `DECISIONS.md`, `scripts/`, `mcp-servers/`, `app/`, `corpus/`, `assets/`,
  and `examples/sgdk-hello-world/`.
- Verification: read `drive16-architecture.md`, verify docker-sgdk v2.11 image
  metadata, syntax-check scripts, and open a validation request for Docker and
  Genteel because Docker Desktop is not running in this session and Genteel CLI
  availability is unconfirmed.

Did:

- Read `drive16-architecture.md` in full.
- Seeded `PROGRESS.md`, `WORKLOG.md`, and `DECISIONS.md`.
- Created the repo skeleton for Phase 0 through later app/corpus/MCP work.
- Added a pinned SGDK 2.11 Docker build script.
- Added a minimal SGDK hello-world project.
- Added a provisional Genteel validation script that checks for a screenshot-capable
  CLI before marking emulator validation complete.

Evidence:

- `docker manifest inspect registry.gitlab.com/doragasu/docker-sgdk:v2.11`
  passed and returned manifest digest
  `sha256:327ab838fbdf6bc741c6a7a11ee3c937cf1aaf1dc07a475995e89b741b6a830d`.
- Container config metadata reports `GDK=/sgdk`, PATH includes `/sgdk/bin`,
  entrypoint is `make -f /sgdk/makefile.gen`, working directory is `/m68k`,
  and default user is `m68k`.
- `bash -n scripts/build-sgdk.sh` passed.
- `bash -n scripts/validate-genteel.sh` passed.
- `git diff --check` passed.
- `scripts/build-sgdk.sh examples/sgdk-hello-world` stopped with the expected
  local environment gate: "Docker is installed, but the Docker daemon is not
  reachable."
- Local Docker build could not be run: Docker CLI exists, but the daemon socket
  `/Users/chrissotraidis/.docker/run/docker.sock` is not available.

VALIDATION REQUEST:

Please run these from the repo root on a machine with Docker Desktop running:

```sh
scripts/build-sgdk.sh examples/sgdk-hello-world
ls -lh examples/sgdk-hello-world/out/rom.bin
```

Expected result:

- Docker pulls or reuses `registry.gitlab.com/doragasu/docker-sgdk:v2.11`.
- SGDK builds the hello-world project without errors.
- `examples/sgdk-hello-world/out/rom.bin` exists.

Then run the emulator validation once a Genteel binary is available:

```sh
GENTEEL_BIN=/path/to/genteel scripts/validate-genteel.sh examples/sgdk-hello-world/out/rom.bin
```

Expected result:

- The ROM runs headlessly for 180 frames.
- A screenshot is written to `artifacts/phase0/genteel-hello.png`.
- If the script reports that the Genteel CLI shape is different, paste that
  output back so the adapter command can be corrected.

Next:

- Wait for the Docker/Genteel validation result before marking those checklist
  items complete.
- If validation passes, begin the bundled VGM loop unit.
