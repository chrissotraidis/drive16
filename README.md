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

The active work is Phase 5 hardening and local-path polish. Phase 4 was
approved after the live generated-assets proof passed locally: default-off
settings toggles, ComfyUI readiness checks, the `comfyui-mcp` wrapper, the
tuned Genesis sprite workflow, generated sprite validation, MML music
generation, and the combined generated-assets proof harness are all in place.

Phase 5 has started with provider settings cleanup, conversation truthfulness,
project menu hardening, local ROM import, ROM controls, ROM-first layout, and
enhancement readiness clarity. Agent Settings now switches cleanly between
OpenRouter and Ollama, hides hosted key/model fields when the local provider is
active, and adds a native local Ollama `/api/tags` check. The
conversation pane now labels local proof responses, gates freeform prompts when
the selected provider is not tested, and avoids implying live model replies are
streaming. The project menu now surfaces New, Save, Open, Import, Export, and
Agent Settings with visible action feedback. Import ROM accepts `.bin`, `.gen`,
`.md`, and `.smd`, stores copied ROMs under ignored
`artifacts/phase5/imports`, and makes Run/Export use the active imported ROM.
The ROM viewport now shows a keyboard mapping, focus state, local input
feedback, and a scripted Right-input proof action. The conversation rail and
ROM detail panels can collapse so the emulator can take priority without losing
compact status. Enhancement toggles now show explicit readiness labels instead
of ambiguous On/Off state.

## What to do next

Current Phase 5 next step: improve Run, Save, Export, Import, and tool-health
feedback so every action has local, immediate, visible results and clear next
steps on error.

To reproduce the Phase 4 live generated-assets proof after reviewing and
accepting the upstream model licenses:

```sh
scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check

scripts/validate-phase4-live-generated-assets.sh
```

The live proof wrapper launches local ComfyUI if needed, checks readiness, runs
the live sprite workflow, validates the generated PNG, builds the generated
sprite plus generated-MML ROM, runs it in Genteel, verifies movement, and
verifies non-silent audio.

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
  and approved.
- Phase 5: hardening and fully local path, in progress.

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
