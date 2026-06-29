# Phase 1 Agent-Loop Validation

This is the gate script for the Phase 1 exit criterion. It prepares a
throwaway SGDK project with a deliberate compile error, then asks OpenCode to
fix it from a text prompt using only the configured MCP tools.

Prepare the validation project and print the credential gate:

```sh
scripts/validate-phase1-agent-loop.py
```

After OpenRouter is configured outside the repo, run:

```sh
export DRIVE16_PHASE1_MODEL=openrouter/<provider-model>
export OPENROUTER_API_KEY=...
scripts/validate-phase1-agent-loop.py --run-agent
```

The script verifies:

- the deliberate compile error was removed;
- `drive16-sgdk-build` built the generated project;
- `read_build_log` was used during the repair loop;
- `drive16-emulator` ran the resulting ROM;
- `capture_frame` produced a PNG screenshot.

Artifacts are written under `artifacts/phase1/agent-loop/`, with the final
screenshot at `artifacts/phase1/emulator/last-frame.png`.
