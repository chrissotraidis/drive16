# Drive16 Fable 5 Investigation Prompt

Use this as a standalone prompt for Claude Fable 5 / Mythos.

```markdown
I'm working on Drive16, an open-source conversational builder for Sega Genesis / Mega Drive games.

The product goal is to let a user talk to an agent, generate SGDK C, build a ROM, verify it through deterministic proof capture, play it inside the app, and save/export the result. The app should feel like a real product, not a demo shell, while staying honest about what is local proof, what is interactive Play, what is model-backed, and what is still setup-gated.

Recommended effort: XHigh for audit and diagnosis. Do not use autonomous implementation mode unless I explicitly ask you to implement after the audit.

Project:
Drive16

Project path:
`/Users/chrissotraidis/Documents/GitHub/drive16`

Live/runtime path:
Browser preview is usually at `http://127.0.0.1:1420/?core-status=dev-only` when the dev server is running.

Native runtime:
The Tauri app is under `app/src-tauri`. A recent debug bundle may exist under `app/src-tauri/target/debug/bundle/macos/Drive16.app`, but verify before relying on it.

Primary concern:
Drive16's local Product V1 is closed for review, and Phase 7 added user-supplied Play core setup plus input profiles. However, the product still has important truth boundaries:

- public/distributable interactive Play depends on a user-supplied or otherwise release-settled Genesis core;
- the app has a conversational agent surface, but live freeform model replies are paused/no-reply rather than a general model-backed chat loop;
- keyboard input and basic controller detection exist, but full remapping, multi-controller support, hardware QA, and interactive audio proof remain unfinished;
- optional ComfyUI sprite and MML music enhancement paths are setup-heavy and should not be confused with the core product path;
- evidence is strong but scattered across many phase docs.

Request:
Extensively audit Drive16 and produce an implementation-oriented report for the next product slice. Identify the deepest product, architecture, runtime, packaging, and UX issues. Focus on the smallest changes that would most improve the app for a fresh user and for a future public v1.

Read these files first:

- `README.md`
- `PROGRESS.md`
- `WORKLOG.md`
- `DECISIONS.md`
- `docs/product-v1-evidence.md`
- `docs/post-v1-backlog.md`
- `docs/phase6-verification-loop.md`
- `docs/phase6-player-architecture.md`
- `docs/phase6-interactive-player-adapter.md`
- `docs/phase6-keyboard-input.md`
- `docs/phase6-player-controls.md`
- `docs/phase6-audio.md`
- `docs/phase6-controller-foundation.md`
- `docs/phase7-interactive-core-distribution.md`
- `docs/phase7-user-core-flow.md`
- `docs/phase7-input-profiles.md`
- `docs/review/2026-07-02-drive16-current-issues-report.md`

Then inspect these code paths:

- `app/src/App.tsx`
- `app/src/player/coreReadiness.ts`
- `app/src/player/input.ts`
- `app/src/player/nostalgist.ts`
- `app/src/player/types.ts`
- `app/src-tauri/src/project.rs`
- `app/src-tauri/src/ollama.rs`
- `scripts/check-interactive-play-core.mjs`
- `scripts/verify-phase6-loop.sh`
- `scripts/verify-phase6-browser-smoke.mjs`
- `app/src-tauri/tauri.conf.json`
- `app/package.json`
- `app/src-tauri/Cargo.toml`

If useful, inspect generated evidence under ignored `artifacts/` folders, but do not assume those artifacts exist on every machine.

Suggested safe verification commands:

```sh
git status --short --branch
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check
cargo test --manifest-path app/src-tauri/Cargo.toml
scripts/check-interactive-play-core.mjs
scripts/verify-phase6-loop.sh --browser
scripts/verify-phase6-loop.sh --no-browser --with-v1-proof
```

Only run browser/native checks if the local server or native app is available, or if you can start them without disrupting the user. Do not treat a missing local server as a product failure without checking whether it simply has not been launched.

Audit questions:

1. What does Drive16 currently prove, and what does it only imply?
2. What would a fresh downloader misunderstand or fail to complete?
3. Which visible product promises are still ahead of the running app?
4. Which missing features are v1 blockers versus post-v1 enhancements?
5. Is the proof/play boundary clean in code and UI?
6. Is the user-supplied core flow enough for public release, or only for local review?
7. What is the right next slice: release-clean Play setup, live freeform agent replies, controller remapping, readiness hub, packaging, or something else?
8. Which files are at risk of becoming too large or too coupled?
9. Which docs are stale, duplicated, or too scattered for a new contributor?
10. What should absolutely not be changed because it is a correct boundary?

Output format:

Produce a markdown report with these sections:

- Executive summary
- Current product truth
- What is working with evidence
- What is not working with evidence
- Evidence versus interpretation
- Highest-severity issues
- Root causes, not just symptoms
- Highest-leverage next implementation slice
- Alternative next slices and why they rank lower
- Specific files to modify for the recommended slice
- Verification plan
- Risks and rollback notes
- Questions that genuinely require user input
- What not to change

Constraints:

- Do not mutate production/live state.
- Do not send messages, emails, posts, or external requests.
- Do not perform destructive actions.
- Do not commit, push, delete files, reset git state, or modify databases.
- Do not invent evidence. If you did not run or inspect something, say so.
- Distinguish confirmed facts from interpretation.
- Prefer simplification over adding new subsystems.
- Do not recommend fake model replies, fake emulator readiness, or fake local-AI readiness.
- Do not collapse Genteel Verify/Capture Proof into interactive Play.
- Do not recommend bundling emulator cores unless licensing and distribution are explicitly resolved.
- Do not move Play/core/controller setup into Agent Settings. It belongs near the ROM player.
- Pause only if you need a destructive action, a real scope change, a credential, a proprietary ROM/core asset, or a product decision only the user can make.

Stop condition:

Stop after delivering the audit report and a clearly ranked next-slice recommendation. Do not proceed into implementation unless I explicitly approve the next slice.
```
