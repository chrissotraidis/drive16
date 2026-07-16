# Drive16 Remediation Plan — goal loop state

Companion to `docs/2026-07-16-comprehensive-audit.md`. This file is the
working state for a goal-based fix loop: work goals **in order**, one goal per
iteration. For each goal: implement → run its acceptance checks → flip its
Status line (`todo` → `done`, or `blocked: <reason>`) → commit with the goal
id in the message. Never mark a goal done without its acceptance checks
passing on this machine.

Ground rules for the loop:

- Branch: `audit/2026-07-16-remediation`. One commit per goal minimum.
- After any `app/src` change, `pnpm --dir app build` (tsc) must pass.
- Keep diffs minimal and in the repo's existing style; no drive-by refactors.
- Local inference only for any agent-run verification
  (`ollama/rafw007/Qwen3.6-35B-A3B-mlx-claude-coder-abliterated:latest`).
- If a goal is blocked, record why in its Status and move to the next goal.

---

## G1 — Replace the 113-tool ComfyUI MCP with a 3-tool Drive16 server

Status: done — 2026-07-16. tools/list: 3 tools / 1,183 schema bytes (was 113 /
118,849). Live `generate_sprite` via the new server: validated 32×32 PNG +
SGDK resource line in 12.8 s (warm ComfyUI). `validate-opencode-config.py`
passes. Fixed overhead: 57,558 → 31,233 input tokens after G1 alone; the
<30k check cleared once G2 landed (20,132 combined).

Why: ~30k tokens of the 57.5k fixed prompt is `comfyui-mcp`'s schema dump
(audit §3). The agent needs generate/status/fetch, nothing else.

Changes:
- New `mcp-servers/comfyui/server.py`, same hand-rolled stdio JSON-RPC shape
  as `mcp-servers/sgdk-build/server.py`, exposing:
  - `generate_sprite(prompt, symbol, timeout_seconds=600)` — wraps
    `scripts/run-comfyui-sprite-workflow.py` (which already does enqueue →
    poll → download → validate → repair) and returns the validated PNG path,
    SGDK resource line, and validation summary.
  - `comfyui_status()` — wraps the readiness probe (API reachable, checkpoint,
    LoRA, quantizer node), returns actionable failure text.
  - `read_sprite_state()` — last generation result, mirroring the other
    servers' `read_*_state` pattern.
- Point `opencode.json` `mcp.drive16-comfyui` at the new server; keep env.
- Leave `scripts/comfyui-mcp.sh` in place (unused) for one release.

Accept:
- [ ] stdio `tools/list` on the new server returns ≤3 tools and <4 KB of schema.
- [ ] `generate_sprite` produces a validated 32×32 PNG with ComfyUI running
      (reuse the running instance on :8188).
- [ ] Trivial `opencode run` ("reply ok", default agent) fixed overhead drops
      from 57,558 to below 30,000 input tokens.
- [ ] `python3 scripts/validate-opencode-config.py` still passes.

## G2 — Stop foreign skill injection into Drive16 agent sessions

Status: done — 2026-07-16. OpenCode 1.14 has no config switch to remove
default skill discovery (`skills.paths` only adds), but a repo-level
`"permission": {"skill": "deny"}` drops the entire skill payload from agent
context. Fixed overhead: 31,233 → **20,132** input tokens (57,558 before
G1+G2; 65% cut). All 23 drive16-* MCP tools confirmed still visible to the
agent via a read-only probe.

Why: 32 unrelated `~/.agents/skills/` entries load into every build session
(~10k tokens, audit §3).

Changes:
- Find the OpenCode 1.14 config switch to disable global skill discovery for
  this project (check `opencode --help`, config schema, docs; candidates:
  `skills` key in opencode.json, permission rules, or an env var). Apply it in
  repo `opencode.json` so it holds for the app-spawned server too.
- If no supported switch exists, document the limitation in the plan and set
  the goal `blocked: <finding>` — do not hack opencode internals.

Accept:
- [ ] Trivial `opencode run` fixed overhead drops again (target: ≤20,000
      combined with G1); OR goal marked blocked with the exact finding.
- [ ] Drive16 agents still see all drive16-* MCP tools (probe via a read-only
      `opencode run` asking to list available drive16 tools).

## G3 — Follow-up prompts must never wipe the active project

Status: done — 2026-07-16. Classification extracted to
`app/src/agent/promptIntent.ts` (pure, unit-tested): follow-up verbs broadened
(add/give/put/…), ambiguous prompts default to preserving a real project,
only explicit phrases ("new game", "start over", "from scratch") or a
different named genre reset, and `drive16-repair` is reserved for
broken-game prompts — feature follow-ups now get the full build agent.
`scripts/verify-prompt-intent.mjs` (14 cases) passes; tsc build passes;
`verify-agent-contract.mjs` updated to assert the new routing and passes.

Why: `shouldPreserveActiveProject` (App.tsx:5876) misses "add/give/put/…" →
`resetActiveProject()` replaces the game (audit §4E).

Changes:
- Broaden `looksLikeFollowUpPrompt` verb set (add, give, put, insert, include,
  attach, extend, expand, speed, slow, double, halve, rename, retheme, polish…).
- Invert the default when a real project exists: in `runAgentPrompt`, if the
  active project's `src/main.c` differs from the blank starter and the prompt
  does not explicitly ask for a new/different game (`new game`, `start over`,
  `from scratch`, or a different genre keyword than the current project),
  treat it as a follow-up.
- Follow-ups that add features (not repairs) should run `drive16-build`, not
  `drive16-repair`; reserve repair for prompts matching fix/repair/broken or
  an immediately preceding failed check.

Accept:
- [ ] New unit test (small node/vitest-free script under `scripts/` in repo
      style, or extracted pure helpers) covering: "add a second ball",
      "add sound", "give the ship a sprite", "make it faster" → preserve;
      "make a tetris game", "new game: snake", "start over" → reset.
- [ ] `pnpm --dir app build` passes.

## G4 — Replace the flat 5-minute kill with an activity-based watchdog

Status: todo

Why: builds are killed at 5 min flat (App.tsx:485) while a healthy local run
takes ~28 min (audit §2–3).

Changes:
- In `startPendingAgentRun`, keep a `lastActivityAt` updated by every agent
  SSE event (tool events, step events). Kill only when now − lastActivityAt
  exceeds `agentIdleLimitMs` (default 5 min), plus a generous absolute ceiling
  (default 45 min, existing message reused).
- Surface "still working, last activity Xs ago" in the build log instead of
  the current premature runaway message.

Accept:
- [ ] `pnpm --dir app build` passes.
- [ ] Code path proves: a run with steady tool events for 20 minutes is not
      killed; a run with zero events for >5 minutes is killed (verify via the
      extracted helper's unit test in repo style, same mechanism as G3 test).

## G5 — Pre-warm Genteel and ctrmml; actionable MCP timeout errors

Status: todo

Why: first `run_rom`/`compile_music` cold-build toolchains inside an MCP call;
the model sees `MCP error -32001: Request timed out` (audit §2).

Changes:
- Add `scripts/prewarm-local-tools.sh` that runs `build-genteel.sh` and
  `build-ctrmml.sh` (both stamp-cached, cheap when warm).
- Call it from `check-live-game-audit-readiness.mjs` (readiness = tools warm)
  and from `scripts/launch-drive16-native.sh`.
- In `mcp-servers/emulator/server.py` and `mcp-servers/mml-music/server.py`,
  detect the cold-build case and return a structured, actionable error
  ("Genteel is still compiling (first run); retry in ~2 minutes or run
  scripts/prewarm-local-tools.sh") instead of letting the client time out.

Accept:
- [ ] `rm -rf artifacts/phase0/genteel-src/target` then readiness check →
      Genteel rebuilt during readiness, and a following `run_rom` succeeds
      without an MCP timeout.
- [ ] `python3 scripts/validate-emulator-mcp.py --rom <starter rom>` passes.

## G6 — Make Ollama a first-class ROM-building provider

Status: todo

Why: hardcoded `agentProviderId = "openrouter"` (App.tsx:1838) despite the
harness, config, and today's passing Pong run proving the local path (audit
§2, §4). This is the gate on "only use local inference".

Changes:
- In `runAgentPrompt`: when `modelProvider === "ollama"` and the model
  connection is ready, use `providerId: "ollama"`, `modelId: ollamaModel`.
  Keep OpenRouter as the default otherwise. Skip the OpenRouter key-sync block
  for ollama runs.
- Keep the existing browser capability probe as the gate for first use
  (`probeAgentToolCapability`) — surface its failure as the setup message
  instead of the "Builds use DeepSeek" copy.
- Update the Settings copy ("Ollama never edits or rebuilds a ROM") and the
  README Model stance section to match reality.

Accept:
- [ ] `pnpm --dir app build` passes.
- [ ] Browser dev test: Settings → Ollama (qwen) → send "make a simple pong
      game" → build-log `agent.started` line names the ollama model, agent
      run proceeds (tool events appear), no OpenRouter key present anywhere.
- [ ] README + SettingsPanel copy updated.

## G7 — Bound Ollama context and document local-inference operation

Status: todo

Why: the model allocates a 262,144-token slot (30 GB KV) and every quality
knob interacts with context length; concurrent local calls evict the cache
(audit §2–3).

Changes:
- Document (README "Local models" subsection + Settings hint): run Ollama
  with `OLLAMA_CONTEXT_LENGTH≈49152` for Drive16, one model instance, don't
  share the model with other local work mid-build.
- Add `num_ctx`/context guidance to `opencode.json` model options if the
  OpenAI-compatible path supports it (verify; if not, document that it must
  be set at the Ollama layer).

Accept:
- [ ] Documentation lands in README; option verified or explicitly documented
      as Ollama-side only.

## G8 — Move ledger bookkeeping out of the model's token budget

Status: todo

Why: exact-phrase PLAYTEST/ASSETS bookkeeping consumes the small output
budget and drives the magic-phrase economy (audit §4B; 5,342 output tokens
total for a whole Pong build).

Changes (first slice, keep bounded):
- New `scripts/generate-project-memory.mjs`: reads a run's
  `opencode-run.jsonl` trace + emulator/audio artifacts and writes/updates the
  mechanical parts of `PLAYTEST.md` (## Evidence rows, gate lines) and
  `ASSETS.md` rows for primitive/seeded roles, leaving prose sections for the
  model.
- Wire it into `run-live-game-audit-prompt.mjs` post-run, and shrink the
  corresponding instruction blocks in the harness prompt + skill file
  (measure the token delta).

Accept:
- [ ] On the existing `pong-local-qwen-1` run artifacts, the generator
      reproduces evidence rows consistent with what the model wrote by hand.
- [ ] Harness prompt + skill instruction size shrinks ≥25% (byte count).
- [ ] `node scripts/verify-project-memory.mjs --project <pong project>` still
      passes.

## G9 — Sprite-engine skeleton + preserved 512px masters (quality floor up)

Status: todo

Why: zero `SPR_*` usage anywhere teaches tile-grid-only graphics; the
512×512 diffusion master is discarded (audit §4D).

Changes (first slice):
- Upgrade `examples/game-skeletons/pong-basic` (or add a sixth skeleton) to
  render the ball as a hardware sprite: `SPRITE` resource in `resources.res`,
  `SPR_init/SPR_addSprite/SPR_setPosition/SPR_update` in the loop.
- In the ComfyUI workflow/runner, save the pre-downscale 512×512 image next
  to the 32×32 output (`*-master.png`) for inspection and future crops.

Accept:
- [ ] Upgraded skeleton builds (`scripts/build-sgdk.sh`) and passes
      `python3 scripts/validate-emulator-mcp.py --rom … --verify-screen`.
- [ ] A `generate_sprite` call leaves both `*-master.png` (512×512) and the
      validated 32×32 on disk.

## G10 — End-to-end re-measurement (close the loop)

Status: todo

Why: prove the P0 batch moved the numbers that define the product experience.

Changes: none — measurement only, after G1–G6 land.

Accept:
- [ ] Fixed overhead (trivial default-agent run): report new number
      (target ≤20k input tokens, from 57,558).
- [ ] Fresh Pong build via harness with local qwen: report wall-clock
      (target ≤15 min, from 27.8) and input-token total (target ≤600k, from
      1.66M).
- [ ] Iteration probe ("paddles twice as tall") via the app-equivalent flow:
      report wall-clock (target ≤5 min, from 9m53s).
- [ ] Record all numbers in a new section appended to the audit doc, and
      update this plan's status lines.

---

## Later (P1/P2 backlog, not in this loop's scope)

Phased build passes with per-phase budgets and temp>0 for creative phases;
batch sprite candidates + tileset/background generation through rescomp;
genre MML template library + dedicated music pass with listen-and-revise;
model routing (design brief vs mechanical passes); self-play playability
scoring; warm-emulator hot iteration; reference calibration. See audit §6.
