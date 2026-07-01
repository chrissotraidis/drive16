# Product V1 Evidence

Status: Product V1 closure complete for the local review scope. Phase 6 has a
working interactive player foundation, native generated-ROM Play is verified,
provider setup is truthful, project lifecycle actions are covered, and post-v1
work is separated in `docs/post-v1-backlog.md`.

## Target

A non-developer can launch Drive16, start from the starter project, ask for the
bundled sprite/music game, understand the agent/proof status, play the
resulting ROM with keyboard input, save or export it, and know what remains
unconfigured.

## Current Evidence

Latest verification loop evidence:

- Browser verification loop:
  `artifacts/phase6/verify-loop/20260701-131904`
- Browser plus generated CORE proof evidence:
  `artifacts/phase6/verify-loop/20260701-131922`
- Native generated-ROM Play click-through:
  `artifacts/product-v1/native-click-through/20260701-1324`
- Provider validation:
  in-app browser Agent Settings reported `Connected` and `OpenRouter key
  accepted`; the missing-provider state reported `ROM proof only` and freeform
  replies paused. The key was not written to tracked files and the browser
  preview was reloaded after the test.
- Phase 6 evidence packet: `docs/phase6-evidence.md`
- Product V1 closure goal: `docs/phase6-to-product-v1-goal.md`
- Post-v1 backlog: `docs/post-v1-backlog.md`

Commands already passing in the Phase 6 loop:

```sh
scripts/verify-phase6-loop.sh --browser
scripts/verify-phase6-loop.sh --no-browser --with-v1-proof
```

The browser smoke currently covers New Project, Save, Open, Import, imported
ROM Play, keyboard ArrowRight, Pause/Resume/Reset/Stop, Verify, Export, and
mobile overflow.

Native generated-ROM Play passed on July 1, 2026:

- Submitted `Make a sprite I can move left and right with music.` in the native
  Tauri window.
- Confirmed the app selected `Generated CORE ROM`.
- Clicked `Play ROM` by native accessibility name.
- Confirmed the generated ROM started in the embedded player.
- Sent ArrowRight and confirmed the UI recorded `Right`.
- Clicked Pause, Resume, Reset, and Stop by native accessibility name.
- Final native UI showed `Interactive player stopped`, `Right`, generated ROM
  path `artifacts/phase2/agent-loop/project/out/rom.bin`, `Right input
  verified`, and `Non-silent 10922`.

## Product V1 Checks

- Golden path clarity:
  Passed. The app exposes New Project through the project menu, Ask Agent in
  the conversation rail, Verify as the proof path, Play ROM as the interactive
  path, and Save/Export as top-level project actions. Browser smoke covers the
  full visible path.
- Provider path:
  Passed. Missing-provider state is truthful, and configured OpenRouter testing
  reported `Connected` / `OpenRouter key accepted`.
- Project lifecycle:
  Passed. New, Save, Open, Import, Play, Verify, and Export all provide visible
  feedback in the browser smoke and use the active ROM source.
- Audio and input truth:
  Passed. Keyboard input is verified in browser and native paths. Interactive
  audio remains visibly gated. The generated CORE proof verifies non-silent
  bundled audio. Controller support remains labeled as future work.
- Emulator/core distribution:
  Passed. Genteel remains Verify/Capture Proof. Nostalgist/RetroArch interactive
  Play remains behind the adapter boundary. Core binary distribution is not
  claimed as bundled or release-settled.

## Stop Condition

Product V1 is marked complete for the local review scope because:

- The native generated-ROM Play check passes. Done on July 1, 2026.
- The Product V1 verification packet records every required check above.
- `scripts/verify-phase6-loop.sh --browser` passed.
- `scripts/verify-phase6-loop.sh --no-browser --with-v1-proof` passed.
- README, PROGRESS, and this evidence file describe the same status.
- Git hygiene confirms no secrets, model weights, commercial ROMs, emulator
  cores, WASM cores, or large local artifacts are committed.

Anything beyond that belongs in the post-v1 backlog.
