# Drive16 MML Music MCP Server

Phase 4 enhancement MCP server for generated music.

This server wraps `ctrmml` as a separate process. `ctrmml` is GPL-2.0, so the
source checkout, build output, generated MML, and generated VGM files stay
under ignored `artifacts/` storage. The Drive16 app and Tauri bundle do not
link against it.

Tools:

- `compile_music`: write MML text to ignored artifacts, compile it to VGM with
  `ctrmml`, validate the VGM header, and return an SGDK `XGM` resource line.
- `read_music_state`: return the latest compile state and log.

The compiler is fetched and built by `scripts/build-ctrmml.sh`.
