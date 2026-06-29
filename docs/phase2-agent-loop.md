# Phase 2 Agent-Loop Validation

This is the gate script for the Phase 2 exit criterion. It prepares a
throwaway SGDK project, embeds the Phase 2 core-asset skill in a plain
OpenCode prompt, and asks the agent to produce a ROM with the bundled sprite
controllable by the D-pad and the bundled music loop playing.

Prepare the validation project and print the credential gate:

```sh
scripts/validate-phase2-agent-loop.py
```

After OpenRouter is configured outside the repo, run:

```sh
export DRIVE16_PHASE2_MODEL=openrouter/<provider-model>
export OPENROUTER_API_KEY=...
scripts/validate-phase2-agent-loop.py --run-agent
```

The script verifies:

- the generated project uses `drive16_player` and `drive16_loop`;
- the project declares the bundled assets through `res/resources.res`;
- `drive16-sgdk-build` built the generated project;
- `drive16-emulator` ran the resulting ROM;
- `send_input` and `capture_frame` were used during the run;
- Genteel captures neutral and Right-input screenshots that differ;
- a Genteel audio dump is non-silent.

Artifacts are written under `artifacts/phase2/agent-loop/`.
