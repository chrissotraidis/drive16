# Phase 2 Evidence Packet

Date: 2026-06-29

Phase 2 exit criterion:

> From a prompt, the agent produces a ROM with a controllable bundled sprite
> and a playing bundled loop. This meets the rescoped v1 content criterion
> with CORE tools only.

Status: evidenced locally. Human sign-off is required before Phase 3 begins.

## Agent Loop

Requirement: drive OpenCode from a plain prompt using only the CORE RAG, SGDK
build, and emulator MCP tools.

Evidence:

- Command:
  `DRIVE16_PHASE2_MODEL=openrouter/anthropic/claude-sonnet-4.6 scripts/validate-phase2-agent-loop.py --run-agent`
- Output:
  `Phase 2 agent-loop ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase2/agent-loop/verification-right.png`
- OpenCode run log:
  `artifacts/phase2/agent-loop/opencode-run.jsonl`
- Prompt artifact:
  `artifacts/phase2/agent-loop/prompt.md`
- Tool-call summary from the OpenCode log included `query_documents`,
  `build_rom`, `run_rom`, `capture_frame`, `send_input`, and
  `capture_audio`.

## Generated ROM

Requirement: the agent must produce an SGDK project that uses the bundled CORE
sprite and music loop through `resources.res`.

Evidence:

- Generated source:
  `artifacts/phase2/agent-loop/project/src/main.c`
- Resource file:
  `artifacts/phase2/agent-loop/project/res/resources.res`
- Output ROM:
  `artifacts/phase2/agent-loop/project/out/rom.bin`
- Final `resources.res` entries:
  `SPRITE drive16_player "../../../../../assets/core/player.png" 4 4 NONE 0`
  and `XGM drive16_loop "../../../../../assets/core/loop.vgm"`.
- The generated code loads `drive16_player`, updates its position from D-pad
  input, and starts `drive16_loop` with `XGM_startPlay`.

## Self-Correction

Requirement: the agent must be able to recover from build feedback during the
loop.

Evidence:

- The first Phase 2 build failed because the generated sprite asset path was
  one directory too shallow.
- The agent edited `resources.res` and reran `build_rom`.
- The second build succeeded with `ok: true` and produced
  `artifacts/phase2/agent-loop/project/out/rom.bin`.

## Genteel Run, Input, And Screenshot

Requirement: the generated ROM must run in Genteel, show the bundled sprite,
and respond to scripted input.

Evidence:

- Neutral screenshot:
  `artifacts/phase2/agent-loop/verification-neutral.png`
- Right-input screenshot:
  `artifacts/phase2/agent-loop/verification-right.png`
- Scripted input:
  `artifacts/phase2/agent-loop/verification-hold-right.csv`
- Verify-only command:
  `scripts/validate-phase2-agent-loop.py --verify-only`
- Verify-only output:
  `Phase 2 agent-loop artifacts ok: /Users/chrissotraidis/Documents/GitHub/drive16/artifacts/phase2/agent-loop/verification-right.png`
- Sprite movement validator:
  `Sprite movement ok: direction=right changed_pixels=768 delta=155 orthogonal_span=25`

Visual result: the neutral frame shows `Drive16 Phase 2` and
`D-pad: move sprite` with the bundled sprite near center. The Right-input frame
shows the same ROM after the sprite moved right.

## Audio Evidence

Requirement: the bundled VGM loop must play through the CORE emulator MCP
tools.

Evidence:

- Emulator state:
  `artifacts/phase1/emulator/state.json`
- Audio dump:
  `artifacts/phase1/emulator/last-audio.wav`
- OpenCode called `capture_audio`, which reported a non-silent WAV dump with
  `maxAbsSample: 10922`.
- The final `run_rom` call used the generated Phase 2 ROM and wrote
  `audioDumpPath`.

## Secret Hygiene

Requirement: no OpenRouter key enters the repo or validation artifacts.

Evidence:

- A workspace scan for the pasted OpenRouter key returned no files.
- The key was used only as an environment variable for the validation run.

## Phase Gate

Phase 2 is ready for human sign-off. Do not begin Phase 3 until sign-off is
given.
