#!/usr/bin/env python3
"""Validate the Drive16 OpenCode project configuration."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_MCP = {
    "drive16-sgdk-build",
    "drive16-emulator",
    "drive16-rag",
    "drive16-comfyui",
    "drive16-mml-music",
}


def run(command: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
    )


def require_ok(result: subprocess.CompletedProcess[str], label: str) -> str:
    if result.returncode != 0:
        raise RuntimeError(
            f"{label} failed with exit {result.returncode}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result.stdout


def resolved_config() -> dict[str, Any]:
    output = require_ok(run(["opencode", "debug", "config"]), "opencode debug config")
    return json.loads(output)


def validate_mcp_config(config: dict[str, Any]) -> None:
    mcp = config.get("mcp")
    if not isinstance(mcp, dict):
        raise RuntimeError("Resolved OpenCode config has no mcp object.")
    missing = EXPECTED_MCP - set(mcp)
    if missing:
        raise RuntimeError(f"Resolved OpenCode config is missing MCP servers: {sorted(missing)}")
    for name in EXPECTED_MCP:
        server = mcp[name]
        if server.get("type") != "local":
            raise RuntimeError(f"{name} must be a local MCP server.")
        if server.get("enabled") is not True:
            raise RuntimeError(f"{name} must be enabled.")
        command = server.get("command")
        if not isinstance(command, list) or not command:
            raise RuntimeError(f"{name} must have a command array.")


def validate_mcp_list() -> None:
    output = require_ok(run(["opencode", "mcp", "list"]), "opencode mcp list")
    for name in EXPECTED_MCP:
        if name not in output:
            raise RuntimeError(f"opencode mcp list did not include {name}.\n{output}")


def validate_serve_smoke() -> None:
    process = subprocess.Popen(
        ["opencode", "serve", "--hostname", "127.0.0.1", "--port", "0"],
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        time.sleep(5)
        if process.poll() is not None:
            stdout, stderr = process.communicate(timeout=5)
            raise RuntimeError(
                f"opencode serve exited early with {process.returncode}\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
            )
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def openrouter_status() -> str:
    providers = run(["opencode", "providers", "list"], timeout=30)
    text = providers.stdout + providers.stderr
    if "OpenRouter" in text or os.environ.get("OPENROUTER_API_KEY"):
        return "OpenRouter credential detected"
    return "VALIDATION REQUEST: configure OpenRouter with opencode providers login or OPENROUTER_API_KEY before the agent loop can be run."


def main() -> int:
    config = resolved_config()
    validate_mcp_config(config)
    validate_mcp_list()
    validate_serve_smoke()
    print("OpenCode config ok")
    print(openrouter_status())
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
