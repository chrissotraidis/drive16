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
    "snake": [(30, ["start"]), (32, []), (60, ["right"]), (90, [])],
    "pong": [(30, ["start"]), (32, []), (60, ["down"]), (90, [])],
    "tetris": [(30, ["start"]), (32, []), (60, ["right"]), (64, [])],
    "asteroids": [
        (30, ["start"]),
        (32, []),
        (60, ["right"]),
        (80, []),
        (90, ["up"]),
        (120, []),
        (130, ["a"]),
        (136, []),
    ],
    "missile-command": [
        (90, ["a"]),
        (92, []),
        (120, ["right"]),
        (150, []),
        (160, ["a"]),
        (164, []),
    ],
}

PRIMARY_ACTION = {
    "snake": "right",
    "pong": "down",
    "tetris": "right",
    "asteroids": "right",
    "missile-command": "right",
}

ASTEROIDS_GAME_OVER_EVENTS = [
    (30, ["start"]),
    (32, []),
    (40, ["left"]),
    (42, []),
    (50, ["up"]),
    (52, []),
    (60, ["up"]),
    (62, []),
    (120, ["up"]),
    (122, []),
    (130, ["up"]),
    (132, []),
    (290, ["up"]),
    (292, []),
    (300, ["up"]),
    (302, []),
]
ASTEROIDS_GAME_OVER_RESTART_EVENTS = [
    *ASTEROIDS_GAME_OVER_EVENTS,
    (2020, ["start"]),
    (2022, []),
]


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
        base_frames = 300 if args.game == "missile-command" else 180
        idle_frames = 1050 if args.game == "missile-command" else 960
        message_id, title_digest, title_png = run_with_events(
            client, process, message_id, rom_path, 180, [(0, [])]
        )
        start_events = (
            [(0, []), (90, ["a"]), (92, [])]
            if args.game == "missile-command"
            else [(0, []), (30, ["start"]), (32, [])]
            if args.game in {"asteroids", "snake", "pong", "tetris"}
            else [(0, [])]
        )
        message_id, neutral_digest, neutral_png = run_with_events(
            client, process, message_id, rom_path, base_frames, start_events
        )
        message_id, input_digest, input_png = run_with_events(
            client, process, message_id, rom_path, base_frames, INPUT_EVENTS[args.game]
        )
        fresh_action_frame = 210 if args.game == "missile-command" else 120
        primary_action = PRIMARY_ACTION[args.game]
        fresh_events = [
            *start_events,
            (fresh_action_frame, [primary_action]),
            (fresh_action_frame + 2, []),
        ]
        message_id, fresh_digest, fresh_png = run_with_events(
            client, process, message_id, rom_path, base_frames, fresh_events
        )
        idle_events = start_events
        message_id, idle_digest, idle_png = run_with_events(
            client, process, message_id, rom_path, idle_frames, idle_events
        )
        late_input_events = [
            *idle_events,
            (990 if args.game == "missile-command" else 900, [primary_action]),
            (1020 if args.game == "missile-command" else 930, []),
        ]
        message_id, late_input_digest, late_input_png = run_with_events(
            client, process, message_id, rom_path, idle_frames, late_input_events
        )
        reset_button = "c" if args.game == "missile-command" else "start"
        reset_frame = 240 if args.game == "missile-command" else 120
        restart_action_frame = 360 if args.game == "missile-command" else 240
        restart_frames = 450 if args.game == "missile-command" else 300
        restart_events = [
            *INPUT_EVENTS[args.game],
            (reset_frame, [reset_button]),
            (reset_frame + 2, []),
            (restart_action_frame, [primary_action]),
            (restart_action_frame + 2, []),
        ]
        _message_id, restart_digest, restart_png = run_with_events(
            client, process, message_id, rom_path, restart_frames, restart_events
        )

        game_over_digest = None
        game_over_png = None
        game_over_restart_digest = None
        game_over_restart_png = None
        if args.game == "asteroids":
            _message_id, game_over_digest, game_over_png = run_with_events(
                client,
                process,
                message_id,
                rom_path,
                2000,
                ASTEROIDS_GAME_OVER_EVENTS,
            )
            _message_id, game_over_restart_digest, game_over_restart_png = run_with_events(
                client,
                process,
                message_id,
                rom_path,
                2150,
                ASTEROIDS_GAME_OVER_RESTART_EVENTS,
            )

        args.out.parent.mkdir(parents=True, exist_ok=True)
        frame_paths = {}
        for label, payload in {
            "title": title_png,
            "neutral": neutral_png,
            "input": input_png,
            "fresh": fresh_png,
            "idle15": idle_png,
            "late-input": late_input_png,
            "restart": restart_png,
            **({"game-over": game_over_png} if game_over_png is not None else {}),
            **(
                {"game-over-restart": game_over_restart_png}
                if game_over_restart_png is not None
                else {}
            ),
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
        late_input_difference = pixel_difference(
            decode_png, frame_paths["idle15"], frame_paths["late-input"]
        )
        game_over_restart_difference = (
            pixel_difference(
                decode_png, frame_paths["neutral"], frame_paths["game-over-restart"]
            )
            if game_over_restart_png is not None
            else None
        )
        report = {
            "game": args.game,
            # One 8x8 Genesis object occupies at most ~0.0009 of a 320x224
            # frame. The scripted sequence is genre-specific, so accept one
            # clearly changed gameplay object without requiring broad repaint.
            "inputChangedFrame": input_difference >= 0.0005,
            "inputDifferenceRatio": round(input_difference, 6),
            # A late D-pad move can affect only a small cursor, so use a
            # tighter threshold than the multi-action input pass. Exact-zero
            # still rejects a title screen, pause, or game-over state that
            # ignores the intended control.
            "idleSurvives15Seconds": late_input_difference >= 0.0001,
            "lateInputDifferenceRatio": round(late_input_difference, 6),
            "restartMatchedFreshState": restart_difference <= 0.05,
            "restartDifferenceRatio": round(restart_difference, 6),
            "visibleRestartPathTested": reset_button,
            "gameOverCandidateCaptured": game_over_png is not None,
            "gameOverRestartCandidateCaptured": game_over_restart_png is not None,
            "gameOverRestartMatchedFreshState": (
                game_over_restart_difference <= 0.05
                if game_over_restart_difference is not None
                else None
            ),
            "gameOverRestartDifferenceRatio": (
                round(game_over_restart_difference, 6)
                if game_over_restart_difference is not None
                else None
            ),
            "manualReviewRequired": [
                "readable title or start state",
                "objective and controls visible before danger",
                "intended action semantics and feedback",
                "clear game over",
                "coherent composed screen",
            ],
            "digests": {
                "title": title_digest,
                "neutral": neutral_digest,
                "input": input_digest,
                "fresh180": fresh_digest,
                "idle960": idle_digest,
                "lateInput960": late_input_digest,
                "restartThen180": restart_digest,
                **({"gameOver": game_over_digest} if game_over_digest is not None else {}),
                **(
                    {"gameOverRestart": game_over_restart_digest}
                    if game_over_restart_digest is not None
                    else {}
                ),
            },
        }
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        return (
            0
            if report["inputChangedFrame"]
            and report["idleSurvives15Seconds"]
            and report["restartMatchedFreshState"]
            and report["gameOverRestartMatchedFreshState"] is not False
            else 1
        )
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
