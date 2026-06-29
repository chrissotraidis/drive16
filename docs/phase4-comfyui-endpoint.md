# Phase 4 ComfyUI Endpoint Evidence

## Scope

This slice adds endpoint configuration and health probing for the optional
AI sprite path. The ComfyUI controls stay behind the `AI sprites` toggle, so
the CORE bundled-asset path remains the default.

Implemented behavior:

- Native `check_comfyui_endpoint` command.
- Local-only endpoint normalization for `http://127.0.0.1:8188` and
  `http://localhost:8188`.
- Health probing through ComfyUI's `GET /system_stats` route.
- Settings endpoint field and `Test` action that only render after enabling
  `AI sprites`.
- Browser-preview fallback that reports a clean failed state when ComfyUI is
  not running.

The official ComfyUI route documentation lists `/system_stats` as the endpoint
for system and device information:
https://docs.comfy.org/development/comfyui-server/comms_routes

## Verification

Native focused tests:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture
```

Result:

- `5 passed; 0 failed; 0 ignored`.

Frontend build:

```sh
pnpm --dir app build
```

Result:

- Frontend build passed.

Rendered browser check at `http://127.0.0.1:1420/`:

- Page title was `Drive16`.
- App content was not blank.
- No Vite or framework error overlay appeared.
- Agent Settings opened from the top model button.
- With `AI sprites` off, the ComfyUI config panel was hidden.
- Enabling `AI sprites` revealed the ComfyUI endpoint field.
- Default endpoint was `http://127.0.0.1:8188`.
- Clicking `Test` changed the ComfyUI status to a clean failed state because
  no local ComfyUI server was running in the browser-preview environment.
- Browser console warnings and errors were empty.
- Browser viewport had no horizontal overflow.

## Next

Wrap ComfyUI through `comfyui-mcp` behind the enabled endpoint.
