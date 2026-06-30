# Phase 5 Evidence Packet

Phase 5 hardens Drive16 from a proof shell into a more usable local workbench.
This packet summarizes what was built, how it was verified, and what remains
truthfully outside the current claim.

## Scope

Phase 5 covered:

- Provider settings cleanup for OpenRouter hosted BYOK and Ollama local.
- Honest conversation and inference state.
- Project menu actions for New, Save, Open, Import, Export, and Agent Settings.
- Local Genesis ROM import into ignored storage.
- ROM controls, viewport focus, and visible keyboard mapping.
- ROM-first layout controls for collapsing conversation and status panels.
- AI sprites and MML music readiness clarity.
- Immediate Run, Save, Export, Import, and tool-health feedback.
- Local setup validation for Ollama and ComfyUI.

## Evidence Index

| Unit | Evidence | Commit |
| --- | --- | --- |
| Provider settings cleanup | `docs/phase5-provider-settings.md` | `f82b31b` |
| Agent truthfulness | `docs/phase5-agent-truthfulness.md` | `5039174` |
| Project menu actions | `docs/phase5-project-menu-actions.md` | `2fd92d1` |
| Import ROM flow | `docs/phase5-rom-import-flow.md` | `1d47a25` |
| ROM controls and input mapping | `docs/phase5-rom-controls.md` | `2e8e927` |
| ROM-first layout | `docs/phase5-rom-first-layout.md` | `b3d5377` |
| Enhancement readiness | `docs/phase5-enhancement-readiness.md` | `314be1a` |
| Action feedback | `docs/phase5-action-feedback.md` | `f3ac1c0` |
| Local path validation | `docs/phase5-local-path-validation.md` | `258653e` |

## Current Behavior

Provider settings:

- OpenRouter and Ollama render as distinct provider surfaces.
- Ollama hides OpenRouter model and key fields.
- OpenRouter keeps hosted model and key controls.
- The active provider updates inference labels in conversation and project menu.
- Ollama readiness probes the local `/api/tags` endpoint.

Conversation state:

- The app distinguishes local proof responses from live model replies.
- Freeform prompts are gated when the selected provider has not been tested.
- ROM-changing proof prompts remain usable and are labeled as local proof work.

Project and ROM actions:

- The project menu exposes New, Save, Open, Import, Export, and Agent Settings.
- Save creates a local project snapshot and shows the path in the UI.
- Open gives visible project action feedback.
- Import accepts `.bin`, `.gen`, `.md`, and `.smd` ROM files.
- Imported ROMs are copied under ignored `artifacts/phase5/imports`.
- Run and Export use the active imported ROM when one exists.

ROM interaction:

- The viewport is focusable and reports whether input is focused.
- The controls strip shows Arrows, Z, X, C, and Enter mappings.
- Local key capture updates the last input state and event feed.
- The `Run Right Proof` action reuses the verified CORE/Genteel movement proof.

Layout:

- The conversation rail can collapse and restore.
- ROM details can collapse into a compact status strip.
- Focused ROM mode gives the emulator more room while preserving compact status.
- A narrow viewport check passed without horizontal overflow.

Enhancements:

- AI sprites show Disabled, Needs setup, Ready, Running, or Failed.
- MML music shows Disabled or Ready.
- The AI sprite readiness row shows the selected SDXL checkpoint and Pixel Art
  LoRA.
- Setup failures include a clear next action.

Action feedback:

- Run, Save, Export, and Import show immediate feedback near the ROM viewport.
- Recent save, export, and import paths are surfaced as chips.
- Tool-health feedback can report attention states instead of appearing dead.

## Local Validation

Ollama:

- CLI found at `/usr/local/bin/ollama`.
- Client version reported as `0.30.10`.
- `ollama list` reported 15 installed models.
- `http://127.0.0.1:11434/api/tags` became reachable and reported 15 models.
- `ollama ps` reported no running model.
- The app default `qwen2.5-coder:7b` is not installed.

Current Ollama next action:

```sh
ollama pull qwen2.5-coder:7b
```

Or enter an already installed local model in Agent Settings.

ComfyUI:

- `http://127.0.0.1:8188/system_stats` was not reachable.
- `http://127.0.0.1:8188/object_info` was not reachable.
- `scripts/check-phase4-comfyui-readiness.py` wrote
  `artifacts/phase4/comfyui-readiness/latest.json`.
- The readiness script reported the API was not reachable.
- SDXL base checkpoint is present.
- Pixel Art XL LoRA is present.
- Pixydust Quantizer is present.
- Workflow classes cannot be inspected until the API is running.

Current ComfyUI next action:

```sh
scripts/launch-phase4-comfyui-api.sh
scripts/check-phase4-comfyui-readiness.py
```

## Verification Commands

The Phase 5 units were verified with combinations of browser click-throughs,
native Genteel proofs, and local build/test checks. The recurring local checks
were:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml
pnpm --dir app build
git diff --check
```

Specific interaction checks included:

- Switching OpenRouter to Ollama and back in Agent Settings.
- Sending ROM-changing and non-ROM prompts.
- Clicking New, Save, Open, Import, Export, and Agent Settings.
- Importing a repo-generated SGDK test ROM.
- Running that imported ROM through Genteel and producing a PNG plus RGB565
  stream under ignored artifacts.
- Focusing the ROM viewport and pressing ArrowRight and Z.
- Running the verified right-input proof.
- Collapsing and restoring conversation and ROM detail panels.
- Checking the narrow responsive layout.
- Toggling AI sprites and MML music readiness states.
- Clicking Run, Save, Export, and Import while watching near-ROM feedback.

## Git And Artifact Hygiene

- No API keys were committed.
- No commercial ROMs were committed.
- No imported ROM files were committed.
- Local import and verification outputs remain under ignored `artifacts/`.
- Model weights remain outside git under the local ComfyUI data folder.

## Exit Criteria Status

- App launches locally: met.
- Provider switching is clean and truthful: met.
- A local test Genesis ROM can be imported, run, and shown in the viewport:
  met with a repo-generated test ROM.
- Save/Open project state is reachable through the project menu: partially met.
  Save writes a local snapshot and Open is surfaced with feedback; richer
  persisted project browsing remains a follow-up.
- ROM controls and input mapping are visible and partially verified: met.
- The ROM viewport can be focused without permanent tool-panel crowding: met.
- Enhancements show disabled, ready, failed, or needs-setup state: met.
- OpenRouter BYOK and Ollama local paths are documented separately: met.
- Secrets, commercial ROMs, model weights, and imported ROMs are kept out of
  git: met.

## Review Notes

Phase 5 is ready for human review with two honest caveats:

- Live freeform model replies are still gated behind provider readiness and are
  not claimed as a fully validated chat loop.
- Full manual controller input into Genteel is not claimed yet; the current
  verified input path is local key capture plus the scripted right-input proof.

Recommended next review flow:

1. Launch the app.
2. Open Agent Settings and switch between OpenRouter and Ollama.
3. Open the project menu and click New, Save, Open, Import, and Export.
4. Import the repo-generated test ROM or another non-commercial local test ROM.
5. Click the ROM viewport and test visible keyboard feedback.
6. Collapse the conversation pane and ROM details.
7. Toggle AI sprites and MML music readiness rows.
8. Decide whether Phase 5 is accepted or whether a Phase 5 patch pass is needed
   before moving to the next phase.
