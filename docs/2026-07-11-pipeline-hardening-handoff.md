# Drive16 Pipeline Hardening Handoff — 2026-07-11

## 2026-07-12 local resume update

The unresolved browser sound-state check is now closed without OpenRouter:

- A fresh streamed-core session proved `Muted -> On -> Muted` while preserving
  the saved `60%` level.
- The sound button, volume slider, and Controls button retained identical
  positions and dimensions through both transitions.
- The playable-core Phase 6 smoke now records this transition, resumes through
  the visible Resume control, and checks restart outcomes through their raw
  events without hiding the higher-priority project trust stage.
- `pnpm --dir app build`, project-memory verification, and the full
  `dev-only` browser smoke pass. Evidence is in
  `artifacts/phase6/verify-loop/browser-smoke/browser-smoke.json`.

Resume with the remaining Asteroids-specific restart and ordinary-user review
steps below. Keep the packaged WKWebView black canvas, Docker amd64 container
startup, and the 28-step ComfyUI timeout as separate environment/product
blockers; none invalidates the completed browser sound-state proof.

## Why work is paused

The six-phase trust, player, verification, starter, OpenRouter, and browser E2E goal is paused by user request. The goal is not complete and the current Asteroids project must remain `PLAYABLE`, not `REVIEWED`.

The working baseline before this slice was `b4e1a27` on `main`.

## Current product truth

- ROM-changing prompts are routed through bounded OpenRouter/DeepSeek work. Ollama is limited to questions, summaries, and diagnostics.
- The paid path allows one implementation call capped at 8,000 completion tokens and one targeted repair capped at 4,000. There are no open-ended automatic retries.
- Deterministic starters are prototypes until independent evidence promotes them.
- Compiling, emitting pixels, frame differences, color counts, or producing audio cannot independently award `Playable` or `Reviewed`.
- Trust stages are kept separate: `Prototype`, `Built`, `Playable`, `Reviewed`, and `Failed`.
- Player controls use stable layout slots. Games start muted while preserving the saved volume percentage.
- Restart uses the recovery control documented by the ROM (Start for the current Asteroids project), rather than resetting the emulator.
- The active project is `artifacts/phase3/active-project`. Its notes and the UI both report `PLAYABLE` / `Playable; review pending`.

## Active Asteroids result

What is working and was verified:

- Readable title, objective, controls, score, lives, pause, game over, and restart text.
- Held Left/Right turns, held Up thrusts, A fires, C pauses, and Start restarts.
- Firing, hits, score, hull damage, life loss, and temporary invulnerability have visible feedback.
- The game survives the 15-second idle test and accepts intended input afterward.
- Deterministic evidence reaches game over and verifies the same visible Start recovery path after game over.
- The browser Restart button was tested from game over and logged `path=button.start`.
- A three-second recovery shield now prevents an immediate life collapse after a new run or restart.
- Game over no longer intentionally retains the stale `HULL HIT` message.
- The game uses composed 16x16 custom tile art for the ship and asteroids. Ambiguous generated ship/asteroid candidates are explicitly rejected and not wired.
- The ROM has a 68.8-second, six-channel MML/VGM arrangement and deterministic non-silent audio evidence.

What is not accepted:

- The soundtrack has a negative human taste review: better than the original loop, but still far below the desired quality.
- Generated art did not pass semantic review. The readable custom tile fallback is honest, but this is not proof that the generated-asset workflow is good.
- The visible game is improved but has not received a positive final human review.
- Therefore the project must not be promoted to `REVIEWED` and packaging/merging should wait.

## Exact unfinished investigation

The sound-control layout is stable: before/after measurements showed identical sound-button, slider, and Controls-button positions and dimensions.

The current browser automation result for the state transition is still unresolved:

1. A fresh player session starts with `Muted` and preserves the saved `60%` level.
2. Clicking the sound button in the Codex browser automation continued to display `Muted` instead of `On` in the latest clean retest.
3. Earlier runs sometimes produced `Unavailable` because pointer-down audio preparation raced the click result.
4. The source now prevents pointer-down from overwriting the visible state, and `setNostalgistVolume` treats an explicit successful unmute command as the `enabled` setting even when the embedded core does not expose a probeable AudioContext.
5. Production TypeScript/Vite builds pass after those changes, but the live `Muted -> On -> Muted` browser result has not yet been proven.

User direction remains authoritative: actual audio playback is considered unblocked; leave the game muted by default. The remaining issue is honest, stable UI state—not reopening general audio playback diagnosis.

Resume at:

- `app/src/App.tsx`: `toggleInteractivePlayerMute` and `prepareInteractivePlayerAudio`
- `app/src/player/nostalgist.ts`: `setNostalgistVolume`, `setNostalgistMuted`, and AudioContext probing
- `app/src/components/PlayerPane.tsx`: `playerAudioLabel` and the fixed sound-control presentation

First prove that the click handler is executing and that no later async callback resets `playerAudio`. Then retest one fresh player session in the Codex browser: `Muted -> On -> Muted`, with the slider still at the saved percentage and all neighboring controls unmoved.

## Verification completed

These checks passed during the final cycle:

```text
npm --prefix app run build
node scripts/verify-agent-contract.mjs
node scripts/verify-genre-playability-gates.mjs
node scripts/verify-audio-evidence-gates.mjs
node scripts/verify-asset-role-gates.mjs
node scripts/verify-project-memory.mjs --project artifacts/phase3/active-project --expect-gate pass
python3 scripts/verify-skeleton-interaction.py asteroids artifacts/phase3/active-project/out/rom.bin
scripts/verify-presentation-quality-baseline.sh
node scripts/verify-phase6-browser-smoke.mjs
```

The full presentation baseline passed for Snake, Pong, Tetris, and Asteroids. Snake and Pong launch screens were adjusted because the gate correctly rejected their former flat five/six-color presentations.

The standalone Phase 6 browser smoke passed only its configured missing-core scenario. It does not replace the live active-ROM review in the Codex browser.

## Reference-ROM calibration

The repository now includes:

- `scripts/capture-reference-run.py`
- `scripts/verify-reference-run.mjs`

These capture behavioral evidence from a repo-local, user-supplied Genesis ROM: title, start, action/baseline, 15-second idle, restart, screenshots, and audio signal. This is reference-only calibration—not model training, source copying, or asset extraction. No commercial reference ROM was supplied or downloaded, so no real-game reference profile has been captured yet.

## Recommended resume order

1. Finish and prove the sound button's `Muted -> On -> Muted` state transition in the Codex browser, then leave it muted.
2. Recheck live Restart from active play, pause, and game over after the newest ROM rebuild; the deterministic verifier already passes all restart paths.
3. Listen to `artifacts/phase9/music-review/asteroids-second-orbit.wav` and either materially revise the arrangement or record a positive human taste decision. Do not infer approval from structural metrics.
4. Perform one final ordinary-user browser pass: understand objective, start, turn, thrust, fire, see a hit/damage, pause/resume, briefly enable and re-mute sound, reach game over, and restart.
5. Promote to `REVIEWED` only if that visible pass is genuinely good. Then, and only then, consider desktop parity, merging, or packaging.

## Cost and scope guardrails

- One bounded 8,000-token DeepSeek implementation call and one bounded 4,000-token targeted repair were already consumed for the active Asteroids attempt.
- No additional paid inference was used for the subsequent deterministic repairs, starter audits, reference harness, or browser review.
- Avoid another OpenRouter call unless a specific ROM-changing defect requires it.
- Keep this solution narrow: do not build a generalized self-training system. Reference ROMs should calibrate measurable behavior and human review, while generated projects retain their own code and assets.
