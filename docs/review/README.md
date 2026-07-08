# Drive16 Review Packet

This folder stores higher-level product and architecture reviews that sit above
the phase evidence docs. Treat these as decision support, not as automatically
approved implementation plans.

Current status note (2026-07-07): this packet is historical Phase 8 review
context. The July 5 overhaul superseded the Phase 8 resume path, and the July 7
reliability pass verified the native two-turn builder loop plus chat MML and
ComfyUI sprite generation. Start current work from `PROGRESS.md`,
`docs/overhaul-plan.md`, and `docs/post-v1-backlog.md`.

## Historical Packet

- `2026-07-02-drive16-current-issues-report.md`: Codex-generated issues report
  prepared from the Fable 5 audit template.
- `2026-07-02-drive16-fable-5-investigation-prompt.md`: standalone prompt used
  to request an independent Fable 5 / Mythos product audit.
- `2026-07-02-fable5-product-audit.md`: Fable 5 product audit returned from
  that prompt.

## Historical Reading

The Fable audit agrees with the existing Product V1 evidence that the local
review scope holds: proof, imported/generated ROM Play foundation, Save/Open,
Export, provider truth, and Phase 7 core/input work are real.

The audit changed the priority conversation. It recommended live freeform
replies through the OpenRouter path, not more Play-core policy work, because
the chat surface was the largest product-promise mismatch not blocked on an
external release decision. That recommendation became Phase 8 Slice 1.

Codex spot-checked the major claims before recording this packet and before
starting Phase 8:

- Freeform chat was gated/no-reply in `app/src/App.tsx` and
  `app/src-tauri/src/opencode.rs` before Phase 8.
- At the time of the review, the dev CDN interactive-core fallback was gated by
  `import.meta.env.DEV`. The July 5 native Play fix later allowed it in the
  local desktop app too; this remains a local/development convenience, not a
  public release policy.
- `app/src-tauri/tauri.conf.json` still has `bundle.active: false` and
  `csp: null`.
- `app/src-tauri/Cargo.toml` declares `license = "MIT"`, while no `LICENSE`
  file exists yet.

Phase 8 Slice 1 implemented OpenRouter-only freeform replies while keeping CORE
ROM proof local and Ollama generation out of scope. Phase 8 Slice 2 added the
compact readiness / first-run hub that the audit recommended as the follow-on
consolidation pass. Both are now historical context for the overhaul.

## Decisions That Still Matter

These still need human review before implementation:

1. Confirm the project license and whether to add an MIT `LICENSE` file.
2. Decide whether public Play v1 uses user-supplied cores, installer-managed
   cores, or a replacement runtime.
3. Decide when packaging/security work should start, including CSP policy for
   user-supplied core JS/WASM.
4. Decide whether Ollama live replies should follow the OpenRouter path or stay
   as a readiness-only local setup path for now.

## Suggested Use

When writing the next loop/prompt, start from the Fable audit but independently
verify any implementation claim against the current code before changing files.
Keep the slice narrow, preserve Genteel Verify/Capture Proof, and do not soften
truthful setup copy unless the underlying capability is implemented.
