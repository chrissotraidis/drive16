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
- Phase 4 sprite-readiness checks through ComfyUI's `GET /object_info` route,
  the committed workflow contract, the selected checkpoint name, and local
  ComfyUI fallback paths.
- Settings checkpoint field that defaults to
  `pixel-art-diffusion-xl.safetensors` and sends the selected filename to the
  native readiness command.
- The endpoint status now reports compact readiness rows for API, checkpoint,
  Pixydust Quantizer, and workflow classes.
- The native endpoint status keeps checkpoint and Pixydust filesystem rows
  visible even when the API is down, and the checkpoint row can include nearby
  local checkpoint hints without accepting them automatically.
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

The focused native tests were rerun after adding sprite-readiness rows to the
same app command:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture
```

Result:

- `11 passed; 0 failed; 0 ignored`.

The focused native tests were rerun after adding the settings checkpoint
request field:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture
```

Result:

- `12 passed; 0 failed; 0 ignored`.

Frontend build:

```sh
npm run build
```

Result:

- Frontend build passed.

Full non-ignored native suite:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml -- --nocapture
```

Result:

- `25 passed; 0 failed; 4 ignored`.

The frontend production build was rerun after the checkpoint field was added:

```sh
npm run build
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

Rendered browser check after adding readiness rows:

- Page identity: `http://127.0.0.1:1420/`, title `Drive16`.
- App content was not blank and no Vite or framework error overlay appeared.
- Agent Settings opened from the settings button.
- Enabling `AI sprites` revealed the ComfyUI endpoint field and `Test` button.
- Clicking `Test` with no local ComfyUI server rendered a failed ComfyUI
  status and an `API` readiness row.
- Browser console warnings and errors were empty.
- Default viewport had no horizontal overflow.
- Mobile viewport `390x844` rendered the same failed status and `API`
  readiness row with no horizontal overflow.
- The temporary mobile viewport override was reset after the check.

The browser-preview path can only prove endpoint/API rendering. The native
Tauri command remains responsible for checkpoint, Pixydust, and workflow-class
checks because those use local filesystem and ComfyUI `/object_info` access.

The native command was rerun after adding checkpoint hints:

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml comfyui -- --nocapture
```

Result:

- `13 passed; 0 failed; 0 ignored`.

The rendered browser preview was rerun after the hint UI was added:

- Page identity remained `http://127.0.0.1:1420/`, title `Drive16`.
- Agent Settings opened and the `AI sprites` toggle revealed the endpoint and
  checkpoint fields.
- Clicking `Test` with no local ComfyUI server rendered the clean failed
  status and the `API` readiness row.
- Browser console warnings and errors were empty.
- Mobile viewport `390x844` rendered the same clean failed status and `API`
  readiness row with no horizontal overflow after the responsive shell update.
- Native checkpoint hint rendering is covered by the focused native tests,
  because browser preview cannot inspect local model folders.

## Next

Place the compatible checkpoint, pass ComfyUI readiness, then run the live
generated-sprite workflow and combined generated-assets proof.
