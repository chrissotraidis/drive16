#!/usr/bin/env python3
"""Prewarm the ComfyUI SDXL checkpoint with a tiny render.

A cold checkpoint load takes minutes and used to blow through MCP client
timeouts mid-build (P1-G0 finding 2). A single 1-step 64x64 render forces the
load up front. No-op (exit 0 with a note) when ComfyUI is not running.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / "assets" / "enhancements" / "comfyui" / "drive16-genesis-sprite.workflow.json"
URL = "http://127.0.0.1:8188"


def http_json(url: str, data: dict | None = None, timeout: float = 15) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    return json.loads(body) if body else {}


def main() -> int:
    try:
        http_json(f"{URL}/system_stats")
    except (urllib.error.URLError, TimeoutError):
        print("ComfyUI is not running; checkpoint prewarm skipped.")
        return 0

    workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))
    workflow.pop("11", None)
    workflow["4"]["inputs"]["width"] = 64
    workflow["4"]["inputs"]["height"] = 64
    workflow["5"]["inputs"]["steps"] = 1
    workflow["7"]["inputs"]["width"] = 32
    workflow["7"]["inputs"]["height"] = 32
    workflow["9"]["inputs"]["filename_prefix"] = "drive16/prewarm/checkpoint"

    started = time.time()
    enqueue = http_json(f"{URL}/prompt", {"prompt": workflow}, timeout=30)
    prompt_id = enqueue.get("prompt_id")
    if not prompt_id:
        print(f"Prewarm enqueue failed: {enqueue}", file=sys.stderr)
        return 1
    deadline = time.time() + 420
    while time.time() < deadline:
        history = http_json(f"{URL}/history/{prompt_id}")
        entry = history.get(prompt_id)
        if isinstance(entry, dict) and entry.get("outputs"):
            print(f"ComfyUI checkpoint warm in {time.time() - started:.1f}s.")
            return 0
        time.sleep(2)
    print("Checkpoint prewarm timed out.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
