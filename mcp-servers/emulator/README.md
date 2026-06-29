# Emulator MCP Server

Phase 1 stdio MCP server for the Genteel sidecar adapter.

Run it from the repo root:

```sh
python3 mcp-servers/emulator/server.py
```

It exposes:

- `run_rom(rom_path, frames = 180)`: runs a repo-local ROM in Genteel headless
  mode, captures a PNG frame, and can write an RGB565 frame stream or WAV audio
  dump.
- `capture_frame()`: returns the latest PNG frame captured by `run_rom`.
- `capture_audio()`: inspects the latest WAV audio dump captured by `run_rom`
  with `dump_audio = true` and reports whether it is non-silent.
- `send_input(frame, p1_buttons, p2_buttons, reset = false)`: writes a sparse
  Genteel input-script event for the next run.
- `read_state()`: returns the latest run metadata and log tail.

Artifacts are written to `artifacts/phase1/emulator/`.

Validate the server and hello-world emulator path:

```sh
scripts/validate-emulator-mcp.py
```

Validate the audio capture path with the Phase 2 asset ROM:

```sh
scripts/validate-emulator-audio-mcp.py
```
