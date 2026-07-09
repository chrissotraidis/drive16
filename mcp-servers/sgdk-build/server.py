#!/usr/bin/env python3
"""Drive16 SGDK build MCP server."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOLS = {PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05"}
REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-sgdk.sh"
PROJECT_MEMORY_AUDIT_SCRIPT = REPO_ROOT / "scripts" / "verify-project-memory.mjs"
LOG_DIR = REPO_ROOT / "artifacts" / "phase1" / "sgdk-build"
LOG_FILE = LOG_DIR / "last-build.log"
STATE_FILE = LOG_DIR / "last-build.json"


class ToolExecutionError(Exception):
    pass


TOOLS: list[dict[str, Any]] = [
    {
        "name": "build_rom",
        "title": "Build SGDK ROM",
        "description": "Build an SGDK project with the pinned docker-sgdk toolchain.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_path": {
                    "type": "string",
                    "description": "Repo-relative SGDK project path.",
                },
                "target": {
                    "type": "string",
                    "description": "Optional make target. Defaults to all.",
                    "default": "all",
                },
            },
            "required": ["project_path"],
            "additionalProperties": False,
        },
    },
    {
        "name": "clean",
        "title": "Clean SGDK Project",
        "description": "Run the SGDK clean target for a project through docker-sgdk.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_path": {
                    "type": "string",
                    "description": "Repo-relative SGDK project path.",
                }
            },
            "required": ["project_path"],
            "additionalProperties": False,
        },
    },
    {
        "name": "read_build_log",
        "title": "Read SGDK Build Log",
        "description": "Return the latest captured SGDK build or clean log.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
        },
    },
    {
        "name": "audit_project_memory",
        "title": "Audit Drive16 Project Memory",
        "description": (
            "Check GAME.md, ASSETS.md, and PLAYTEST.md against the current ROM and return "
            "specific issues to repair before calling the game complete."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_path": {
                    "type": "string",
                    "description": "Repo-relative or absolute Drive16 project path.",
                },
                "expect_gate": {
                    "type": "string",
                    "enum": ["any", "pass", "fail", "unknown"],
                    "description": "Expected PLAYTEST.md gate. Use pass before reporting completion.",
                    "default": "pass",
                },
            },
            "required": ["project_path"],
            "additionalProperties": False,
        },
    },
]


def respond(message_id: Any, result: dict[str, Any] | None = None, error: dict[str, Any] | None = None) -> None:
    response: dict[str, Any] = {"jsonrpc": "2.0", "id": message_id}
    if error is not None:
        response["error"] = error
    else:
        response["result"] = result or {}
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def resolve_project_path(value: Any) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ToolExecutionError("project_path must be a non-empty string.")

    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    project_path = candidate.resolve()

    try:
        project_path.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise ToolExecutionError("project_path must be inside the Drive16 repository.") from exc

    if not project_path.is_dir():
        raise ToolExecutionError(f"project_path does not exist: {project_path}")
    if not (project_path / "Makefile").is_file():
        raise ToolExecutionError(f"project_path has no Makefile: {project_path}")
    return project_path


def write_run_state(
    *,
    action: str,
    project_path: Path | None,
    returncode: int,
    log_text: str,
    rom_path: Path | None = None,
) -> dict[str, Any]:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(log_text, encoding="utf-8")
    state = {
        "action": action,
        "ok": returncode == 0,
        "exitCode": returncode,
        "projectPath": str(project_path) if project_path else None,
        "romPath": str(rom_path) if rom_path else None,
        "logPath": str(LOG_FILE),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    return state


def tail(text: str, max_chars: int = 6000) -> str:
    return text if len(text) <= max_chars else text[-max_chars:]


def tool_result(payload: dict[str, Any], is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def run_sgdk(project_path: Path, target: str, action: str) -> dict[str, Any]:
    if not BUILD_SCRIPT.is_file():
        raise ToolExecutionError(f"SGDK build script is missing: {BUILD_SCRIPT}")
    if not target or "/" in target or "\x00" in target:
        raise ToolExecutionError("target must be a simple make target.")

    env = os.environ.copy()
    process = subprocess.run(
        [str(BUILD_SCRIPT), str(project_path), target],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=240,
        env=env,
        check=False,
    )
    log_text = process.stdout
    if process.stderr:
        log_text = f"{log_text}\n{process.stderr}" if log_text else process.stderr

    rom_path = project_path / "out" / "rom.bin"
    state = write_run_state(
        action=action,
        project_path=project_path,
        returncode=process.returncode,
        log_text=log_text,
        rom_path=rom_path if rom_path.is_file() else None,
    )
    payload = {
        **state,
        "logTail": tail(log_text),
    }
    return tool_result(payload, is_error=process.returncode != 0)


def audit_project_memory(project_path: Path, expect_gate: str) -> dict[str, Any]:
    if not PROJECT_MEMORY_AUDIT_SCRIPT.is_file():
        raise ToolExecutionError(f"Project-memory verifier is missing: {PROJECT_MEMORY_AUDIT_SCRIPT}")
    if expect_gate not in {"any", "pass", "fail", "unknown"}:
        raise ToolExecutionError("expect_gate must be any, pass, fail, or unknown.")

    audit_dir = REPO_ROOT / "artifacts" / "phase9" / "project-memory-audit" / "mcp"
    audit_dir.mkdir(parents=True, exist_ok=True)
    project_id = hashlib.sha256(str(project_path).encode("utf-8")).hexdigest()[:12]
    report_path = audit_dir / f"{project_id}.json"
    process = subprocess.run(
        [
            "node",
            str(PROJECT_MEMORY_AUDIT_SCRIPT),
            "--project",
            str(project_path),
            "--expect-gate",
            expect_gate,
            "--out",
            str(report_path),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )
    if not report_path.is_file():
        detail = tail(f"{process.stdout}\n{process.stderr}".strip())
        raise ToolExecutionError(detail or "Project-memory audit did not produce a report.")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    payload = {
        **report,
        "ok": report.get("status") == "passed",
        "reportPath": str(report_path),
    }
    # A failed audit is actionable feedback, not a broken tool call. Returning
    # a normal result lets the builder repair the listed issues and audit again.
    return tool_result(payload)


def call_tool(name: str, arguments: Any) -> dict[str, Any]:
    args = arguments if isinstance(arguments, dict) else {}
    if name == "build_rom":
        project_path = resolve_project_path(args.get("project_path"))
        target = args.get("target", "all")
        if not isinstance(target, str):
            raise ToolExecutionError("target must be a string.")
        return run_sgdk(project_path, target, "build_rom")
    if name == "clean":
        project_path = resolve_project_path(args.get("project_path"))
        return run_sgdk(project_path, "clean", "clean")
    if name == "read_build_log":
        if not LOG_FILE.is_file():
            payload = {"ok": False, "logPath": str(LOG_FILE), "log": ""}
            return tool_result(payload, is_error=True)
        state: dict[str, Any] = {}
        if STATE_FILE.is_file():
            state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        payload = {**state, "log": LOG_FILE.read_text(encoding="utf-8")}
        return tool_result(payload, is_error=not bool(state.get("ok", True)))
    if name == "audit_project_memory":
        project_path = resolve_project_path(args.get("project_path"))
        expect_gate = args.get("expect_gate", "pass")
        if not isinstance(expect_gate, str):
            raise ToolExecutionError("expect_gate must be a string.")
        return audit_project_memory(project_path, expect_gate)
    raise KeyError(name)


def handle_request(message: dict[str, Any]) -> None:
    method = message.get("method")
    message_id = message.get("id")
    params = message.get("params") if isinstance(message.get("params"), dict) else {}

    if method == "notifications/initialized":
        return
    if message_id is None:
        return

    if method == "initialize":
        requested = params.get("protocolVersion")
        protocol = requested if requested in SUPPORTED_PROTOCOLS else PROTOCOL_VERSION
        respond(
            message_id,
            {
                "protocolVersion": protocol,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {
                    "name": "drive16-sgdk-build",
                    "title": "Drive16 SGDK Build",
                    "version": "0.1.0",
                },
                "instructions": "Builds repo-local SGDK projects through the pinned docker-sgdk script.",
            },
        )
        return
    if method == "ping":
        respond(message_id, {})
        return
    if method == "tools/list":
        respond(message_id, {"tools": TOOLS})
        return
    if method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        if not isinstance(tool_name, str):
            respond(message_id, error={"code": -32602, "message": "tools/call requires a tool name."})
            return
        try:
            respond(message_id, call_tool(tool_name, arguments))
        except KeyError:
            respond(message_id, error={"code": -32602, "message": f"Unknown tool: {tool_name}"})
        except ToolExecutionError as exc:
            respond(
                message_id,
                tool_result({"ok": False, "error": str(exc)}, is_error=True),
            )
        except subprocess.TimeoutExpired:
            respond(
                message_id,
                tool_result({"ok": False, "error": "SGDK build timed out."}, is_error=True),
            )
        return

    respond(message_id, error={"code": -32601, "message": f"Method not found: {method}"})


def main() -> int:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
            if isinstance(message, dict):
                handle_request(message)
        except Exception as exc:  # Keep protocol stdout clean and diagnostics on stderr.
            print(f"drive16-sgdk-build: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
