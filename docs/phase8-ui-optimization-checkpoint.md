# Phase 8 UI Optimization Checkpoint

Status: active checkpoint for the UI/IA repair pause.

## Phase State To Return To

Drive16 is currently at **Phase 8 Slice 2: Readiness / First-Run Truth Hub**.

Completed and verified:

- Product V1 local review scope: generated ROM proof/play foundation,
  Save/Open/Export, Verify, provider truth, and project lifecycle.
- Phase 7 core policy: user-supplied interactive core flow, dev-CDN fallback
  only for local development, and Genteel Verify kept independent.
- Phase 7 input profile work: visible keyboard mapping, local profile
  persistence, reset defaults, Gamepad API detection, and truthful controller
  readiness states.
- Phase 8 Slice 1: OpenRouter-only live freeform replies using
  `deepseek/deepseek-chat-v3.1`, with keys kept in app memory only and CORE
  sprite/music prompts kept on the local proof path.
- Phase 8 Slice 2: project-menu readiness hub that consolidates proof, Play,
  provider, tool, enhancement, and release-blocker truth.

Latest verified evidence:

- `scripts/verify-phase6-loop.sh --browser` passed with evidence under
  `artifacts/phase6/verify-loop/20260702-152451`.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` passed with 51 passed,
  0 failed, 4 ignored.
- Secret and tracked-artifact scans passed.

Open decisions still intentionally unresolved:

- Confirm the project license before adding a `LICENSE` file.
- Decide public interactive Play core policy.
- Decide packaging/signing/notarization and CSP policy.
- Decide whether Ollama live replies should be implemented later.
- Add import/core size limits before treating local file ingestion as robust.

## Why We Are Pausing Feature Work

The app now has a real amount of functionality, but the visible product surface
has become confusing. The main problem is not another missing backend feature;
it is that too many implementation facts are exposed at the same priority.

Current UI issues to address before continuing feature slices:

- Chat identity is confusing. Plain messages can land under `Local proof`
  when OpenRouter is not tested, which makes a normal chat exchange feel like a
  ROM proof result.
- Provider state is confusing. The app can show a stale hosted model label such
  as Claude Sonnet even though the tested Phase 8 path is DeepSeek/OpenRouter.
  Keys are intentionally in-memory only, so a reload loses the key, but the UI
  does not make that temporary state obvious enough.
- The left rail mixes conversation, inference state, proof events, and file
  listings, so no single mental model wins.
- The project menu and readiness hub are truthful but too long and card-heavy.
  They read like backend status dumps instead of a usable menu.
- ROM/player status chips truncate important text, especially in normal
  desktop window sizes.
- The main window scales poorly outside fullscreen: important controls compress,
  status rows become unreadable, and text truncation hides meaning.
- Controls may be wired, but their feedback is scattered enough that they feel
  unwired.

## UI Repair Track

The next work should be treated as a UI/IA repair track, not Phase 9 feature
work.

Target outcome:

- A normal-size desktop window should feel usable without fullscreen.
- The first screen should make the primary workflow obvious:
  `Chat/request -> Build/Verify -> Play/Export`.
- Chat should behave like chat, and proof/status should behave like proof/status.
- Settings should be short, grouped, and task-oriented.
- Menus should expose actions first and details second.
- Status text should not truncate in ways that hide the meaning.
- Every visible button should provide clear immediate feedback or be removed
  from the visible path until it is meaningful.

Recommended first implementation slice after plan approval:

1. Freeze new feature work.
2. Refactor the app shell into clearer regions:
   - left: conversation only;
   - center/right: ROM player and primary controls;
   - secondary drawer: project/setup/status details.
3. Replace long status chips with two-line or expandable rows that do not hide
   the important state.
4. Make provider state explicit in the composer:
   - `OpenRouter live` when tested in this session;
   - `Key needed` after reload;
   - `ROM proof only` for local proof prompts;
   - `Ollama readiness only` when Ollama is selected.
5. Compress Settings into sections/tabs: Provider, Play Core, Enhancements,
   Release Readiness.
6. Add browser QA at several realistic window sizes, not only fullscreen and
   narrow mobile.

Stop condition for the UI repair track:

The app can be opened in a normal desktop window, used without horizontal
clipping, and explained by the visible layout without reading the README.

## Slice 1 Implementation Note

The first UI repair slice is now implemented and recorded in
`docs/phase8-ui-repair-slice1.md`.

That slice added the visible control map, cleaned up chat/proof identity,
collapsed secondary proof/file/readiness details, moved provider/session truth
closer to the composer, compressed Settings and the project menu, and verified
the browser preview at realistic desktop sizes.

Feature work is still paused until the UI repair track has a native-window
click-through and an every-visible-button trust pass.

## Slice 2 Implementation Note

The second UI repair slice is now implemented and recorded in
`docs/phase8-ui-repair-slice2.md`.

That slice fixed the `Verify Right` stuck-`Verifying` state, made
browser-preview `Play ROM` feedback truthful when disk ROM bytes are not
available, added stable audit hooks, and verified that the real current native
dev window shows the Phase 8 repair UI.

The remaining gap is narrower now: direct native click-through for OS
file-picker flows and any launch-flow cleanup needed to prevent stale bundled
windows from being mistaken for the current dev app.

## Slice 3 Implementation Note

The third UI repair slice is now implemented and recorded in
`docs/phase8-ui-repair-slice3.md`.

That slice made the default desktop shell calmer by moving provider/session
truth next to the composer, defaulting ROM/tool inspector details to collapsed,
compressing the player session strip behind `More`, and fixing the composer
session/status wrapping that failed at normal desktop widths.

Feature work remains paused. The remaining UI repair gap is direct native
click-through for OS file-picker flows (`Import ROM`, `Choose Core` /
`Set Up Play`) plus any dev-launch cleanup needed to prevent stale app windows.

## Handoff Note

The current resume point for another agent is recorded in
`docs/phase8-next-agent-handoff.md`.

Start there before continuing Phase 8 UI repair. The next implementation slice
should complete the native file-picker trust pass, update the control map, and
avoid new feature work unless the user explicitly ends the UI repair pause.
