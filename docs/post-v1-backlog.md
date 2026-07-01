# Post-V1 Backlog

These items are intentionally outside Product V1. Do not pull them into the V1
closure unless a later goal explicitly changes scope.

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

- Real controller detection, mapping UI, remapping, and persistence.
- Multi-controller support.
- Interactive audio proof beyond the current honest `Audio gated` player state.

## Emulator Distribution

- Final release packaging policy for Nostalgist/RetroArch cores.
- Installer-managed Genesis core flow, if the project chooses to go beyond the
  current user-supplied setup path.
- Replacement or deeper integration if Genesis Plus GX licensing is not the
  right release posture.

## Agent And Provider Depth

- Live freeform answer streaming through OpenCode instead of the current
  truthful no-reply logging path.
- Broader hosted provider validation beyond OpenRouter.
- Persistent provider profiles and encrypted key storage.

## Product Surface

- Generalized multi-ROM library and metadata browser.
- Marketplace, community sharing, or template browser.
- Richer sprite/music editing surfaces.
- Packaging, signing, notarization, and installer polish.

## Enhancements

- Fully automated local ComfyUI lifecycle management.
- Generated asset review and correction UI.
- Advanced MML composition tools.
