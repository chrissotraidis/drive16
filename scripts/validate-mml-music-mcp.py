#!/usr/bin/env python3
"""Validate the Drive16 MML music MCP server."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER = REPO_ROOT / "mcp-servers" / "mml-music" / "server.py"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "phase4" / "mml-music"
VALIDATION_FILE = ARTIFACT_DIR / "validation.json"
PROTOCOL_VERSION = "2025-11-25"
SAMPLE_MML = """#title Drive16 Tiny
#platform megadrive
A t120 @0 v12 o4 l8 cdefgab>c L c4 r4
"""


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


def structured_payload(response: dict[str, Any]) -> dict[str, Any]:
    result = response.get("result")
    if not isinstance(result, dict):
        raise RuntimeError(f"Response has no result: {response}")
    payload = result.get("structuredContent")
    if not isinstance(payload, dict):
        raise RuntimeError(f"Response has no structuredContent: {response}")
    return payload


def main() -> int:
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
                        "clientInfo": {"name": "drive16-mml-validator", "version": "0"},
                    },
                }
            ),
            json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
            json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}),
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 3,
                    "method": "tools/call",
                    "params": {
                        "name": "compile_music",
                        "arguments": {
                            "mml_text": SAMPLE_MML,
                            "symbol": "drive16_generated_music",
                        },
                    },
                }
            ),
            "",
        ]
    )
    process = subprocess.run(
        [sys.executable, str(SERVER)],
        cwd=REPO_ROOT,
        input=payload,
        text=True,
        capture_output=True,
        timeout=420,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(
            f"MML MCP server exited {process.returncode}\nSTDOUT:\n{process.stdout}\nSTDERR:\n{process.stderr}"
        )
    messages = read_json_lines(process.stdout)
    tools = require_response(messages, 2)
    tool_names = {
        tool.get("name")
        for tool in tools.get("result", {}).get("tools", [])
        if isinstance(tool, dict)
    }
    required_tools = {"compile_music", "read_music_state"}
    missing = sorted(required_tools - tool_names)
    if missing:
        raise RuntimeError(f"MML MCP server missing tools: {missing}")

    compile_response = require_response(messages, 3)
    if compile_response.get("result", {}).get("isError"):
        raise RuntimeError(f"compile_music returned error: {compile_response}")
    compile_payload = structured_payload(compile_response)
    if compile_payload.get("ok") is not True:
        raise RuntimeError(f"compile_music did not succeed: {compile_payload}")
    vgm_path = compile_payload.get("vgmPath")
    if not isinstance(vgm_path, str) or not Path(vgm_path).is_file():
        raise RuntimeError(f"compile_music did not write a VGM file: {vgm_path}")
    vgm = compile_payload.get("vgm")
    if not isinstance(vgm, dict) or vgm.get("size", 0) <= 0:
        raise RuntimeError(f"compile_music returned invalid VGM metadata: {compile_payload}")
    if "XGM drive16_generated_music" not in str(compile_payload.get("rescomp", "")):
        raise RuntimeError(f"compile_music did not return the SGDK XGM resource line: {compile_payload}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    validation = {
        "ok": True,
        "server": str(SERVER.relative_to(REPO_ROOT)),
        "requiredTools": sorted(required_tools),
        "vgmPath": vgm_path,
        "vgm": vgm,
        "rescomp": compile_payload.get("rescomp"),
    }
    VALIDATION_FILE.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    print(
        "MML music MCP ok: "
        f"{vgm['size']} byte VGM, validation saved to {VALIDATION_FILE.relative_to(REPO_ROOT)}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
