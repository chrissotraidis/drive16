#!/usr/bin/env python3
"""Verify that a genre skeleton visibly responds to input and restarts cleanly."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLIENT_SOURCE = ROOT / "scripts" / "validate-emulator-mcp.py"
DECODER_SOURCE = ROOT / "scripts" / "validate-generated-sprite.py"

INPUT_EVENTS = {
    "snake": [(30, ["right"]), (90, [])],
    "pong": [(30, ["down"]), (90, [])],
    "tetris": [(30, ["right"]), (34, [])],
    "asteroids": [(30, ["right"]), (34, []), (50, ["up"]), (54, []), (70, ["a"]), (74, [])],
}


def load_client():
    spec = importlib.util.spec_from_file_location("drive16_interaction_client", CLIENT_SOURCE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load emulator client from {CLIENT_SOURCE}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_decoder():
    spec = importlib.util.spec_from_file_location("drive16_interaction_png", DECODER_SOURCE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load PNG decoder from {DECODER_SOURCE}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.decode_png


def pixel_difference(decode_png, left: Path, right: Path) -> float:
    left_image = decode_png(left)
    right_image = decode_png(right)
    if (left_image.width, left_image.height) != (right_image.width, right_image.height):
        return 1.0
    changed = sum(
        left_pixel[:3] != right_pixel[:3]
        for left_pixel, right_pixel in zip(left_image.pixels, right_image.pixels)
    )
    return changed / len(left_image.pixels)


def screenshot_payload(run: dict) -> tuple[str, bytes]:
    source = Path(run["screenshotPath"])
    payload = source.read_bytes()
    return hashlib.sha256(payload).hexdigest(), payload


def queue_events(client, process, message_id: int, events: list[tuple[int, list[str]]]) -> int:
    for index, (frame, buttons) in enumerate(events):
        client.tool_call(
            process,
            message_id,
            "send_input",
            {"frame": frame, "p1_buttons": buttons, "reset": index == 0},
        )
        message_id += 1
    return message_id


def run_with_events(client, process, message_id: int, rom_path: str, frames: int, events):
    message_id = queue_events(client, process, message_id, events)
    run = client.tool_call(
        process,
        message_id,
        "run_rom",
        {"rom_path": rom_path, "frames": frames, "use_input_script": True},
    )
    digest, payload = screenshot_payload(run)
    return message_id + 1, digest, payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("game", choices=sorted(INPUT_EVENTS))
    parser.add_argument("rom", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    try:
        rom_path = str(args.rom.resolve().relative_to(ROOT))
    except ValueError as error:
        raise RuntimeError("Interaction verification requires a repo-local ROM.") from error

    client = load_client()
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
                "clientInfo": {"name": "drive16-skeleton-interaction", "version": "0.1.0"},
            },
        )
        client.send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        message_id = 2
        message_id, neutral_digest, neutral_png = run_with_events(
            client, process, message_id, rom_path, 180, [(0, [])]
        )
        message_id, input_digest, input_png = run_with_events(
            client, process, message_id, rom_path, 180, INPUT_EVENTS[args.game]
        )
        message_id, fresh_digest, fresh_png = run_with_events(
            client, process, message_id, rom_path, 180, [(0, [])]
        )
        restart_events = [*INPUT_EVENTS[args.game], (120, ["start"]), (122, [])]
        _message_id, restart_digest, restart_png = run_with_events(
            client, process, message_id, rom_path, 300, restart_events
        )

        args.out.parent.mkdir(parents=True, exist_ok=True)
        frame_paths = {}
        for label, payload in {
            "neutral": neutral_png,
            "input": input_png,
            "fresh": fresh_png,
            "restart": restart_png,
        }.items():
            frame_path = args.out.with_name(f"{args.out.stem}-{label}.png")
            frame_path.write_bytes(payload)
            frame_paths[label] = frame_path

        decode_png = load_decoder()
        input_difference = pixel_difference(
            decode_png, frame_paths["neutral"], frame_paths["input"]
        )
        restart_difference = pixel_difference(
            decode_png, frame_paths["fresh"], frame_paths["restart"]
        )
        report = {
            "game": args.game,
            "inputChangedFrame": input_difference >= 0.001,
            "inputDifferenceRatio": round(input_difference, 6),
            "restartMatchedFreshState": restart_difference <= 0.05,
            "restartDifferenceRatio": round(restart_difference, 6),
            "digests": {
                "neutral": neutral_digest,
                "input": input_digest,
                "fresh180": fresh_digest,
                "restartThen180": restart_digest,
            },
        }
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 0 if report["inputChangedFrame"] and report["restartMatchedFreshState"] else 1
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
