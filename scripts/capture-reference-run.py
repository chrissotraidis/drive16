#!/usr/bin/env python3
"""Capture local behavioral evidence from a user-supplied Genesis ROM.

This is reference evidence, not training data and not a playability verdict. It
records a few scripted states that Drive16 can compare with a generated ROM
without copying source code or extracting game assets.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLIENT_SOURCE = ROOT / "scripts" / "validate-emulator-mcp.py"
DECODER_SOURCE = ROOT / "scripts" / "validate-generated-sprite.py"
VALID_BUTTONS = {"left", "right", "up", "down", "start", "a", "b", "c", "x", "y", "z", "mode"}


def load_module(name: str, source: Path):
    spec = importlib.util.spec_from_file_location(name, source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {source}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pixel_difference(decode_png, left: Path, right: Path) -> float:
    left_image = decode_png(left)
    right_image = decode_png(right)
    if (left_image.width, left_image.height) != (right_image.width, right_image.height):
        return 1.0
    changed = sum(
        left_pixel[:3] != right_pixel[:3]
        for left_pixel, right_pixel in zip(left_image.pixels, right_image.pixels)
    )
    return changed / max(1, len(left_image.pixels))


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


def capture(
    client,
    process,
    message_id: int,
    rom_path: str,
    label: str,
    frames: int,
    events: list[tuple[int, list[str]]],
    output_dir: Path,
    dump_audio: bool = False,
):
    message_id = queue_events(client, process, message_id, events)
    run = client.tool_call(
        process,
        message_id,
        "run_rom",
        {
            "rom_path": rom_path,
            "frames": frames,
            "use_input_script": True,
            "stream_frames": False,
            "dump_audio": dump_audio,
        },
    )
    message_id += 1
    screenshot_source = Path(run["screenshotPath"])
    screenshot_path = output_dir / f"{label}.png"
    shutil.copy2(screenshot_source, screenshot_path)

    audio = None
    if dump_audio and run.get("audioDumpPath"):
        audio_summary = client.tool_call(process, message_id, "capture_audio")
        message_id += 1
        audio_path = output_dir / f"{label}.wav"
        shutil.copy2(Path(audio_summary["audioDumpPath"]), audio_path)
        audio = {
            "path": str(audio_path),
            "sha256": sha256(audio_path),
            "maxAbsSample": audio_summary["maxAbsSample"],
            "sampleRate": audio_summary["sampleRate"],
            "channels": audio_summary["channels"],
            "nonSilent": audio_summary["nonSilent"],
        }

    return message_id, {
        "label": label,
        "frames": frames,
        "inputEvents": [{"frame": frame, "buttons": buttons} for frame, buttons in events],
        "screenshotPath": str(screenshot_path),
        "screenshotSha256": sha256(screenshot_path),
        "audio": audio,
    }


def button(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in VALID_BUTTONS:
        raise argparse.ArgumentTypeError(
            f"Unsupported Genesis button {value!r}; choose from {', '.join(sorted(VALID_BUTTONS))}."
        )
    return normalized


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rom", type=Path, help="Repo-local .bin/.md/.gen ROM supplied by the user")
    parser.add_argument("--out", type=Path, required=True, help="Local evidence directory")
    parser.add_argument("--start-button", type=button, default="start")
    parser.add_argument("--action-button", type=button, default="a")
    parser.add_argument("--restart-button", type=button, default="start")
    args = parser.parse_args()

    rom = args.rom.resolve()
    if not rom.is_file():
        raise RuntimeError(f"Reference ROM is missing: {rom}")
    try:
        rom_path = str(rom.relative_to(ROOT))
    except ValueError as error:
        raise RuntimeError("Reference capture requires a repo-local ROM; import it into Drive16 first.") from error

    output_dir = args.out.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    client = load_module("drive16_reference_client", CLIENT_SOURCE)
    decode_png = load_module("drive16_reference_png", DECODER_SOURCE).decode_png
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
                "clientInfo": {"name": "drive16-reference-capture", "version": "0.1.0"},
            },
        )
        client.send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})

        start = [(0, []), (30, [args.start_button]), (32, [])]
        action = [*start, (90, [args.action_button]), (94, [])]
        restart = [*action, (150, [args.restart_button]), (152, [])]
        capture_specs = [
            ("title", 180, [(0, [])], False),
            ("started", 180, start, True),
            ("action-baseline", 110, start, False),
            ("action", 110, action, False),
            ("idle15", 960, start, False),
            ("restart", 300, restart, False),
        ]
        message_id = 2
        captures = []
        for label, frames, events, dump_audio in capture_specs:
            message_id, evidence = capture(
                client,
                process,
                message_id,
                rom_path,
                label,
                frames,
                events,
                output_dir,
                dump_audio,
            )
            captures.append(evidence)

        by_label = {capture["label"]: capture for capture in captures}
        difference = lambda left, right: round(
            pixel_difference(
                decode_png,
                Path(by_label[left]["screenshotPath"]),
                Path(by_label[right]["screenshotPath"]),
            ),
            6,
        )
        report = {
            "schemaVersion": 1,
            "kind": "drive16-reference-run",
            "referenceOnly": True,
            "rom": {
                "path": str(rom),
                "sha256": sha256(rom),
                "bytes": rom.stat().st_size,
            },
            "controls": {
                "start": args.start_button,
                "action": args.action_button,
                "restart": args.restart_button,
            },
            "captures": captures,
            "signals": {
                "titleToStartedDifference": difference("title", "started"),
                "actionDifference": difference("action-baseline", "action"),
                "idle15Difference": difference("started", "idle15"),
                "restartDifference": difference("started", "restart"),
                "audioNonSilent": bool(by_label["started"]["audio"]["nonSilent"]),
                "audioMaxAbsSample": by_label["started"]["audio"]["maxAbsSample"],
            },
            "usage": {
                "allowed": "Local behavioral comparison and human review.",
                "notAllowed": "Claiming model training, copying source, or reusing extracted art/audio.",
            },
            "manualReviewRequired": [
                "title and objective readability",
                "control semantics",
                "pacing and feedback",
                "composition and visual hierarchy",
                "music quality and fit",
            ],
        }
        report_path = output_dir / "reference-run.json"
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 0
    finally:
        if process.stdin:
            process.stdin.close()
        process.terminate()
        process.wait(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
