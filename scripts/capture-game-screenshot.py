#!/usr/bin/env python3
"""Capture a stable final gameplay frame through the emulator MCP server."""

from __future__ import annotations

import argparse
import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EMULATOR_VALIDATOR = ROOT / "scripts" / "validate-emulator-mcp.py"


def load_emulator_client():
    spec = importlib.util.spec_from_file_location("drive16_emulator_client", EMULATOR_VALIDATOR)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load emulator client from {EMULATOR_VALIDATOR}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rom", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frames", type=int, default=180)
    args = parser.parse_args()
    if args.frames < 120:
        parser.error("--frames must be at least 120 for a stable final capture")

    client = load_emulator_client()
    process = subprocess.Popen(
        [sys.executable, str(client.SERVER)],
        cwd=ROOT,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        client.call(
            process,
            1,
            "initialize",
            {
                "protocolVersion": "2025-11-25",
                "capabilities": {},
                "clientInfo": {"name": "drive16-final-capture", "version": "0.1.0"},
            },
        )
        client.send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})
        run = client.tool_call(
            process,
            2,
            "run_rom",
            {"rom_path": str(args.rom), "frames": args.frames},
        )
        frame = client.tool_call(process, 3, "capture_frame")
        source = Path(frame.get("screenshotPath") or run["screenshotPath"])
        args.output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, args.output)
        print(args.output)
        return 0
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
