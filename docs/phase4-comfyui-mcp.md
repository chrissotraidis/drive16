# Phase 4 ComfyUI MCP Wrapper Evidence

## Scope

This slice wraps the optional AI sprite path with the external MIT
`comfyui-mcp` MCP server. It does not generate sprites yet and does not ship
the tuned Genesis workflow. Those remain the next Phase 4 units.

Implemented behavior:

- Added `scripts/comfyui-mcp.sh`, which installs `comfyui-mcp` into ignored
  `artifacts/phase4/comfyui-mcp/` and runs it as a stdio MCP server.
- Added `drive16-comfyui` to `opencode.json` as a local MCP server.
- Set the default `COMFYUI_URL` to `http://127.0.0.1:8188`.
- Kept model/download cache output under ignored Phase 4 artifacts.
- Added `scripts/validate-comfyui-mcp-wrapper.py` to prove the wrapper
  initializes and exposes expected tools.
- Extended `scripts/validate-opencode-config.py` to require
  `drive16-comfyui`.

## Source Package

Package metadata checked during this slice:

- npm package: `comfyui-mcp`
- version: `0.21.0`
- license: `MIT`
- binary: `comfyui-mcp`
- engine requirement: Node.js `>=22.0.0`

The package readme documents the `npx -y comfyui-mcp` MCP setup, local
ComfyUI operation, and `COMFYUI_URL`, `COMFYUI_HOST`, and `COMFYUI_PORT`
configuration:
https://www.npmjs.com/package/comfyui-mcp

## Verification

Package metadata:

```sh
npm view comfyui-mcp@0.21.0 name version license bin engines --json
```

Result:

- `name`: `comfyui-mcp`
- `version`: `0.21.0`
- `license`: `MIT`
- `bin`: `comfyui-mcp`
- `engines.node`: `>=22.0.0`

Wrapper handshake:

```sh
scripts/validate-comfyui-mcp-wrapper.py
```

Result:

- `ComfyUI MCP wrapper ok: 113 tools`
- Validation artifact:
  `artifacts/phase4/comfyui-mcp/validation.json`
- Required tools exposed:
  `enqueue_workflow`, `generate_image`, and `get_system_stats`.

OpenCode config:

```sh
python3 scripts/validate-opencode-config.py
```

Result:

- OpenCode config validation passed.
- `drive16-comfyui` was present in resolved MCP config and `opencode mcp list`.
- The script still reported the existing validation request for model
  credentials before running a full agent loop.

## Next

Ship the tuned Genesis palette ComfyUI workflow.
