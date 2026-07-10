# Drive16 Progress

Current phase: Direct-download packaging baseline complete; packaged
interactive Play remains a release blocker.

The builder reliability, four-prompt functional audit, first-run UX, stricter
presentation baseline, and three-model comparison are complete. A release-mode
macOS `.app` now runs from bundled support files copied into Application
Support, with an explicit CSP and a streamed-or-local Play-core policy. The owner
confirmed MIT and chose direct download rather than App Store or Apple-notarized
distribution. The ad-hoc-signed DMG passes install and native Verify checks,
but it is still a test build because interactive Play is black in the packaged
WKWebView. Downloaded copies may require macOS **Open Anyway** on first launch.

## Stalled-build recovery and packaged verification (2026-07-10)

- Diagnosed the failed Tetris run: the packaged app attached to an older
  OpenCode server rooted in the git checkout, so three successful ROM builds
  landed outside the Application Support project watched by the UI.
- Drive16 now always launches and stops its own OpenCode child, passes the
  absolute active-project path to the agent, and refuses to silently reuse an
  unrelated healthy server on port 4096.
- Agent runs now have an absolute six-minute ceiling, explicitly abort the
  OpenCode session, enforce the two-attempt music limit, and recover a current
  ROM when verification stalls after a successful build.
- Recovered Tetris from the proven deterministic skeleton without another
  model call. It builds, presents a composed game screen, responds to scripted
  Right input, restarts cleanly, and emits non-silent music.
- The DMG now bundles the native Genteel verifier. In the release app, Verify
  completed in about three seconds with screen capture, a same-frame 0.333%
  input change, and audio max-absolute sample 10922; the UI reported `Ready`.
- Direct-download releases enable the existing streamed interactive core path
  without asking the user to find `.zip`, `.js`, or `.wasm` files. The browser
  renders the recovered Tetris ROM and records Right/Up input. The packaged
  WKWebView starts the same core and records input, but its canvas remains black;
  the screen check now times out honestly instead of staying on `Checking`.

## Local model and packaging proof (2026-07-09)

- Added a live `audit_project_memory` builder tool so local models can repair
  exact `GAME.md` / `ASSETS.md` / `PLAYTEST.md` contradictions before claiming
  completion.
- Removed stale emulator-input leakage between audit runs and fixed
  `nonSilent=true` evidence normalization.
- Local Qwen passed a full Snake packet with all eleven run-record checks true:
  build, screen, directional input, restart, audio, assets, genre rules,
  project memory, trace, agent completion, and fresh evidence.
- The three-model/four-prompt bakeoff remains verified. DeepSeek is the quality
  operational default; Qwen is the zero-cost local fallback. After rescoring
  every historical screenshot under presentation contract v2, all 12 outputs
  need visual repair, so the report no longer overstates a visual winner.
- Replaced the sparse text-grid genre skeletons with custom 8x8 tile art,
  composed playfield panels, stronger palette hierarchy, and distinct object
  silhouettes. All four baselines build, pass v2 screenshot checks, and emit
  verified non-silent audio without any new model calls.
- The desktop app now auto-starts ComfyUI whenever the persisted AI-sprites
  toggle is enabled. The native release reached readiness in nine seconds and
  generated a validated 32x32, 16-slot local sprite; browser preview now states
  plainly that it cannot start native sprite tools.
- Tauri bundling is enabled. The release `.app` embeds the 3.7 MB Drive16
  support runtime, copies it to
  `~/Library/Application Support/dev.drive16.desktop/runtime`, and initializes
  the active project there instead of under the git checkout.
- Release mode enables the streamed interactive core for the direct-download
  build while keeping the core out of the package itself.
- The packaged native window, OpenCode bridge, first-run workspace, settings,
  and Advanced setup list were inspected successfully.
- The whole `.app` is now ad-hoc signed instead of using `--no-sign`, so strict
  bundle verification includes all packaged resources, including the MIT
  license file.
- `pnpm --dir app verify:release:macos` verifies the DMG checksum, copies the
  app to a canonical isolated install path, launches with an empty home, and
  proves the writable runtime plus active project are created.

## Live-audit contract completed (2026-07-09)

- Checkpointed the reliability pass in commit `9ead63d` before starting UX
  changes.
- Promoted clean DeepSeek V3.1 primitive/fallback runs for Snake, Pong,
  Tetris, and Asteroids into `artifacts/phase9/live-game-audit/report.json`.
- `pnpm --dir app verify:live-game-audit:report` passes with compile, screen,
  directional input, restart, non-silent audio, asset ledger, genre, project
  memory, fresh-ROM, trace, and evidence-file checks for all four prompts.
- Added in-place failed-run continuation so a repair preserves the original
  project and OpenCode trace instead of resetting evidence.
- Added atomic run promotion: the report template is replaced only after the
  complete four-run verifier passes.
- Seeded runs now carry their original run plan as required provenance; the
  final verifier permits a missing source edit only when that seed evidence is
  present and matches the prompt.
- Fixed an audio-negation false positive where `no errors` on a build line
  could be paired with `captured` on a screenshot line and incorrectly reject
  later non-silent audio proof.
- The model bakeoff was run only after the first-run and evidence contracts
  stabilized. Its historical screenshots are now explicitly rescored under
  presentation v2 rather than grandfathered as visually complete.

## First-run and operational UI update (2026-07-09)

- Replaced the dominant empty `NO ROM` canvas with a guided start card: one
  primary describe-game action, Snake/Pong/Tetris/Asteroids examples that seed
  the existing composer, and an open-project route.
- The native card reports concise build readiness (`Ready to build locally` or
  the one dependency that needs attention) without turning setup into the main
  experience.
- Kept Save and Export in the top bar and removed their duplicate project-menu
  actions.
- Replaced artifact-path-heavy project metadata with user-facing state such as
  `Built and ready`, `Snapshot ready`, and `No imported ROM`; exact paths remain
  available as hover titles for debugging.
- Settings now keeps provider, model, API key, AI sprite mode, and original
  music visible. ComfyUI endpoint/model/LoRA values plus local tool paths and
  diagnostics live behind Advanced disclosures.
- Browser smoke now proves the guided first-run actions, example-to-composer
  handoff, settings persistence through the advanced disclosure, and the
  simplified project menu.
- The native debug app was rebuilt and visually checked at its real 1440x900
  window with OpenCode and Docker ready.

## Next robustness goals (2026-07-08)

Goal 1 - Make project state trustworthy.

- New Project must reset chat, build log, active ROM, player preview/playback,
  project title, pending agent session state, and evidence state together.
- The project header/dropdown must always reflect the active project workspace,
  never an old `Starter Project` summary after a refresh or reset.
- Play/Verify must refuse missing-ROM projects plainly instead of falling back
  to an older template ROM.

Goal 2 - Make settings persistent and honest.

- OpenRouter key, accepted-key marker, AI sprites toggle, MML music toggle,
  ComfyUI endpoint, checkpoint, and LoRA must survive refresh in the app window.
- Settings labels must distinguish `ready`, `enabled`, `failed`, and `not
  tested`; a toggle being on is not proof that ComfyUI or MML worked.
- ComfyUI failures should preserve the concrete endpoint/model error so the
  next action is obvious.

Goal 3 - Make the agent loop usable turn by turn.

- Each user build/edit prompt should create a clean OpenCode run while keeping
  continuity through the active project files.
- Broad prompts should get either a few clarifying questions or a visible
  default plan before long-running build work begins.
- Stale OpenCode events from an older session must not update the visible chat,
  player evidence, or current project status.
- Timeouts and provider/tool failures should produce actionable chat feedback,
  not an endless working state.

Goal 4 - Make live logging useful instead of noisy.

- The visible build log should show meaningful events: accepted request,
  planning, file edits, asset generation, music generation, build, emulator run,
  screenshot, input check, audio check, retry, failure, and finish.
- Heartbeat should be shown as a pinned live status, with raw heartbeat events
  available only in the raw log.
- The visible log should stay scrolled to the newest event during active work.

Goal 5 - Add per-project memory for resumed work.

- Every active project should carry `GAME.md`, `ASSETS.md`, and `PLAYTEST.md`.
- The agent must read these files before continuing a project and update them
  after material changes.
- These files should record the game's concept, controls, assets used, known
  bugs, playtest evidence, and next checks so future turns do not start from
  scratch.
- The project menu should preview `ASSETS.md` role rows so the user can see
  whether a game used primitive drawing, bundled files, ComfyUI sprites, MML,
  or SFX without opening the project folder.

Goal 6 - Gate "done" on playability evidence.

- The app and builder prompt should not call a generated game done merely
  because a ROM compiled.
- A done claim requires evidence for visible screen, non-broken initial state,
  input response, basic game rules, restart/start behavior where relevant,
  style/asset intent, and audio status.
- The player surface should show an aggregate playability gate such as `no ROM`,
  `needs repair`, `failed`, or `verified` based on screen/input/audio evidence.

Goal 7 - Prove the asset and music paths through chat.

- When AI sprites are enabled, the agent should use ComfyUI only if readiness
  passes, normalize/crop/palette-check the PNG, wire it into SGDK resources, and
  disclose exactly what asset was used.
- When MML music is enabled, the agent should generate/compile/wire a VGM and
  capture audio evidence after loading the ROM.
- If either enhancement is unavailable, the chat should say it used primitive
  tiles or no generated music instead of implying the feature ran.

Goal 8 - Fix the player feedback loop.

- Sound on/off must actually toggle player audio and reflect the current state.
- Player status messages must match what is on screen; it should not say blank
  when the frame is visibly rendering.
- Play, pause, reset, stop, and imported/generated ROM transitions need focused
  smoke coverage so old ROM state does not leak into new projects.

## Reliability status (2026-07-07)

Recent user testing contradicted the optimistic July 5 wording:

- OpenRouter key and enhancement settings appear to be lost on refresh.
- AI sprites and MML music toggles do not behave as reliable working features.
- ComfyUI fails from Settings and is not usable from the agent flow.
- MML music can show `Ready` without proving music generation works through
  chat.
- The agent path may handle one prompt, but turn-by-turn build/edit chat stalls
  or fails.
- Logging is not strong enough to identify where the agent loop blocks.

Follow-up from the Snake proof-case review:

- The generated Snake project built but originally overclaimed completion: it
  used only primitive C tiles, did not use ComfyUI or MML, and the first
  screenshot evidence showed score/state and visual defects.
- The first recovery slice now adds project memory templates (`GAME.md` and
  `PLAYTEST.md`), visible chat build-log plumbing, a player audio-volume fix,
  and stricter builder-agent rules for broad prompts, asset disclosure, and
  playability gates.
- The next recovery slice passes app enhancement settings into the builder
  prompt, shows a visible default plan or clarifying questions before long
  desktop agent runs, and normalizes OpenCode tool events into specific chat
  log categories for files, build, ROM run, input, screenshot, audio, sprites,
  and music.
- The chat log now also labels failed-build recovery as fixing, retrying, and
  fixed, so a compiler failure no longer looks like a silent stall.
- Browser smoke now covers the broad-prompt question gate: `Build a game.`
  asks three quick design questions and does not call OpenRouter.
- The active Snake project was repaired into a basic playable primitive-tile
  proof with score 0, visible snake/food/border, directional input, wall
  collision, and restart evidence. It is not proof that generated sprites or
  music work in that game.
- Follow-up generated-assets Snake proof now wires ComfyUI and MML into that
  same active project: `res/snake_head.png` is referenced as
  `snake_head_sprite`, `res/snake_theme.vgm` is referenced as `snake_theme`,
  the ROM builds, screenshot/input evidence is saved under
  `artifacts/phase9/generated-snake-proof/`, movement diff passes, and emulator
  audio is non-silent (`maxAbsSample=10922`). The sprite is visibly rough, so
  this is pipeline/playability proof rather than final art direction.
- A live OpenCode run against the active Snake project now leaves readable
  evidence for the builder loop: it read `GAME.md`/`PLAYTEST.md`, built the
  ROM, sent movement/state input, ran the emulator, captured a screenshot, and
  updated `PLAYTEST.md`. `scripts/verify-agent-contract.mjs` now checks that
  real OpenCode events normalize into visible chat-log categories.
- Browser preview recheck after reload confirmed the chat build log is visible,
  the OpenRouter key field stayed populated for the session, AI sprites and MML
  toggles stayed enabled, and there were no console warnings/errors. This is
  UI persistence/logging evidence, not a native ComfyUI/MML generation proof.
- The asset-memory slice now makes `ASSETS.md` start with an Asset Plan, parses
  its role table in the native project summary, and shows those rows in the
  project menu with thumbnails for repo-local PNG files. This improves
  auditability, but it is not proof that future games will use ComfyUI/MML well
  until the live agent gates pass.
- Passing project-memory gates now enforce the generated-asset side of that
  ledger: `ASSETS.md` needs an Asset Plan, and ComfyUI/generated rows must use
  a specific gameplay role rather than `Sprite`, plus record the prompt,
  crop/slice normalization, and whether the asset was used. Temporary fixtures
  cover vague roles and missing crop/use evidence.
- The observability slice now derives a compact agent phase from real OpenCode
  events: Planning, Editing, Building, Testing, Done, or Failed. The top status
  and chat activity strip use that phase while the raw log keeps the detailed
  event stream for debugging.
- The project-memory audit now enforces genre evidence on passing gates for
  Snake, Pong, Tetris, and Asteroids-style games. A `PLAYTEST.md` pass with
  `Genre checks: pending` or missing genre proof fails the verifier, while a
  failed gate can still record pending/untested checks honestly.
- `pnpm --dir app verify:project-memory` now also runs temporary Snake, Pong,
  Tetris, and Asteroids-style fixtures to prove those gate rules reject pending
  genre checks and accept complete evidence.
- After an agent-produced ROM appears, the app now reads the active
  `PLAYTEST.md` gate and adds an explicit chat/action notice. A ROM with
  `Playability gate: FAIL`, missing project memory, or an unknown gate is shown
  as needing repair/unverified instead of being treated as done.
- The same audit now rejects passing gates that have no active music/SFX
  evidence unless the project explicitly records that audio was disabled or
  intentionally omitted. `pnpm --dir app verify:project-memory` now includes
  audio fixtures for missing audio, captured audio, uncaptured audio, and
  explicit no-audio requests; that caught and fixed a false positive where
  negated text like "no audio evidence was captured yet" could pass.
- Model bakeoff remains pending, but the evidence contract now exists:
  `scripts/verify-model-bakeoff-report.mjs` requires DeepSeek V3.1 plus at
  least two alternatives, the same Snake/Pong/Tetris/Asteroids prompts, all
  plumbing gates marked pass, compile/tool/asset/playability/honesty scores,
  time/cost, and project-memory evidence before accepting any default-model
  recommendation.
- The bakeoff CLI now keeps scaffold checks separate from evidence:
  `pnpm --dir app prepare:model-bakeoff` refuses to write a bakeoff template
  until `pnpm --dir app verify:live-game-audit:report` passes, and
  `pnpm --dir app verify:model-bakeoff:report` requires every model/prompt
  evidence file to exist. This prevents a model recommendation from being made
  before the four-prompt live audit is actually complete.
- Live game-quality audit now has a pre-bakeoff report contract:
  `scripts/verify-live-game-audit.mjs` validates the single-model Snake, Pong,
  Tetris, and Asteroids prompt packet before comparing models. Each run must
  record compile, preview, visible screen, input, restart, audio, asset-ledger,
  gameplay-rule, and project-memory evidence; a passing run cannot carry
  unresolved issues or unknown/silent audio unless sound was disabled by
  request. This is a verifier/template for the next native audit, not proof
  that the four live game runs have already passed.
- Live audit readiness now has a concrete report:
  `scripts/check-live-game-audit-readiness.mjs` writes
  `artifacts/phase9/live-game-audit/readiness.json` after checking the local app
  URL, OpenCode/MCP config, OpenRouter credential, Docker, ComfyUI, contract
  checks, project-memory gates, and live-audit verifier. The report now
  separates primitive/fallback readiness from generated-sprite readiness so a
  green audit prerequisite does not imply ComfyUI is available. If ComfyUI is
  not listening on `127.0.0.1:8188`, the primitive/fallback audit can still run
  only with explicit fallback-art disclosure; generated-sprite audit readiness
  stays false until ComfyUI is actually ready.
- `pnpm --dir app prepare:live-game-audit` now writes the next single-model
  `report.json` template after first refreshing readiness, so plumbing fields
  such as `comfyUiStatus: fallback-disclosed` or `ready` match the current
  machine state instead of being copied from stale notes. Historical failed-run
  traces remain under `artifacts/phase9/live-game-audit/runs/`.
- `scripts/run-live-game-audit-prompt.mjs` now prepares one reproducible
  prompt packet for the required Snake/Pong/Tetris/Asteroids live audit. It
  refreshes readiness, copies a fresh starter project without stale ROM output,
  writes the exact prompt and `run-record.json` skeleton, and can optionally
  run OpenCode with `--run-agent`. Real runs now stream OpenCode stdout/stderr
  into `opencode-run.jsonl` and `opencode-run.stderr` while the process is
  still alive, with `opencode-run.status.json` reporting pid/status. Use
  `pnpm --dir app prepare:live-game-audit:prompt -- --prompt snake-basic` for
  a dry packet, then `pnpm --dir app run:live-game-audit:prompt -- --prompt
  snake-basic --model openrouter/<model>` when ready to produce real evidence.
- The first streamed `snake-basic` retry using
  `openrouter/deepseek/deepseek-chat-v3.1` confirmed the harness visibility fix:
  `opencode-run.jsonl` grew live and `opencode-run.status.json` exposed the
  running pid before the 180-second cap expired. The model still failed the
  audit: it read the project memory files, then spent the run editing `GAME.md`
  and `ASSETS.md`, claimed `out/rom.bin` was built before any ROM existed,
  claimed no known issues while `PLAYTEST.md` still failed, and self-omitted
  audio without a user no-audio request. The JS and native project-memory
  audits now reject those exact claims, including for failed gates, so this
  failed run is recorded as useful blocker evidence rather than a clean project
  memory pass.
- The builder instructions, app runtime prompt, and live-audit prompt now all
  include a source-first documentation rule learned from that failed run: do
  not polish `GAME.md` before gameplay exists, keep early `ASSETS.md` rows
  `Planned`/`Pending`, never claim `out/rom.bin` was built before `build_rom`
  succeeds, never write `Known Issues: none` before a passing `PLAYTEST.md`,
  and never call audio omitted unless the user explicitly requested no audio.
  A dry `smoke-doc-order` packet confirms those lines are present in the
  generated audit prompt.
- `verify-live-game-audit.mjs` now labels zero-run packets as templates, not
  completed audits, and `pnpm --dir app verify:live-game-audit:report` is the
  evidence command that requires all Snake/Pong/Tetris/Asteroids runs plus their
  files. This keeps verifier self-tests from being mistaken for live-game
  proof.
- A direct `scripts/launch-phase4-comfyui-api.sh` run reached a healthy
  `http://127.0.0.1:8188/system_stats` response on the local machine, and
  `pnpm --dir app check:live-game-audit-readiness` reported generated-sprite
  audit readiness as ready while that process was running. This proves the
  pinned source/model setup can work locally; generated-sprite readiness still
  depends on the API process being live.
- The follow-up July 8 live-readiness run launched Docker successfully. ComfyUI
  ran correctly in the foreground long enough for
  `scripts/validate-phase4-live-generated-assets.sh` to pass end to end with a
  live ComfyUI sprite, generated MML, SGDK build, emulator run, movement proof,
  and non-silent generated-audio proof. After the foreground process was
  stopped, a detached shell restart reached "Starting server" but did not stay
  listening on `127.0.0.1:8188`, so the current readiness command is green for
  primitive/fallback blockers but not generated-sprite readiness unless
  ComfyUI is launched again through the app/foreground path.
- A first isolated OpenCode live game audit was run for `snake-basic` under
  `artifacts/phase9/live-game-audit/runs/snake-basic/`. That run is failed
  evidence, not a pass:
  DeepSeek V3.1 eventually wrote game code, fixed one SGDK compile error, built
  `out/rom.bin`, ran the emulator, captured a frame, and sent Start/movement
  input. It did not call `capture_audio`, did not produce an audio dump, left
  `PLAYTEST.md` at `Playability gate: FAIL`, and the project-memory audit
  caught overclaiming in `GAME.md` plus weak primitive-role disclosure. The
  builder skill now spells out the exact `dump_audio: true` then
  `capture_audio` sequence and requires a failed playtest note instead of an
  endless audio loop.
- The exact failed audio-loop pattern is now mechanically checked:
  `scripts/verify-opencode-audio-trace.mjs` parses OpenCode JSONL traces and
  accepts either the safer one-shot `drive16-emulator.verify_audio` tool or the
  fallback `run_rom` with `dump_audio=true` followed by `capture_audio`. It
  rejects repeated emulator `run_rom` calls that omit `dump_audio=true`, missing
  audio capture, and silent/missing audio evidence. The live-game audit verifier
  now uses this trace guard for any passing run that claims captured audio, so a
  report cannot simply mark audio as captured without the real tool sequence.
- The emulator MCP server now exposes `verify_audio`, which runs the ROM with
  audio dumping forced on and inspects the WAV in one tool call. The builder
  skill and app prompt now make `verify_audio` the default audio proof path, with
  the old `dump_audio: true` plus `capture_audio` sequence only as fallback.
- A second isolated `snake-basic` retry that explicitly asked for
  `verify_audio` still failed before the evidence gate. The trace shows the
  agent tried invalid `V0`/`v0` MML syntax three times, only succeeded after
  reading `corpus/mml/ctrmml-megadrive.md`, copied `snake_music.vgm`, then
  edited `src/main.c` after the existing `out/rom.bin` timestamp. No
  `build_rom`, `run_rom`, `capture_frame`, `send_input`, or `verify_audio`
  call happened after that final edit. A manual post-run SGDK build of that
  project failed on deprecated `VDP_setPlanSize`, so the old ROM was stale
  evidence. The builder skill and app prompt now require a rebuild after the
  final edit, require reading/querying the MML corpus before the first music
  compile, and cap failed MML compile attempts at two before recording audio as
  failed and finishing gameplay verification. The live-game audit verifier also
  rejects a passing run when `out/rom.bin` is older than files under the
  project's `src/` or `res/` folders.
- A third primitive/fallback `snake-basic` audit run improved one thing but
  exposed the next blocker. The agent read the MML corpus before compiling, but
  then called `drive16-mml-music_compile_music` five times, all failed with
  `Expected track or tag identifier`, and it never edited gameplay source,
  rebuilt, ran the emulator, captured a frame, sent input, or verified audio.
  It also overclaimed music in `GAME.md`. `scripts/verify-opencode-audio-trace.mjs`
  now counts failed `compile_music` calls and rejects traces that keep trying
  after the two-attempt cap, while the builder skill/app prompt now say core
  playable gameplay comes before optional music.
- A follow-up primitive/fallback `snake-basic` trace was stopped after it wrote
  `GAME.md`, `ASSETS.md`, and a large `src/main.c` edit but before any
  `build_rom`, emulator frame capture, input, or audio call. This is not a pass
  or a fair complete model-quality result, but it proves another report loophole:
  a trace can contain real source edits while the existing `out/rom.bin` remains
  older than the source. `scripts/verify-opencode-audio-trace.mjs` now has
  `--expect-game-progress`, which fails traces with source/resource edits that
  are not followed by a rebuild, frame capture, and input evidence. The live
  audit verifier now applies that trace check to passing runs, not only the
  audio sequence.
- The native project-memory audit now rejects weak `Playability gate: PASS`
  notes before the app surfaces a build as verified. A passing `PLAYTEST.md`
  must have a non-empty Evidence section without pending/untested markers,
  genre evidence for the detected game type, and either captured/non-silent
  audio evidence or an explicit no-audio request. Focused Tauri tests cover a
  pending-evidence pass staying `warning` and a complete Snake/audio pass
  becoming `ready`.

Current reliability update from July 8:

- OpenCode startup no longer assumes port `4096` is safe. If the health check
  gets the observed HTTP 401/auth response from another local tool, Drive16
  reports the port conflict and launches OpenCode on a Drive16-owned alternate
  local port. OpenCode restarts now stop only the child process Drive16 owns;
  if something else is still healthy on the current endpoint, Drive16 moves
  itself to a fresh owned port instead of killing unrelated `opencode serve`
  processes.
- Background OpenCode request failures are drained back into the UI so a failed
  agent POST can produce a concrete chat/build-log error before the generic
  stall timer.
- Pending OpenCode runs now track the missing milestone before declaring a
  stall. If the agent edits `src/` or `res/` and stops before `build_rom`, or
  builds without screen/input/audio checks, the chat/build notice names that
  concrete gap instead of only saying the agent stopped.
- Settings now has a ComfyUI Launch action. It invokes the existing local
  ComfyUI launch script, shows `Starting`, then reuses the readiness checks for
  ready/missing-model/missing-LoRA/failure detail. The AI sprites toggle now
  summarizes those rows as `Not running`, `Missing model`, `Missing LoRA`, or
  `Missing model + LoRA` when it can distinguish the blocker.
- The native ComfyUI launch path now captures stdout/stderr to
  `artifacts/phase4/comfyui-api/drive16-comfyui-launch.log`. If the process
  exits before the API becomes ready, Settings reports the exit status and log
  tail instead of only showing a generic connection failure. The managed child
  is now tied to the requested endpoint, so changing the Settings endpoint/port
  relaunches the Drive16-owned ComfyUI process instead of reusing a child that
  is listening somewhere else.
- The active ComfyUI endpoint/checkpoint/LoRA are passed into the OpenCode
  runtime environment for MCP tools, not only written into the visible prompt.
- The builder prompt now includes ComfyUI readiness and explicitly requires
  primitive/manual Genesis-safe art disclosure when AI sprites are enabled but
  ComfyUI is not ready.
- The playability contract now includes genre-specific minimum checks for
  Snake, Pong, Tetris, and Asteroids-style prompts. New projects include that
  checklist in `PLAYTEST.md`, the native fallback template matches it, and the
  UI calls a running-but-unverified ROM `Gate: needs repair` rather than
  implying it is merely unfinished.
- App refresh no longer auto-loads an existing active-project ROM into the
  preview/player path. A remembered ROM is shown as available, but the user
  must press Verify or Play before Drive16 captures frames or starts playback,
  which avoids stale-ROM evidence being mistaken for a fresh build.
- Interactive Play audio now treats the Drive16 volume slider as the safety
  source of truth. RetroArch launches at minimum volume, Drive16 pushes the
  runtime volume down on session start, and the player no longer depends on the
  toggle-style RetroArch mute command to keep startup silent. `New Project`
  also explicitly resets app volume to 0%, and the agent/UI contract verifier
  guards that reset path.
- Agent-finished ROMs now actually run through the ROM preview capture path
  before Drive16 surfaces the project-memory audit. The chat no longer says it
  is loading/checking a generated ROM while only reading `PLAYTEST.md`; if the
  preview capture fails, the build state stays in error instead of looking
  verified.
- Preview capture failures now override optimistic project-memory results. A
  generated ROM with a failing preview path surfaces `Preview failed` with the
  concrete launch error, keeps screen/audio evidence unverified or failed, and
  does not allow a `PLAYTEST.md` pass to make the UI look done.
- OpenCode `finished` no longer means Drive16 `Done`. The visible phase and
  build-log label move to Testing while Drive16 loads the ROM, captures preview
  evidence, and audits project memory; only an explicit verification pass moves
  the phase to Done.

The native chat loop, MML music path, and ComfyUI sprite path were reproduced
live in the current session on July 7.

Current recovery evidence from this pass:

- Browser smoke now verifies refresh persistence for the OpenRouter session
  key, AI sprites toggle, MML music toggle, and ComfyUI endpoint/checkpoint/LoRA
  fields.
- MML direct tooling works: `validate-mml-music-mcp.py` produced a valid VGM,
  and `validate-phase4-generated-music-prompt.sh` passed the generated-MML ROM
  proof.
- ComfyUI initially failed because no API process was listening on
  `127.0.0.1:8188`. The local model files and Pixydust node were already
  present. After launching `scripts/launch-phase4-comfyui-api.sh`,
  `check-phase4-comfyui-readiness.py`, `run-comfyui-sprite-workflow.py`, and
  `validate-phase4-generated-assets-prompt.sh` all passed.
- OpenCode same-session turns repeat the first instruction in a minimal
  OpenRouter session smoke. The app now starts a fresh OpenCode session per
  build turn and keeps continuity through the active project workspace. A fresh
  session-per-turn smoke answered `APPLE` then `BANANA` correctly.
- Direct OpenCode app-payload build loop passes with the fresh-session
  approach: one turn changed the active project title to `TURN ONE` and rebuilt
  `out/rom.bin`; a second fresh-session turn changed it to `TURN TWO` and
  rebuilt again.
- Native UI chat click-through now passes: one turn changed the active project
  title to `NATIVE ONE` and rebuilt `out/rom.bin`; the next turn changed it to
  `NATIVE TWO`, rebuilt again, and the player loaded the updated ROM.
- Native chat MML path now passes for wiring/build: the agent generated
  `res/upbeat_loop.vgm`, added `upbeat_loop` to `res/resources.res` and
  `res/resources.h`, changed `src/main.c` to `XGM_startPlay(upbeat_loop)`, and
  rebuilt `out/rom.bin`. Direct generated-MML proof remains the non-silent audio
  evidence; native speaker playback was not separately audited in this pass.
- Native chat ComfyUI path now passes while the local API is running: the agent
  generated `res/spaceship.png` as a 32x32 indexed PNG, added
  `spaceship_sprite`, replaced the ball sprite usage with that resource, rebuilt
  `out/rom.bin`, and the player loaded the rebuilt ROM.

## Overhaul status (2026-07-05)

- [x] Track A - real agent loop: chat routes to the OpenCode agent with the
  SGDK build / emulator / RAG / music / ComfyUI MCP tools; builder skill at
  `agent/skills/drive16-app-builder.md`; active project workspace at
  `artifacts/phase3/active-project`; agent-built ROM auto-loads into the
  player. Current truth: fresh-session native UI turns can edit and rebuild the
  same active project repeatedly.
- [~] Track B - player audio: Web Audio resume/mute is wired in the Nostalgist
  player. Current truth: generated MML proof passes directly, and chat-through-
  agent music now generates, wires, and rebuilds a ROM. Native speaker playback
  still needs a separate audible pass.
- [x] Track C - UI rebuild: two-pane shell (chat left, game right), six
  components under `app/src/components/`, App.tsx 6,014 -> ~3,600 lines,
  styles.css rewritten at half size, dev-process jargon removed from
  user-facing copy. Browser smoke updated and passing.
- [x] Track E (partial) - hardening: timeouts + kill on Docker/Genteel
  shell-outs; ROM (16 MB) and core (96 MB) import size caps.
- [x] Track D - generation via chat: music and sprite recipes are present in
  the builder skill and local tooling. Current truth: direct MML and direct
  ComfyUI sprite generation pass when the ComfyUI API is running; native chat
  generated a VGM music asset and a 32x32 ComfyUI sprite asset, wired each into
  resources, rebuilt the ROM, and reloaded the player.
- [x] In-app trust pass (from live user testing): OpenCode auth activates
  via automatic server restart; saved keys are detected on launch (no
  re-pasting); action results show as visible toasts; real error strings
  are preserved; silent provider rejections surface as re-test-key errors;
  Browser Play works via the streamed core fallback; the current packaged
  macOS WKWebView starts that player and receives input but renders black.
  New Project resets the agent workspace; desktop chat has exactly one path
  (the agent) — the freeform gate path is browser-preview-only.
- [x] Structure formalized: `docs/project-structure.md`, starter template
  ships `res/` scaffold, project menu shows the Workspace folder, agent
  skill carries identity/capabilities and a no-tools-for-greetings rule.
- [~] Track E (rest) - app-data paths, Tauri bundling, CSP, the user-core
  policy, MIT licensing, and ad-hoc direct-download packaging are implemented;
  the isolated install smoke passes. Packaged interactive rendering remains a
  release blocker. Apple notarization is optional future Gatekeeper polish.

Older phase history follows below.

## Current Review Packet

- [x] Codex current-issues report created in
  `docs/review/2026-07-02-drive16-current-issues-report.md`.
- [x] Fable 5 investigation prompt created in
  `docs/review/2026-07-02-drive16-fable-5-investigation-prompt.md`.
- [x] Fable 5 returned product audit added at
  `docs/review/2026-07-02-fable5-product-audit.md`.
- [x] Review packet indexed in `docs/review/README.md`.
- [x] Post-v1 backlog updated with audit findings and the selected Phase 8
  slice.
- [x] Human approved the OpenRouter-only live freeform reply loop.
- [x] Human approved the readiness / first-run truth hub loop.
- [x] UI optimization checkpoint recorded in
  `docs/phase8-ui-optimization-checkpoint.md`.
- [x] UI repair control map recorded in `docs/ui-repair-control-map.md`.
- [x] UI repair Slice 1 recorded in `docs/phase8-ui-repair-slice1.md`.
- [x] UI repair Slice 2 recorded in `docs/phase8-ui-repair-slice2.md`.
- [x] UI repair Slice 3 recorded in `docs/phase8-ui-repair-slice3.md`.
- [x] UI repair Slice 4 recorded in `docs/phase8-ui-repair-slice4.md`.
- [x] UI repair Slice 5 recorded in `docs/phase8-ui-repair-slice5.md`.
- [x] UI repair Slice 6 recorded in `docs/phase8-ui-repair-slice6.md`.
- [x] UI repair Slice 7 recorded in `docs/phase8-ui-repair-slice7.md`.
- [x] Phase 8 next-agent handoff recorded in
  `docs/phase8-next-agent-handoff.md`; it is now historical and superseded by
  the 2026-07-05 overhaul state.
- [x] Human confirmed MIT and the repository now includes `LICENSE`.

## Phase 8 UI Repair Checklist

- [x] Preserve the Phase 8 roadmap checkpoint before changing the UI.
- [x] Create a visible-control map for primary buttons and feedback locations.
- [x] Separate chat, setup/gating replies, proof results, and model replies.
- [x] Keep provider/session truth in Settings while preserving clear chat
  fallback messages.
- [x] Collapse proof/files details out of the main conversation rail.
- [x] Put project actions before readiness details in the project menu.
- [x] Collapse secondary Settings sections by default.
- [x] Fix normal-window status wrapping for the ROM/player surface.
- [x] Default ROM/tool inspector details to collapsed on first load.
- [x] Keep the chat composer neutral instead of showing provider status beside
  messages.
- [x] Compress the player session strip behind a `More` disclosure.
- [x] Block OpenRouter replies that claim local ROM build/proof completion
  without local proof evidence.
- [x] Make missing interactive-Play copy say `Set Up Play` and clarify that
  Verify still works without a Play core.
- [x] Tighten chat card spacing.
- [x] Keep OpenRouter BYOK keys available across refreshes in the current app
  window without committing them to the project.
- [x] Run browser checks at realistic desktop sizes.
- [x] Fix `Verify Right` so completed proof returns the header to `Ready`.
- [x] Make browser-preview `Play ROM` feedback explain the import-or-desktop
  next step instead of looking like a broken player.
- [x] Relaunch and visually verify the current Phase 8 repair UI in the real
  native Tauri window.
- [x] Browser-audit every obvious non-file-picker primary control.
- [x] Run direct native Tauri-window click-through for OS file-picker flows.
- [x] Add a fresh native app launch helper so macOS does not reopen stale
  embedded UI bundles during review.
- [x] Finish the every-visible-button trust audit for save/open/export and
  settings detail paths.

## Phase 8 Slice 2 Checklist

- [x] Keep the existing OpenRouter freeform reply and CORE proof routes intact.
- [x] Add a compact readiness hub reachable from the main UI.
- [x] Surface ROM proof, interactive Play core, OpenRouter chat, Ollama
  readiness-only status, OpenCode/local tools, ComfyUI sprites, MML music, and
  release blockers in one place.
- [x] Keep release blockers truthful without changing licensing, bundling, CSP,
  signing, or public core policy.
- [x] Extend browser smoke coverage so the hub opens, required statuses render,
  and the mobile-width hub has no horizontal overflow.
- [x] Update README, progress/worklog, decisions, backlog, review index, and
  Phase 8 docs.
- [x] Run native formatting and tests.
- [x] Run the full Phase 6 browser loop.
- [x] Run secret hygiene checks.

## Phase 8 Slice 1 Checklist

- [x] Keep OpenRouter as the only live provider for this slice.
- [x] Use `deepseek/deepseek-chat-v3.1` as the default cheap tested model.
- [x] Add a small OpenRouter chat-completions client without persisting keys.
- [x] Keep CORE sprite/music prompts on the local proof path.
- [x] Render OpenRouter-tested freeform replies as model replies.
- [x] Keep Ollama live replies out of scope with truthful copy.
- [x] Leave OpenCode no-reply logging best-effort and non-blocking.
- [x] Add browser smoke coverage for no-key gate, mocked OpenRouter reply, and
  CORE prompt routing.
- [x] Update README, progress/worklog, decisions, backlog, and Phase 8 docs.
- [x] Run native formatting and tests.
- [x] Run the full Phase 6 browser loop.
- [x] Run a live one-shot OpenRouter manual test with the temporary key.
- [x] Run secret hygiene checks for tracked files and generated artifacts.

## Phase 7 Slice 3 Checklist

- [x] Add a compact Controls / Input setup surface near ROM player controls,
  not Agent Settings.
- [x] Keep the default keyboard mapping: arrows, `Z`, `X`, `C`, Enter.
- [x] Introduce a shared input action map for keyboard and controller bindings.
- [x] Persist the input profile locally in localStorage.
- [x] Add Reset defaults.
- [x] Detect browser Gamepad API availability and connected controller
  presence.
- [x] Show truthful states for Keyboard ready, Controller unavailable,
  Controller detected, and Mapping not configured.
- [x] Wire basic standard-gamepad button/D-pad transitions into the existing
  player input actions when a controller is detected.
- [x] Add browser smoke coverage for default mapping, Controls open/close,
  Reset defaults, and no-controller truthfulness.
- [x] Verify user-core and missing-core behavior are not regressed.
- [x] Update README, progress/worklog, and Phase 7 docs.

## Phase 7 Slice 2 Checklist

- [x] Commit the completed Phase 7 Slice 1 checkpoint before starting.
- [x] Add `Set Up Play` / `Choose Core` near project and ROM player actions,
  not Agent Settings.
- [x] Accept a compatible `.zip` archive or `.js + .wasm` pair.
- [x] Copy normalized core files into ignored local storage under
  `artifacts/phase7/interactive-core`.
- [x] Report `Play ready` / `User core` when a user core is configured.
- [x] Make `Play ROM` prefer the user-supplied core.
- [x] Keep the dev-CDN core path as a development fallback only.
- [x] Add validator coverage for local core presence, readability, tracked
  binary hygiene, and Verify availability.
- [x] Verify user-core Play and missing-core setup behavior in browser smoke.
- [x] Update README and Phase 7 evidence docs.

## Phase 7 Slice 1 Checklist

- [x] Confirm upstream wrapper/core licensing posture for the current
  Nostalgist/RetroArch/Genesis Plus GX path.
- [x] Choose the release posture: current Play is local-development `Dev CDN`,
  not bundled or release-settled.
- [x] Record the decision in `DECISIONS.md`.
- [x] Add an interactive core readiness contract with `available`,
  `dev-only`, `missing`, `needs-user-action`, and `unsupported`.
- [x] Surface Play readiness near the ROM player without moving it into Agent
  Settings.
- [x] Add an `Interactive Play` setup item to the Tools panel.
- [x] Add a setup/check command for the interactive Play core policy.
- [x] Run the expanded browser smoke for present and missing core states.
- [x] Update final evidence after verification.

## Phase 6 Checklist

- [x] Read Phase 6 goal objective.
- [x] Evaluate embedded emulator core options and license posture.
- [x] Add player architecture boundary.
- [x] Clean up UI language so Play and Verify/Capture Proof are distinct.
- [x] Wire imported ROMs into the interactive player.
- [x] Wire keyboard input into the running interactive player.
- [x] Add player controls without crowding the ROM viewport.
- [x] Add or honestly gate audio.
- [x] Add controller-ready input foundation.
- [x] Wire Drive16-generated ROMs into the same player.
- [x] Run full polish, regression, and evidence pass.
- [x] Assemble Phase 6 evidence packet for human review.

## Phase 5 Checklist

- [x] Human sign-off: Phase 4 approved, begin Phase 5.
- [x] Clean provider switching between OpenRouter and Ollama.
- [x] Clarify live agent inference versus local proof responses.
- [x] Add project menu actions for load/open project and import ROM.
- [x] Import a local Genesis ROM into ignored storage and run it in the app.
- [x] Add visible ROM controls and keyboard/controller mapping.
- [x] Add collapsible or resizable ROM-first layout.
- [x] Clarify AI sprites and MML music readiness states.
- [x] Improve Run, Save, Export, Import, and tool-health feedback.
- [x] Validate and document the fully local Ollama plus local ComfyUI path.
- [x] Assemble Phase 5 evidence packet for human review.

## Current Task

The active reliability gate has passed for the basic builder loop. Settings
persistence, native turn-by-turn agent chat, MML music generation, ComfyUI
sprite generation, and logging have current evidence. Track E release hardening
is now the next major workstream.

Evidence is recorded in:

- `docs/overhaul-plan.md`
- `WORKLOG.md` iterations 112-114
- `docs/project-structure.md`
- `docs/phase8-ui-repair-slice1.md`
- `docs/phase8-ui-repair-slice2.md`
- `docs/phase8-ui-repair-slice3.md`
- `docs/phase8-ui-repair-slice4.md`
- `docs/phase8-ui-repair-slice5.md`
- `docs/phase8-ui-repair-slice6.md`
- `docs/phase8-ui-repair-slice7.md`
- `docs/phase8-next-agent-handoff.md`
- `docs/ui-repair-control-map.md`
- `docs/phase8-ui-optimization-checkpoint.md`
- `docs/phase8-readiness-hub.md`
- `docs/phase8-openrouter-freeform-replies.md`
- `docs/phase7-interactive-core-distribution.md`
- `docs/phase7-user-core-flow.md`
- `docs/phase7-input-profiles.md`
- `docs/product-v1-evidence.md`
- `docs/post-v1-backlog.md`
- `docs/phase6-to-product-v1-goal.md`
- `docs/phase6-interactive-player-adapter.md`
- `docs/phase6-keyboard-input.md`
- `docs/phase6-player-controls.md`
- `docs/phase6-audio.md`
- `docs/phase6-controller-foundation.md`
- `docs/phase6-verification-loop.md`

## Release-hardening result

Release hardening is complete for the selected direct-download scope:

1. Runtime paths use app-data storage and bundled resources.
2. Tauri bundling produces a verified ad-hoc-signed macOS DMG.
3. An explicit CSP preserves local Play/core loading.
4. MIT and the user-supplied public interactive-core policy are confirmed.
5. Keep the logging around OpenCode auth, session creation, prompt finish,
   tool activity, ROM detection, and failure duration.

## Completed Phase 6 Work

- [x] Phase 6 goal objective read from the attached prompt.
- [x] Nostalgist, EmulatorJS, romdevtools, retroemu, and direct Genteel
  approaches reviewed.
- [x] Decision recorded to keep interactive play behind a provider adapter.
- [x] Genteel remains the Verify/Capture Proof path.
- [x] Emulator core binaries remain outside git until licensing and delivery
  are explicit.
- [x] Active ROM source model added for starter, imported, and generated ROMs.
- [x] Player provider/session/audio/input types added under `app/src/player`.
- [x] Keyboard mapping now comes from a shared player input model.
- [x] Compact player-session strip added above the ROM viewport.
- [x] Top-level ROM action now says Verify instead of Run.
- [x] Captured-frame toolbar labels now say proof preview and capture.
- [x] Scripted movement proof now says Verify Right.
- [x] Native `read_rom_bytes` command added for safe repo-local ROM payloads.
- [x] `Play ROM` action added and wired to prepare the active ROM for the
  interactive player path.
- [x] Missing-core and browser-preview read failures surface as visible Play
  feedback instead of pretending playback started.
- [x] Nostalgist adapter added behind the Drive16 player boundary.
- [x] Imported repo ROM smoke test launched in the embedded player canvas.
- [x] Keyboard ArrowRight sends input through the running player path.
- [x] Pause, Resume, Reset, and Stop controls added next to Play.
- [x] Audio remains explicitly gated until verified.
- [x] Controller-ready input shape documented without claiming controller
  support is finished.
- [x] V1/CORE generated ROM proof harness passed locally.
- [x] Generated CORE ROM fixture played through the same embedded player.
- [x] Repeatable Phase 6 verification loop added and passed with required
  browser smoke plus generated CORE proof mode.
- [x] Native generated-ROM `Play ROM` click-through passed with ArrowRight,
  Pause, Resume, Reset, and Stop.

## Completed Phase 5 Work

- [x] Phase 4 approved through the Phase 5 goal prompt.
- [x] App header now reports Phase 5 hardening.
- [x] Agent Settings renders OpenRouter and Ollama as mutually exclusive
  provider panels.
- [x] Native Ollama readiness check added for local `/api/tags` model probing.
- [x] Conversation and project menu inference labels now follow the selected
  provider.
- [x] Conversation mode row now distinguishes ROM proof mode from paused
  freeform model replies.
- [x] Freeform prompts are gated when the selected provider is not tested.
- [x] ROM-changing proof prompts still run and are labeled as local proof.
- [x] Message history auto-scrolls to the latest local proof response.
- [x] Project menu includes New, Save, Open, Import, Export, and Agent
  Settings actions.
- [x] Save populates a recent project snapshot row.
- [x] Open Project and Import ROM actions now provide visible feedback instead
  of acting like dead buttons.
- [x] Import ROM storage is prepared under ignored `artifacts/phase5/imports`.
- [x] Import ROM can copy selected ROM bytes into ignored local storage.
- [x] The app can activate an imported ROM and show it as the current project.
- [x] Run and rerun actions use the active imported ROM path when one exists.
- [x] Export can copy the active imported ROM, not only the starter ROM.
- [x] A repo-generated imported test ROM launched through Genteel with a PNG
  screenshot and RGB565 frame stream.
- [x] ROM viewport is focusable and shows `Click ROM to control` versus
  `Input focused`.
- [x] Visible keyboard mapping shows Arrows, Z, X, C, and Enter.
- [x] Local key capture updates the last input state and event feed.
- [x] `Run Right Proof` reuses the verified CORE/Genteel movement proof path.
- [x] Conversation rail can collapse and restore from the emulator toolbar.
- [x] ROM details can collapse into a compact status strip.
- [x] Focused emulator mode keeps status available without showing full cards.
- [x] Narrow viewport check passed without horizontal overflow.
- [x] AI sprites show explicit Disabled, Needs setup, Ready, Running, and
  Failed readiness labels.
- [x] AI sprite readiness shows the selected SDXL checkpoint and Pixel Art LoRA.
- [x] MML music shows Disabled or Ready with a generated-MML prompt path note.
- [x] Enhancement readiness rows include a next action when setup is incomplete.
- [x] Run, Save, Export, and Import feedback appears near the ROM viewport.
- [x] Save feedback shows the latest snapshot path.
- [x] Export feedback shows the latest exported ROM path.
- [x] Import feedback shows the active imported ROM path.
- [x] Ollama local HTTP readiness documented with installed model list status.
- [x] App default Ollama model miss documented with a concrete pull or model
  override path.
- [x] ComfyUI local readiness documented: API not running, checkpoint/LoRA and
  Pixydust present.
- [x] OpenRouter BYOK, Ollama local, and ComfyUI local setup paths are
  documented separately.
- [x] Phase 5 evidence packet assembled for human review.

## Completed Phase 4 Work

- [x] Phase 3 approval received from the human.
- [x] Settings now include default-off toggles for AI sprites and MML music.
- [x] Phase 4 enhancement-toggle evidence recorded in
  `docs/phase4-enhancement-toggles.md`.
- [x] Native ComfyUI endpoint health probing added behind the AI sprites
  toggle.
- [x] Phase 4 ComfyUI endpoint evidence recorded in
  `docs/phase4-comfyui-endpoint.md`.
- [x] Optional `drive16-comfyui` MCP server configured through
  `scripts/comfyui-mcp.sh`.
- [x] Phase 4 ComfyUI MCP wrapper evidence recorded in
  `docs/phase4-comfyui-mcp.md`.
- [x] Tuned Genesis palette ComfyUI workflow committed under
  `assets/enhancements/comfyui/`.
- [x] Phase 4 ComfyUI workflow evidence recorded in
  `docs/phase4-comfyui-workflow.md`.
- [x] Generated-sprite PNG validator added at
  `scripts/validate-generated-sprite.py`.
- [x] Phase 4 generated-sprite validator evidence recorded in
  `docs/phase4-generated-sprite-validator.md`.
- [x] Live ComfyUI sprite runner added at
  `scripts/run-comfyui-sprite-workflow.py`.
- [x] Phase 4 live ComfyUI validation request recorded in
  `docs/phase4-live-comfyui-runner.md`.
- [x] Optional `drive16-mml-music` MCP server configured through
  `mcp-servers/mml-music/server.py`.
- [x] Phase 4 MML music MCP evidence recorded in
  `docs/phase4-mml-music-mcp.md`.
- [x] Original FM preset library added under `assets/enhancements/mml/`.
- [x] Phase 4 MML FM preset evidence recorded in
  `docs/phase4-mml-presets.md`.
- [x] MML reference added to the RAG corpus under
  `corpus/mml/ctrmml-megadrive.md`.
- [x] Phase 4 MML RAG evidence recorded in
  `docs/phase4-mml-rag-corpus.md`.
- [x] App prompt path calls generated-MML music when `MML music` is enabled.
- [x] Phase 4 generated-music prompt evidence and validation request recorded
  in `docs/phase4-generated-music-prompt.md`.
- [x] Generated-MML prompt path requires a live validated ComfyUI PNG before
  using generated sprite assets.
- [x] Phase 4 generated-sprite prompt gate evidence recorded in
  `docs/phase4-generated-sprite-prompt-gate.md`.
- [x] Combined generated-sprite plus generated-MML validation harness added at
  `scripts/validate-phase4-generated-assets-prompt.sh`.
- [x] Phase 4 generated-assets validation evidence recorded in
  `docs/phase4-generated-assets-validation.md`.
- [x] Generated-MML ROM proof passed with Docker, SGDK, Genteel screenshots,
  Right-input sprite movement, and non-silent generated audio.
- [x] Phase 4 ComfyUI readiness check added at
  `scripts/check-phase4-comfyui-readiness.py`.
- [x] Phase 4 ComfyUI readiness evidence recorded in
  `docs/phase4-comfyui-readiness.md`.
- [x] Dry-run ComfyUI prerequisite setup helper added at
  `scripts/setup-phase4-comfyui-prereqs.sh`.
- [x] Phase 4 ComfyUI prerequisite setup evidence recorded in
  `docs/phase4-comfyui-prereq-setup.md`.
- [x] Local Pixydust Quantizer prerequisite installed at the pinned revision
  and recorded in `docs/phase4-comfyui-pixydust-local.md`.
- [x] Local ComfyUI API launch path added, verified, and recorded in
  `docs/phase4-comfyui-api-launch.md`.
- [x] Runtime checkpoint override added for compatible local checkpoint names
  and recorded in `docs/phase4-comfyui-checkpoint-override.md`.
- [x] Generated-assets validation request refreshed to use the checkpoint-aware
  ComfyUI readiness sequence.
- [x] App-side AI-sprite prompt gate refreshed to use the checkpoint-aware
  ComfyUI readiness sequence.
- [x] Settings ComfyUI test now reports API, checkpoint, Pixydust, and workflow
  readiness behind the `AI sprites` toggle.
- [x] Browser-preview ComfyUI failure state renders the readiness-row UI and
  has been checked at desktop and mobile widths.
- [x] Settings ComfyUI test now accepts a checkpoint filename and sends it to
  native readiness before the environment or manifest fallback is used.
- [x] Validator-accepted generated-sprite PNGs now have an SGDK `SPRITE`
  resource harness with ROM build and Genteel screenshot evidence.
- [x] Combined generated-sprite plus generated-MML prompt path fixture proof
  passed without masking the live ComfyUI gate.
- [x] Explicit checkpoint install helper added for user-provided compatible
  checkpoint files or URLs.
- [x] Phase 4 evidence packet assembled at `docs/phase4-evidence.md`.
- [x] Repeatable ComfyUI API smoke verifies API, workflow classes, and
  Pixydust without masking the missing checkpoint.
- [x] Pixel Art Diffusion XL source metadata audited without auto-downloading
  model weights.
- [x] Phase 4 default ComfyUI dependency moved to SDXL Base plus Pixel Art XL
  LoRA with an explicit license-accepting installer.
- [x] Default SDXL Base checkpoint and Pixel Art XL LoRA installed locally
  after human license acceptance.
- [x] Live ComfyUI sprite runner repairs dominant generated backgrounds into
  SGDK palette-index-0 transparency before final validation.
- [x] Live ComfyUI generated sprite validated as a 32x32 SGDK sprite resource.
- [x] Phase 4 live generated-assets proof passed end to end with ComfyUI,
  Docker SGDK, Genteel screenshots, Right-input movement, and non-silent
  generated audio.
- [x] ComfyUI readiness report now includes nearby model-file hints without
  relaxing the real live sprite gate.
- [x] Checkpoint installer supports explicit local-file symlink mode for large
  user-selected model weights.
- [x] Native app ComfyUI readiness rows surface checkpoint hints without
  relaxing the required selected-checkpoint gate.
- [x] Live ComfyUI sprite runner preflights Phase 4 readiness before enqueueing
  the generation workflow.
- [x] One-command live generated-assets proof wrapper added for the final
  checkpoint-to-ROM gate sequence.
- [x] Live generated-assets proof wrapper now launches local ComfyUI if needed
  and stops the process it owns.

## Completed Phase 3 Work

- [x] Phase 3 approval received from the human.
- [x] Phase 2 approval received from the human.
- [x] Tauri 2 shell scaffolded under `app/src-tauri/`.
- [x] React and Vite frontend scaffolded under `app/src/`.
- [x] Two-pane Drive16 shell added with conversation, tool stream, project
  files, blank ROM preview, transport controls, tool health, and local
  interaction state.
- [x] Phase 3 app shell evidence recorded in `docs/phase3-app-shell.md`.
- [x] Native Tauri preflight command added for OpenCode, Docker, SGDK script,
  Genteel, RAG corpus, and CORE asset checks.
- [x] Refreshable health panel wired to native preflight with a browser-preview
  fallback.
- [x] Phase 3 preflight evidence recorded in `docs/phase3-preflight.md`.
- [x] Dedicated blank starter SGDK fixture added at
  `examples/app-starter-blank`.
- [x] Native Tauri `launch_starter_rom` command added to build the starter ROM
  when needed, run it through Genteel, and return a captured PNG data URL.
- [x] Right-pane ROM panel wired to the starter preview result with a
  browser-preview fallback.
- [x] Phase 3 starter ROM evidence recorded in
  `docs/phase3-starter-rom.md`.
- [x] Native starter launch now returns sampled RGB565 framebuffer records
  from the Genteel stream.
- [x] Right pane renders those framebuffer records through a pixelated canvas
  with pause/resume animation state.
- [x] Phase 3 framebuffer evidence recorded in
  `docs/phase3-framebuffer.md`.
- [x] Native OpenCode bridge added for health checks, server launch, session
  creation, and no-reply message posting.
- [x] Left pane wired to OpenCode SSE events and composer message posting with
  a browser-preview fallback.
- [x] Phase 3 OpenCode bridge evidence recorded in
  `docs/phase3-opencode-bridge.md`.
- [x] Model settings drawer added for provider selection, OpenRouter key entry,
  model selection, and connection testing.
- [x] Phase 3 model settings evidence recorded in
  `docs/phase3-model-settings.md`.
- [x] Native project summary and export-ROM commands added for the starter
  project.
- [x] Left file panel and top-bar export action wired to project/export state.
- [x] Phase 3 project export evidence recorded in
  `docs/phase3-project-export.md`.
- [x] App control hardening pass wired visible `Run ROM`, `New Project`,
  focused emulator, export feedback, and tool-health feedback.
- [x] App control hardening evidence recorded in
  `docs/app-control-hardening.md`.
- [x] App navigation hardening added a project menu, project save snapshots,
  compact top actions, agent-local inference placement, and responsive header
  fixes.
- [x] App navigation hardening evidence recorded in
  `docs/app-navigation-hardening.md`.
- [x] Native v1 prompt command added to build and verify the CORE bundled
  sprite/music ROM.
- [x] Chat composer wired so the v1-style request loads the generated CORE ROM
  state into the right pane.
- [x] Phase 3 v1 prompt evidence recorded in
  `docs/phase3-v1-prompt.md`.

## Phase 3 Gate Evidence

Evidence packet: `docs/phase3-evidence.md`.

Core prompt proof: `docs/phase3-v1-prompt.md`.

- [x] App loads with the blank starter ROM state in the right pane.
- [x] Chat request path accepts the v1 prompt.
- [x] Native v1 prompt command builds the CORE bundled sprite/music ROM.
- [x] Genteel captures a neutral frame stream for the generated ROM.
- [x] Genteel captures a Right-input screenshot for the generated ROM.
- [x] Sprite movement validator proves Right-input movement.
- [x] Audio dump is non-silent.
- [x] Browser preview shows the generated CORE ROM state in the right pane.

Phase gate status: evidence assembled. Human sign-off is required before
advancing to Phase 4.

## Completed Phase 2 Gate

Evidence packet: `docs/phase2-evidence.md`.

- [x] OpenCode ran from a plain prompt with the Phase 2 CORE MCP servers.
- [x] RAG was queried before asset wiring and Genesis C edits.
- [x] The agent fixed an initial resource-path build failure and rebuilt.
- [x] The generated SGDK project built to `out/rom.bin`.
- [x] Genteel ran the generated ROM and captured neutral and Right-input
  screenshots.
- [x] Scripted input moved the bundled sprite right.
- [x] The emulator MCP audio dump was non-silent.

## Completed Phase 2 Work

- [x] Phase 1 approval received from the human.
- [x] Core pack added at `assets/core/` with `drive16_player` and
  `drive16_loop`.
- [x] Core pack validator added at `scripts/validate-core-assets.py`.
- [x] RAG project-pattern notes updated with Phase 2 asset symbols and wiring
  guidance.
- [x] Phase 2 reference fixture added at `examples/phase2-core-assets`.
- [x] Fixture validator added at `scripts/validate-phase2-core-assets.sh`.
- [x] Phase 2 asset wiring skill added at
  `agent/skills/phase2-core-assets.md`.
- [x] Agent context validator added at
  `scripts/validate-phase2-agent-context.sh`.
- [x] Phase 2 prompt-driven validation harness added at
  `scripts/validate-phase2-agent-loop.py`.
- [x] Emulator MCP audio capture added so Phase 2 can prove music through CORE
  tools.
- [x] Sprite movement validator added so scripted input evidence is stronger
  than a byte-level screenshot difference.
- [x] Phase 2 agent-loop validation passed with OpenCode, SGDK build MCP,
  Genteel emulator MCP, scripted input, screenshot verification, and non-silent
  audio evidence.

## Completed Phase 1 Gate

Evidence packet: `docs/phase1-evidence.md`.

- [x] OpenCode ran from a plain text prompt with the Phase 1 MCP servers.
- [x] RAG was queried before Genesis C edits.
- [x] The deliberate compile error was repaired by the agent loop.
- [x] The generated SGDK project built to `out/rom.bin`.
- [x] Genteel ran the generated ROM and captured a screenshot.
- [x] Screenshot shows `Drive16 Phase 1` on a blue background.

## Completed Phase 0 Gate

Evidence packet: `docs/phase0-evidence.md`.

- [x] Bootstrap repo skeleton and living project files.
- [x] Add a pinned docker-sgdk build script for SGDK 2.11.
- [x] Add a minimal SGDK hello-world validation project.
- [x] Add original Phase 0 sprite and VGM validation assets.
- [x] Add an SGDK asset ROM fixture wiring the sprite and VGM through `rescomp`.
- [x] Add a pinned known-good open homebrew validator for Genteel accuracy.
- [x] Align the Genteel screenshot validator with the observed upstream CLI.
- [x] Add a pinned Genteel source-build helper.
- [x] Local validation: docker-sgdk builds the hello-world ROM.
- [x] Local validation: Genteel runs the hello-world ROM.
- [x] Local validation: Genteel captures a screenshot of the hello-world ROM.
- [x] Local validation: Genteel captures a headless screenshot from a known-good ROM.
- [x] Local validation: Genteel accuracy is checked with a known-good open homebrew ROM.
- [x] Local validation: Genteel live-framebuffer path streams RGB565 frame records.
- [x] Local validation: docker-sgdk builds the Phase 0 asset ROM.
- [x] Local validation: the Phase 0 asset ROM emits non-silent audio from the bundled VGM loop.
- [x] Local validation: the Phase 0 asset ROM shows a controllable bundled sprite through scripted input.
- [x] Add a complete Phase 0 human validation runbook.
