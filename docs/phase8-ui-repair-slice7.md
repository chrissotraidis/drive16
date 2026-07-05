# Phase 8 UI Repair Slice 7

Status: implemented and browser-smoke verified.

## What Changed

- Removed the large OpenRouter/Ollama status strip from the conversation rail.
- Changed the composer label to neutral `Message` instead of repeating provider
  state such as `OpenRouter live`.
- Kept detailed provider state in Agent Settings, where model/provider/key
  configuration belongs.
- Left provider gating behavior intact: if OpenRouter is not ready and the user
  sends a freeform message, the app still explains the missing key/test state
  as a normal Drive16 setup reply.
- Updated browser smoke so it verifies the chat rail does not show
  `OpenRouter live` after provider setup, while OpenRouter freeform replies
  still work.

## Verification

- `pnpm --dir app build` passed.
- Browser smoke passed with the provider-status leak check.
- Rendered browser check confirmed the settings drawer owns OpenRouter setup
  and the chat composer no longer carries the provider status strip.

## Product Note

The earlier design put provider truth beside chat to make reply mode explicit,
but it read like a second settings panel and made the chat surface feel bloated.
The current direction is simpler: Settings owns provider status; chat owns
conversation and only explains provider problems when the user actually hits
one.
