#!/usr/bin/env python3
"""Drive16 Genteel emulator MCP server."""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOLS = {PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05"}
REPO_ROOT = Path(__file__).resolve().parents[2]
BUILD_GENTEEL = REPO_ROOT / "scripts" / "build-genteel.sh"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "phase1" / "emulator"
LOG_FILE = ARTIFACT_DIR / "last-run.log"
STATE_FILE = ARTIFACT_DIR / "state.json"
SCREENSHOT_FILE = ARTIFACT_DIR / "last-frame.png"
FRAME_STREAM_FILE = ARTIFACT_DIR / "last-frames.rgb565"
INPUT_SCRIPT_FILE = ARTIFACT_DIR / "input-script.csv"

BUTTON_ORDER = [
    ("up", "U"),
    ("down", "D"),
    ("left", "L"),
    ("right", "R"),
    ("a", "A"),
    ("b", "B"),
    ("c", "C"),
    ("start", "S"),
    ("x", "X"),
    ("y", "Y"),
    ("z", "Z"),
    ("mode", "M"),
]
BUTTON_ALIASES = {
    "u": "up",
    "up": "up",
    "d": "down",
    "down": "down",
    "l": "left",
    "left": "left",
    "r": "right",
    "right": "right",
    "a": "a",
    "b": "b",
    "c": "c",
    "s": "start",
    "start": "start",
    "x": "x",
    "y": "y",
    "z": "z",
    "m": "mode",
    "mode": "mode",
}


class ToolExecutionError(Exception):
    pass


TOOLS: list[dict[str, Any]] = [
    {
        "name": "run_rom",
        "title": "Run ROM",
        "description": "Run a Genesis ROM through the Genteel sidecar in headless mode.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "rom_path": {
                    "type": "string",
                    "description": "Repo-relative ROM path.",
                },
                "frames": {
                    "type": "integer",
                    "description": "Number of frames to run. Defaults to 180.",
                    "default": 180,
                    "minimum": 1,
                    "maximum": 20000,
                },
                "use_input_script": {
                    "type": "boolean",
                    "description": "Use the pending input script from send_input.",
                    "default": True,
                },
                "stream_frames": {
                    "type": "boolean",
                    "description": "Also write a raw RGB565 frame stream.",
                    "default": True,
                },
                "stream_every": {
                    "type": "integer",
                    "description": "When streaming, write one frame every N frames.",
                    "default": 30,
                    "minimum": 1,
                    "maximum": 600,
                },
            },
            "required": ["rom_path"],
            "additionalProperties": False,
        },
    },
    {
        "name": "capture_frame",
        "title": "Capture Frame",
        "description": "Return the latest PNG frame captured by run_rom.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "send_input",
        "title": "Send Input",
        "description": "Write a sparse Genteel input-script event for the next run_rom call.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "frame": {
                    "type": "integer",
                    "description": "Frame number for this input event.",
                    "minimum": 0,
                },
                "p1_buttons": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Player 1 buttons held at this frame.",
                    "default": [],
                },
                "p2_buttons": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Player 2 buttons held at this frame.",
                    "default": [],
                },
                "reset": {
                    "type": "boolean",
                    "description": "Clear the pending input script before writing this event.",
                    "default": False,
                },
            },
            "required": ["frame"],
            "additionalProperties": False,
        },
    },
    {
        "name": "read_state",
        "title": "Read Emulator State",
        "description": "Return the latest emulator run state and log tail.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
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


def tool_result(
    payload: dict[str, Any],
    is_error: bool = False,
    content: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "content": content or [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def tail(text: str, max_chars: int = 6000) -> str:
    return text if len(text) <= max_chars else text[-max_chars:]


def resolve_repo_file(value: Any, label: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ToolExecutionError(f"{label} must be a non-empty string.")
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    path = candidate.resolve()
    try:
        path.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise ToolExecutionError(f"{label} must be inside the Drive16 repository.") from exc
    if not path.is_file():
        raise ToolExecutionError(f"{label} does not exist: {path}")
    return path


def bounded_int(value: Any, name: str, default: int, minimum: int, maximum: int) -> int:
    if value is None:
        return default
    if not isinstance(value, int):
        raise ToolExecutionError(f"{name} must be an integer.")
    if value < minimum or value > maximum:
        raise ToolExecutionError(f"{name} must be between {minimum} and {maximum}.")
    return value


def bool_arg(value: Any, name: str, default: bool) -> bool:
    if value is None:
        return default
    if not isinstance(value, bool):
        raise ToolExecutionError(f"{name} must be a boolean.")
    return value


def get_genteel_bin() -> tuple[Path, str]:
    env_bin = os.environ.get("GENTEEL_BIN")
    if env_bin:
        found = shutil.which(env_bin) if not Path(env_bin).is_absolute() else env_bin
        if found and Path(found).is_file():
            return Path(found), ""
        raise ToolExecutionError(f"Genteel binary was not found: {env_bin}")

    if not BUILD_GENTEEL.is_file():
        raise ToolExecutionError(f"Genteel build script is missing: {BUILD_GENTEEL}")

    process = subprocess.run(
        [str(BUILD_GENTEEL)],
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
        raise ToolExecutionError(f"Genteel build failed:\n{tail(combined)}")

    path_text = process.stdout.strip().splitlines()[-1] if process.stdout.strip() else ""
    if not path_text:
        raise ToolExecutionError("Genteel build did not print a binary path.")
    genteel_path = Path(path_text).resolve()
    if not genteel_path.is_file():
        raise ToolExecutionError(f"Genteel binary was not created: {genteel_path}")
    return genteel_path, combined


def button_string(buttons_value: Any) -> str:
    buttons = buttons_value if isinstance(buttons_value, list) else []
    normalized: set[str] = set()
    for raw in buttons:
        if not isinstance(raw, str):
            raise ToolExecutionError("button names must be strings.")
        key = raw.strip().lower()
        if key not in BUTTON_ALIASES:
            valid = ", ".join(sorted(set(BUTTON_ALIASES.values())))
            raise ToolExecutionError(f"unknown button '{raw}'. Valid buttons: {valid}")
        normalized.add(BUTTON_ALIASES[key])
    return "".join(letter if name in normalized else "." for name, letter in BUTTON_ORDER)


def read_input_events() -> dict[int, tuple[str, str]]:
    events: dict[int, tuple[str, str]] = {}
    if not INPUT_SCRIPT_FILE.is_file():
        return events
    for line in INPUT_SCRIPT_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 2:
            continue
        try:
            frame = int(parts[0])
        except ValueError:
            continue
        p1 = parts[1] if len(parts) > 1 else "............"
        p2 = parts[2] if len(parts) > 2 else "............"
        events[frame] = (p1, p2)
    return events


def write_input_events(events: dict[int, tuple[str, str]]) -> str:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["# frame,p1_buttons,p2_buttons"]
    for frame in sorted(events):
        p1, p2 = events[frame]
        lines.append(f"{frame},{p1},{p2}")
    script_text = "\n".join(lines) + "\n"
    INPUT_SCRIPT_FILE.write_text(script_text, encoding="utf-8")
    return script_text


def write_state(state: dict[str, Any], log_text: str) -> dict[str, Any]:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(log_text, encoding="utf-8")
    full_state = {
        **state,
        "logPath": str(LOG_FILE),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    STATE_FILE.write_text(json.dumps(full_state, indent=2) + "\n", encoding="utf-8")
    return full_state


def run_rom(args: dict[str, Any]) -> dict[str, Any]:
    rom_path = resolve_repo_file(args.get("rom_path"), "rom_path")
    frames = bounded_int(args.get("frames"), "frames", 180, 1, 20000)
    use_input_script = bool_arg(args.get("use_input_script"), "use_input_script", True)
    stream_frames = bool_arg(args.get("stream_frames"), "stream_frames", True)
    stream_every = bounded_int(args.get("stream_every"), "stream_every", 30, 1, 600)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    for path in (SCREENSHOT_FILE, FRAME_STREAM_FILE):
        if path.exists():
            path.unlink()

    genteel_bin, build_log = get_genteel_bin()
    command = [str(genteel_bin)]
    input_script_used = False
    if use_input_script and INPUT_SCRIPT_FILE.is_file():
        command.extend(["--script", str(INPUT_SCRIPT_FILE)])
        input_script_used = True
    command.extend(["--headless", str(frames)])
    if stream_frames:
        command.extend(["--stream-frames", str(FRAME_STREAM_FILE), "--stream-every", str(stream_every)])
    command.extend(["--screenshot", str(SCREENSHOT_FILE), str(rom_path)])

    process = subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=max(60, min(420, frames // 30 + 60)),
        check=False,
    )
    log_text = ""
    if build_log:
        log_text += f"[build-genteel]\n{build_log}\n"
    log_text += f"[command]\n{' '.join(command)}\n"
    if process.stdout:
        log_text += f"[stdout]\n{process.stdout}\n"
    if process.stderr:
        log_text += f"[stderr]\n{process.stderr}\n"

    ok = process.returncode == 0 and SCREENSHOT_FILE.is_file()
    state = write_state(
        {
            "action": "run_rom",
            "ok": ok,
            "exitCode": process.returncode,
            "romPath": str(rom_path),
            "frames": frames,
            "genteelPath": str(genteel_bin),
            "inputScriptPath": str(INPUT_SCRIPT_FILE) if input_script_used else None,
            "screenshotPath": str(SCREENSHOT_FILE) if SCREENSHOT_FILE.is_file() else None,
            "frameStreamPath": str(FRAME_STREAM_FILE) if FRAME_STREAM_FILE.is_file() else None,
            "streamEvery": stream_every if stream_frames else None,
        },
        log_text,
    )
    payload = {**state, "logTail": tail(log_text)}
    return tool_result(payload, is_error=not ok)


def capture_frame() -> dict[str, Any]:
    if not SCREENSHOT_FILE.is_file():
        payload = {"ok": False, "error": "No captured frame is available. Run run_rom first."}
        return tool_result(payload, is_error=True)
    image_data = base64.b64encode(SCREENSHOT_FILE.read_bytes()).decode("ascii")
    payload = {
        "ok": True,
        "screenshotPath": str(SCREENSHOT_FILE),
        "mimeType": "image/png",
        "bytes": SCREENSHOT_FILE.stat().st_size,
    }
    return tool_result(
        payload,
        content=[
            {"type": "text", "text": json.dumps(payload, indent=2)},
            {"type": "image", "data": image_data, "mimeType": "image/png"},
        ],
    )


def send_input(args: dict[str, Any]) -> dict[str, Any]:
    frame = bounded_int(args.get("frame"), "frame", 0, 0, 20000)
    reset = bool_arg(args.get("reset"), "reset", False)
    events = {} if reset else read_input_events()
    events[frame] = (
        button_string(args.get("p1_buttons", [])),
        button_string(args.get("p2_buttons", [])),
    )
    script_text = write_input_events(events)
    payload = {
        "ok": True,
        "inputScriptPath": str(INPUT_SCRIPT_FILE),
        "events": len(events),
        "script": script_text,
    }
    return tool_result(payload)


def read_state() -> dict[str, Any]:
    state: dict[str, Any] = {}
    if STATE_FILE.is_file():
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    log_text = LOG_FILE.read_text(encoding="utf-8") if LOG_FILE.is_file() else ""
    payload = {
        "ok": bool(state.get("ok", False)),
        **state,
        "inputScriptPath": str(INPUT_SCRIPT_FILE) if INPUT_SCRIPT_FILE.is_file() else None,
        "logTail": tail(log_text),
    }
    return tool_result(payload, is_error=not bool(payload.get("ok")))


def call_tool(name: str, arguments: Any) -> dict[str, Any]:
    args = arguments if isinstance(arguments, dict) else {}
    if name == "run_rom":
        return run_rom(args)
    if name == "capture_frame":
        return capture_frame()
    if name == "send_input":
        return send_input(args)
    if name == "read_state":
        return read_state()
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
                    "name": "drive16-emulator",
                    "title": "Drive16 Emulator",
                    "version": "0.1.0",
                },
                "instructions": "Runs repo-local ROMs through the pinned Genteel sidecar.",
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
            respond(message_id, tool_result({"ok": False, "error": "Genteel run timed out."}, is_error=True))
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
        except Exception as exc:
            print(f"drive16-emulator: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
