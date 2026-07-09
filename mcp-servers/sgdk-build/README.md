# SGDK Build MCP Server

Phase 1 stdio MCP server for the pinned SGDK Docker toolchain.

Run it from the repo root:

```sh
python3 mcp-servers/sgdk-build/server.py
```

It exposes:

- `build_rom(project_path, target = "all")`: builds a repo-local SGDK project
  through `scripts/build-sgdk.sh`.
- `clean(project_path)`: runs the SGDK `clean` target through the same pinned
  Docker image.
- `read_build_log()`: returns the latest captured build or clean log.
- `audit_project_memory(project_path, expect_gate = "pass")`: checks
  `GAME.md`, `ASSETS.md`, and `PLAYTEST.md` against the current ROM and returns
  exact evidence issues for the builder to repair before claiming completion.

Build logs are written to `artifacts/phase1/sgdk-build/last-build.log`, with
metadata in `artifacts/phase1/sgdk-build/last-build.json`.

Validate the server and hello-world build path:

```sh
scripts/validate-sgdk-build-mcp.py
```
