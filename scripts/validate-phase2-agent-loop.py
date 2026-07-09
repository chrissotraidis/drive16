#!/usr/bin/env python3
"""Prepare and run the Phase 2 OpenCode bundled-asset validation."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import wave
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "phase2" / "agent-loop"
PROJECT_DIR = ARTIFACT_ROOT / "project"
PROMPT_PATH = ARTIFACT_ROOT / "prompt.md"
OPENCODE_LOG = ARTIFACT_ROOT / "opencode-run.jsonl"
OPENCODE_STDERR = ARTIFACT_ROOT / "opencode-run.stderr"
SKILL_PATH = REPO_ROOT / "agent" / "skills" / "phase2-core-assets.md"
SGDK_STATE = REPO_ROOT / "artifacts" / "phase1" / "sgdk-build" / "last-build.json"
EMULATOR_STATE = REPO_ROOT / "artifacts" / "phase1" / "emulator" / "state.json"
EMULATOR_FRAME = REPO_ROOT / "artifacts" / "phase1" / "emulator" / "last-frame.png"
GENTEEL_BUILD = REPO_ROOT / "scripts" / "build-genteel.sh"
NEUTRAL_FRAME = ARTIFACT_ROOT / "verification-neutral.png"
RIGHT_FRAME = ARTIFACT_ROOT / "verification-right.png"
INPUT_SCRIPT = ARTIFACT_ROOT / "verification-hold-right.csv"
SPRITE_MOVEMENT = REPO_ROOT / "scripts" / "validate-sprite-movement.py"

MAKEFILE = """GDK ?= /sgdk

include $(GDK)/makefile.gen
"""

STARTER_MAIN_C = """#include <genesis.h>

int main(bool hardReset)
{
    VDP_drawText("Drive16 Phase 2", 9, 11);
    VDP_drawText("Add bundled assets", 7, 13);

    while (TRUE)
    {
        SYS_doVBlankProcess();
    }

    return 0;
}
"""

PROMPT_TEMPLATE = """You are validating the Drive16 Phase 2 CORE asset loop.

Plain user request:

Make a Genesis ROM with the bundled Drive16 sprite controllable by the D-pad
and the bundled music loop playing.

Work only inside this SGDK project:

{project_path}

Use the Drive16 MCP tools, not direct shell build commands. Use CORE tools only:
`drive16-rag`, `drive16-sgdk-build`, and `drive16-emulator`.

Required flow:

1. Query `drive16-rag` for Phase 2 bundled assets, `drive16_player`,
   `drive16_loop`, `resources.res`, `SPRITE`, and `XGM`.
2. Apply the Phase 2 skill below.
3. Write the needed SGDK files inside the project.
4. The final ROM must include visible text `Drive16 Phase 2`.
5. The final ROM must use `drive16_player` from `assets/core/player.png`.
6. The final ROM must use `drive16_loop` from `assets/core/loop.vgm`.
7. Build through `drive16-sgdk-build`.
8. If the build fails, call `read_build_log`, fix the issue, and rebuild.
9. Run the ROM through `drive16-emulator`.
10. Call `capture_frame` after the first run to inspect the neutral screenshot.
11. Call `send_input` with Player 1 holding Right, run the ROM again, call
    `capture_frame`, then call `verify_audio` so movement and non-silent music
    are both proven in the final emulator state. If `verify_audio` is not
    available, use `run_rom` with `dump_audio=true`, then `capture_audio`.

Success means the ROM builds, runs in Genteel, uses the bundled sprite and
bundled music symbols, captures screenshots, proves non-silent audio through
`verify_audio` or `capture_audio`, and exercises D-pad movement.

Phase 2 skill:

{skill_text}
"""


class ValidationError(Exception):
    pass


def run(command: list[str], *, timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def prepare_project() -> None:
    if PROJECT_DIR.exists():
        shutil.rmtree(PROJECT_DIR)
    (PROJECT_DIR / "src").mkdir(parents=True, exist_ok=True)
    (PROJECT_DIR / "Makefile").write_text(MAKEFILE, encoding="utf-8")
    (PROJECT_DIR / "src" / "main.c").write_text(STARTER_MAIN_C, encoding="utf-8")

    skill_text = SKILL_PATH.read_text(encoding="utf-8")
    prompt = PROMPT_TEMPLATE.format(project_path=PROJECT_DIR, skill_text=skill_text)
    PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROMPT_PATH.write_text(prompt, encoding="utf-8")


def assert_project_prepared() -> None:
    main_c = PROJECT_DIR / "src" / "main.c"
    if not main_c.is_file():
        raise ValidationError("Phase 2 test project has not been prepared.")
    source = main_c.read_text(encoding="utf-8")
    if "Add bundled assets" not in source:
        raise ValidationError("Prepared project no longer contains the starter source.")
    if not PROMPT_PATH.is_file():
        raise ValidationError("Phase 2 prompt has not been written.")


def openrouter_ready() -> tuple[bool, str]:
    model = os.environ.get("DRIVE16_PHASE2_MODEL", "").strip()
    if not model:
        return False, "DRIVE16_PHASE2_MODEL is not set."
    if not model.startswith("openrouter/"):
        return False, "DRIVE16_PHASE2_MODEL must use the openrouter/<model> format."
    if os.environ.get("OPENROUTER_API_KEY"):
        return True, "OpenRouter API key detected in environment."

    providers = run(["opencode", "providers", "list"], timeout=30)
    provider_text = providers.stdout + providers.stderr
    if "OpenRouter" in provider_text:
        return True, "OpenRouter credential detected by opencode providers list."
    return False, "OpenRouter credential is not configured."


def print_validation_request(reason: str) -> None:
    print("VALIDATION REQUEST: Phase 2 agent-loop validation is ready but cannot run yet.")
    print(reason)
    print()
    print("Configure credentials outside the repo, then run:")
    print("  export DRIVE16_PHASE2_MODEL=openrouter/<provider-model>")
    print("  export OPENROUTER_API_KEY=...")
    print("  scripts/validate-phase2-agent-loop.py --run-agent")
    print()
    print(f"Prepared project: {PROJECT_DIR}")
    print(f"Prompt: {PROMPT_PATH}")


def run_agent() -> None:
    ready, reason = openrouter_ready()
    if not ready:
        raise ValidationError(reason)

    model = os.environ["DRIVE16_PHASE2_MODEL"].strip()
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    command = [
        "opencode",
        "run",
        "--model",
        model,
        "--format",
        "json",
        "--title",
        "Drive16 Phase 2 bundled-asset validation",
        "--dangerously-skip-permissions",
        PROMPT_PATH.read_text(encoding="utf-8"),
    ]
    result = run(command, timeout=2400)
    OPENCODE_LOG.write_text(result.stdout, encoding="utf-8")
    OPENCODE_STDERR.write_text(result.stderr, encoding="utf-8")
    if result.returncode != 0:
        raise ValidationError(
            f"opencode run failed with exit {result.returncode}. See {OPENCODE_LOG} and {OPENCODE_STDERR}."
        )


def read_json(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise ValidationError(f"Missing expected state file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def assert_contains(path: Path, terms: list[str]) -> str:
    if not path.is_file():
        raise ValidationError(f"Missing expected file: {path}")
    text = path.read_text(encoding="utf-8")
    missing = [term for term in terms if term not in text]
    if missing:
        raise ValidationError(f"{path} is missing expected terms: {missing}")
    return text


def verify_project_files() -> Path:
    source = assert_contains(
        PROJECT_DIR / "src" / "main.c",
        [
            "Drive16 Phase 2",
            "drive16_player",
            "drive16_loop",
            "JOY_readJoypad",
            "SPR_addSprite",
            "SPR_update",
            "XGM_startPlay",
        ],
    )
    if "ComfyUI" in source or "MML" in source:
        raise ValidationError("Phase 2 source should not reference generated-asset tools.")

    assert_contains(
        PROJECT_DIR / "res" / "resources.res",
        [
            "SPRITE drive16_player",
            "XGM drive16_loop",
            "assets/core/player.png",
            "assets/core/loop.vgm",
        ],
    )
    assert_contains(
        PROJECT_DIR / "res" / "resources.h",
        [
            "SpriteDefinition drive16_player",
            "u8 drive16_loop",
        ],
    )

    rom = PROJECT_DIR / "out" / "rom.bin"
    if not rom.is_file():
        raise ValidationError(f"Missing built ROM: {rom}")
    return rom


def verify_mcp_state(rom: Path) -> None:
    sgdk_state = read_json(SGDK_STATE)
    if sgdk_state.get("ok") is not True:
        raise ValidationError("SGDK MCP state does not report a successful build.")
    if Path(str(sgdk_state.get("projectPath"))).resolve() != PROJECT_DIR.resolve():
        raise ValidationError("Latest SGDK MCP build was not for the Phase 2 validation project.")

    emulator_state = read_json(EMULATOR_STATE)
    if emulator_state.get("ok") is not True:
        raise ValidationError("Emulator MCP state does not report a successful run.")
    if Path(str(emulator_state.get("romPath"))).resolve() != rom.resolve():
        raise ValidationError("Latest emulator MCP run was not for the Phase 2 validation ROM.")
    if not EMULATOR_FRAME.is_file() or EMULATOR_FRAME.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValidationError(f"Missing captured PNG frame: {EMULATOR_FRAME}")
    audio_path = emulator_state.get("audioDumpPath")
    if not audio_path:
        raise ValidationError(
            "Latest emulator MCP run did not include an audio dump. "
            "The final Right-input run must use dump_audio=true."
        )
    verify_audio(Path(str(audio_path)))


def verify_agent_log() -> None:
    log_text = OPENCODE_LOG.read_text(encoding="utf-8") if OPENCODE_LOG.is_file() else ""
    required_markers = [
        "query_documents",
        "build_rom",
        "run_rom",
        "capture_frame",
        "send_input",
    ]
    missing = [marker for marker in required_markers if marker not in log_text]
    if "verify_audio" not in log_text and "capture_audio" not in log_text:
        missing.append("verify_audio or capture_audio")
    if missing:
        raise ValidationError(f"OpenCode log is missing expected tool markers: {missing}")


def genteel_binary() -> Path:
    env_bin = os.environ.get("GENTEEL_BIN")
    if env_bin:
        path = Path(env_bin).expanduser()
        if not path.is_absolute():
            found = shutil.which(env_bin)
            if not found:
                raise ValidationError(f"Genteel binary was not found: {env_bin}")
            path = Path(found)
        if not path.is_file():
            raise ValidationError(f"Genteel binary was not found: {path}")
        return path.resolve()

    result = run([str(GENTEEL_BUILD)], timeout=600)
    if result.returncode != 0:
        raise ValidationError(f"Genteel build failed:\n{result.stdout}\n{result.stderr}")
    path_text = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ""
    path = Path(path_text).resolve()
    if not path.is_file():
        raise ValidationError(f"Genteel build did not produce a binary path: {path_text}")
    return path


def run_genteel(command: list[str]) -> None:
    result = run(command, timeout=120)
    if result.returncode != 0:
        raise ValidationError(f"Genteel verification failed:\n{result.stdout}\n{result.stderr}")


def verify_audio(path: Path) -> int:
    if not path.is_file():
        raise ValidationError(f"Audio dump missing: {path}")
    with wave.open(str(path), "rb") as wav:
        frames = wav.readframes(wav.getnframes())
        samples = [
            int.from_bytes(frames[i : i + 2], "little", signed=True)
            for i in range(0, len(frames), 2)
        ]
    if not samples:
        raise ValidationError("Audio dump contains no samples.")
    max_abs = max(abs(sample) for sample in samples)
    if max_abs == 0:
        raise ValidationError("Audio dump is silent.")
    return max_abs


def verify_runtime(rom: Path) -> int:
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    genteel = genteel_binary()
    run_genteel([
        str(genteel),
        "--headless",
        "180",
        "--screenshot",
        str(NEUTRAL_FRAME),
        str(rom),
    ])

    INPUT_SCRIPT.write_text("0,...R....,........\n", encoding="utf-8")
    run_genteel([
        str(genteel),
        "--script",
        str(INPUT_SCRIPT),
        "--headless",
        "180",
        "--screenshot",
        str(RIGHT_FRAME),
        str(rom),
    ])

    if not NEUTRAL_FRAME.is_file() or NEUTRAL_FRAME.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValidationError(f"Neutral screenshot missing or invalid: {NEUTRAL_FRAME}")
    if not RIGHT_FRAME.is_file() or RIGHT_FRAME.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValidationError(f"Right-input screenshot missing or invalid: {RIGHT_FRAME}")
    movement = run(
        [
            str(SPRITE_MOVEMENT),
            str(NEUTRAL_FRAME),
            str(RIGHT_FRAME),
            "--direction",
            "right",
            "--min-delta",
            "24",
            "--min-changed",
            "40",
        ],
        timeout=30,
    )
    if movement.returncode != 0:
        raise ValidationError(f"Sprite movement validation failed:\n{movement.stdout}\n{movement.stderr}")
    return None


def verify_artifacts(require_agent_log: bool) -> None:
    rom = verify_project_files()
    verify_mcp_state(rom)
    if require_agent_log:
        verify_agent_log()
    verify_runtime(rom)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-agent", action="store_true", help="run the OpenCode agent validation")
    parser.add_argument("--verify-only", action="store_true", help="verify artifacts from a previous agent run")
    args = parser.parse_args()

    if args.verify_only:
        verify_artifacts(require_agent_log=True)
        print(f"Phase 2 agent-loop artifacts ok: {RIGHT_FRAME}")
        return 0

    prepare_project()
    assert_project_prepared()

    if not args.run_agent:
        ready, reason = openrouter_ready()
        if ready:
            print("Phase 2 agent-loop validation is ready to run.")
            print(reason)
            print("Run: scripts/validate-phase2-agent-loop.py --run-agent")
        else:
            print_validation_request(reason)
        return 0

    run_agent()
    verify_artifacts(require_agent_log=True)
    print(f"Phase 2 agent-loop ok: {RIGHT_FRAME}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
