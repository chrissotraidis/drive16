#!/usr/bin/env python3
"""Smoke-test the Drive16 emulator MCP server over stdio."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER = REPO_ROOT / "mcp-servers" / "emulator" / "server.py"
ROM = REPO_ROOT / "examples" / "sgdk-hello-world" / "out" / "rom.bin"


def send(process: subprocess.Popen[str], message: dict[str, Any]) -> None:
    assert process.stdin is not None
    process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
    process.stdin.flush()


def receive(process: subprocess.Popen[str]) -> dict[str, Any]:
    assert process.stdout is not None
    line = process.stdout.readline()
    if not line:
        stderr = process.stderr.read() if process.stderr else ""
        raise RuntimeError(f"MCP server exited early. stderr:\n{stderr}")
    return json.loads(line)


def call(process: subprocess.Popen[str], message_id: int, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": message_id, "method": method}
    if params is not None:
        message["params"] = params
    send(process, message)
    response = receive(process)
    if "error" in response:
        raise RuntimeError(f"{method} failed: {response['error']}")
    return response["result"]


def tool_call(process: subprocess.Popen[str], message_id: int, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
    result = call(
        process,
        message_id,
        "tools/call",
        {"name": name, "arguments": arguments or {}},
    )
    text = result["content"][0]["text"]
    payload = json.loads(text)
    if result.get("isError"):
        raise RuntimeError(f"{name} returned an error:\n{text}")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rom", type=Path, default=ROM)
    parser.add_argument("--verify-screen", action="store_true")
    args = parser.parse_args()
    rom = args.rom.resolve()
    try:
        rom_path = str(rom.relative_to(REPO_ROOT))
    except ValueError as error:
        raise RuntimeError("Emulator verification requires a repo-local ROM.") from error

    if rom == ROM and not ROM.is_file():
        subprocess.run(
            ["scripts/build-sgdk.sh", "examples/sgdk-hello-world"],
            cwd=REPO_ROOT,
            check=True,
        )
    elif not rom.is_file():
        raise RuntimeError(f"ROM is missing: {rom}")

    process = subprocess.Popen(
        [sys.executable, str(SERVER)],
        cwd=REPO_ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        init = call(
            process,
            1,
            "initialize",
            {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "drive16-validator", "version": "0.1.0"},
            },
        )
        assert init["capabilities"]["tools"]["listChanged"] is False
        send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        tools = call(process, 2, "tools/list")["tools"]
        tool_names = {tool["name"] for tool in tools}
        expected = {
            "run_rom",
            "capture_frame",
            "verify_screen",
            "capture_audio",
            "verify_audio",
            "send_input",
            "read_state",
        }
        missing = expected - tool_names
        if missing:
            raise RuntimeError(f"Missing tools: {sorted(missing)}")

        tool_call(
            process,
            3,
            "send_input",
            {"frame": 0, "p1_buttons": ["right"], "reset": True},
        )
        run = tool_call(
            process,
            4,
            "run_rom",
            {
                "rom_path": rom_path,
                "frames": 180 if args.verify_screen else 90,
                "stream_frames": True,
                "stream_every": 30,
            },
        )

        screenshot = Path(run["screenshotPath"])
        if screenshot.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError(f"Screenshot is not a PNG: {screenshot}")

        stream_path = Path(run["frameStreamPath"])
        subprocess.run(
            ["scripts/validate-frame-stream.py", str(stream_path), "--min-frames", "3"],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )

        frame = tool_call(process, 5, "capture_frame")
        if frame["mimeType"] != "image/png":
            raise RuntimeError("capture_frame did not return PNG metadata.")

        state = tool_call(process, 6, "read_state")
        if not state["ok"]:
            raise RuntimeError("read_state did not report a successful latest run.")

        if args.verify_screen:
            verified = tool_call(
                process,
                7,
                "verify_screen",
                {"rom_path": rom_path, "frames": 180},
            )
            if not verified.get("ok"):
                raise RuntimeError(f"verify_screen did not accept the ROM: {verified}")

        print(f"Emulator MCP ok: {screenshot}")
        return 0
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
