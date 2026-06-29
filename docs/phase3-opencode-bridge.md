# Phase 3 OpenCode Bridge Evidence

This slice connects the left conversation pane to OpenCode over local HTTP and
server-sent events.

## Scope

- Native Tauri command `connect_opencode` checks
  `http://127.0.0.1:4096/global/health`.
- If no server is reachable, the native bridge starts:
  `opencode serve --hostname 127.0.0.1 --port 4096`.
- The bridge returns the canonical OpenCode health and event URLs to the
  frontend.
- The left pane subscribes to `http://127.0.0.1:4096/global/event` with
  `EventSource` and renders the latest OpenCode events.
- Composer submit creates an OpenCode session when needed and posts the user
  message to `/session/{sessionID}/message`.
- This first app slice uses `noReply: true`. That proves transport, session
  creation, and SSE wiring without consuming or storing a provider key.

Real model replies are intentionally left for the next Phase 3 unit: settings
for provider, OpenRouter key entry, model selection, and connection test.

## OpenCode Server Discovery

Local OpenCode version:

```text
opencode --version
1.14.33
```

Health endpoint:

```text
curl --max-time 5 http://127.0.0.1:4096/global/health
{"healthy":true,"version":"1.14.33"}
```

Session endpoint shape:

```text
POST http://127.0.0.1:4096/session
HTTP/1.1 200 OK
Content-Length: 296

{"id":"ses_...","version":"1.14.33","directory":"/Users/chrissotraidis/Documents/GitHub/drive16",...}
```

Message endpoint shape:

```json
{
  "messageID": "msg_drive16_<stamp>",
  "noReply": true,
  "parts": [
    {
      "id": "prt_drive16_<stamp>",
      "type": "text",
      "text": "OpenCode bridge browser smoke test"
    }
  ]
}
```

## Automated Verification

Rust bridge tests:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml opencode -- --nocapture
2 passed
```

Full Rust test suite:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml
5 passed; 1 ignored
```

Rust compile check:

```text
cargo check --manifest-path app/src-tauri/Cargo.toml
passed
```

Frontend build:

```text
pnpm --dir app build
passed
```

Tauri debug build:

```text
pnpm --dir app tauri build --debug --no-bundle
finished dev profile and built app/src-tauri/target/debug/drive16
```

## Browser Verification

Target:

```text
http://127.0.0.1:1420/
```

Initial state:

- Page title was `Drive16`.
- OpenCode chip rendered `OpenCode live`.
- SSE feed showed `sse.connecting`, `sse.open`, and OpenCode server events.
- Send button was enabled.
- Browser console warnings and errors were empty.

Message send:

- Filled the composer with `OpenCode bridge final bundle smoke test`.
- Clicked `Send message`.
- The left pane appended the user message.
- The app created an OpenCode session.
- The app appended an OpenCode session post confirmation.
- The event feed retained `message.posted` after the server emitted follow-up
  events.
- The top status stayed `Running` rather than implying a ROM build had started.
- Browser console warnings and errors remained empty.

Responsive check:

- Mobile viewport was set to `390` by `844`.
- The app reported `OpenCode live`.
- The composer was visible.
- No horizontal document overflow was detected.
- Browser console warnings and errors remained empty.

Screenshots:

- `artifacts/phase3/opencode-bridge/browser-after-send.png`
- `artifacts/phase3/opencode-bridge/browser-mobile.png`

## Secret Check

The OpenRouter key supplied during the session was not written to project files.
The final iteration secret scan checks for the key prefix, the visible key
fingerprint, and common environment-variable secret assignments before commit.
