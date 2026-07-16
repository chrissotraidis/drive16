<p align="center">
  <img src="docs/assets/drive16-readme-banner.png" alt="Drive16 banner: build Sega Genesis / Mega Drive games by talking" width="100%">
</p>

# Drive16

**Build Sega Genesis / Mega Drive games by talking.**

Drive16 is an open-source desktop app: a conversation on the left, your game
running on the right. You describe what you want in plain language; an agent
writes SGDK C code, can generate sprites and music, compiles the ROM, and
checks the result in an emulator. A bounded repair pass may fix one specific
failure; if it still fails, the app reports the blocker instead of presenting
the ROM as finished.

```text
You:      make a sprite I can move around, with upbeat music
Drive16:  (writes C, composes an FM song, builds, verifies)  →  the game
          appears on the right, playable
```

## Current status (2026-07-10)

The desktop shell and local tool loop are real, but the builder is still in a
reliability/playability hardening phase. A ROM existing is not treated as proof
that the generated game is good or playable.

| Capability | Status |
|---|---|
| Desktop chat → OpenCode agent → active SGDK project | Working, still being hardened |
| First-run workspace | Working: one describe-game action, four proven examples, and an open-project route replace the empty ROM canvas |
| Agent startup | Drive16 always launches its own OpenCode process inside the writable app runtime; if port 4096 belongs to another process, it chooses another local port instead of attaching to it |
| Project lifecycle: New / Save / Open / Import ROM / Export ROM / Verify | Working, with no-ROM/stale-ROM guards plus deterministic screen, input, and audio proof |
| Interactive play: keyboard + gamepad, pause/reset/stop, fullscreen | Working in the browser with the real recovered ROM. The packaged macOS WKWebView starts the core and receives input but currently renders a black canvas; this is a release blocker. |
| Audio in the player | Working with safe default volume: ROM playback starts muted/0% |
| Original music through MML | Tooling works; chat-built games must still prove it was wired and captured |
| AI sprites through ComfyUI | Working locally; when AI sprites are enabled, the desktop app starts ComfyUI automatically and the agent must disclose fallback art if setup is unavailable |
| Asset and sound disclosure | Working: `ASSETS.md` is the enforced role ledger and the project menu previews its rows |
| Playability verification | Working for the primitive/fallback audit: screen, input, restart, audio, genre, freshness, and project-memory evidence are required |
| Live game-quality audit | Functional four-prompt audit complete; its sparse historical frames are now rejected by presentation contract v2 |
| Presentation baseline | Snake, Pong, Tetris, and Asteroids now build with custom tile art, composed panels, stronger palettes, and verified non-silent audio |
| Model bakeoff | Three models × four prompts complete and rescored under presentation v2: all 12 historical outputs need visual repair, so DeepSeek is only the operational default |
| Ollama | Local questions, summaries, and diagnostics only; ROM-changing work is routed through bounded DeepSeek V3.1 calls on OpenRouter |
| Distributable .app/.dmg | The ad-hoc-signed `.app` and `.dmg` pass signature, disk-image, isolated install, writable-runtime, and native Verify checks. Treat them as a test build until packaged interactive Play no longer renders black. |
| LICENSE file | MIT |

Recent history: the app was overhauled on 2026-07-05 — the agent loop was
wired for real (previously only one hardcoded prompt built anything), the UI
was rebuilt into a clean two-pane shell, player audio was added, and the
desktop app now has exactly one chat path: the build agent, with honest
errors. Details: `docs/overhaul-plan.md` (the audit and plan) and
`WORKLOG.md` (what happened, iteration by iteration).

## How it works

Four swappable layers (full detail in `drive16-architecture.md`):

```text
App shell (Tauri 2 + React)          — two-pane UI, player, project actions
  └── Agent spine (OpenCode, local)  — the agent loop, spawned on a local Drive16-owned port
        └── Model                    — OpenRouter for ROM changes; Ollama for local questions/diagnostics
        └── MCP tool servers         — the agent's hands:
              drive16-sgdk-build     — compile C + assets → rom.bin (Docker)
              drive16-emulator       — run ROM, screenshot, input, audio dump
              drive16-rag            — Genesis/SGDK reference retrieval
              drive16-mml-music      — MML → VGM compiler (ctrmml)
              drive16-comfyui        — local Stable Diffusion sprite pipeline
```

The agent's instructions live in `agent/skills/drive16-app-builder.md`
(registered via `opencode.json`). It knows the project layout, the Genesis
hardware rules, both asset-generation recipes, and that it must never claim
success without building.

Two emulators, two jobs: **Genteel** (MIT, patched for frame streaming) does
deterministic headless verification; **Nostalgist/RetroArch** (WASM) powers
interactive play in the app.

## Your game is just a folder

Everything the agent builds lives in one ordinary SGDK project —
`artifacts/phase3/active-project/`:

```text
src/main.c        # game code
res/              # ALL assets as plain files
  resources.res   #   one line per asset (SPRITE / XGM declarations)
  *.png  *.vgm    #   sprites and music, generated or bundled
out/rom.bin       # the built ROM — nothing more than a compile of this folder
```

Generated sprites and songs are staged in scratch space, validated, then
copied into `res/` and registered in `resources.res`. You can open the folder
in any editor, build it by hand (`scripts/build-sgdk.sh <path>`), or export
the ROM to share. `ASSETS.md` records which roles used primitive drawing,
bundled files, ComfyUI PNGs, MML music, or SFX; the project menu previews that
ledger and shows thumbnails for repo-local PNG rows so asset use is visible
without opening markdown. Save/Open snapshots live in
`artifacts/phase3/projects/`.
Full contract: **`docs/project-structure.md`**.

## Quickstart

Requirements (macOS today; the toolchain itself is cross-platform):

- Docker Desktop (runs the SGDK compiler image — no local cross-compiler)
- Node 22+ and pnpm, Rust + Cargo
- [OpenCode CLI](https://opencode.ai) (`opencode` on PATH — the agent spine)
- An OpenRouter API key (BYOK; default `deepseek/deepseek-chat-v3.1`) for ROM-changing work
- Optional Ollama for local questions, summaries, and diagnostics

```sh
pnpm --dir app install

# Browser-first development surface
pnpm --dir app dev            # → http://127.0.0.1:1420/

# The real app (macOS debug bundle, rebuilds then opens)
scripts/launch-drive16-native.sh
```

First run, in the app:

1. Start Docker Desktop.
2. Settings → choose OpenRouter and test your key. Ollama remains available for
   local questions and diagnostics, but it does not change ROMs.
3. Type what you want to build. Watch the right pane.

If something is missing (Docker down, no key), the agent tells you in one
plain sentence, and Settings → Setup shows a live checklist.

## Optional: AI sprite generation (local diffusion)

Sprites are generated by a local ComfyUI with a tuned Genesis workflow
(SDXL + Pixel Art XL LoRA + 16-color quantizer, downscaled to 32x32 and
validated against hardware rules). One-time setup:

```sh
# install the two model files after reviewing their licenses
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check

# start the local ComfyUI API (or use Settings → AI sprites → Launch)
scripts/launch-phase4-comfyui-api.sh
```

Then enable **AI sprites** in Settings and just ask the agent ("give the
player a spaceship sprite"). Generation can also be driven directly:

```sh
python3 scripts/run-comfyui-sprite-workflow.py --prompt "a small green alien spaceship" --symbol my_ship
```

Music generation needs no setup: the ctrmml compiler is fetched and built
automatically on first use, entirely locally.

## Verifying the build (for developers)

```sh
pnpm --dir app build                          # typecheck + bundle
pnpm --dir app check:live-game-audit-readiness # writes primitive/fallback vs generated-sprite audit readiness
pnpm --dir app prepare:live-game-audit        # refreshes readiness, then writes report.json
pnpm --dir app prepare:live-game-audit:prompt # prepares one Snake/Pong/Tetris/Asteroids run packet
pnpm --dir app run:live-game-audit:prompt -- --prompt snake-basic --model openrouter/<model>
pnpm --dir app promote:live-game-audit -- --run snake-basic=<run-id> --run pong-basic=<run-id> --run tetris-basic=<run-id> --run asteroids-basic=<run-id>
pnpm --dir app verify:opencode-audio-trace    # self-test audio trace guard for generated-game audits
pnpm --dir app verify:live-game-audit         # self-test the next live game-quality audit gate
pnpm --dir app verify:live-game-audit:report  # fails until all live prompt runs have evidence files
pnpm --dir app prepare:model-bakeoff          # requires the completed live audit report first
pnpm --dir app verify:model-bakeoff:report    # fails until all model/prompt evidence files exist
pnpm --dir app verify:presentation-baseline  # build/capture/audio-check all four richer genre skeletons
pnpm --dir app release:macos                  # ad-hoc-signed local .app/.dmg + isolated install smoke
pnpm --dir app verify:release:macos           # verify existing release artifacts without rebuilding
cargo test --manifest-path app/src-tauri/Cargo.toml   # native tests
node scripts/verify-phase6-browser-smoke.mjs  # Playwright UI smoke (dev server must run)
scripts/verify-phase6-loop.sh --browser       # full loop harness
```

The deterministic proof path (build → run in Genteel → verify sprite
movement and non-silent audio) is available in-app via the project menu's
**Verify**, or from the CLI with `scripts/validate-phase4-live-generated-assets.sh`.

## Repository map

```text
app/                  Tauri 2 + React desktop app
  src/App.tsx           state owner + routing
  src/components/       TopBar, ChatRail, PlayerPane, SettingsPanel, ProjectMenu
  src/agent/            OpenCode session client, OpenRouter fallback (browser)
  src/player/           Nostalgist adapter, input profiles, core readiness
  src-tauri/src/        Rust: opencode bridge, project/ROM/asset commands,
                        Genteel runner, preflight, ComfyUI/Ollama checks
agent/skills/         the builder agent's instructions
mcp-servers/          sgdk-build, emulator, mml-music (Python, stdio MCP)
corpus/               Genesis/SGDK reference corpus for RAG
assets/core/          bundled sprite + music loop (proven CC-clean pack)
assets/enhancements/  ComfyUI workflow contract, MML FM presets
examples/             app-starter-blank (the project template)
scripts/              build/launch/validation tooling
docs/                 living docs + per-phase evidence archive
patches/              Genteel frame-streaming patch
```

Key documents:

- `docs/overhaul-plan.md` — the 2026-07-05 audit and the five-track plan
- `docs/presentation-quality.md` — the v2 visual baseline and proof metrics
- `docs/project-structure.md` — how a game lives on disk
- `PROGRESS.md` — current ledger; `WORKLOG.md` — iteration journal
- `DECISIONS.md` — recorded decisions (MIT, distribution, emulator choices)
- `drive16-architecture.md` — full architecture reference
- `docs/phase*-*.md` — historical evidence packets from phases 0–8

## Model stance

ROM-changing work runs on the provider you select in Settings: a tested local
Ollama model builds entirely on your machine, or bring your own OpenRouter key
(default `deepseek/deepseek-chat-v3.1`) for hosted builds. Every run verifies
the model can actually drive the build tools before results are trusted. No
Drive16 flow asks you to log into a consumer AI subscription.

## Local reference runs

Drive16 can capture behavioral evidence from a user-supplied or permissively
licensed Genesis ROM without treating it as training data or extracting its
assets. Import the ROM into the repository workspace, then run:

```sh
python3 scripts/capture-reference-run.py path/to/reference.bin \
  --out /tmp/drive16-reference --action-button a
node scripts/verify-reference-run.mjs /tmp/drive16-reference/reference-run.json
```

The report records local title/start, matched action/no-action frames, a
15-second idle run, restart behavior, and an audio signal summary. Human review
is still required for control semantics, pacing, composition, and music taste.

## Asset and license hygiene

No commercial ROMs, no disassemblies, no API keys, no model weights, and no
build artifacts in git. Copyleft components (ComfyUI, ctrmml, BlastEm if
used) run as separate processes and are never linked into the app binary.
Genteel (MIT) is the verification emulator. Drive16's app code is released
under the repository's MIT `LICENSE` (`DECISIONS.md`).

The streamed browser player core is not bundled with Drive16. Genesis Plus GX
has a non-commercial core license, so this test-build path is for free,
non-commercial use and must be revisited before monetization.

The macOS DMG is ad-hoc signed, not Apple notarized. A copy downloaded from the
internet may therefore require **Open Anyway** in macOS Privacy & Security on
first launch. Developer ID signing/notarization can remove that Gatekeeper
friction later without changing the project's no-App-Store distribution plan.

## Roadmap

1. **Packaging** — keep the verified direct-download `.dmg` reproducible;
   Apple notarization is optional future install polish, not an App Store goal.
2. **Multi-project workspaces** — named projects you can switch between,
   beyond the single active workspace + snapshots.
3. **Local-model quality** — extend the passing Qwen proof across the remaining
   audit prompts and keep improving completion discipline.
4. **Packaged Play** — replace or repair the current RetroArch/WebAssembly path
   so the macOS WKWebView renders the same visible frames as the browser.
5. **Release hardening** — continue clean-machine and broader prompt testing.
