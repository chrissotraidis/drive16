#!/usr/bin/env python3
"""Smoke-test emulator MCP audio capture with the Phase 2 asset ROM."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER = REPO_ROOT / "mcp-servers" / "emulator" / "server.py"
ROM = REPO_ROOT / "examples" / "phase2-core-assets" / "out" / "rom.bin"


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
    subprocess.run(["scripts/validate-core-assets.py"], cwd=REPO_ROOT, check=True)
    if not ROM.is_file():
        subprocess.run(["scripts/build-sgdk.sh", "examples/phase2-core-assets"], cwd=REPO_ROOT, check=True)

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
                "clientInfo": {"name": "drive16-audio-validator", "version": "0.1.0"},
            },
        )
        assert init["capabilities"]["tools"]["listChanged"] is False
        send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        tools = call(process, 2, "tools/list")["tools"]
        tool_names = {tool["name"] for tool in tools}
        expected = {"run_rom", "capture_frame", "capture_audio", "send_input", "read_state"}
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
                "rom_path": "examples/phase2-core-assets/out/rom.bin",
                "frames": 180,
                "use_input_script": True,
                "stream_frames": False,
                "dump_audio": True,
            },
        )
        if not run.get("audioDumpPath"):
            raise RuntimeError("run_rom did not record an audio dump path.")

        frame = tool_call(process, 5, "capture_frame")
        if frame["mimeType"] != "image/png":
            raise RuntimeError("capture_frame did not return PNG metadata.")

        audio = tool_call(process, 6, "capture_audio")
        if audio["mimeType"] != "audio/wav" or audio["maxAbsSample"] <= 0:
            raise RuntimeError(f"capture_audio did not prove non-silent WAV output: {audio}")

        state = tool_call(process, 7, "read_state")
        if not state["ok"] or not state.get("audioDumpPath"):
            raise RuntimeError("read_state did not report a successful audio-backed run.")

        print(f"Emulator audio MCP ok: {audio['audioDumpPath']} max_abs={audio['maxAbsSample']}")
        return 0
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
