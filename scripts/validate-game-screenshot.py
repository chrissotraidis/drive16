#!/usr/bin/env python3
"""Reject blank, vertically empty, or visibly corrupted game screenshots."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_png_decoder():
    source = ROOT / "scripts" / "validate-generated-sprite.py"
    spec = importlib.util.spec_from_file_location("drive16_png_decoder", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load PNG decoder from {source}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.decode_png


def analyze_pixels(width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> dict:
    rgb = [(red, green, blue) for red, green, blue, _alpha in pixels]
    colors = Counter(rgb)
    dominant_color, dominant_count = colors.most_common(1)[0]
    # Genesis RGB conversion can dither a dark background into two nearby
    # colors. Count only meaningful contrast as foreground so that palette
    # noise cannot make a blank or half-drawn frame look populated.
    foreground = [
        sum((channel - dominant) ** 2 for channel, dominant in zip(pixel, dominant_color)) >= 64**2
        for pixel in rgb
    ]
    foreground_ratio = sum(foreground) / len(foreground)

    third_ratios = []
    for start, end in ((0, height // 3), (height // 3, 2 * height // 3), (2 * height // 3, height)):
        section = foreground[start * width : end * width]
        third_ratios.append(sum(section) / len(section))

    rows = [tuple(rgb[y * width : (y + 1) * width]) for y in range(height)]
    row_counts = Counter(rows)
    transitions = [
        sum(row[index] != row[index - 1] for index in range(1, width))
        for row in rows
    ]
    high_transition_rows = sum(value > width * 0.30 for value in transitions)
    max_repeated_rows = max(row_counts.values())

    issues: list[str] = []
    if width < 256 or height < 192:
        issues.append(f"Screenshot is too small for gameplay review: {width}x{height}.")
    dominant_ratio = dominant_count / len(rgb)
    if len(colors) < 7:
        issues.append(
            "Screenshot uses fewer than seven visible colors and still reads as a flat prototype palette."
        )
    if foreground_ratio < 0.06:
        issues.append("Screenshot is effectively blank or lacks enough visible game art.")
    if dominant_ratio > 0.84:
        issues.append(
            "One color covers more than 84% of the frame; add a composed playfield, panels, or richer scene structure."
        )
    for index, ratio in enumerate(third_ratios, start=1):
        if ratio < 0.015:
            issues.append(f"Screen composition leaves vertical third {index} without meaningful content.")
    if high_transition_rows > height * 0.10:
        issues.append(
            "Screenshot contains too many high-frequency rows and looks like corrupt tile or framebuffer output."
        )
    if max_repeated_rows > height * 0.45:
        issues.append("Screenshot repeats one identical row across nearly half the frame.")

    return {
        "contractVersion": 2,
        "status": "passed" if not issues else "failed",
        "issues": issues,
        "metrics": {
            "width": width,
            "height": height,
            "visibleColors": len(colors),
            "dominantColor": "#{:02x}{:02x}{:02x}".format(*dominant_color),
            "dominantRatio": round(dominant_ratio, 6),
            "foregroundRatio": round(foreground_ratio, 6),
            "foregroundByVerticalThird": [round(value, 6) for value in third_ratios],
            "uniqueRows": len(row_counts),
            "maxRepeatedRows": max_repeated_rows,
            "highTransitionRows": high_transition_rows,
        },
    }


def run_self_test() -> None:
    width, height = 320, 240
    background = (8, 10, 20, 255)
    good = [background] * (width * height)
    panel = (20, 34, 58, 255)
    for y in range(22, 218):
        for x in range(32, 288):
            good[y * width + x] = panel
    accents = [
        (230, 220, 180, 255),
        (80, 190, 130, 255),
        (60, 150, 220, 255),
        (240, 120, 80, 255),
        (180, 90, 220, 255),
        (250, 190, 70, 255),
    ]
    for y in range(height):
        left = 24 + (y % 17)
        for x in range(left, min(width, left + 28)):
            good[y * width + x] = accents[y % len(accents)]
    for y in range(16, 224, 32):
        for x in range(48, 272):
            good[y * width + x] = accents[(y // 32) % len(accents)]
    good_report = analyze_pixels(width, height, good)
    if good_report["status"] != "passed":
        raise AssertionError(f"Good screenshot fixture failed: {good_report['issues']}")

    prototype = [background] * (width * height)
    prototype_colors = [(230, 230, 230, 255), (90, 120, 180, 255), (220, 140, 70, 255)]
    for y in range(20, 220, 24):
        color = prototype_colors[(y // 24) % len(prototype_colors)]
        for x in range(48, 272):
            if x % 12 < 2:
                prototype[y * width + x] = color
    prototype_report = analyze_pixels(width, height, prototype)
    if prototype_report["status"] != "failed" or not any(
        "flat prototype palette" in issue or "84%" in issue
        for issue in prototype_report["issues"]
    ):
        raise AssertionError("Sparse prototype screenshot fixture was not rejected.")

    corrupt = []
    for y in range(height):
        if y < 128:
            corrupt.extend((255, 255, 255, 255) if x % 2 else (0, 0, 0, 255) for x in range(width))
        else:
            corrupt.extend((0, 0, 0, 255) for _x in range(width))
    corrupt_report = analyze_pixels(width, height, corrupt)
    if corrupt_report["status"] != "failed" or not any(
        "corrupt tile" in issue for issue in corrupt_report["issues"]
    ):
        raise AssertionError("Corrupt screenshot fixture was not rejected.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", nargs="?", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        print("Game screenshot quality self-test passed.")
        return 0
    if args.image is None:
        parser.error("Provide a PNG screenshot or use --self-test.")

    decode_png = load_png_decoder()
    image = decode_png(args.image)
    report = analyze_pixels(image.width, image.height, image.pixels)
    report["image"] = str(args.image)
    payload = json.dumps(report, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(payload, encoding="utf-8")
    print(payload, end="")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
