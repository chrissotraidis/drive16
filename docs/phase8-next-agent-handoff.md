# Phase 8 Next-Agent Handoff

Status: current checkpoint for handing Drive16 to another agent.

Last updated: 2026-07-02.

## Current State

Drive16 is paused in the Phase 8 UI/IA repair track after Slice 3. Feature
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
- Phase 8 UI repair Slices 1 through 3 are implemented and browser-verified.

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

Native verification status:

- The current native Tauri dev window visually showed the Slice 3 UI before
  work paused.
- Direct native OS file-picker completion was not verified. Do not count it as
  done.

## Not Verified Yet

The next agent should resume with these, in this order:

1. Relaunch or re-front the current Tauri dev app.
2. Confirm the visible native app is the current Phase 8 shell, not a stale
   older Drive16 window.
3. Test `Import ROM` in the native app with a repo-generated ROM, for example
   `examples/app-starter-blank/out/rom.bin` if present after a local build.
4. Test `Choose Core` / `Set Up Play` in the native app with a local compatible
   `.zip` core archive or a `.js + .wasm` pair.
5. Confirm every native file-picker path provides clear local feedback after
   cancel, invalid selection, and valid selection.
6. Update `docs/ui-repair-control-map.md` and the Slice 3 or follow-up slice
   doc with the result.

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
- Decide whether dev launch should automatically clean up stale Drive16 windows.

## Provider And Secret Rules

OpenRouter is BYOK and keys are session memory only. No key should be persisted
in source, docs, localStorage, or committed artifacts.

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
Goal: complete the Phase 8 UI repair native file-picker trust pass.

Start state:
- Phase 8 UI repair Slice 3 is implemented.
- Browser verification is already complete.
- Native visual verification exists, but native file-picker completion is open.

Work:
1. Relaunch or re-front the current Tauri dev app.
2. Verify the window is the current Phase 8 shell.
3. Click through Import ROM in the native app.
4. Click through Choose Core / Set Up Play in the native app.
5. Cover cancel, invalid file, and valid file feedback where practical.
6. Fix only UI feedback or wiring bugs found in those paths.
7. Update docs and control map.
8. Run app build and diff/secret hygiene checks.

Stop when:
- Native Import ROM and Choose Core / Set Up Play either work with visible
  feedback or are clearly guarded with accurate copy.
- The control map no longer has native file-picker completion marked Open.
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
- `docs/post-v1-backlog.md`
- `docs/review/README.md`

## Guardrails

- Keep Genteel Verify/Capture Proof separate from interactive Play.
- Do not commit API keys, commercial ROMs, emulator core binaries, model
  weights, or generated artifacts that belong under ignored artifact folders.
- Do not imply `Dev CDN` Play is public-release ready.
- Do not restart feature work until the user says the UI repair pause is done.
