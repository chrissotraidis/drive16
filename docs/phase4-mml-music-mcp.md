# Phase 4 MML Music MCP Evidence

## Scope

This slice wraps `ctrmml` as the optional MML music MCP server. It does not yet
ship the FM preset library or wire generated music into the app prompt path.

Implemented behavior:

- Added `scripts/build-ctrmml.sh`, pinned to upstream commit
  `ca87769a5e73d69a514401e15a8d8bb193a3c0ef`.
- Added `mcp-servers/mml-music/server.py` with `compile_music` and
  `read_music_state` tools.
- Added `drive16-mml-music` to `opencode.json`.
- Added `scripts/validate-mml-music-mcp.py`.
- Extended OpenCode config validation to require `drive16-mml-music`.

## Source Package

Upstream source:

- repository: `https://github.com/superctr/ctrmml`
- pinned commit: `ca87769a5e73d69a514401e15a8d8bb193a3c0ef`
- license: GPL-2.0
- build command: `make RELEASE=1 mmlc`
- usage: `ctrmml <input.mml>`, with `--output` and `--format` options

`ctrmml` is built and run from ignored artifacts as a separate process.
Drive16 does not vendor or link it into the app.

## Verification

MML MCP server:

```sh
scripts/validate-mml-music-mcp.py
```

Result:

- The MCP server initialized and exposed `compile_music` and
  `read_music_state`.
- `compile_music` built the pinned `ctrmml` `mmlc` executable under ignored
  artifacts.
- A tiny Megadrive MML song compiled to a VGM file.
- The VGM header declared version `0x00000161` and a YM2612 clock.
- The tool returned an SGDK resource line:
  `XGM drive16_generated_music "<generated-vgm>"`.
- Validation artifact:
  `artifacts/phase4/mml-music/validation.json`.

OpenCode config:

```sh
python3 scripts/validate-opencode-config.py
```

Result:

- OpenCode config validation passed.
- `drive16-mml-music` was present in resolved MCP config and
  `opencode mcp list`.
- The script still reported the existing validation request for model
  credentials before full agent-loop runs.

## Next

Ship the FM preset library.
