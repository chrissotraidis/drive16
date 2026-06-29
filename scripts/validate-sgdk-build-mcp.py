#!/usr/bin/env python3
"""Smoke-test the Drive16 SGDK build MCP server over stdio."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER = REPO_ROOT / "mcp-servers" / "sgdk-build" / "server.py"
PROJECT = "examples/sgdk-hello-world"


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
        expected = {"build_rom", "clean", "read_build_log"}
        missing = expected - tool_names
        if missing:
            raise RuntimeError(f"Missing tools: {sorted(missing)}")

        tool_call(process, 3, "clean", {"project_path": PROJECT})
        build = tool_call(process, 4, "build_rom", {"project_path": PROJECT})
        rom_path = Path(build["romPath"])
        if not rom_path.is_file():
            raise RuntimeError(f"ROM was not created: {rom_path}")

        log = tool_call(process, 5, "read_build_log")
        if "Built ROM:" not in log["log"]:
            raise RuntimeError("Latest build log did not include the ROM success line.")

        print(f"SGDK build MCP ok: {rom_path}")
        return 0
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
