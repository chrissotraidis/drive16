#!/usr/bin/env python3
"""Drive16 ComfyUI sprite MCP server.

A deliberately small surface over the tuned Genesis sprite workflow. The
generic comfyui-mcp package exposes 113 tools (~30k prompt tokens per agent
step); the builder needs exactly three: generate a sprite, check readiness,
and read the last result. The heavy lifting stays in
scripts/run-comfyui-sprite-workflow.py, which already enqueues, polls,
downloads, validates, and repairs.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOLS = {PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05"}
REPO_ROOT = Path(__file__).resolve().parents[2]
SPRITE_RUNNER = REPO_ROOT / "scripts" / "run-comfyui-sprite-workflow.py"
READINESS_SCRIPT = REPO_ROOT / "scripts" / "check-phase4-comfyui-readiness.py"
RUN_LOG = REPO_ROOT / "artifacts" / "phase4" / "live-comfyui-sprite" / "last-run.json"
READINESS_REPORT = REPO_ROOT / "artifacts" / "phase4" / "comfyui-readiness" / "latest.json"

SYMBOL_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
MAX_PROMPT_CHARS = 300


class ToolExecutionError(Exception):
    pass


TOOLS: list[dict[str, Any]] = [
    {
        "name": "generate_sprite",
        "title": "Generate Genesis Sprite",
        "description": (
            "Generate one Genesis-safe 32x32 16-color sprite PNG from a short subject "
            "prompt through the local ComfyUI pipeline, validated for SGDK use. "
            "Takes about two minutes per sprite."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Sprite subject, e.g. 'a small green alien spaceship'.",
                },
                "symbol": {
                    "type": "string",
                    "description": "SGDK resource symbol (C identifier) for the sprite.",
                },
                "timeout_seconds": {
                    "type": "integer",
                    "description": "Generation wait budget. Defaults to 600.",
                    "default": 600,
                },
            },
            "required": ["prompt", "symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "comfyui_status",
        "title": "Check ComfyUI Readiness",
        "description": (
            "Check that local ComfyUI is reachable with the SDXL checkpoint, Pixel Art "
            "XL LoRA, and quantizer node needed for sprite generation."
        ),
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
        },
    },
    {
        "name": "read_sprite_state",
        "title": "Read Last Sprite Result",
        "description": "Return the result of the most recent sprite generation run.",
        "inputSchema": {
            "type": "object",
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


def tail(text: str, max_chars: int = 4000) -> str:
    return text if len(text) <= max_chars else text[-max_chars:]


def tool_result(payload: dict[str, Any], is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def read_run_log() -> dict[str, Any]:
    if not RUN_LOG.is_file():
        return {}
    try:
        parsed = json.loads(RUN_LOG.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def generate_sprite(prompt: str, symbol: str, timeout_seconds: int) -> dict[str, Any]:
    if not SPRITE_RUNNER.is_file():
        raise ToolExecutionError(f"Sprite runner is missing: {SPRITE_RUNNER}")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ToolExecutionError("prompt must be a non-empty string.")
    if len(prompt) > MAX_PROMPT_CHARS:
        raise ToolExecutionError(f"prompt must be at most {MAX_PROMPT_CHARS} characters.")
    if not isinstance(symbol, str) or not SYMBOL_PATTERN.match(symbol):
        raise ToolExecutionError("symbol must be a C identifier of at most 64 characters.")
    if not isinstance(timeout_seconds, int) or not 60 <= timeout_seconds <= 1800:
        raise ToolExecutionError("timeout_seconds must be an integer between 60 and 1800.")

    process = subprocess.run(
        [
            sys.executable,
            str(SPRITE_RUNNER),
            "--prompt",
            prompt.strip(),
            "--symbol",
            symbol,
            "--timeout",
            str(timeout_seconds),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=timeout_seconds + 180,
        env=os.environ.copy(),
        check=False,
    )
    run_log = read_run_log()
    output = process.stdout
    if process.stderr:
        output = f"{output}\n{process.stderr}" if output else process.stderr

    if process.returncode == 2:
        payload = {
            "ok": False,
            "error": (
                "ComfyUI is not ready for sprite generation. Start it with "
                "scripts/launch-phase4-comfyui-api.sh (or Settings -> AI sprites -> Launch), "
                "then retry. Do not claim generated sprites were used."
            ),
            "readinessReport": str(READINESS_REPORT),
            "detail": tail(output),
        }
        return tool_result(payload, is_error=True)
    if process.returncode != 0:
        payload = {
            "ok": False,
            "error": "Sprite generation failed.",
            "detail": tail(output),
            "runLog": run_log,
        }
        return tool_result(payload, is_error=True)

    payload = {
        "ok": True,
        "spritePng": run_log.get("downloadedPng"),
        "rawPng": run_log.get("rawPng"),
        "symbol": symbol,
        "resourceLine": (
            f'SPRITE {symbol} "{run_log.get("downloadedPng")}" 4 4 NONE 0'
            if run_log.get("downloadedPng")
            else None
        ),
        "validatorOutput": run_log.get("validatorOutput"),
        "detail": tail(output),
    }
    return tool_result(payload)


def comfyui_status() -> dict[str, Any]:
    if not READINESS_SCRIPT.is_file():
        raise ToolExecutionError(f"Readiness script is missing: {READINESS_SCRIPT}")
    process = subprocess.run(
        [sys.executable, str(READINESS_SCRIPT)],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=120,
        env=os.environ.copy(),
        check=False,
    )
    report: dict[str, Any] = {}
    if READINESS_REPORT.is_file():
        try:
            parsed = json.loads(READINESS_REPORT.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                report = parsed
        except json.JSONDecodeError:
            report = {}
    output = process.stdout
    if process.stderr:
        output = f"{output}\n{process.stderr}" if output else process.stderr
    payload = {
        "ok": process.returncode == 0,
        "report": report,
        "reportPath": str(READINESS_REPORT),
        "detail": tail(output),
    }
    if process.returncode != 0:
        payload["error"] = (
            "ComfyUI readiness failed. Start local ComfyUI with "
            "scripts/launch-phase4-comfyui-api.sh and install models with "
            "scripts/install-phase4-comfyui-models.sh, then retry."
        )
    return tool_result(payload, is_error=process.returncode != 0)


def read_sprite_state() -> dict[str, Any]:
    run_log = read_run_log()
    if not run_log:
        return tool_result(
            {"ok": False, "error": "No sprite generation has run yet.", "runLogPath": str(RUN_LOG)},
            is_error=True,
        )
    return tool_result({"ok": bool(run_log.get("ok")), "runLogPath": str(RUN_LOG), **run_log})


def call_tool(name: str, arguments: Any) -> dict[str, Any]:
    args = arguments if isinstance(arguments, dict) else {}
    if name == "generate_sprite":
        timeout_seconds = args.get("timeout_seconds", 600)
        return generate_sprite(args.get("prompt"), args.get("symbol"), timeout_seconds)
    if name == "comfyui_status":
        return comfyui_status()
    if name == "read_sprite_state":
        return read_sprite_state()
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
                    "name": "drive16-comfyui",
                    "title": "Drive16 ComfyUI Sprites",
                    "version": "0.1.0",
                },
                "instructions": (
                    "Generates one validated Genesis-safe 32x32 sprite per call through "
                    "the tuned local ComfyUI workflow."
                ),
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
                tool_result(
                    {
                        "ok": False,
                        "error": (
                            "Sprite generation timed out. ComfyUI may still be rendering; "
                            "check read_sprite_state before retrying."
                        ),
                    },
                    is_error=True,
                ),
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
            print(f"drive16-comfyui: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
