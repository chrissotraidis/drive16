#!/usr/bin/env python3
"""Run the Drive16 ComfyUI sprite workflow and validate the generated PNG."""

from __future__ import annotations

import argparse
import copy
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "scripts" / "comfyui-mcp.sh"
READINESS = ROOT / "scripts" / "check-phase4-comfyui-readiness.py"
VALIDATOR = ROOT / "scripts" / "validate-generated-sprite.py"
MANIFEST = ROOT / "assets" / "enhancements" / "comfyui" / "manifest.json"
WORKFLOW = ROOT / "assets" / "enhancements" / "comfyui" / "drive16-genesis-sprite.workflow.json"
ARTIFACT_DIR = ROOT / "artifacts" / "phase4" / "live-comfyui-sprite"
RUN_LOG = ARTIFACT_DIR / "last-run.json"
PROTOCOL_VERSION = "2025-11-25"


class RunnerError(Exception):
    pass


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def workflow_with_checkpoint(workflow: Any, checkpoint: str) -> Any:
    updated = copy.deepcopy(workflow)
    if not isinstance(updated, dict):
        raise RunnerError("Workflow must be a ComfyUI API prompt object.")
    checkpoint_nodes = [
        node
        for node in updated.values()
        if isinstance(node, dict) and node.get("class_type") == "CheckpointLoaderSimple"
    ]
    if len(checkpoint_nodes) != 1:
        raise RunnerError(
            f"Expected exactly one CheckpointLoaderSimple node, found {len(checkpoint_nodes)}."
        )
    inputs = checkpoint_nodes[0].setdefault("inputs", {})
    if not isinstance(inputs, dict):
        raise RunnerError("CheckpointLoaderSimple inputs must be an object.")
    inputs["ckpt_name"] = checkpoint
    return updated


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
    raise RunnerError(f"Missing JSON-RPC response id {message_id}.")


def mcp_call(tool: str, arguments: dict[str, Any], *, timeout: int, env: dict[str, str]) -> Any:
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
                        "clientInfo": {"name": "drive16-comfyui-runner", "version": "0"},
                    },
                }
            ),
            json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 2,
                    "method": "tools/call",
                    "params": {"name": tool, "arguments": arguments},
                }
            ),
            "",
        ]
    )
    process = subprocess.run(
        [str(SERVER)],
        cwd=ROOT,
        input=payload,
        text=True,
        capture_output=True,
        timeout=timeout,
        check=False,
        env=env,
    )
    if process.returncode != 0:
        raise RunnerError(
            f"{SERVER.relative_to(ROOT)} exited {process.returncode}\nSTDOUT:\n{process.stdout}\nSTDERR:\n{process.stderr}"
        )
    response = require_response(read_json_lines(process.stdout), 2)
    result = response.get("result")
    if not isinstance(result, dict):
        raise RunnerError(f"MCP tool {tool} returned no result: {response}")
    content = result.get("content", [])
    text = "\n".join(
        part.get("text", "")
        for part in content
        if isinstance(part, dict) and part.get("type") == "text"
    )
    if result.get("isError"):
        raise RunnerError(f"MCP tool {tool} failed: {text or response}")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


def request_json(base_url: str, path: str, *, timeout: float) -> Any:
    url = base_url.rstrip("/") + path
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def download_image(base_url: str, image: dict[str, Any], destination: Path, *, timeout: float) -> Path:
    filename = str(image.get("filename", ""))
    subfolder = str(image.get("subfolder", ""))
    image_type = str(image.get("type", "output"))
    if not filename:
        raise RunnerError("History image output did not include a filename.")
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": image_type})
    url = base_url.rstrip("/") + "/view?" + params
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / filename
    with urllib.request.urlopen(url, timeout=timeout) as response:
        data = response.read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise RunnerError(f"Downloaded output is not a PNG: {filename}")
    target.write_bytes(data)
    return target


def find_first_image(history: dict[str, Any], prompt_id: str) -> dict[str, Any]:
    entry = history.get(prompt_id)
    if entry is None and len(history) == 1:
        entry = next(iter(history.values()))
    if not isinstance(entry, dict):
        raise RunnerError(f"No history entry found for prompt {prompt_id}.")
    outputs = entry.get("outputs")
    if not isinstance(outputs, dict):
        raise RunnerError(f"History entry for prompt {prompt_id} has no outputs.")
    for output in outputs.values():
        if isinstance(output, dict):
            images = output.get("images")
            if isinstance(images, list) and images:
                image = images[0]
                if isinstance(image, dict):
                    return image
    raise RunnerError(f"History entry for prompt {prompt_id} has no image outputs.")


def wait_for_history(base_url: str, prompt_id: str, *, timeout: float, interval: float) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            history = request_json(base_url, f"/history/{urllib.parse.quote(prompt_id)}", timeout=10)
            if isinstance(history, dict) and history:
                try:
                    find_first_image(history, prompt_id)
                    return history
                except RunnerError:
                    pass
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        time.sleep(interval)
    if last_error is not None:
        raise RunnerError(f"Timed out waiting for ComfyUI history after {timeout:.0f}s: {last_error}")
    raise RunnerError(f"Timed out waiting for ComfyUI history after {timeout:.0f}s.")


def run_validator(png: Path, symbol: str) -> str:
    result = subprocess.run(
        [sys.executable, str(VALIDATOR), str(png), "--symbol", symbol],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    if result.returncode != 0:
        raise RunnerError(
            f"{VALIDATOR.relative_to(ROOT)} rejected {png}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return result.stdout.strip()


def run_readiness(args: argparse.Namespace) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(READINESS),
            "--comfyui-url",
            args.comfyui_url,
            "--checkpoint",
            args.checkpoint,
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )


def validation_request(
    message: str,
    args: argparse.Namespace,
    *,
    readiness: subprocess.CompletedProcess[str] | None = None,
) -> int:
    command = (
        f"COMFYUI_URL={shlex.quote(args.comfyui_url)} "
        f"DRIVE16_COMFYUI_CHECKPOINT={shlex.quote(args.checkpoint)} "
        "scripts/run-comfyui-sprite-workflow.py"
    )
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "ok": False,
        "reason": message,
        "validationRequest": {
            "startComfyUI": "Start local ComfyUI on http://127.0.0.1:8188 with the Pixel Art Diffusion XL checkpoint and Pixydust Quantizer custom node installed.",
            "command": command,
            "expected": "The command enqueues through drive16-comfyui, downloads a PNG, and prints Generated sprite ok.",
        },
    }
    if readiness is not None:
        payload["readiness"] = {
            "exitCode": readiness.returncode,
            "report": "artifacts/phase4/comfyui-readiness/latest.json",
            "stdout": readiness.stdout.strip(),
            "stderr": readiness.stderr.strip(),
        }
    RUN_LOG.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("VALIDATION REQUEST: local ComfyUI is required for live generated sprite validation.")
    print(message)
    if readiness is not None:
        if readiness.stdout.strip():
            print()
            print(readiness.stdout.strip())
        if readiness.stderr.strip():
            print()
            print(readiness.stderr.strip(), file=sys.stderr)
    print(f"Run after ComfyUI is available: {command}")
    return 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comfyui-url", default=os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188"))
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--interval", type=float, default=2)
    parser.add_argument("--mcp-timeout", type=int, default=240)
    parser.add_argument("--disable-random-seed", action="store_true")
    parser.add_argument("--symbol", default=None)
    parser.add_argument(
        "--checkpoint",
        default=os.environ.get("DRIVE16_COMFYUI_CHECKPOINT"),
        help="Pixel Art Diffusion XL compatible checkpoint filename to use.",
    )
    args = parser.parse_args()

    manifest = load_json(MANIFEST)
    workflow = load_json(WORKFLOW)
    manifest_checkpoint = str(manifest.get("model", {}).get("checkpoint", ""))
    args.checkpoint = str(args.checkpoint or manifest_checkpoint)
    workflow = workflow_with_checkpoint(workflow, args.checkpoint)
    validator = manifest.get("validator", {})
    symbol = args.symbol or (
        validator.get("defaultSymbol") if isinstance(validator, dict) else None
    ) or "drive16_generated_sprite"
    env = os.environ.copy()
    env["COMFYUI_URL"] = args.comfyui_url
    env.setdefault("COMFYUI_MCP_AUTOUPDATE", "0")

    readiness = run_readiness(args)
    if readiness.returncode != 0:
        return validation_request(
            "Phase 4 ComfyUI readiness did not pass, so the live sprite workflow was not enqueued.",
            args,
            readiness=readiness,
        )

    try:
        mcp_call("get_system_stats", {}, timeout=args.mcp_timeout, env=env)
    except (RunnerError, urllib.error.URLError, TimeoutError) as exc:
        return validation_request(str(exc), args)

    try:
        enqueue = mcp_call(
            "enqueue_workflow",
            {"workflow": workflow, "disable_random_seed": args.disable_random_seed},
            timeout=args.mcp_timeout,
            env=env,
        )
        if not isinstance(enqueue, dict) or not enqueue.get("prompt_id"):
            raise RunnerError(f"enqueue_workflow returned no prompt_id: {enqueue}")
        prompt_id = str(enqueue["prompt_id"])
        history = wait_for_history(args.comfyui_url, prompt_id, timeout=args.timeout, interval=args.interval)
        image = find_first_image(history, prompt_id)
        output_dir = ARTIFACT_DIR / prompt_id
        png = download_image(args.comfyui_url, image, output_dir, timeout=60)
        validator_output = run_validator(png, symbol)

        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            "ok": True,
            "promptId": prompt_id,
            "checkpoint": args.checkpoint,
            "downloadedPng": str(png.relative_to(ROOT)),
            "validatorOutput": validator_output,
        }
        RUN_LOG.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"ComfyUI live sprite workflow ok: prompt_id={prompt_id}")
        print(f"Downloaded PNG: {png.relative_to(ROOT)}")
        print(validator_output)
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ComfyUI live sprite workflow failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
