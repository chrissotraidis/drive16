# Phase 5 Agent Truthfulness

This slice continues Phase 5 hardening by making the conversation pane honest
about local proof responses versus live model replies.

## Goal

The chat should not imply that the selected model answered unless live model
reply handling is actually configured and tested. ROM-changing proof prompts
should remain available because they use the verified local build path.

## Behavior

- Conversation mode row:
  - Shows `ROM proof only` while the selected provider is not tested.
  - States that freeform model replies are paused.
  - Keeps the active provider label near Agent Settings.
- Message history:
  - Labels local proof responses as `Local proof`.
  - Keeps future model and OpenCode log labels separate.
  - Auto-scrolls to the latest response after new messages.
- General freeform prompt:
  - Does not post as a live model answer when the selected provider is not
    tested.
  - Adds a local proof message explaining that freeform replies are paused.
  - Logs `message.gated` in the event feed.
- ROM-changing prompt:
  - Still runs the verified local proof path.
  - Adds a local proof response that describes the preview or native ROM proof.
  - Updates the top status to the completed ROM proof.

## Evidence

Commands:

```sh
pnpm --dir app build
cargo test --manifest-path app/src-tauri/Cargo.toml opencode -- --nocapture
```

Rendered browser proof at `http://127.0.0.1:1420/`:

- App loaded with title `Drive16`.
- Console warnings and errors were empty.
- Initial mode row read
  `ROM proof only` with `Claude Sonnet Latest is not tested; freeform model replies are paused`.
- Sending `What can you do?` added a `Local proof` reply that freeform model
  replies are paused while ROM-changing prompts still use the verified local
  build path.
- Sending `Make a sprite I can move left and right with music.` added a
  `Local proof` reply for the bundled sprite/music ROM proof.
- The input cleared after each submit.
- The message pane showed the latest local proof response.
- The top status changed to `CORE ROM proof completed.`

Screenshot:

- `/tmp/drive16-phase5-unit2/conversation-truthfulness.png`
