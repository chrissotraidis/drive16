#!/usr/bin/env python3
"""Generate a Genesis-safe background/tileset image through local ComfyUI.

Derives the graph from the tuned sprite workflow (same checkpoint + Pixel Art
XL LoRA + 16-color quantizer) but scales to a plane-sized image instead of a
32x32 sprite, converts the result to an indexed PNG, and validates it for use
as an SGDK IMAGE resource. Writes a structured result to
artifacts/phase4/live-comfyui-background/last-run.json.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / "assets" / "enhancements" / "comfyui" / "drive16-genesis-sprite.workflow.json"
MANIFEST = ROOT / "assets" / "enhancements" / "comfyui" / "manifest.json"
ARTIFACT_DIR = ROOT / "artifacts" / "phase4" / "live-comfyui-background"
RUN_LOG = ARTIFACT_DIR / "last-run.json"

BACKGROUND_PROMPT_TEMPLATE = (
    "16-bit Sega Genesis background art, {subject}, detailed pixel art scene, "
    "limited 16 color game palette, crisp pixels, no text"
)


def write_result(payload: dict) -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    RUN_LOG.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def http_json(url: str, data: dict | None = None, timeout: float = 30) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    return json.loads(body) if body else {}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--width", type=int, default=256)
    parser.add_argument("--height", type=int, default=128)
    parser.add_argument("--comfyui-url", default="http://127.0.0.1:8188")
    parser.add_argument("--timeout", type=float, default=600)
    args = parser.parse_args()

    try:
        workflow = json.loads(WORKFLOW.read_text(encoding="utf-8"))
        # Retarget the sprite graph: full-scene prompt, plane-sized output, no
        # master save (node 11 removed), background-specific save prefix.
        workflow.pop("11", None)
        subject = BACKGROUND_PROMPT_TEMPLATE.format(subject=args.prompt.strip())
        workflow["2"]["inputs"]["text"] = subject
        workflow["7"]["inputs"]["width"] = args.width
        workflow["7"]["inputs"]["height"] = args.height
        workflow["9"]["inputs"]["filename_prefix"] = "drive16/generated/drive16_genesis_background"
        workflow["5"]["inputs"]["seed"] = int(time.time()) % (2**48)

        enqueue = http_json(f"{args.comfyui_url}/prompt", {"prompt": workflow}, timeout=30)
        prompt_id = enqueue.get("prompt_id")
        if not prompt_id:
            raise RuntimeError(f"ComfyUI rejected the workflow: {enqueue}")

        deadline = time.time() + args.timeout
        image = None
        while time.time() < deadline:
            history = http_json(f"{args.comfyui_url}/history/{prompt_id}", timeout=15)
            entry = history.get(prompt_id)
            if isinstance(entry, dict) and entry.get("outputs"):
                for output in entry["outputs"].values():
                    for candidate in output.get("images") or []:
                        image = candidate
                        break
                    if image:
                        break
                if image:
                    break
            time.sleep(2)
        if not image:
            raise RuntimeError("ComfyUI did not produce a background image in time.")

        query = urllib.parse.urlencode(
            {"filename": image["filename"], "subfolder": image.get("subfolder", ""), "type": image.get("type", "output")}
        )
        out_dir = ARTIFACT_DIR / prompt_id
        out_dir.mkdir(parents=True, exist_ok=True)
        raw_path = out_dir / image["filename"].replace("/", "_")
        with urllib.request.urlopen(f"{args.comfyui_url}/view?{query}", timeout=60) as response:
            raw_path.write_bytes(response.read())

        indexed_path = out_dir / f"{args.symbol}.png"
        validate = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate-generated-background.py"), str(raw_path), "--out", str(indexed_path)],
            text=True,
            capture_output=True,
            timeout=120,
            check=False,
        )
        if validate.returncode != 0:
            raise RuntimeError(f"Background validation failed: {validate.stdout}\n{validate.stderr}")

        payload = {
            "ok": True,
            "promptId": prompt_id,
            "backgroundPng": str(indexed_path.relative_to(ROOT)),
            "rawPng": str(raw_path.relative_to(ROOT)),
            "width": args.width,
            "height": args.height,
            "validatorOutput": validate.stdout.strip(),
        }
        write_result(payload)
        print(f"ComfyUI background ok: {indexed_path.relative_to(ROOT)}")
        return 0
    except Exception as exc:  # noqa: BLE001
        write_result({"ok": False, "error": str(exc)})
        print(f"ComfyUI background failed: {exc}", file=sys.stderr)
        return 1


import urllib.parse  # noqa: E402  (used above; kept adjacent for clarity)

if __name__ == "__main__":
    raise SystemExit(main())
