# MCP Servers

Reserved for Drive16 tool servers.

- `sgdk-build/`: Phase 1 SGDK build MCP server.
- `emulator/`: Phase 1 emulator sidecar adapter and MCP server.
- `mml-music/`: Phase 4 MML music MCP server backed by `ctrmml`.

Phase 4 reuses the external MIT `comfyui-mcp` package through
`scripts/comfyui-mcp.sh`, configured as `drive16-comfyui` in `opencode.json`.
