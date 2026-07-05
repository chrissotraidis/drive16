# Phase 8 Next-Agent Handoff

Status: current checkpoint for handing Drive16 to another agent.

Last updated: 2026-07-03.

## Current State

Drive16 is paused in the Phase 8 UI/IA repair track after Slice 6. Feature
expansion is intentionally paused until the normal macOS desktop window feels
usable, readable, and trustworthy.

The current product truth:

- CORE v1 proof is complete for the local review scope.
- Product V1 local closure is complete, with proof, Play foundation,
  Save/Open/Export, provider truth, and project lifecycle covered.
- Phase 7 added interactive Play policy, user-supplied core setup, input
  profiles, keyboard mapping, and basic controller detection.
- Phase 8 Slice 1 added OpenRouter-only live freeform replies.
- Phase 8 Slice 2 added the first-run readiness hub.
- Phase 8 UI repair Slices 1 through 7 are implemented and verified for the
  current browser and native button/open/cancel paths.

The current UI repair goal is not "add more features." The goal is to make the
existing feature set legible in a normal desktop window.

## Implemented In The Current Dirty-To-Commit Work

The current local state includes these uncommitted changes that should be
preserved and pushed:

- `app/src/App.tsx` and `app/src/styles.css` now support the repaired Phase 8
  shell.
- `app/src/agent/openrouter.ts` adds a small browser-side OpenRouter
  chat-completions client.
- `scripts/verify-phase6-browser-smoke.mjs` includes expanded browser smoke
  coverage for Phase 8 flows.
- `docs/review/` contains the Codex current-issues report, Fable prompt, and
  Fable audit.
- `docs/phase8-openrouter-freeform-replies.md` records Slice 1.
- `docs/phase8-readiness-hub.md` records Slice 2.
- `docs/phase8-ui-optimization-checkpoint.md` records the UI repair pause.
- `docs/ui-repair-control-map.md` maps every visible control to action,
  feedback, and verification state.
- `docs/phase8-ui-repair-slice1.md`,
  `docs/phase8-ui-repair-slice2.md`, and
  `docs/phase8-ui-repair-slice3.md` record the UI repair slices.
- `docs/phase8-ui-repair-slice4.md` records the OpenRouter overclaim guard,
  compact chat, and `Set Up Play` copy cleanup.
- `docs/phase8-ui-repair-slice5.md` records native app freshness, the
  rebuild-and-open helper, native Import/Test/Set Up Play click-through, and
  concise missing-core feedback.
- `docs/phase8-ui-repair-slice6.md` records the remaining native visible-button
  trust pass for Save/Open/Export, Settings, Controls, details, and layout
  collapse.
- `docs/phase8-ui-repair-slice7.md` records the provider-status cleanup that
  moved persistent OpenRouter/Ollama detail out of chat and back into Settings.
- `scripts/launch-drive16-native.sh` rebuilds and opens the current debug
  macOS app bundle.
- Root living docs are updated: `README.md`, `PROGRESS.md`, `WORKLOG.md`,
  `DECISIONS.md`.

## Verified

Recent verified checks:

- `pnpm --dir app build` passed.
- `git diff --check` passed.
- Browser checks passed at `1440x900`, `1180x780`, and `1040x740` with no
  horizontal overflow and no detected clipped visible button, message, session,
  or status text.
- Sending `hey` with no session OpenRouter key appends a normal `You` message
  and a `Drive16` setup reply, not a false proof result.
- `Play ROM` shows browser-preview import-or-desktop feedback near the ROM
  player.
- `Verify Right` completes with `Right proof passed`, appends a `Proof result`,
  and returns the top status to `Ready`.
- `Show Details` expands the ROM/tool inspector.
- `Setup` opens the project menu with Actions first and readiness details
  collapsed.
- Agent Settings opens with secondary sections collapsed.
- Switching to Ollama hides OpenRouter fields and relabels the composer as
  `Ollama readiness only`.
- Browser console warning/error log was empty after the Slice 3 interaction
  pass.
- Slice 4 browser smoke passed with a mocked OpenRouter reply that claimed
  `ROM built successfully`; Drive16 blocked the overclaim and kept the CORE
  sprite/music prompt on the local proof path.
- `pnpm --dir app tauri build --debug --bundles app` rebuilt the current
  desktop `.app` bundle.
- The rebuilt native app showed `Phase 8 readiness hub`, not stale Phase 7
  copy.
- Native `Import Test ROM` imported the repo-generated test ROM, switched to
  Imported ROM, and captured proof.
- Native `Import ROM` opened the macOS file picker and returned visible
  `Choose ROM file` feedback after cancel.
- Native `Set Up Play` opened the macOS file picker and returned visible
  `Choose Play core` feedback after cancel.
- Native `Play ROM` without a core returned concise `Play setup needed`
  feedback.
- Native `Save` created a project snapshot and reported the path.
- Native `Export` copied the active ROM and reported the path.
- Native `Open Project` loaded the latest saved snapshot after Save.
- Native `Agent Settings` opened; OpenRouter/Ollama switching hid irrelevant
  fields and kept provider state inside Settings.
- Native `Controls` opened; `Reset defaults` saved the default input profile
  locally and returned visible feedback.
- Native `Show Details` / `Hide ROM details` and `Hide conversation pane` /
  `Show conversation pane` worked and left the app in a compact state.
- Browser smoke verifies `OpenRouter live` does not persist in the conversation
  pane after provider setup; Settings owns provider detail.

Native verification status:

- Native file-picker open/cancel paths are verified.
- Native visible-button paths available without external files are verified.
- Valid user-core import still needs a compatible local Genesis core file.

## Not Verified Yet

The next agent should resume with these, in this order:

1. Launch native review with `scripts/launch-drive16-native.sh`.
2. Test `Import ROM` with a valid local Genesis ROM selected through the native
   file picker.
3. Test `Set Up Play` with a real compatible `.zip` core archive or
   `.js + .wasm` pair when one is available.
4. Confirm every native file-picker path provides clear local feedback after
   invalid selection and valid selection.
5. Add import/core size limits and invalid-file error copy before calling local
   file ingestion robust.
6. Update `docs/ui-repair-control-map.md` and the next follow-up slice doc with
   the result.

Important: do not use a browser file input result as proof of native
file-picker completion. The remaining gap is specifically the macOS native app
flow.

## Open Product And Release Decisions

These are intentionally unresolved:

- Confirm the project license before adding a `LICENSE` file.
- Decide public interactive Play core policy.
- Decide packaging, signing, notarization, and CSP policy.
- Decide whether Ollama live replies should be implemented later.
- Add import/core size limits before treating local file ingestion as robust.
- Decide whether the launch helper should become the default `pnpm` command for
  all native reviews.

## Provider And Secret Rules

OpenRouter is BYOK and keys are session-scoped. No key should be persisted in
source, docs, localStorage, or committed artifacts. The current app keeps the
key in session storage for the lifetime of the app window so it survives
refreshes during review.

The current default tested hosted model is:

```text
deepseek/deepseek-chat-v3.1
```

Ollama is readiness-only in the current app. Do not imply live Ollama chat is
wired unless a later slice implements and verifies it.

CORE ROM-changing prompts still use the local proof path. General chat can use
OpenRouter only after the user enters and tests a session key.

## First Resume Slice

Recommended next slice:

```text
Goal: complete the Phase 8 native local-file trust pass.

Start state:
- Phase 8 UI repair Slice 6 is implemented.
- Browser verification, native file-picker open/cancel verification, and native
  visible-button verification are complete.
- Valid user ROM import and valid user-core setup still need real local files.

Work:
1. Run `scripts/launch-drive16-native.sh`.
2. Verify the window is the current Phase 8 shell.
3. Import a valid local Genesis ROM through the native picker and confirm the
   player/export state switches to that ROM.
4. Configure a compatible user Play core through the native picker and confirm
   `Play ROM` uses that core.
5. Add clear invalid-file and size-limit feedback for ROM/core ingestion.
6. Fix only local-file feedback or wiring bugs found in those paths.
7. Update docs and control map.
8. Run app build, native tests, browser smoke, diff hygiene, and secret checks.

Stop when:
- Valid native ROM import and valid native Play-core setup are verified or
  explicitly blocked by missing external files.
- Invalid local-file paths have clear user-facing feedback.
- The work is documented and verified.
```

## Key Files For Resume

- `PROGRESS.md`
- `WORKLOG.md`
- `DECISIONS.md`
- `README.md`
- `app/src/App.tsx`
- `app/src/styles.css`
- `app/src/agent/openrouter.ts`
- `scripts/verify-phase6-browser-smoke.mjs`
- `docs/phase8-ui-optimization-checkpoint.md`
- `docs/ui-repair-control-map.md`
- `docs/phase8-ui-repair-slice3.md`
- `docs/phase8-ui-repair-slice4.md`
- `docs/phase8-ui-repair-slice5.md`
- `docs/phase8-ui-repair-slice6.md`
- `docs/phase8-ui-repair-slice7.md`
- `docs/post-v1-backlog.md`
- `docs/review/README.md`

## Guardrails

- Keep Genteel Verify/Capture Proof separate from interactive Play.
- Do not commit API keys, commercial ROMs, emulator core binaries, model
  weights, or generated artifacts that belong under ignored artifact folders.
- Do not imply `Dev CDN` Play is public-release ready.
- Do not restart feature work until the user says the UI repair pause is done.
