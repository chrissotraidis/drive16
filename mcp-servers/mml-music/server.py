#!/usr/bin/env python3
"""Drive16 MML music MCP server backed by ctrmml."""

from __future__ import annotations

import json
import re
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOLS = {PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05"}
REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_CTRMML = REPO_ROOT / "scripts" / "build-ctrmml.sh"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "phase4" / "mml-music"
LOG_FILE = ARTIFACT_DIR / "last-compile.log"
STATE_FILE = ARTIFACT_DIR / "state.json"
LAST_MML = ARTIFACT_DIR / "last.mml"
LAST_VGM = ARTIFACT_DIR / "last.vgm"


class ToolExecutionError(Exception):
    pass


TOOLS: list[dict[str, Any]] = [
    {
        "name": "compile_music",
        "title": "Compile MML Music",
        "description": "Compile MML text to a VGM file with ctrmml for SGDK XGM resources.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "mml_text": {
                    "type": "string",
                    "description": "Complete ctrmml MML text. Include #platform megadrive.",
                },
                "symbol": {
                    "type": "string",
                    "description": "SGDK XGM resource symbol to report.",
                    "default": "drive16_generated_music",
                },
                "optimize": {
                    "type": "boolean",
                    "description": "Pass --optimize to ctrmml.",
                    "default": False,
                },
            },
            "required": ["mml_text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "read_music_state",
        "title": "Read MML Music State",
        "description": "Return the latest MML compile state and log.",
        "inputSchema": {"type": "object", "additionalProperties": False},
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


def tool_result(payload: dict[str, Any], is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def tail(text: str, max_chars: int = 6000) -> str:
    return text if len(text) <= max_chars else text[-max_chars:]


def symbol_arg(value: Any) -> str:
    symbol = value if isinstance(value, str) and value else "drive16_generated_music"
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,63}", symbol):
        raise ToolExecutionError("symbol must be a C identifier up to 64 characters.")
    return symbol


def mml_text_arg(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ToolExecutionError("mml_text must be a non-empty string.")
    if len(value.encode("utf-8")) > 64 * 1024:
        raise ToolExecutionError("mml_text must be at most 64 KiB.")
    if "#platform" not in value.lower():
        raise ToolExecutionError("mml_text must include #platform megadrive.")
    if "megadrive" not in value.lower():
        raise ToolExecutionError("mml_text must target #platform megadrive.")
    return value if value.endswith("\n") else value + "\n"


def build_ctrmml() -> tuple[Path, str]:
    if not BUILD_CTRMML.is_file():
        raise ToolExecutionError(f"ctrmml build script is missing: {BUILD_CTRMML}")
    process = subprocess.run(
        [str(BUILD_CTRMML)],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=300,
        check=False,
    )
    combined = process.stdout
    if process.stderr:
        combined = f"{combined}\n{process.stderr}" if combined else process.stderr
    if process.returncode != 0:
        raise ToolExecutionError(f"ctrmml build failed:\n{tail(combined)}")
    path_text = process.stdout.strip().splitlines()[-1] if process.stdout.strip() else ""
    if not path_text:
        raise ToolExecutionError("ctrmml build script did not print a compiler path.")
    compiler = Path(path_text).resolve()
    if not compiler.is_file():
        raise ToolExecutionError(f"ctrmml compiler was not created: {compiler}")
    return compiler, combined


def validate_vgm(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 0x40 or data[:4] != b"Vgm ":
        raise ToolExecutionError(f"ctrmml output is not a VGM file: {path}")
    version = struct.unpack_from("<I", data, 0x08)[0]
    ym2612_clock = struct.unpack_from("<I", data, 0x2C)[0] if len(data) >= 0x30 else 0
    loop_offset = struct.unpack_from("<I", data, 0x1C)[0]
    loop_samples = struct.unpack_from("<I", data, 0x20)[0]
    if version < 0x00000150:
        raise ToolExecutionError(f"VGM version is below 1.50: 0x{version:08x}")
    if ym2612_clock == 0:
        raise ToolExecutionError("VGM does not declare a YM2612 clock.")
    return {
        "size": len(data),
        "version": f"0x{version:08x}",
        "ym2612Clock": ym2612_clock,
        "loopOffset": loop_offset,
        "loopSamples": loop_samples,
        "hasLoop": loop_offset != 0 and loop_samples != 0,
    }


def write_state(payload: dict[str, Any], log_text: str) -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(log_text, encoding="utf-8")
    STATE_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def compile_music(args: dict[str, Any]) -> dict[str, Any]:
    mml_text = mml_text_arg(args.get("mml_text"))
    symbol = symbol_arg(args.get("symbol"))
    optimize = bool(args.get("optimize", False))

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    LAST_MML.write_text(mml_text, encoding="utf-8")
    if LAST_VGM.exists():
        LAST_VGM.unlink()

    compiler, build_log = build_ctrmml()
    command = [str(compiler), "--output", str(LAST_VGM), "--format", "vgm"]
    if optimize:
        command.append("--optimize")
    command.append(str(LAST_MML))

    process = subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=120,
        check=False,
    )
    compile_log = process.stdout
    if process.stderr:
        compile_log = f"{compile_log}\n{process.stderr}" if compile_log else process.stderr
    log_text = build_log
    if compile_log:
        log_text = f"{log_text}\n{compile_log}" if log_text else compile_log

    ok = process.returncode == 0 and LAST_VGM.is_file()
    payload: dict[str, Any] = {
        "ok": ok,
        "compiler": str(compiler),
        "mmlPath": str(LAST_MML),
        "vgmPath": str(LAST_VGM) if LAST_VGM.is_file() else None,
        "logPath": str(LOG_FILE),
        "exitCode": process.returncode,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "rescomp": f'XGM {symbol} "{LAST_VGM}"',
        "logTail": tail(log_text),
    }
    if ok:
        payload["vgm"] = validate_vgm(LAST_VGM)
    write_state(payload, log_text)
    return tool_result(payload, is_error=not ok)


def read_music_state() -> dict[str, Any]:
    if not STATE_FILE.is_file():
        return tool_result({"ok": False, "logPath": str(LOG_FILE), "log": ""}, is_error=True)
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    log_text = LOG_FILE.read_text(encoding="utf-8") if LOG_FILE.is_file() else ""
    return tool_result({**state, "log": log_text}, is_error=not bool(state.get("ok")))


def call_tool(name: str, arguments: Any) -> dict[str, Any]:
    args = arguments if isinstance(arguments, dict) else {}
    if name == "compile_music":
        return compile_music(args)
    if name == "read_music_state":
        return read_music_state()
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
                    "name": "drive16-mml-music",
                    "title": "Drive16 MML Music",
                    "version": "0.1.0",
                },
                "instructions": "Compiles Megadrive MML to VGM through ctrmml as a Phase 4 enhancement.",
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
            respond(message_id, tool_result({"ok": False, "error": str(exc)}, is_error=True))
        except subprocess.TimeoutExpired:
            respond(message_id, tool_result({"ok": False, "error": "MML compile timed out."}, is_error=True))
        return

    respond(message_id, error={"code": -32601, "message": f"Method not found: {method}"})


def main() -> int:
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            message = json.loads(line)
            if isinstance(message, dict):
                handle_request(message)
        except json.JSONDecodeError:
            continue
        except Exception as exc:  # noqa: BLE001
            message_id = message.get("id") if isinstance(message, dict) else None
            if message_id is not None:
                respond(message_id, error={"code": -32603, "message": str(exc)})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
