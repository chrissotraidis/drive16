# Phase 6 To Product V1 Goal Loop

## Purpose

Phase 6 proved interactive ROM play, but Drive16 still needs one focused
closure pass before it feels like a coherent Product V1. This loop turns the
current workbench into a v1 product slice without drifting into Phase 7 ideas.

## Product V1 Target

A non-developer can launch Drive16, start from the starter project, ask for the
bundled sprite/music game, watch truthful agent/proof progress, play the
resulting ROM with keyboard input, verify it through the proof path, save or
export it, and understand what is configured or missing.

## Working Files

- `PROGRESS.md`: current status and next step.
- `WORKLOG.md`: append-only loop record.
- `DECISIONS.md`: architecture or distribution decisions.
- `docs/product-v1-evidence.md`: Product V1 pass/fail evidence packet.
- `docs/phase6-evidence.md`: Phase 6 evidence and native generated-ROM
  review item.

## Stop Condition

Stop when all Product V1 exit criteria below are met, the verification loop
passes, evidence is updated, and remaining post-v1 work is clearly separated.
Do not continue into controller UI, marketplace, packaging/notarization, richer
asset editing, or generalized multi-ROM library work.

## Non-Goals

- No marketplace, template browser, or community sharing.
- No commercial ROMs or committed imported ROMs.
- No committed emulator cores, WASM cores, model weights, or API keys.
- No claim of full controller support unless a real controller is detected and
  tested.
- No claim that AI sprite/music generation is on the critical path.
- No packaging/notarization pass unless it blocks local Product V1 review.

## Unit 0: Reconcile Current State

Expected work:

- Read `PROGRESS.md`, `README.md`, `docs/phase6-evidence.md`, and this file.
- Confirm the app launches locally as both browser preview and native Tauri
  process.
- Confirm the current git state, including any uncommitted Phase 6 verifier
  work.
- Run the existing verification loop once before changing behavior.

Exit evidence:

- Current blockers are listed before implementation begins.
- No stale claim remains in the top-level docs.
- `docs/product-v1-evidence.md` reflects the current pass/fail state.

## Unit 1: Close The Native Generated-ROM Play Check

Expected behavior:

- In the native Tauri window, a generated CORE ROM can be selected or produced.
- `Play ROM` starts that generated ROM without first importing it through the
  browser file picker.
- ArrowRight reaches the running player.
- Pause, Resume, Reset, and Stop work from the native window.
- Browser smoke remains green.

Exit evidence:

- `docs/phase6-evidence.md` no longer lists the native generated-ROM
  click-through as unreviewed.
- New screenshots or notes identify the generated ROM source and the native
  Play result.

## Unit 2: Make The Golden Path Obvious

Expected behavior:

- The primary user path is visually and textually clear:
  New Project -> Ask Agent -> Build/Verify -> Play -> Export.
- `Verify` means proof/capture.
- `Play ROM` means interactive human play.
- `Save` and `Export` show durable, nearby confirmation.
- Project menu actions do not feel like a hidden drawer of unrelated tools.
- The ROM viewport remains the visual center when playing.

Design constraints:

- Do not add a new landing page.
- Do not add status cards that compete with the player.
- Do not use vague status language like "running" unless the running thing is
  named.
- Keep controls conventional and compact.

Exit evidence:

- Desktop and narrow screenshots show the golden path without overlap or
  awkward wrapping.
- The app has no obvious dead or ambiguous top-level button.

## Unit 3: Make The Agent Path Truthful And Useful

Expected behavior:

- OpenRouter is the only hosted provider required for Product V1.
- If OpenRouter is untested or missing a key, the app says exactly that and
  keeps local proof mode honest.
- If OpenRouter is configured, a user prompt can produce a useful streamed
  agent/proof flow rather than a no-reply or confusing local-only response.
- Tool events explain what is happening: building, verifying, playing, exporting,
  or waiting for setup.
- Model/provider information stays near chat/settings, not as confusing global
  chrome.

Exit evidence:

- One configured-provider path is tested end-to-end.
- One missing-provider path is tested and reads as setup guidance, not failure.
- No pasted key material is committed or logged in tracked files.

## Unit 4: Tighten Project Save, Open, Import, Export

Expected behavior:

- `New Project` clearly resets to the blank starter.
- `Save Project` creates a discoverable snapshot.
- `Open Project` restores a saved snapshot or clearly explains why none exists.
- `Import ROM` imports an external local ROM into ignored storage.
- `Export ROM` exports the active ROM, whether generated, starter, or imported.
- The active ROM source is visible before Play and Export.

Exit evidence:

- Browser/native click-through covers New, Save, Open, Import, Play, Verify,
  and Export.
- Imported ROMs remain ignored.

## Unit 5: Audio And Input Truth

Expected behavior:

- Keyboard input is the Product V1 supported input path.
- Audio either works in interactive Play with user-gesture-safe defaults or is
  explicitly labeled as not wired.
- Controller UI is not shown as complete unless tested with a real controller.
- The controller-ready input abstraction remains documented for the next phase.

Exit evidence:

- Keyboard input is verified in browser and native paths.
- Audio state is tested or honestly gated.
- Controller copy does not overpromise.

## Unit 6: Emulator/Core Distribution Decision

Expected work:

- Reconcile the original Genteel-first architecture with the Phase 6
  Nostalgist/RetroArch interactive adapter.
- Decide Product V1 wording for Genesis Plus GX core delivery:
  user-supplied, installer-managed, dev-only, or replaced later.
- Keep Genteel as the Verify/Capture Proof path unless deliberately changed.

Exit evidence:

- `README.md` and a decision/evidence doc state the distribution posture.
- The app does not imply bundled commercial-ready emulator core distribution
  if that is not true.

## Unit 7: Product V1 Verification Packet

Required checks:

- `scripts/verify-phase6-loop.sh --browser`
- `scripts/verify-phase6-loop.sh --no-browser --with-v1-proof`
- Native Tauri click-through for generated ROM Play.
- OpenRouter configured-provider path, if a key is available for the run.
- Missing-provider path.
- New, Save, Open, Import, Play, Verify, Export.
- Desktop and narrow viewport visual checks.
- Git hygiene: no ROMs, model weights, emulator cores, secrets, or large local
  artifacts committed.

Exit evidence:

- `docs/product-v1-evidence.md` or an updated evidence packet lists the checks,
  results, and any intentional limitations.
- `PROGRESS.md` and `README.md` describe Product V1 status accurately.
- Remaining work is separated into post-v1 backlog.

## Product V1 Exit Criteria

- Drive16 launches locally as a native app and browser preview.
- A user can follow the golden path without guessing which button matters.
- The bundled sprite/music CORE path works from prompt to verified ROM.
- The resulting ROM can be played interactively with keyboard input.
- The generated-ROM native Play path is verified.
- Save/Open/Import/Export have clear feedback and work for the active ROM.
- Agent/provider setup is truthful and useful.
- Verify/Capture Proof remains distinct from Play.
- Audio and controller states are honest.
- License/core distribution posture is documented.
- The full verification loop passes.
- No prohibited artifacts or secrets are committed.
