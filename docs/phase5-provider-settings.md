# Phase 5 Provider Settings

This slice starts Phase 5 hardening by fixing the provider-switching mismatch
captured in `/tmp/drive16-ui-audit/notes.md`.

## Goal

When a user chooses OpenRouter or Ollama, the Agent Settings modal should show
only the active provider's controls. It should not leave OpenRouter model and
key fields visible while Ollama is selected.

## Behavior

- OpenRouter selected:
  - Shows the hosted model selector.
  - Shows the OpenRouter API key field.
  - Footer action reads `Test OpenRouter`.
  - Connection test validates the OpenRouter key endpoint.
- Ollama selected:
  - Hides OpenRouter model and key fields.
  - Shows local Ollama endpoint and model fields.
  - Footer action reads `Test Ollama`.
  - Native Tauri command probes local `/api/tags`.
  - Browser preview reports that the native app checks Ollama locally.
- Conversation inference chip follows the active provider.
- Project menu inference label follows the active provider.

## Native Ollama Check

The Tauri command `check_ollama_endpoint` accepts a local endpoint and model
name. It only allows `http://127.0.0.1` or `http://localhost`, defaults to port
`11434`, calls `/api/tags`, and reports:

- `ready` when the requested model is listed.
- `warning` when Ollama is reachable but the requested model is missing.
- `missing` when the endpoint is invalid or unreachable.

This keeps the fully local provider path separate from OpenRouter BYOK and
does not require or store any API key.

## Evidence

Commands:

```sh
cargo fmt --manifest-path app/src-tauri/Cargo.toml --check
cargo test --manifest-path app/src-tauri/Cargo.toml ollama -- --nocapture
cargo test --manifest-path app/src-tauri/Cargo.toml
pnpm --dir app build
git diff --check
```

Rendered browser proof at `http://127.0.0.1:1420/`:

- App loaded with title `Drive16`.
- Console warnings and errors were empty.
- Opening Agent Settings first showed one OpenRouter panel and zero Ollama
  panels.
- Switching to Ollama showed one Ollama panel and zero OpenRouter panels.
- OpenRouter API key and model fields both had count `0` while Ollama was
  selected.
- Ollama endpoint and model fields both had count `1`.
- Footer action changed to `Test Ollama`.
- Browser-preview test status changed to `Check` with detail
  `Native app checks Ollama locally`.
- Switching back to OpenRouter showed one OpenRouter panel, zero Ollama panels,
  and footer action `Test OpenRouter`.
- Project menu showed `Inference Ollama Qwen2.5 Coder 7b` after choosing
  Ollama.

Screenshots:

- `/tmp/drive16-phase5-unit1/ollama-settings.png`
- `/tmp/drive16-phase5-unit1/project-menu-ollama.png`
