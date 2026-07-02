# Drive16 Product Audit — Fable 5, 2026-07-02

Audit scope: product, architecture, runtime, packaging, and UX, per the standing
audit prompt. No implementation was performed. All commands below were actually
run on this machine on 2026-07-02; anything not run is labeled as such.

## Executive Summary

Drive16's local Product V1 claim holds up under independent re-verification.
Every advertised check passed today on this machine: frontend build, Rust
format/tests (51 passed, 0 failed, 4 heavy proof tests ignored by default),
core-policy checker, and the full Phase 6 verification loop including live
browser smoke against the running preview. The proof/play boundary is clean in
code, not just in docs: Genteel proof capture has zero dependency on the
interactive core, and the dev-CDN Play fallback is hard-gated on
`import.meta.env.DEV`, so a production build genuinely cannot silently use the
unlicensed CDN core.

The three biggest true gaps are, in order of product leverage:

1. **The conversational identity is still inert.** Freeform messages get an
   honest "replies are paused" note or a no-reply OpenCode log. This is the
   largest promise/behavior mismatch, and — unlike Play distribution — it is
   blocked on no external policy decision. The direct-browser-fetch path to
   OpenRouter already exists and works (the key test hits
   `openrouter.ai/api/v1/key` with a Bearer token today).
2. **Public release is blocked by decisions, not code.** Core distribution
   policy, packaging (`bundle.active: false`, `csp: null`), signing, and —
   notably — a **missing LICENSE file** despite `Cargo.toml` declaring MIT and
   the README calling the project open-source.
3. **Evidence and readiness truth is scattered.** ~70 phase docs, with the
   keyboard mapping duplicated verbatim in three, the proof/play boundary
   restated in three, and verification commands repeated in four.

**Recommended next slice: live freeform agent replies via OpenRouter direct
browser fetch** (one provider, truthful failure states, ROM-proof path
untouched), with a small readiness-hub consolidation as the follow-on. Play
onboarding polish ranks below it because its remaining work is mostly a
release-policy decision only you can make, and dev-mode users already have
working Play today.

## Current Product Truth

What the app is, as of commit `b844895` on `main` (clean tree except untracked
`docs/review/`):

- A Tauri 2 + React shell with a ROM-first layout: project actions,
  conversation rail, provider settings, ROM viewport, proof status, tool
  readiness.
- A deterministic proof path (Genteel) that builds and verifies the CORE
  sprite+music ROM, including right-input movement and non-silent audio.
- An interactive Play path (Nostalgist 0.21.1 / RetroArch) behind an adapter
  boundary, with three honest states: `Play ready`/`User core`,
  `Dev preview only`/`Dev CDN` (dev builds only), `Play setup needed`.
- A user-supplied core flow (`.zip` or `.js + .wasm`, fflate extraction,
  normalized into ignored `artifacts/phase7/interactive-core/`).
- Keyboard input plus basic Gamepad API detection through a shared,
  localStorage-persisted input profile (`drive16.inputProfile.v1`), display +
  Reset only, no remap editor.
- A conversation surface where only the keyword-matched CORE prompt
  (`isV1Prompt`: "sprite" + "music" + move/left/right,
  [App.tsx:3352](../../app/src/App.tsx)) does real work; everything else is
  gated or logged to OpenCode with `noReply: true`
  ([opencode.rs:106](../../app/src-tauri/src/opencode.rs)).
- Readiness probes only (no generation calls) for Ollama and ComfyUI; the
  OpenRouter "test" is a real authenticated browser fetch of the key endpoint.

## What Is Working — With Evidence (run today, 2026-07-02)

| Check | Result | Evidence |
|---|---|---|
| `pnpm --dir app build` | pass (tsc + vite, 903ms) | background task log |
| `cargo fmt -- --check` | pass | background task log |
| `cargo test` | 51 passed, 0 failed, 4 ignored | background task log |
| `scripts/check-interactive-play-core.mjs` | exit 0, "Dev preview only" | ran in session; correctly reports no user core installed on this machine |
| `scripts/verify-phase6-loop.sh --browser` | full pass incl. live browser smoke | `artifacts/phase6/verify-loop/20260702-123710/` |
| Tracked-artifact + secret hygiene | pass (no core binaries, no `sk-or-v1-` keys tracked) | same loop run |
| Doc→code cross-check | readiness states, storage key, default bindings, action IDs all match code exactly | subagent cross-check of phase 6/7 docs vs `coreReadiness.ts`, `input.ts` |
| Phase 7 smoke evidence packets | present and consistent | `artifacts/phase7/browser-smoke-{user-core,missing-core,input-profile-*}/browser-smoke.json` |

Additional verified strengths:

- **Path safety in `project.rs` is genuinely good**: rejects absolute paths,
  canonicalizes and enforces repo-prefix on every user-supplied path; upload
  filenames are whitelist-sanitized; ROM/core extensions whitelist-validated.
  Backed by tests (`export_rom_path_rejects_paths_outside_repo`, etc.).
- **Key ephemerality is real**: the OpenRouter key lives only in React state
  ([App.tsx:657](../../app/src/App.tsx)); nothing writes it to localStorage or
  disk, and the secret-hygiene check enforces the repo side.
- **The gamepad poll loop is correctly built**: rAF-based, down/up transition
  deltas via a ref, full cleanup including key-release on unmount.
- **No TODO/FIXME markers anywhere in `app/src` or `app/src-tauri/src`**, and
  commit history is clean and phase-scoped.

## What Is Not Working / Not Finished — With Evidence

- **No live model replies.** `submitMessage` ([App.tsx:1001](../../app/src/App.tsx))
  routes freeform text to either a gate message ("Freeform model replies are
  paused. ROM-changing prompts still work.") or an OpenCode post with
  `noReply: true`. `ollama.rs` contains no generate call — only a `/api/tags`
  probe. This is honest, but the product's central promise.
- **No LICENSE file.** `ls LICENSE*` finds nothing; `Cargo.toml` says
  `license = "MIT"`; DECISIONS.md says MIT is "proposed... pending human
  confirmation." The README calls Drive16 open-source. This is a contradiction
  today and a hard public-v1 blocker.
- **Packaging is switched off**: `tauri.conf.json` has `bundle.active: false`
  and `csp: null`. A debug `Drive16.app` exists under
  `app/src-tauri/target/debug/bundle/macos/`, but there is no signing,
  notarization, or release CSP story. `csp: null` deserves attention
  specifically because the app executes user-supplied core JS/WASM.
- **No import size limits.** `import_rom_bytes` and
  `import_interactive_core_files` decode base64 fully into memory with no size
  cap (project.rs). A huge file selection stalls or OOMs the app.
- **Interactive audio remains fully gated** — `docs/phase6-audio.md` is
  entirely a deferral; nothing audio-related is proven for the human Play
  surface (the non-silent proof is Genteel-only). The docs are truthful here.
- **Controls are display-only.** `InputControlsPanel`
  ([App.tsx:3501](../../app/src/App.tsx)) shows bindings and offers Reset;
  there is no editor. (Notably, the pipeline resolves actions from the profile
  on every input, so an editor needs only UI, no core changes.)
- **Smoke coverage has two blind spots**: the agent/conversation surface and
  the entire settings panel (provider selection, Ollama, ComfyUI, enhancement
  toggles) are untested; there are no negative tests (bad ROM, corrupt zip),
  and `needs-user-action`/`unsupported` core states are only implicitly
  covered.
- **Two minor state-lifecycle glitches** (found by code read, not reproduced
  live — treat as plausible, not confirmed):
  - `v1PromptResult` persists across project switches, so "Right input
    verified" can display against a ROM it wasn't proven on.
  - `loadedInteractiveCore` (in-memory bytes) is cleared on status change but
    not on every re-selection path, so stale core bytes are conceivable in an
    unusual re-import sequence.

## Evidence Versus Interpretation

Confirmed by running or reading directly this session:

- All verification results in the table above.
- The dev-CDN gate (`allowDevCoreCdnFallback` = `import.meta.env.DEV`,
  [App.tsx:3344](../../app/src/App.tsx)).
- The no-reply OpenCode contract (`noReply: true` in
  [opencode.rs:106](../../app/src-tauri/src/opencode.rs)).
- Absence of LICENSE, `bundle.active: false`, `csp: null`, no user core on
  this machine, preview server running at `127.0.0.1:1420`.
- The Rust backend has **no TLS-capable HTTP client** — `ollama.rs` and
  `opencode.rs` hand-roll HTTP/1.1 over `TcpStream`, and `Cargo.toml` has no
  reqwest/hyper. Consequence: a *native* OpenRouter call would require a new
  dependency; a *browser* fetch requires nothing new.

Interpretation (reasoned, not proven):

- The state-lifecycle glitches above.
- "OpenRouter direct browser fetch will work for chat completions" — inferred
  from the working key-test fetch and OpenRouter's browser-CORS design; the
  chat endpoint itself was not called in this audit.
- Fresh-clone friction claims — no clean-machine test was performed.
- Real controller hardware behavior — never tested outside the Gamepad API
  smoke mocks; the docs say so themselves.

## Highest-Severity Issues (ranked)

1. **Conversational promise vs. inert agent surface.** The app is named and
   framed as a conversational builder; only one keyword-matched prompt does
   anything. Biggest fresh-user disappointment and the biggest gap that is
   *not* blocked on an external decision.
2. **Missing LICENSE / open-source contradiction.** Cheap to fix, but until
   fixed, every "open-source" claim and the `Cargo.toml` license declaration
   are ahead of reality. Requires a human decision (confirm MIT).
3. **Release path unresolved as a bundle of decisions** (core policy ×
   packaging × signing × CSP). Not a code bug; should be treated as one
   product decision packet, not four accidental discoveries.
4. **First-run comprehension.** README omits prerequisites (Node/pnpm, Rust,
   Docker/SGDK path), never says where a compatible core comes from, and the
   many true readiness states live in a dozen docs rather than one surface.
5. **`App.tsx` density** (5,337 lines, ~52 `useState` + 9 refs). Not an
   emergency; becomes one the moment chat streaming or a remap editor is added
   without extracting the conversation panel and provider settings first.
6. **Unbounded import sizes** (ROM and core) — robustness, local-only impact.
7. **Smoke blind spots** (agent surface, settings, negative paths) — matters
   most the moment slice B lands, since that's exactly the untested surface.

## Root Causes, Not Just Symptoms

- Freeform chat is inert because the project (correctly) refused to fake it,
  and the transport decision — OpenCode bridge vs. direct fetch vs. native
  command — was deferred. The blocker is a decision, not architecture: gating
  is already centralized in `submitMessage`/`freeformGateMessage`, and a
  working authenticated OpenRouter fetch already ships.
- Play setup confusion is a *licensing* constraint surfacing as UX: Genesis
  Plus GX is non-commercial, so the app can't bundle or auto-download, so the
  user must supply a core the README can't link to.
- Evidence scatter is the natural residue of the phase-by-phase working style
  (which produced the quality); it now needs one consolidation pass, not a
  process change.
- `App.tsx` density is the standard accretion pattern; the player module
  extraction proves the codebase already knows the remedy.

## Highest-Leverage Next Implementation Slice — Recommended

**Slice B: Live freeform agent replies — OpenRouter only, direct browser
fetch, truthful failure states.**

Smallest useful scope:

1. When provider = OpenRouter, key tested, and the message is not a CORE
   prompt: send the conversation (system prompt + recent messages) to
   `POST https://openrouter.ai/api/v1/chat/completions` from the browser,
   exactly as the key test already does. Non-streaming first; streaming is a
   follow-up, not a requirement.
2. Render the reply as an agent message with a distinct source tag (e.g.
   `openrouter`) so "Local proof" messages remain visually and semantically
   separate. `isV1Prompt` routing stays exactly as is.
3. Keep the OpenCode `noReply` log as the event trail (unchanged), or log the
   reply event alongside — no OpenCode behavior change required.
4. Failure states, each with distinct copy: no key, key rejected, network
   failure, model error, and (unchanged) Ollama-selected → still paused, with
   copy saying local live replies are a later slice.
5. Smoke coverage: one path asserting the paused gate still appears without a
   key, one path with a mocked/route-intercepted completions response
   asserting a reply renders. This also closes the "agent surface untested"
   blind spot.
6. Precondition refactor (small, targeted): extract the conversation panel
   and provider settings from `App.tsx` before wiring the reply, since both
   are touched anyway. Do not refactor anything else.

Why this ranks first: it is the only top-tier gap with no unresolved external
decision, it attacks the product-identity mismatch directly, the transport is
already proven in miniature, and it stays within the BYOK/no-fake-replies
principles. It also makes every later slice (readiness hub, packaging) more
meaningful, because the product loop it advertises will actually exist.

## Alternative Next Slices — And Why They Rank Lower

- **A. Release-clean Play onboarding.** High value eventually, but its
  remaining substance is the release policy decision (user-supplied vs
  installer-managed vs replacement runtime) that only you can make. Dev-mode
  users already have working Play via the DEV-gated CDN fallback; production
  builds don't ship yet (`bundle.active: false`), so polishing production Play
  setup now optimizes a surface nobody can reach. Do the copy/guided-flow
  polish after the policy call.
- **D. Product readiness hub.** Cheap, real value, and the right *second*
  slice — but it consolidates truth rather than changing what the product can
  do. Bundle a README prerequisites/first-run fix into it. It gets better if
  done after B, when "Agent: live (OpenRouter)" is a state it can report.
- **C. Controller remap editor.** Architecturally ready (profile schema,
  persistence, per-input lookup all in place — UI-only work) but the lowest
  product leverage of the four: it deepens an already-working input surface
  rather than closing a promise gap.
- **Packaging/signing.** Blocked behind the license file, the core policy
  decision, and a CSP decision; premature until those land.

## Specific Files to Modify for the Recommended Slice

- `app/src/App.tsx` — extract `ConversationPanel` and `ProviderSettings`
  (state + JSX currently around lines 590–680, 1001–1116, 1687–1808,
  2740–2870, 3260–3300, 4463+); then wire the reply call into the extracted
  conversation submit path.
- `app/src/agent/openrouter.ts` (new) — completions call, request/response
  types, error mapping. Keep it transport-only; no state.
- `app/src/agent/` (new home) — move `isV1Prompt`, gate-message logic, and
  message-source types so proof-vs-chat routing lives in one testable module.
- `scripts/verify-phase6-browser-smoke.mjs` — add the two agent-surface
  assertions (gate without key; mocked reply renders).
- `README.md` — one honest paragraph updating "freeform replies are paused" to
  "OpenRouter live replies; Ollama replies still paused," plus the stale
  next-step line at ~line 89, plus a prerequisites list (fold into slice D if
  preferred).
- `docs/` — one new short slice doc in the existing phase-doc style;
  `DECISIONS.md` entry for "freeform replies go direct-to-OpenRouter from the
  browser."

Explicitly not touched: `opencode.rs`, `ollama.rs`, `v1_prompt.rs`, the player
module, `coreReadiness.ts`, `project.rs`.

## Verification Plan

1. `pnpm --dir app build` — type-checks the extraction.
2. `cargo fmt -- --check && cargo test` — proves no native surface changed.
3. `scripts/verify-phase6-loop.sh --browser` — existing loop must stay green
   (regression proof for the extraction).
4. New smoke: no-key gate assertion + intercepted-completions reply assertion.
5. Manual, once, with a real key: one freeform prompt → one real reply; one
   CORE prompt → verify it still routes to the local proof path and never
   touches OpenRouter.
6. Hygiene: confirm the key still never appears in localStorage or any
   artifact log (existing secret scan plus a manual localStorage check).

## Risks and Rollback Notes

- **Risk: proof/chat routing regression.** Mitigated by leaving `isV1Prompt`
  untouched and asserting the CORE path in smoke. This is the one invariant
  that must not move.
- **Risk: the extraction refactor destabilizes unrelated UI.** Mitigated by
  extracting only the two components the slice touches and leaning on the
  existing browser smoke, which already exercises most of the shell.
- **Risk: key exposure surface grows.** The key already travels in a browser
  fetch today (key test); the completions call adds message content, not new
  key handling. Keep the in-memory-only rule; do not add persistence in this
  slice.
- **Risk: OpenRouter CORS/limits surprises on the completions endpoint.**
  Detected immediately by the manual step; fallback is routing the same
  request through a thin Tauri command — but that requires adding a TLS HTTP
  client (e.g. reqwest) to a currently dependency-lean `Cargo.toml`, which is
  why browser-fetch-first is the right order.
- **Rollback:** the slice is additive; reverting the reply call restores the
  current gate message. The extraction commits should be separate from the
  feature commit so either can be reverted independently.

## Questions That Genuinely Require User Input

1. **License:** confirm MIT and add the LICENSE file? (Currently declared in
   `Cargo.toml` but absent; contradicts the open-source claim.)
2. **Freeform transport:** approve direct browser fetch to OpenRouter for
   replies (recommended), vs. OpenCode-mediated, vs. native Tauri command
   (requires new Rust HTTP/TLS dependency)?
3. **Public Play policy:** is user-supplied core acceptable for public v1, or
   do you want an installer-managed/license-gated download, or a replacement
   runtime? (Blocks slice A and packaging, not slice B.)
4. **Ollama live replies:** explicitly out of scope for the first live-reply
   slice, or must both providers land together?
5. **Release CSP:** when packaging starts, `csp: null` needs a deliberate
   policy given user-supplied core JS/WASM execution — decide then, flagged
   now.

## What Not to Change

- The Genteel proof path and its independence from the interactive core — the
  deterministic backbone; `verifyDetail` messaging on every readiness state is
  doing real work.
- The `import.meta.env.DEV` gate on the dev-CDN fallback — this is the
  mechanism that keeps production builds honest. Do not widen it.
- The no-bundled-cores policy and the tracked-binary/secret hygiene checks.
- OpenRouter key ephemerality (memory-only) and the local-only endpoint
  validation for Ollama/ComfyUI.
- The honest no-reply/gate copy — replace it only by making it true, never by
  softening it.
- The input profile schema, storage key, and per-input profile lookup — they
  are exactly the foundation a future remap editor needs.
- Play/core/controller setup placement near the ROM player (not Agent
  Settings).
- `project.rs` path-safety code.
- Do not broadly refactor `App.tsx`; extract only what slice B touches.

## Appendix: Not Run / Not Verified This Session

- The ignored heavy proof tests (`--with-v1-proof`, starter-ROM Genteel run) —
  the loop was run without them; their 2026-07-01 evidence packets exist.
- Fresh-clone setup on a clean machine.
- Real controller hardware.
- The OpenRouter chat-completions endpoint itself.
- Native `Drive16.app` behavior (bundle exists at
  `app/src-tauri/target/debug/bundle/macos/Drive16.app`; not launched).
- ComfyUI / MML / Ollama live functionality (probes only; no services running
  were required for this audit).
