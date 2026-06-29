# Phase 1 OpenCode Setup

Drive16 uses the project-level `opencode.json` to wire the Phase 1 MCP tools
into OpenCode.

Configured MCP servers:

- `drive16-sgdk-build`: `build_rom`, `clean`, and `read_build_log`.
- `drive16-emulator`: `run_rom`, `capture_frame`, `send_input`, and
  `read_state`.
- `drive16-rag`: `mcp-local-rag` over the indexed SGDK plus VDP corpus.

Validate the non-secret setup:

```sh
scripts/validate-opencode-config.py
```

The validator checks that OpenCode resolves the three MCP servers and that
`opencode serve` can start locally.

## OpenRouter Gate

The real Phase 1 agent run still requires an OpenRouter credential and a model
choice. Do not commit API keys. Configure credentials outside the repo with one
of these paths:

```sh
opencode providers login
```

or:

```sh
export OPENROUTER_API_KEY=...
```

After that, run the text-loop validation from a plain CLI prompt.

## Text-Loop Validation

The Phase 1 agent-loop gate is scripted in
`scripts/validate-phase1-agent-loop.py`.

Prepare the throwaway project and confirm the credential gate:

```sh
scripts/validate-phase1-agent-loop.py
```

Run the real agent validation after OpenRouter is configured:

```sh
export DRIVE16_PHASE1_MODEL=openrouter/<provider-model>
scripts/validate-phase1-agent-loop.py --run-agent
```

See `docs/phase1-agent-loop.md` for the exact checks.
