#!/usr/bin/env python3
"""Drive16 ComfyUI sprite MCP server.

A deliberately small surface over the tuned Genesis sprite workflow. The
generic comfyui-mcp package exposes 113 tools (~30k prompt tokens per agent
step); the builder needs exactly three: generate a sprite, check readiness,
and read the last result. The heavy lifting stays in
scripts/run-comfyui-sprite-workflow.py, which already enqueues, polls,
downloads, validates, and repairs.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2025-11-25"
SUPPORTED_PROTOCOLS = {PROTOCOL_VERSION, "2025-06-18", "2025-03-26", "2024-11-05"}
REPO_ROOT = Path(__file__).resolve().parents[2]
SPRITE_RUNNER = REPO_ROOT / "scripts" / "run-comfyui-sprite-workflow.py"
BACKGROUND_RUNNER = REPO_ROOT / "scripts" / "run-comfyui-background-workflow.py"
READINESS_SCRIPT = REPO_ROOT / "scripts" / "check-phase4-comfyui-readiness.py"
RUN_LOG = REPO_ROOT / "artifacts" / "phase4" / "live-comfyui-sprite" / "last-run.json"
BG_RUN_LOG = REPO_ROOT / "artifacts" / "phase4" / "live-comfyui-background" / "last-run.json"
READINESS_REPORT = REPO_ROOT / "artifacts" / "phase4" / "comfyui-readiness" / "latest.json"
JOB_DIR = REPO_ROOT / "artifacts" / "phase4" / "sprite-jobs"
JOB_FILE = JOB_DIR / "current.json"

SYMBOL_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
MAX_PROMPT_CHARS = 300


class ToolExecutionError(Exception):
    pass


TOOLS: list[dict[str, Any]] = [
    {
        "name": "generate_sprite",
        "title": "Generate Genesis Sprite",
        "description": (
            "Generate one Genesis-safe 32x32 16-color sprite PNG from a short subject "
            "prompt through the local ComfyUI pipeline, validated for SGDK use. "
            "Takes about two minutes per sprite."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Sprite subject, e.g. 'a small green alien spaceship'.",
                },
                "symbol": {
                    "type": "string",
                    "description": "SGDK resource symbol (C identifier) for the sprite.",
                },
                "role": {
                    "type": "string",
                    "description": "Gameplay role this sprite fills, e.g. 'player ship'.",
                },
                "timeout_seconds": {
                    "type": "integer",
                    "description": "Generation wait budget. Defaults to 600.",
                    "default": 600,
                },
            },
            "required": ["prompt", "symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "enqueue_sprite",
        "title": "Enqueue Sprite Job",
        "description": (
            "Background sprite job for cold starts or parallel work: returns a job id "
            "immediately; poll job_status, then fetch_result. Inside a bounded agent "
            "pass prefer the synchronous generate_sprite - polling costs steps."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Sprite subject."},
                "symbol": {"type": "string", "description": "SGDK resource symbol (C identifier)."},
                "role": {"type": "string", "description": "Gameplay role this asset fills, e.g. 'attacker missile'."},
            },
            "required": ["prompt", "symbol", "role"],
            "additionalProperties": False,
        },
    },
    {
        "name": "enqueue_background",
        "title": "Enqueue Background Job",
        "description": (
            "Start a background/tileset generation job (16-color indexed image sized "
            "for a Genesis plane, wired as an SGDK IMAGE resource). Returns a job id "
            "immediately; poll job_status, then fetch_result."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Background subject, e.g. 'night city skyline'."},
                "symbol": {"type": "string", "description": "SGDK resource symbol (C identifier)."},
                "role": {"type": "string", "description": "Gameplay role, e.g. 'plane B backdrop'."},
                "width": {"type": "integer", "description": "Output width in pixels (multiple of 8, <=320). Default 256."},
                "height": {"type": "integer", "description": "Output height in pixels (multiple of 8, <=224). Default 128."},
            },
            "required": ["prompt", "symbol", "role"],
            "additionalProperties": False,
        },
    },
    {
        "name": "job_status",
        "title": "Check Generation Job",
        "description": "Status of the current generation job: idle, running, done, or failed.",
        "inputSchema": {"type": "object", "additionalProperties": False},
    },
    {
        "name": "fetch_result",
        "title": "Fetch Job Result",
        "description": "Result of the last finished generation job (paths, resource line, role).",
        "inputSchema": {"type": "object", "additionalProperties": False},
    },
    {
        "name": "comfyui_status",
        "title": "Check ComfyUI Readiness",
        "description": (
            "Check that local ComfyUI is reachable with the SDXL checkpoint, Pixel Art "
            "XL LoRA, and quantizer node needed for sprite generation."
        ),
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
        },
    },
    {
        "name": "read_sprite_state",
        "title": "Read Last Sprite Result",
        "description": "Return the result of the most recent sprite generation run.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
        },
    },
]


def respond(message_id: Any, result: dict[str, Any] | None = None, error: dict[str, Any] | None = None) -> None:
    response: dict[str, Any] = {"jsonrpc": "2.0", "id": message_id}
    if error is not None:
        response["error"] = error
    else:
        response["result"] = result or {}
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def tail(text: str, max_chars: int = 4000) -> str:
    return text if len(text) <= max_chars else text[-max_chars:]


def tool_result(payload: dict[str, Any], is_error: bool = False) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "structuredContent": payload,
        "isError": is_error,
    }


def read_run_log() -> dict[str, Any]:
    if not RUN_LOG.is_file():
        return {}
    try:
        parsed = json.loads(RUN_LOG.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def validate_generation_args(prompt: str, symbol: str, role: str) -> None:
    if not isinstance(prompt, str) or not prompt.strip():
        raise ToolExecutionError("prompt must be a non-empty string.")
    if len(prompt) > MAX_PROMPT_CHARS:
        raise ToolExecutionError(f"prompt must be at most {MAX_PROMPT_CHARS} characters.")
    if not isinstance(symbol, str) or not SYMBOL_PATTERN.match(symbol):
        raise ToolExecutionError("symbol must be a C identifier of at most 64 characters.")
    if role is not None and (not isinstance(role, str) or len(role) > 120):
        raise ToolExecutionError("role must be a short string.")


def read_job() -> dict[str, Any]:
    if not JOB_FILE.is_file():
        return {}
    try:
        parsed = json.loads(JOB_FILE.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


_spawned_children: dict[str, subprocess.Popen] = {}


def job_process_alive(job: dict[str, Any]) -> bool:
    pid = job.get("pid")
    if not isinstance(pid, int):
        return False
    child = _spawned_children.get(job.get("id", ""))
    if child is not None:
        return child.poll() is None
    # Child of a previous server instance: orphans are reaped by launchd, so a
    # plain existence probe cannot see a zombie. Reap defensively first.
    try:
        reaped, _status = os.waitpid(pid, os.WNOHANG)
        if reaped == pid:
            return False
    except ChildProcessError:
        pass
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def current_job_status() -> dict[str, Any]:
    job = read_job()
    if not job:
        return {"status": "idle"}
    if job.get("status") == "running" and not job_process_alive(job):
        # The runner exited; classify from its exit artifacts.
        log_path = RUN_LOG if job.get("kind") == "sprite" else BG_RUN_LOG
        result: dict[str, Any] = {}
        if log_path.is_file() and log_path.stat().st_mtime >= job.get("startedAt", 0):
            try:
                result = json.loads(log_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                result = {}
        job["status"] = "done" if result.get("ok") else "failed"
        job["result"] = {**result, "role": job.get("role"), "symbol": job.get("symbol")}
        JOB_FILE.write_text(json.dumps(job), encoding="utf-8")
    return job


def enqueue_job(kind: str, prompt: str, symbol: str, role: str, extra_args: list[str]) -> dict[str, Any]:
    runner = SPRITE_RUNNER if kind == "sprite" else BACKGROUND_RUNNER
    if not runner.is_file():
        raise ToolExecutionError(f"Runner is missing: {runner}")
    validate_generation_args(prompt, symbol, role)
    active = current_job_status()
    if active.get("status") == "running":
        raise ToolExecutionError(
            f"A {active.get('kind')} job ({active.get('id')}) is already running; poll job_status and fetch_result first."
        )
    JOB_DIR.mkdir(parents=True, exist_ok=True)
    import time as _time

    job_id = f"{kind}-{int(_time.time())}"
    log_path = JOB_DIR / f"{job_id}.log"
    with open(log_path, "w", encoding="utf-8") as log_handle:
        child = subprocess.Popen(
            [sys.executable, str(runner), "--prompt", prompt.strip(), "--symbol", symbol, *extra_args],
            cwd=REPO_ROOT,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=os.environ.copy(),
        )
    _spawned_children[job_id] = child
    job = {
        "id": job_id,
        "kind": kind,
        "status": "running",
        "pid": child.pid,
        "prompt": prompt.strip(),
        "symbol": symbol,
        "role": role,
        "startedAt": _time.time(),
        "logPath": str(log_path),
    }
    JOB_FILE.write_text(json.dumps(job), encoding="utf-8")
    return tool_result({"ok": True, "jobId": job_id, "status": "running", "next": "Poll job_status until done, then fetch_result."})


def job_status_tool() -> dict[str, Any]:
    job = current_job_status()
    payload = {
        "ok": True,
        "status": job.get("status", "idle"),
        "jobId": job.get("id"),
        "kind": job.get("kind"),
        "role": job.get("role"),
    }
    if job.get("status") == "running":
        import time as _time

        payload["elapsedSeconds"] = int(_time.time() - job.get("startedAt", 0))
    return tool_result(payload)


def fetch_result_tool() -> dict[str, Any]:
    job = current_job_status()
    if job.get("status") == "running":
        return tool_result({"ok": False, "error": "Job still running; poll job_status."}, is_error=True)
    if not job or "result" not in job:
        return tool_result({"ok": False, "error": "No finished job to fetch."}, is_error=True)
    result = job["result"]
    payload = {
        "ok": bool(result.get("ok")),
        "jobId": job.get("id"),
        "kind": job.get("kind"),
        "role": job.get("role"),
        "symbol": job.get("symbol"),
        **result,
    }
    if job.get("kind") == "sprite" and result.get("downloadedPng"):
        payload["resourceLine"] = f'SPRITE {job.get("symbol")} "{result.get("downloadedPng")}" 4 4 NONE 0'
    if job.get("kind") == "background" and result.get("backgroundPng"):
        payload["resourceLine"] = f'IMAGE {job.get("symbol")} "{result.get("backgroundPng")}" BEST'
    return tool_result(payload, is_error=not payload["ok"])


def generate_sprite(prompt: str, symbol: str, timeout_seconds: int, role: str | None = None) -> dict[str, Any]:
    if not SPRITE_RUNNER.is_file():
        raise ToolExecutionError(f"Sprite runner is missing: {SPRITE_RUNNER}")
    validate_generation_args(prompt, symbol, role)
    if not isinstance(timeout_seconds, int) or not 60 <= timeout_seconds <= 1800:
        raise ToolExecutionError("timeout_seconds must be an integer between 60 and 1800.")

    process = subprocess.run(
        [
            sys.executable,
            str(SPRITE_RUNNER),
            "--prompt",
            prompt.strip(),
            "--symbol",
            symbol,
            "--timeout",
            str(timeout_seconds),
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=timeout_seconds + 180,
        env=os.environ.copy(),
        check=False,
    )
    run_log = read_run_log()
    output = process.stdout
    if process.stderr:
        output = f"{output}\n{process.stderr}" if output else process.stderr

    if process.returncode == 2:
        payload = {
            "ok": False,
            "error": (
                "ComfyUI is not ready for sprite generation. Start it with "
                "scripts/launch-phase4-comfyui-api.sh (or Settings -> AI sprites -> Launch), "
                "then retry. Do not claim generated sprites were used."
            ),
            "readinessReport": str(READINESS_REPORT),
            "detail": tail(output),
        }
        return tool_result(payload, is_error=True)
    if process.returncode != 0:
        payload = {
            "ok": False,
            "error": "Sprite generation failed.",
            "detail": tail(output),
            "runLog": run_log,
        }
        return tool_result(payload, is_error=True)

    payload = {
        "ok": True,
        "spritePng": run_log.get("downloadedPng"),
        "rawPng": run_log.get("rawPng"),
        "masterPng": run_log.get("masterPng"),
        "symbol": symbol,
        "role": role,
        "resourceLine": (
            f'SPRITE {symbol} "{run_log.get("downloadedPng")}" 4 4 NONE 0'
            if run_log.get("downloadedPng")
            else None
        ),
        "validatorOutput": run_log.get("validatorOutput"),
        "detail": tail(output),
    }
    return tool_result(payload)


def comfyui_status() -> dict[str, Any]:
    if not READINESS_SCRIPT.is_file():
        raise ToolExecutionError(f"Readiness script is missing: {READINESS_SCRIPT}")
    process = subprocess.run(
        [sys.executable, str(READINESS_SCRIPT)],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=120,
        env=os.environ.copy(),
        check=False,
    )
    report: dict[str, Any] = {}
    if READINESS_REPORT.is_file():
        try:
            parsed = json.loads(READINESS_REPORT.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                report = parsed
        except json.JSONDecodeError:
            report = {}
    output = process.stdout
    if process.stderr:
        output = f"{output}\n{process.stderr}" if output else process.stderr
    payload = {
        "ok": process.returncode == 0,
        "report": report,
        "reportPath": str(READINESS_REPORT),
        "detail": tail(output),
    }
    if process.returncode != 0:
        payload["error"] = (
            "ComfyUI readiness failed. Start local ComfyUI with "
            "scripts/launch-phase4-comfyui-api.sh and install models with "
            "scripts/install-phase4-comfyui-models.sh, then retry."
        )
    return tool_result(payload, is_error=process.returncode != 0)


def read_sprite_state() -> dict[str, Any]:
    run_log = read_run_log()
    if not run_log:
        return tool_result(
            {"ok": False, "error": "No sprite generation has run yet.", "runLogPath": str(RUN_LOG)},
            is_error=True,
        )
    return tool_result({"ok": bool(run_log.get("ok")), "runLogPath": str(RUN_LOG), **run_log})


def call_tool(name: str, arguments: Any) -> dict[str, Any]:
    args = arguments if isinstance(arguments, dict) else {}
    if name == "generate_sprite":
        timeout_seconds = args.get("timeout_seconds", 600)
        return generate_sprite(args.get("prompt"), args.get("symbol"), timeout_seconds, args.get("role"))
    if name == "enqueue_sprite":
        return enqueue_job("sprite", args.get("prompt"), args.get("symbol"), args.get("role"), [])
    if name == "enqueue_background":
        width = args.get("width", 256)
        height = args.get("height", 128)
        if not isinstance(width, int) or not isinstance(height, int) or width % 8 or height % 8 or not (32 <= width <= 320) or not (32 <= height <= 224):
            raise ToolExecutionError("width/height must be multiples of 8 within 32..320 x 32..224.")
        return enqueue_job(
            "background", args.get("prompt"), args.get("symbol"), args.get("role"),
            ["--width", str(width), "--height", str(height)],
        )
    if name == "job_status":
        return job_status_tool()
    if name == "fetch_result":
        return fetch_result_tool()
    if name == "comfyui_status":
        return comfyui_status()
    if name == "read_sprite_state":
        return read_sprite_state()
    raise KeyError(name)


def handle_request(message: dict[str, Any]) -> None:
    method = message.get("method")
    message_id = message.get("id")
    params = message.get("params") if isinstance(message.get("params"), dict) else {}

    if method == "notifications/initialized":
        return
    if message_id is None:
        return

    if method == "initialize":
        requested = params.get("protocolVersion")
        protocol = requested if requested in SUPPORTED_PROTOCOLS else PROTOCOL_VERSION
        respond(
            message_id,
            {
                "protocolVersion": protocol,
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {
                    "name": "drive16-comfyui",
                    "title": "Drive16 ComfyUI Sprites",
                    "version": "0.1.0",
                },
                "instructions": (
                    "Generates one validated Genesis-safe 32x32 sprite per call through "
                    "the tuned local ComfyUI workflow."
                ),
            },
        )
        return
    if method == "ping":
        respond(message_id, {})
        return
    if method == "tools/list":
        respond(message_id, {"tools": TOOLS})
        return
    if method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        if not isinstance(tool_name, str):
            respond(message_id, error={"code": -32602, "message": "tools/call requires a tool name."})
            return
        try:
            respond(message_id, call_tool(tool_name, arguments))
        except KeyError:
            respond(message_id, error={"code": -32602, "message": f"Unknown tool: {tool_name}"})
        except ToolExecutionError as exc:
            respond(
                message_id,
                tool_result({"ok": False, "error": str(exc)}, is_error=True),
            )
        except subprocess.TimeoutExpired:
            respond(
                message_id,
                tool_result(
                    {
                        "ok": False,
                        "error": (
                            "Sprite generation timed out. ComfyUI may still be rendering; "
                            "check read_sprite_state before retrying."
                        ),
                    },
                    is_error=True,
                ),
            )
        return

    respond(message_id, error={"code": -32601, "message": f"Method not found: {method}"})


def main() -> int:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
            if isinstance(message, dict):
                handle_request(message)
        except Exception as exc:  # Keep protocol stdout clean and diagnostics on stderr.
            print(f"drive16-comfyui: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
