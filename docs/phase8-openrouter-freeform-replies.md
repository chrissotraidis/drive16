# Phase 8 OpenRouter Freeform Replies

Status: implemented for Phase 8 Slice 1.

## Goal

Close the largest remaining product-promise gap from the 2026-07-02 review
packet: Drive16 presents a conversational builder, but freeform messages were
previously gated/no-reply unless they matched the narrow CORE sprite/music
prompt.

## What Changed

- Added a small OpenRouter chat-completions client in
  `app/src/agent/openrouter.ts`.
- Set `deepseek/deepseek-chat-v3.1` as the default cheap tested OpenRouter
  model for the first live-reply slice.
- OpenRouter API keys now use dedicated local app storage so refreshes do not
  drop the key. A successful Test OpenRouter stores a local accepted-key marker
  for that saved key so the Settings status can reopen as connected after
  refresh; editing or clearing the key clears that accepted state. The key is
  still never written to project files, docs, logs, screenshots, or artifacts,
  and testing syncs it into OpenCode auth for the local build agent.
- Updated the freeform submit path:
  - CORE sprite/music prompts still route to the local proof path.
  - OpenRouter-tested freeform prompts now produce real non-streaming model
    replies.
  - OpenCode no-reply logging remains best-effort and does not block live
    replies.
  - Ollama live replies remain out of scope and keep truthful paused copy.
- Updated the conversation mode label to show `OpenRouter live` when the
  OpenRouter key is tested.
- Extended the browser smoke to prove:
  - no-key freeform prompts still gate truthfully;
  - the API key, chosen model, and accepted connection state survive refresh;
  - a mocked OpenRouter reply renders as an agent reply;
  - the CORE sprite/music prompt does not call OpenRouter.

## Runtime Truth

- `OpenRouter live`: freeform prompts use OpenRouter chat completions and local
  ROM-changing prompts still use Drive16's proof path.
- `ROM proof only`: provider is not tested, Ollama is selected, or a model
  request fails.
- `Local proof`: Drive16 changed or verified ROM state locally.
- `OpenRouter`: a hosted model reply, not a ROM build/proof claim.

## Verification

Implemented checks:

```sh
pnpm --dir app build
cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check
cargo test --manifest-path app/src-tauri/Cargo.toml
node --check scripts/verify-phase6-browser-smoke.mjs
node scripts/verify-phase6-browser-smoke.mjs --url http://127.0.0.1:1420/ --core-status missing --out artifacts/phase8/browser-smoke-openrouter-missing-core
scripts/verify-phase6-loop.sh --browser
```

Latest focused evidence:

- `artifacts/phase8/browser-smoke-openrouter-missing-core/browser-smoke.json`
- `artifacts/phase6/verify-loop/20260702-143052`
- Live one-shot OpenRouter reply on `deepseek/deepseek-chat-v3.1`:
  `drive16-phase8-live-ok`, 34 total tokens.
- Headless app-level live test: Agent Settings accepted the temporary
  OpenRouter key, conversation mode switched to `OpenRouter live`, the rendered
  model reply was `drive16-app-live-ok`, and console errors were `0`.

The focused smoke uses a mocked OpenRouter key check and mocked chat completion
so no real credential enters evidence artifacts.

Secret hygiene passed: no tracked or generated file contained an
`sk-or-v1-` key pattern after the live one-shot test.

## Out Of Scope

- Ollama generation.
- Streaming replies.
- Play/core distribution policy changes.
- Packaging, signing, notarization, or CSP changes.
- Broad `App.tsx` refactors beyond the small OpenRouter transport extraction.
