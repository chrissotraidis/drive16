#!/usr/bin/env python3
"""Validate the Drive16 comfyui-mcp wrapper handshake."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER = REPO_ROOT / "scripts" / "comfyui-mcp.sh"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "phase4" / "comfyui-mcp"
VALIDATION_FILE = ARTIFACT_DIR / "validation.json"
PROTOCOL_VERSION = "2025-11-25"


def read_json_lines(text: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            messages.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return messages


def require_response(messages: list[dict[str, Any]], message_id: int) -> dict[str, Any]:
    for message in messages:
        if message.get("id") == message_id:
            return message
    raise RuntimeError(f"Missing JSON-RPC response id {message_id}.")


def main() -> int:
    if not SERVER.is_file():
        raise RuntimeError(f"Missing wrapper script: {SERVER}")

    payload = "\n".join(
        [
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "initialize",
                    "params": {
                        "protocolVersion": PROTOCOL_VERSION,
                        "capabilities": {},
                        "clientInfo": {"name": "drive16-validator", "version": "0"},
                    },
                }
            ),
            json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
            json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}),
            "",
        ]
    )
    process = subprocess.run(
        [str(SERVER)],
        cwd=REPO_ROOT,
        input=payload,
        text=True,
        capture_output=True,
        timeout=180,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(
            f"comfyui-mcp wrapper exited {process.returncode}\nSTDOUT:\n{process.stdout}\nSTDERR:\n{process.stderr}"
        )

    messages = read_json_lines(process.stdout)
    initialize = require_response(messages, 1)
    tools = require_response(messages, 2)
    tool_names = [
        tool.get("name")
        for tool in tools.get("result", {}).get("tools", [])
        if isinstance(tool, dict)
    ]
    required_tools = {"generate_image", "enqueue_workflow", "get_system_stats"}
    missing = sorted(required_tools - set(tool_names))
    if missing:
        raise RuntimeError(f"comfyui-mcp wrapper did not expose tools: {missing}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    validation = {
        "ok": True,
        "server": str(SERVER.relative_to(REPO_ROOT)),
        "protocolVersion": initialize.get("result", {}).get("protocolVersion"),
        "toolCount": len(tool_names),
        "requiredTools": sorted(required_tools),
    }
    VALIDATION_FILE.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    print(
        "ComfyUI MCP wrapper ok: "
        f"{validation['toolCount']} tools, validation saved to {VALIDATION_FILE.relative_to(REPO_ROOT)}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
