# Drive16 Comprehensive Audit — 2026-07-16

Scope: get Drive16 running locally from a fresh checkout, drive the real build
flow end-to-end using **only local inference** (Ollama + Qwen 3.6 35B MoE), and
find the root causes behind the standing complaints:

- Games take forever to render, and are usually bad.
- Iterating on a built game is extremely difficult.
- Music is too simple. Graphics are too simple. Texture/sprite use is bad.

Machine: Apple M3 Max, 128 GB RAM, macOS (Darwin 25.5). All numbers below were
measured on this machine today unless cited from repo docs.

---

## 1. What was run

| Step | Result |
|---|---|
| Prereqs (Node 22, Rust, Docker 29, OpenCode 1.14.33, Ollama 0.32) | All present; repo needs pnpm 10 (global pnpm 8 fails on `pnpm-workspace.yaml`; README says only "pnpm") |
| `pnpm --dir app install` + `pnpm --dir app dev` | UI up at 127.0.0.1:1420 |
| `opencode serve --port 4096` at repo root | Agent spine up; providers connected: ollama, openrouter; Qwen registered |
| Active project reset via `/__drive16_project/reset` | Blank starter seeded (fresh checkout has no `artifacts/`, so readiness fails until this is done — a real first-run trap) |
| `scripts/build-sgdk.sh` on starter | **6.4 s** ROM build (Docker, x86-emulated on arm64) |
| ComfyUI: pinned source + SDXL base + Pixel Art XL LoRA + Pixydust | Installed and launched on 8188 |
| `run-comfyui-sprite-workflow.py` ("a small green alien spaceship") | **1 m 52 s** for one 32×32/16-color sprite; result is a barely-recognizable green blob; the 512×512 diffusion master is discarded |
| Full Pong build via `run-live-game-audit-prompt.mjs --run-agent --model ollama/<qwen>` | **Completed: 27.8 min**, 23 steps, 28 tool calls, 10/11 evidence checks green (details §3) |

Raw Qwen speed on this machine (short context): **77 tok/s generation, ~1,000
tok/s prefill**. Local inference itself is *not* the bottleneck. What the
system does around it is.

---

## 2. How the system actually works today

```text
User prompt (chat)
  → App.tsx keyword classifiers:
      looksLikeBuildPrompt / shouldPreserveActiveProject / clarifying questions
  → NEW GAME:    resetActiveProject() → seed genre skeleton → Docker baseline build
    FOLLOW-UP:   ensureActiveProject()  (keyword regex decides which!)
  → agentPromptWithProject(): ~100 lines of rules wrapped around the user's one line
  → OpenCode run, FRESH SESSION every turn
      agent drive16-build: 20 steps, 8k output tokens, temp 0
      agent drive16-repair: 16 steps, 4k output tokens (used for ALL follow-ups)
  → MCP tools: sgdk-build (Docker), emulator (Genteel), mml-music (ctrmml),
      comfyui (113-tool generic npm wrapper), rag (LanceDB)
  → App-side watchdog kills the run at 5 minutes (App.tsx:485)
  → Post-run gates: screenshot contract v2, project-memory audit, trace audit,
      genre evidence phrases in PLAYTEST.md
```

Ollama today is hard-excluded from ROM work: `App.tsx:1838` pins the build
provider to `"openrouter"`. Yet the harness accepts `ollama/<model>`, the
`opencode.json` already registers four Ollama models, and WORKLOG iter 117
records a fully passing bounded local-Qwen Snake proof. The local path was
proven once and never adopted.

---

## 3. Measured: the Pong build with local Qwen

Run: `artifacts/phase9/live-game-audit/runs/pong-local-qwen-1` (prompt:
"Build a simple working Genesis-style Pong game", seeded skeleton, primitive
mode, no --agent bound → OpenCode default build agent).

Key trace numbers:

| Observation | Value |
|---|---|
| Input tokens on the FIRST model step | **58,745** |
| Fixed overhead (trivial "reply ok", default agent, no work) | **57,558 input tokens** |
| Input tokens by step ~11 | 72,320 and climbing ~1–3k/step |
| Prefill speed at 60k+ context (Ollama log) | 92–186 tok/s (vs ~1,000 short-context) |
| Generation speed at 64k context | **16 tok/s** (vs 77 short-context) |
| Wall-clock per agent step | **~60–160 s** |
| `run_rom` first call | failed: `MCP error -32001: Request timed out` (Genteel cold-built from source behind the call); model burned ~5 min and 3 steps recovering |
| Concurrent local request (my probe) | evicted the KV cache → next step re-prefilled ~72k tokens ≈ 6–9 min stall |
| **Final tally** | **27.8 min wall-clock; 1,660,084 input tokens consumed to produce 5,342 output tokens (311:1)**; final step context 79,666 tokens; run record: all mechanical checks pass (compiled, screen, input, restart, non-silent audio, ledgers, trace); only the by-design "Drive16 owns Playable" gate is left open |

The model's work quality was **good**: honest, thorough PLAYTEST/ASSETS
entries, correct tool sequencing, correct handling of the audit gate. The
capability is not the problem; the harness economics are. At DeepSeek
OpenRouter pricing this same token profile is the recorded ~$0.45/run — and
in-app it would have been killed at 5 minutes with nothing to show.

### The iteration probe

Follow-up ("Make both paddles twice as tall and the ball slightly faster")
run app-style through the real `drive16-repair` agent against the finished
project:

| Observation | Value |
|---|---|
| Wall-clock | **9 m 53 s** (still ~2× the app's 5-minute kill timer) |
| Steps / tools / tokens | 13 steps, 18 tool calls, 821,165 input → 1,916 output tokens |
| Diff quality | Exactly right: `PADDLE_H 4→8`, `BALL_FRAMES 8→6`, rebuilt, input+audio verified |
| Caveat found | The model's visual evidence (and the harness's) captures the **title screen**, whose decorative paddles are hard-coded 4-tall — gameplay frames require a Start press that automated captures don't send. I verified the real change by scripting Start through the emulator MCP. |

So iteration *works* mechanically and the local model edits precisely — but
it costs ten minutes, ~800k tokens, and the misclassification/reset trap and
5-minute timer sit in front of it in the real app.

The arithmetic is damning: a 20-step build at 1–2.5 min/step is 25–50 minutes
— against a 5-minute in-app kill timer. **The desktop app's own timeout
guarantees that any local-model build (and many DeepSeek builds) is killed
mid-flight.** This is the literal mechanism behind "games take forever and
usually come out bad": the timer fires long before art, music, or polish.

### Where the 57.5k fixed tokens come from

| Source | Approx. size |
|---|---|
| `comfyui-mcp` npm package: **113 tools, 118.8 KB of JSON schemas** | ~30k tokens |
| `agent/skills/drive16-app-builder.md` (456 lines) | ~6.5k tokens |
| OpenCode system prompt + built-in tool schemas | ~5–8k tokens |
| 32 unrelated global skills in `~/.agents/skills/` (auto-discovered by OpenCode) | several k tokens |
| Other 4 MCP servers (sgdk 4 tools, emulator 7, mml 2, rag 7) | ~1.5k tokens |
| Harness prompt (`prompt.md`, ~100 lines of rules) | ~1.3k tokens |

The agent needs perhaps **3** of the 113 ComfyUI tools (enqueue, status, get
image). The other 110 — `download_civitai_model`, `scaffold_custom_node`,
`generate_video`, `bisect_*`, `publish_custom_node`… — are pure noise that
(a) multiplies prefill cost on every step of every build, and (b) drowns a
mid-size model in irrelevant choices. The team's own `bakeoff` agent already
denies `drive16-comfyui_*` — evidence this was noticed but never fixed for the
real build agent.

---

## 4. Root causes, mapped to each complaint

### A. "Games take forever to render"

1. **57k-token fixed prompt** × fresh session per turn × 20 steps. Every step
   re-pays prefill; at long context, local prefill collapses to ~100–190 tok/s
   and generation to 16 tok/s. (§3)
2. **Cold tool builds behind first tool calls.** Genteel (git clone + cargo
   release build) and ctrmml (git clone + make) build lazily inside an MCP
   call with a shorter client timeout — the model sees `Request timed out`,
   which is non-actionable, and re-burns steps. Docs show this was fixed for
   the *packaged* app (bundled arm64 verifier, WORKLOG iter 122) but the
   repo/dev flow still cold-builds.
3. **Verification is 3+ emulator processes per cycle** (`run_rom`,
   `verify_screen` re-runs the ROM, `verify_audio` re-runs it again), plus
   readiness scripts before each harness run, plus screenshot/memory/trace
   audits after.
4. **Docker per build, x86-emulated on arm64** (`--platform linux/amd64`,
   `docker run --rm` each call — no warm container, no cache). Small today
   (6.4 s), but it's a per-iteration tax that grows with project size.
5. **Single Ollama slot + zero cache affinity**: any other local model use
   (even the app's own freeform chat) evicts the KV cache and adds minutes.

### B. "Games are usually really bad"

1. **The 5-minute kill timer** (App.tsx:485) plus **one bounded pass (20
   steps, 8k tokens, temp 0) + one repair pass (16 steps, 4k)**. All quality
   knobs are pinned to the cost-control floor (confirmed as deliberate in
   `docs/2026-07-11-pipeline-hardening-handoff.md`: "no open-ended automatic
   retries").
2. **A huge share of the output budget is bookkeeping, not game.** The agent
   must write/update GAME.md, ASSETS.md, PLAYTEST.md with exact section names
   and exact genre evidence phrases, then run `audit_project_memory` and
   repair its findings. In an 8k-token budget, documentation-with-magic-words
   competes directly with gameplay code.
3. **The quality gates only punish; they never help.** Presentation contract
   v2 (≥7 colors, ≤84% dominant, thirds coverage…) rejects weak frames but
   provides no path to a better one. Under a hard step cap, gate failure =
   shipped mediocrity + FAIL note, not another attempt.
4. **The model bakeoff never found a good model — it found the least-bad
   scorekeeper.** All 12 historical outputs (3 models × 4 prompts) fail
   presentation v2; DeepSeek is default for "tool discipline and honesty,"
   explicitly *not* visual quality (rescore script's own words).
5. **Temp 0 for creative work.** Composition, art direction, and tuning all
   sampled greedy.

### C. "Music is too simple"

1. **Three of five skeletons ship the identical 159-byte VGM stub**
   (pong/snake/tetris = same md5 as `assets/core/loop.vgm`). Unless the model
   composes replacement MML in-run, "music" is a blip loop.
2. **Two-attempt MML cap**: two failed `compile_music` calls and music is
   abandoned for the turn. Recorded runs show models burning attempts on
   syntax (`Expected track or tag identifier` ×5, invalid `V0` syntax ×3).
3. **The quality gate is purely structural** (≥5 channels, ≥4 instruments,
   ≥96 note events, ≥16 s loop) — it counts, it doesn't listen. The one human
   taste review on record: "better than the original loop, but still far
   below the desired quality."
4. **No compositional scaffolding**: no genre song templates, no
   verified-good MML example library beyond one corpus doc, no
   iterate-on-audio loop (compose → render → listen/score → revise).

### D. "Graphics are too simple / texture use is bad"

1. **The entire AI art pipeline outputs exactly one 32×32, 16-color sprite
   per ~2-minute call.** No sprite sheets, no animation frames, no
   backgrounds, no tilesets. The workflow hard-codes 512×512 SDXL → nearest
   downscale to 32×32 → 16-color quantize, and throws away the 512×512
   master.
2. **No skeleton uses the Genesis sprite engine at all.** Zero `SPR_*` calls,
   zero `SPRITE` resources across all five skeletons — everything is 8×8
   background-plane tiles. The "copy/adapt this skeleton" instruction
   therefore *teaches* the model tile-grid-only graphics.
3. **There is no generation path for the texture-shaped assets a Genesis game
   actually needs** — tilesets, plane-B parallax backgrounds, HUD panels,
   fonts. `rescomp` supports IMAGE/TILESET resources; Drive16 never generates
   them.
4. Sprite prompt template is frozen ("single 32x32 … full body, centered"),
   so even prompt-level art direction is out of the agent's hands.

### E. "Iterating is extremely difficult"

1. **Follow-up detection is a keyword regex** (`App.tsx:5876`), and it is
   wrong in common cases: "add coins", "add a second ball", "give the ship a
   sprite" match none of the follow-up verbs → classified as NEW game →
   **`resetActiveProject()` replaces the current game with the blank
   starter.** (One `.previous` copy survives, but a second misclassified
   prompt destroys even that, and nothing in the chat tells the user their
   game was benched.) The skill file even lists "add sound" as a canonical
   follow-up; the app regex disagrees.
2. **Every follow-up runs the *repair* agent** (16 steps / 4k tokens — half
   budget) with instructions framing the work as "the single permitted repair
   pass after a specific failed check". Design iteration ("make it feel
   faster") is shoehorned into a bug-fix contract.
3. **Fresh session every turn** re-pays the 57k prefill and rereads project
   state through 3 markdown files; nothing else persists.
4. **Full re-verification every turn** — screen, input, restart, audio, docs,
   memory audit — even for a one-line tweak, inside the same 5-minute window.
5. Historical trap (recorded, partially fixed): the app attaching to a stale
   `opencode serve` on port 4096 working in the wrong directory. I found
   **8 stray `opencode serve` processes** on this machine today; the
   ecosystem invites this failure.

---

## 5. What is genuinely good (keep it)

- **The tool layer design is right**: build / run / screenshot / input /
  audio / music-compile as deterministic MCP tools, with honest gates. This
  is a real moat versus "prompt → hope".
- The **honesty architecture** (never claim Playable without evidence; asset
  ledger disclosure) is a differentiator worth keeping — at lower cost.
- The verified local path exists: **local Qwen completed the build/verify
  loop today** through the repo's own harness.
- Docker'd SGDK, patched Genteel, ctrmml, pinned ComfyUI workflow: correct,
  reproducible choices individually.
- Skeleton seeding delivers an instant baseline ROM — smart. It just needs to
  stop being both the floor *and* the ceiling.

---

## 6. Goal-based roadmap

### P0 — This week: stop the bleeding (mostly config/small diffs)

| Goal | Change |
|---|---|
| Cut fixed prompt ~35k → ~15k tokens | Replace `comfyui-mcp` (113 tools) with a thin 3-tool server shaped like `mcp-servers/*/server.py` (enqueue_sprite / job_status / fetch_image), or filter tools per-agent in `opencode.json` the way `bakeoff` already denies them. Stop OpenCode auto-loading unrelated `~/.agents/skills` for Drive16 sessions (config: dedicated `OPENCODE_CONFIG`/project-scoped skills). |
| Stop killing healthy builds | Raise the 5-min watchdog (App.tsx:485) or make it activity-based (kill on N minutes with no tool event, not N minutes total). Scale timeouts by provider: local models get generous wall-clock. |
| Stop wiping projects on "add X" | Fix `shouldPreserveActiveProject` (include add/give/put/insert/etc.), or better: when a game exists and the prompt is not clearly "new game", default to preserve + ask. Never hard-reset without a snapshot the user can restore in one click. |
| Kill cold-start step burn | Pre-build Genteel + ctrmml at app start / first-run setup (the app already auto-starts ComfyUI; do the same). Make MCP timeouts > tool build time, and return actionable errors ("emulator is compiling, retry in ~2 min") instead of `-32001`. |
| Make Ollama a first-class build provider | Delete the hardcode at App.tsx:1838; gate on the existing tool-capability probe instead of provider identity. The harness, config, and a passing Snake proof already exist. |
| Right-size Ollama | Set `num_ctx` ≈ 32–48k for build sessions (262k allocation wastes VRAM and slows attention); keep one dedicated slot; never share the model between the build agent and freeform chat mid-run. |

### P1 — This month: restructure the loop for quality

1. **Split the one bounded pass into phased passes with separate budgets**:
   implement → verify → *then* dedicated art pass, music pass, polish pass —
   each a short session against the project folder (continuity via files
   already works). Retry budgets per phase, not one global cap. Temperature
   >0 for the art/music/design phases.
2. **Move bookkeeping out of the model.** Generate ASSETS.md/PLAYTEST.md rows
   mechanically from tool traces (the data already exists in the run trace);
   the model writes only what a human must read (GAME.md concept + known
   issues). This returns most of the 8k output budget to game code and kills
   the magic-phrase economy.
3. **Teach sprites for real**: add one skeleton (or upgrade pong-basic) that
   uses `SPR_addSprite` + a `SPRITE` resource + an animated 2-frame sprite,
   so copied baselines exercise the hardware sprite path.
4. **Asset pipeline v2**:
   - Keep the 512×512 master; derive 32×32 (and 16×16, 48×48…) crops from it.
   - Batch mode: N candidates per role in one queue submission; validator
     picks the best (existing scorers can rank); user sees a picker in the UI.
   - Add tileset/background generation (SDXL → tile quantize → `rescomp`
     IMAGE/TILESET), not just single sprites.
5. **Music pipeline v2**: ship 3–5 verified-good genre MML templates as
   corpus + few-shot examples; raise the compile-attempt cap for a dedicated
   music pass; add a "render → analyze audio features → revise once" loop.
   Keep the structural gate, but make passing it *achievable by construction*
   (templates already pass).
6. **Iteration contract**: follow-ups get the full build agent, a
   project-preserving prompt, and verification scoped to what changed (screen
   diff vs full gauntlet) — target: "make the paddles bigger" lands in <2 min.

### P2 — This quarter: world-class

- **Model routing**: big model (or human) for design brief + art direction;
  local models for mechanical passes; the existing bakeoff harness becomes a
  continuous regression suite over the phased pipeline.
- **Self-play scoring**: input-script probes per genre already exist —
  extend to automated playability scoring (did score change? did death
  happen? frame-diff entropy) so quality is measured beyond one screenshot.
- **Hot iteration**: keep a warm emulator with save-states; apply
  code-only rebuilds incrementally (warm Docker container or native
  toolchain) to get sub-30s edit→see loops.
- **Reference calibration**: finish the reference-run harness — capture pace
  /composition profiles from permissively-licensed homebrew and score
  generated games against them.

---

## 7. Fresh-checkout paper cuts (fix in README/setup)

- pnpm 10 required (workspace `allowBuilds` + lockfile v9); README says only "pnpm".
- `artifacts/phase3/active-project` must exist before readiness passes; the
  browser dev flow only creates it after a manual reset call.
- First `run_rom`/`compile_music` trigger multi-minute source builds with no
  user-visible warning (see P0).
- 8 stray `opencode serve` processes accumulated on this machine; the app's
  port-collision logic works but nothing reaps orphans.

---

## 8. Post-remediation results (same day)

The goal loop in `docs/2026-07-16-remediation-plan.md` (G1–G9, branch
`audit/2026-07-16-remediation`) was completed and re-measured with the same
local model and machine:

| Metric | Baseline (this audit) | After G1–G9 | Target | Result |
|---|---|---|---|---|
| Fixed prompt overhead (trivial run) | 57,558 tokens | **18,803 tokens** | ≤20k | **−67%** ✅ |
| Fresh Pong build via harness (local Qwen) | 27.8 min | **12.3 min** (740 s, 27 steps) | ≤15 min | **−56%** ✅ |
| Pong build input tokens | 1,660,084 | **894,710** | ≤600k | −46% ✖ (missed: the richer run — sprite skeleton, memory-audit repair loop — used 27 steps vs 23) |
| Input:output token ratio | 311:1 | **139:1** | — | halved |
| Iteration ("paddles twice as tall", repair agent) | 9 m 53 s | **3 m 06 s** (14 steps, 352k in) | ≤5 min | **−69%** ✅ |
| Run evidence checks | 10/11 | 11/11 mechanical checks green | — | see caveat |

Caveat found by the re-measurement itself: the harness prompt had always
instructed `audit_project_memory` with `expect_gate pass`, contradicting the
builder rule that Drive16 owns `Playability gate: PASS`; the leaner G8 prompt
made the model follow that instruction literally and award itself the gate.
Fixed in the same pass (`expect_gate fail` + explicit ownership line), so
builder runs again cap at Built/FAIL pending independent review. The
underlying evidence in that run was real and trace-backed either way.

Also validated incidentally: an in-app browser build on the Ollama provider
ran end-to-end to a clean finish (32 tool calls), and the G3 classifier now
treats "make a simple pong game" over an existing Pong as an iteration
instead of a project reset.

## 9. P1 quality loop results (2026-07-17)

Branch `quality/2026-07-17-p1` (plan: `docs/2026-07-17-p1-plan.md`). The
benchmark was the user's bar: a Missile Command that looks and sounds like a
real Genesis release, built fully locally.

- **Before (single bounded pass)**: 29.5 min, 741k tokens, and no game —
  sprites and a quality-passing soundtrack were generated but the run died at
  its step cap with zero build_rom calls.
- **After (phased pipeline)**: implement → art → music → polish with
  deterministic gates: **25.2 min, all gates green** — three role-correct
  generated sprites wired and visible in play, a template-derived soundtrack
  wired and verified non-silent, and the full presentation contract passing
  at every visual gate.
- **Iteration**: follow-ups on a working game now route to a bounded iterate
  agent with change-scoped verification — measured **1 m 49 s** in-app for a
  correct two-define change on local qwen.
- Supporting: timeout-proof sprite/background job tools (cold-start safe),
  a verified-good genre MML template library (skeleton stub blips replaced
  with real tracks), and a stack of session-reliability fixes (3,500-token
  step cap, sleep-proofed runs, stale-server documentation).

Carried to P2: gameplay depth beyond the seeded skeletons (self-play
scoring, reference calibration), sprite crops/candidate ranking, and app-UI
integration of the phased runner.
