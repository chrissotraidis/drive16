# Phase 5 Local Path Validation

This slice completes Phase 5 Unit 9 by validating and documenting the local
Ollama and ComfyUI paths separately from hosted OpenRouter BYOK.

## Goal

Drive16 should be clear about which provider/enhancement path is ready:

- OpenRouter is hosted BYOK.
- Ollama is local model inference.
- ComfyUI is optional local AI sprite generation.

Readiness for one path must not imply readiness for another.

## Local Ollama Evidence

Commands:

```sh
command -v ollama
ollama --version
ollama list
ollama ps
curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags
```

Observed:

- Ollama CLI exists at `/usr/local/bin/ollama`.
- Ollama client version is `0.30.10`.
- `ollama list` reported 15 installed models.
- `ollama ps` reported no running model.
- The HTTP `/api/tags` endpoint became reachable and reported 15 models.
- The app default model `qwen2.5-coder:7b` is not installed.

Current local next action:

```sh
ollama pull qwen2.5-coder:7b
```

Or enter one of the already installed local model names in Agent Settings.

## Local ComfyUI Evidence

Commands:

```sh
curl -fsS --max-time 3 http://127.0.0.1:8188/system_stats
curl -fsS --max-time 3 http://127.0.0.1:8188/object_info
scripts/check-phase4-comfyui-readiness.py
```

Observed:

- `127.0.0.1:8188` is not currently serving ComfyUI.
- The readiness report is written to
  `artifacts/phase4/comfyui-readiness/latest.json`.
- Current report:
  - API: not reachable, connection refused.
  - SDXL base checkpoint: present.
  - Pixel Art XL LoRA: present.
  - Pixydust Quantizer: present.
  - Workflow classes: not inspectable because API is not reachable.

Current local next action:

```sh
scripts/launch-phase4-comfyui-api.sh
```

Then rerun:

```sh
scripts/check-phase4-comfyui-readiness.py
```

For the full generated sprite plus generated-MML proof:

```sh
scripts/validate-phase4-live-generated-assets.sh
```

## Setup Boundaries

OpenRouter hosted BYOK:

- Requires an OpenRouter API key.
- Uses hosted models.
- Does not prove local Ollama or ComfyUI readiness.

Ollama local:

- Requires a local Ollama service at `http://127.0.0.1:11434`.
- Requires the selected model to be installed locally.
- Requires no OpenRouter key.

ComfyUI local:

- Requires local ComfyUI API at `http://127.0.0.1:8188`.
- Requires the selected checkpoint and LoRA under the local ComfyUI data folder.
- Requires Pixydust Quantizer custom node for the current Drive16 workflow.
- Remains behind the AI sprites toggle.

## README Update

`README.md` now includes separate setup sections for:

- OpenRouter hosted BYOK.
- Ollama local.
- ComfyUI local AI sprites.

It also records the current local blockers:

- `qwen2.5-coder:7b` is not installed.
- ComfyUI API is not currently running.
