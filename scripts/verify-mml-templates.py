#!/usr/bin/env python3
"""Compile every genre MML template through the mml-music MCP server and
require quality.pass for each. Optionally export the compiled VGMs.

Usage: python3 scripts/verify-mml-templates.py [--export-dir <dir>]
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / "assets" / "enhancements" / "mml" / "genre-templates"
LAST_VGM = ROOT / "artifacts" / "phase4" / "mml-music" / "last.vgm"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-dir", default=None)
    args = parser.parse_args()

    templates = sorted(TEMPLATE_DIR.glob("*.mml"))
    if not templates:
        print("No templates found.", file=sys.stderr)
        return 1

    server = subprocess.Popen(
        [sys.executable, str(ROOT / "mcp-servers" / "mml-music" / "server.py")],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        cwd=ROOT,
    )

    def call(message_id: int, method: str, params: dict) -> dict:
        server.stdin.write(json.dumps({"jsonrpc": "2.0", "id": message_id, "method": method, "params": params}) + "\n")
        server.stdin.flush()
        deadline = time.time() + 300
        while time.time() < deadline:
            line = server.stdout.readline()
            if not line:
                return {}
            try:
                parsed = json.loads(line)
            except json.JSONDecodeError:
                continue
            if parsed.get("id") == message_id:
                return parsed
        return {}

    call(1, "initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "template-verify", "version": "0"}})
    server.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
    server.stdin.flush()

    failures = 0
    for index, template in enumerate(templates, start=10):
        symbol = template.stem.replace("-", "_")
        response = call(index, "tools/call", {"name": "compile_music", "arguments": {"mml_text": template.read_text(encoding="utf-8"), "symbol": symbol}})
        content = response.get("result", {}).get("content", [])
        payload = {}
        if content:
            try:
                payload = json.loads(content[0].get("text", "{}"))
            except json.JSONDecodeError:
                payload = {}
        quality = payload.get("quality", {})
        ok = bool(payload.get("ok")) and bool(quality.get("pass"))
        print(
            f"{template.name}: ok={payload.get('ok')} quality.pass={quality.get('pass')} "
            f"channels={quality.get('channelCount')} loop={quality.get('loopSeconds')}s"
        )
        if not ok:
            failures += 1
            for issue in quality.get("issues", [])[:4]:
                print(f"  issue: {issue}")
            error = payload.get("error") or payload.get("compilerOutput")
            if error:
                print(f"  error: {str(error)[-300:]}")
        elif args.export_dir and LAST_VGM.is_file():
            export = Path(args.export_dir) / f"{symbol}.vgm"
            export.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(LAST_VGM, export)
            print(f"  exported: {export}")

    server.kill()
    if failures:
        print(f"{failures}/{len(templates)} templates failed.", file=sys.stderr)
        return 1
    print(f"MML templates ok: {len(templates)} compiled with quality.pass.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
