# Post-V1 Backlog

These items are intentionally outside Product V1. Do not pull them into the V1
closure unless a later goal explicitly changes scope.

## Audit Review - Phase 8 Selected Slice

The 2026-07-02 review packet in `docs/review/` includes Codex's current issues
report, the Fable 5 investigation prompt, and Fable's returned product audit.

Fable's audit was not accepted as automatic truth, but its major claims were
spot-checked against the repo before Phase 8 work began:

- Freeform chat was gated/no-reply outside the narrow CORE prompt path.
- The interactive Play dev CDN fallback is gated to development builds.
- `bundle.active: false`, `csp: null`, and the missing `LICENSE` file are real
  public-release blockers.

The selected audit-backed implementation slices are now:

- **Phase 8 Slice 1:** OpenRouter-only live freeform replies via the
  existing browser-fetch key path, with truthful failure states and the local
  ROM-proof path untouched.
- **Phase 8 Slice 2:** a compact readiness / first-run hub that consolidates
  proof, Play, provider, enhancement, and release-blocker truth.
- **Still needs human decision later:** confirm the project license, public
  Play policy, and packaging/security posture.

After those slices, the user paused feature expansion for a UI/IA repair track.
That work is recorded in `docs/phase8-ui-optimization-checkpoint.md`,
`docs/ui-repair-control-map.md`, the three `docs/phase8-ui-repair-slice*.md`
files, and `docs/phase8-next-agent-handoff.md`. The next concrete backlog item
is native app click-through for `Import ROM` and `Choose Core` / `Set Up Play`.

## Selected First Slice

Emulator/core distribution is the first Phase 7 area and now has both the
policy implementation in `docs/phase7-interactive-core-distribution.md` and
the user-supplied setup flow in `docs/phase7-user-core-flow.md`:

- Decide whether the Product V1 interactive Genesis core is user-supplied,
  installer-managed, dev-only, or replaced before public release.
- Keep Genteel as Verify/Capture Proof during this slice.
- Update README/app copy so a new downloader knows exactly what is bundled,
  what is downloaded, and what remains their responsibility.

Why this first: it is the highest-leverage post-v1 blocker for someone cloning
the repo and expecting interactive Play to work without guesswork.

Current result: Drive16 treats a selected local compatible core as
`Play ready` / `User core`, treats the existing Nostalgist/RetroArch CDN path
as `Dev preview only` for local development, does not bundle Genesis core
binaries, and keeps installer-managed or replacement runtime decisions open for
public distribution.

## Input And Play

- Full controller remapping editor and per-device mapping.
- Multi-controller support.
- Packaged controller hardware QA.
- Interactive audio proof beyond the current honest `Audio gated` player state.

## Emulator Distribution

- Final release packaging policy for Nostalgist/RetroArch cores.
- Installer-managed Genesis core flow, if the project chooses to go beyond the
  current user-supplied setup path.
- Replacement or deeper integration if Genesis Plus GX licensing is not the
  right release posture.

## Agent And Provider Depth

- Live freeform answers for OpenRouter. Phase 8 Slice 1 uses direct browser
  fetch first, with OpenCode no-reply logging left intact unless a later slice
  changes that bridge.
- Ollama live generation after the OpenRouter reply path is proven, unless a
  later goal explicitly requires both providers at once.
- Broader hosted provider validation beyond OpenRouter.
- Persistent provider profiles and encrypted key storage.

## Product Surface

- Generalized multi-ROM library and metadata browser.
- Marketplace, community sharing, or template browser.
- Richer sprite/music editing surfaces.
- Packaging, signing, notarization, and installer polish.
- Add the project license file after the human confirms the intended license.
- Add explicit import/core size limits before treating local file ingestion as
  robust beyond trusted local testing.

## Enhancements

- Fully automated local ComfyUI lifecycle management.
- Generated asset review and correction UI.
- Advanced MML composition tools.
