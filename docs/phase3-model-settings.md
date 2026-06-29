# Phase 3 Model Settings Evidence

This slice adds the Phase 3 settings surface for provider choice, OpenRouter
key entry, model selection, and connection testing.

## Scope

- The top model control and left-pane gear open `Agent Settings`.
- Provider selection starts with OpenRouter and Ollama.
- OpenRouter model choices load from
  `https://openrouter.ai/api/v1/models`.
- OpenRouter key entry is password-masked, autocomplete-disabled, and kept only
  in React state.
- The connection test calls `https://openrouter.ai/api/v1/key` with a bearer
  token and renders only a safe success or failure state.
- No key is written to project files, local storage, or app config.

The connection test does not yet restart or configure the OpenCode server for
live model replies. That remains part of the final app prompt wiring.

## Endpoint Checks

OpenRouter CORS preflight from the local preview origin:

```text
curl -i --max-time 10 -X OPTIONS https://openrouter.ai/api/v1/key \
  -H 'Origin: http://127.0.0.1:1420' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type'

HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET,OPTIONS,PATCH,DELETE,POST,PUT
```

OpenRouter unauthenticated key check shape:

```text
curl -i --max-time 10 https://openrouter.ai/api/v1/key

HTTP/2 401
{"error":{"message":"No cookie auth credentials found","code":401}}
```

OpenRouter model list:

```text
curl --max-time 10 https://openrouter.ai/api/v1/models
```

The app loaded six preferred model choices in browser preview, including the
current Sonnet alias.

## Browser Verification

Target:

```text
http://127.0.0.1:1420/
```

Settings open:

- The `Open model settings` control opened the dialog.
- The dialog reported `Not tested`.
- The OpenRouter model selector loaded six options.
- The selected model was `~anthropic/claude-sonnet-latest`.
- Browser console warnings and errors were empty.

Connection test:

- The provided OpenRouter key was pasted into the password field.
- `Test connection` returned `Connected` and `OpenRouter key accepted`.
- The event feed recorded `model.ready`.
- The key input stayed masked as `password`.
- Browser console warnings and errors were empty.
- The key was not printed in command output or written to files.

Mobile check:

- Mobile viewport was set to `390` by `844`.
- Reload cleared the runtime key state.
- The settings dialog reopened with key length `0`.
- No horizontal document overflow was detected.
- Browser console warnings and errors remained empty.

Screenshots:

- `artifacts/phase3/model-settings/browser-connected.png`
- `artifacts/phase3/model-settings/browser-mobile.png`

## Build Verification

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

Rust tests:

```text
cargo test --manifest-path app/src-tauri/Cargo.toml
5 passed; 1 ignored
```

The final iteration secret scan also checks that the provided OpenRouter key was
not written to repo files.
