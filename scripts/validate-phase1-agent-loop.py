#!/usr/bin/env python3
"""Prepare and run the Phase 1 OpenCode agent-loop validation."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = REPO_ROOT / "artifacts" / "phase1" / "agent-loop"
PROJECT_DIR = ARTIFACT_ROOT / "project"
PROMPT_PATH = ARTIFACT_ROOT / "prompt.md"
OPENCODE_LOG = ARTIFACT_ROOT / "opencode-run.jsonl"
SGDK_STATE = REPO_ROOT / "artifacts" / "phase1" / "sgdk-build" / "last-build.json"
EMULATOR_STATE = REPO_ROOT / "artifacts" / "phase1" / "emulator" / "state.json"
EMULATOR_FRAME = REPO_ROOT / "artifacts" / "phase1" / "emulator" / "last-frame.png"

BROKEN_MAIN_C = """#include <genesis.h>

int main(bool hardReset)
{
    VDP_drawText("Drive16 Phase 1", 9, 11);
    VDP_drawText("Fix the build", 9, 13);
    VDP_setBackgroundColor(DRIVE16_COMPILE_ERROR_SENTINEL);

    while (TRUE)
    {
        SYS_doVBlankProcess();
    }

    return 0;
}
"""

MAKEFILE = """GDK ?= /sgdk

include $(GDK)/makefile.gen
"""

PROMPT = """You are validating the Drive16 Phase 1 text-only agent loop.

Work only inside this SGDK project:

{project_path}

The project has a deliberate C compile error. Do not remove the test project.

Use the Drive16 MCP tools, not direct shell build commands:

1. Query `drive16-rag` for SGDK VDP text drawing, palette or background color,
   and the Drive16 Phase 1 project-pattern notes.
2. Edit `src/main.c` so the ROM builds and shows a text-only screen.
3. The final ROM should include the text `Drive16 Phase 1`.
4. The final ROM should have a blue or blue-ish background.
5. Build through `drive16-sgdk-build`.
6. If the build fails, call `read_build_log`, fix the compile error, and build
   again until it succeeds.
7. Run the ROM through `drive16-emulator`.
8. Call `capture_frame` and inspect the screenshot result before reporting done.

Success means the deliberate compile error is gone, the ROM builds, the ROM runs
in Genteel, and a screenshot is captured.
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
    (PROJECT_DIR / "src" / "main.c").write_text(BROKEN_MAIN_C, encoding="utf-8")
    PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROMPT_PATH.write_text(PROMPT.format(project_path=PROJECT_DIR), encoding="utf-8")


def assert_project_prepared() -> None:
    main_c = PROJECT_DIR / "src" / "main.c"
    if not main_c.is_file():
        raise ValidationError("Phase 1 test project has not been prepared.")
    if "DRIVE16_COMPILE_ERROR_SENTINEL" not in main_c.read_text(encoding="utf-8"):
        raise ValidationError("Prepared project no longer contains the deliberate compile error.")


def openrouter_ready() -> tuple[bool, str]:
    model = os.environ.get("DRIVE16_PHASE1_MODEL", "").strip()
    if not model:
        return False, "DRIVE16_PHASE1_MODEL is not set."
    if not model.startswith("openrouter/"):
        return False, "DRIVE16_PHASE1_MODEL must use the openrouter/<model> format."
    if os.environ.get("OPENROUTER_API_KEY"):
        return True, "OpenRouter API key detected in environment."

    providers = run(["opencode", "providers", "list"], timeout=30)
    provider_text = providers.stdout + providers.stderr
    if "OpenRouter" in provider_text:
        return True, "OpenRouter credential detected by opencode providers list."
    return False, "OpenRouter credential is not configured."


def print_validation_request(reason: str) -> None:
    print("VALIDATION REQUEST: Phase 1 agent-loop validation is ready but cannot run yet.")
    print(reason)
    print()
    print("Configure credentials outside the repo, then run:")
    print("  export DRIVE16_PHASE1_MODEL=openrouter/<provider-model>")
    print("  export OPENROUTER_API_KEY=...")
    print("  scripts/validate-phase1-agent-loop.py --run-agent")
    print()
    print(f"Prepared project: {PROJECT_DIR}")
    print(f"Prompt: {PROMPT_PATH}")


def run_agent() -> None:
    ready, reason = openrouter_ready()
    if not ready:
        raise ValidationError(reason)

    model = os.environ["DRIVE16_PHASE1_MODEL"].strip()
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    command = [
        "opencode",
        "run",
        "--model",
        model,
        "--format",
        "json",
        "--title",
        "Drive16 Phase 1 text-loop validation",
        "--dangerously-skip-permissions",
        PROMPT_PATH.read_text(encoding="utf-8"),
    ]
    result = run(command, timeout=1800)
    OPENCODE_LOG.write_text(result.stdout, encoding="utf-8")
    (ARTIFACT_ROOT / "opencode-run.stderr").write_text(result.stderr, encoding="utf-8")
    if result.returncode != 0:
        raise ValidationError(
            f"opencode run failed with exit {result.returncode}. See {OPENCODE_LOG} and opencode-run.stderr."
        )


def read_json(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise ValidationError(f"Missing expected state file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def verify_artifacts(require_agent_log: bool) -> None:
    main_c = PROJECT_DIR / "src" / "main.c"
    if not main_c.is_file():
        raise ValidationError("Missing generated project source.")
    source = main_c.read_text(encoding="utf-8")
    if "DRIVE16_COMPILE_ERROR_SENTINEL" in source:
        raise ValidationError("The deliberate compile error is still present.")
    if "Drive16 Phase 1" not in source:
        raise ValidationError("The final source does not include the expected Phase 1 text.")

    rom = PROJECT_DIR / "out" / "rom.bin"
    if not rom.is_file():
        raise ValidationError(f"Missing built ROM: {rom}")

    sgdk_state = read_json(SGDK_STATE)
    if sgdk_state.get("ok") is not True:
        raise ValidationError("SGDK MCP state does not report a successful build.")
    if Path(str(sgdk_state.get("projectPath"))).resolve() != PROJECT_DIR.resolve():
        raise ValidationError("Latest SGDK MCP build was not for the Phase 1 validation project.")

    emulator_state = read_json(EMULATOR_STATE)
    if emulator_state.get("ok") is not True:
        raise ValidationError("Emulator MCP state does not report a successful run.")
    if Path(str(emulator_state.get("romPath"))).resolve() != rom.resolve():
        raise ValidationError("Latest emulator MCP run was not for the Phase 1 validation ROM.")
    if not EMULATOR_FRAME.is_file() or EMULATOR_FRAME.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValidationError(f"Missing captured PNG frame: {EMULATOR_FRAME}")

    if require_agent_log:
        log_text = OPENCODE_LOG.read_text(encoding="utf-8") if OPENCODE_LOG.is_file() else ""
        required_markers = [
            "query_documents",
            "build_rom",
            "read_build_log",
            "run_rom",
            "capture_frame",
        ]
        missing = [marker for marker in required_markers if marker not in log_text]
        if missing:
            raise ValidationError(f"OpenCode log is missing expected tool markers: {missing}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-agent", action="store_true", help="run the OpenCode agent validation")
    parser.add_argument("--verify-only", action="store_true", help="verify artifacts from a previous agent run")
    args = parser.parse_args()

    if args.verify_only:
        verify_artifacts(require_agent_log=True)
        print(f"Phase 1 agent-loop artifacts ok: {EMULATOR_FRAME}")
        return 0

    prepare_project()
    assert_project_prepared()

    if not args.run_agent:
        ready, reason = openrouter_ready()
        if ready:
            print("Phase 1 agent-loop validation is ready to run.")
            print(reason)
            print("Run: scripts/validate-phase1-agent-loop.py --run-agent")
        else:
            print_validation_request(reason)
        return 0

    run_agent()
    verify_artifacts(require_agent_log=True)
    print(f"Phase 1 agent-loop ok: {EMULATOR_FRAME}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
