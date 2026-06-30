# Drive16

Drive16 is an open-source, conversational builder for Sega Genesis / Mega Drive
games. You talk to an agent, it writes SGDK C, builds a ROM, runs it in an
emulator, reads the result, and iterates.

The core v1 target is deliberately narrow: from a conversation, Drive16 writes
and builds a Genesis ROM with SGDK, runs it, self-corrects build or runtime
issues, puts a controllable bundled sprite on screen, and plays a bundled VGM
loop.

## Current status

Core v1 is complete and evidenced. The Phase 3 app flow launches a two-pane
Drive16 shell, starts from a blank ROM preview, accepts the prompt
`make a sprite I can move left and right with music`, builds the bundled
sprite plus music ROM, verifies right-input sprite movement, and verifies
non-silent audio.

Evidence:

- Phase 3 packet: `docs/phase3-evidence.md`
- Core prompt proof: `docs/phase3-v1-prompt.md`
- Current ledger: `PROGRESS.md`
- Iteration journal: `WORKLOG.md`

The active work is Phase 4, which is optional enhancement work beyond core v1.
The Phase 4 proof now passes locally: default-off settings toggles, ComfyUI
readiness checks, the `comfyui-mcp` wrapper, the tuned Genesis sprite workflow,
generated sprite validation, MML music generation, and the combined
generated-assets proof harness are all in place.

Phase 4 is at the human sign-off gate. The live proof generated an AI sprite
with Stability AI SDXL Base plus the `nerijs/pixel-art-xl` LoRA, repaired the
generated background into SGDK-ready palette transparency, built the generated
sprite plus generated-MML ROM, and passed the Genteel movement and audio proof.

## What to do next

To reproduce the one-command live Phase 4 proof after reviewing and accepting
the upstream model licenses:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check

scripts/validate-phase4-live-generated-assets.sh
```

The live proof wrapper launches local ComfyUI if needed, checks readiness, runs
the live sprite workflow, validates the generated PNG, builds the generated
sprite plus generated-MML ROM, runs it in Genteel, verifies movement, and
verifies non-silent audio. If the evidence is accepted, Phase 5 hardening is
next.

## Running the app locally

The browser preview runs from the Tauri app folder:

```sh
pnpm --dir app install
pnpm --dir app dev
```

Then open:

```text
http://127.0.0.1:1420/
```

Useful checks:

```sh
pnpm --dir app build
cargo test --manifest-path app/src-tauri/Cargo.toml
```

The native Tauri app can be run with:

```sh
pnpm --dir app tauri dev
```

## Phase map

- Phase 0: SGDK, Genteel, frame stream, sprite, and VGM spike evidence.
- Phase 1: text-only agent build loop with OpenRouter and CORE MCP servers.
- Phase 2: agent-produced CORE ROM with bundled sprite and bundled music.
- Phase 3: core v1 app flow, complete and approved.
- Phase 4: optional AI sprites and generated MML music, proof passed locally
  and awaiting human sign-off.
- Phase 5: hardening and fully local path, not started.

## Model stance

Drive16 is bring-your-own-key or local-only:

- OpenRouter is the default hosted model path.
- Ollama is the local model path.
- Direct provider keys can be added as configuration.
- Consumer subscription login relay is out of scope.

No Drive16 flow should ask a user to log into a Claude, ChatGPT, or other
consumer subscription account.

## Asset and model hygiene

The repo must not contain commercial ROMs, disassemblies, API keys, model
weights, generated ROM build output, or large local artifacts. ComfyUI model
weights stay outside git and are installed or linked into the local ComfyUI
folder by explicit user action.

## License posture

Drive16 app code is intended to use a permissive license. Copyleft or
non-commercial dependencies must run as separate processes and must not be
linked or vendored into the Tauri binary. MIT is proposed in `DECISIONS.md` as
the app license, pending human confirmation before finalizing a `LICENSE` file.
