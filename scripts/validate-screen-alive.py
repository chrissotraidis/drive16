#!/usr/bin/env python3
"""Weak screen-liveness check for phased-build pass gates.

The full presentation contract (validate-game-screenshot.py) is the FINAL
visual bar and rejects dense repeating patterns as corrupt output — a false
positive for legitimate patterned backgrounds mid-pipeline. Pass gates only
need to know the screen is alive and structured: not black, not one flat
color, some real content.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("screenshot")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    image = Image.open(args.screenshot).convert("RGB")
    pixels = list(image.getdata())
    total = len(pixels)
    counts = Counter(pixels)
    unique_colors = len(counts)
    dominant_share = counts.most_common(1)[0][1] / total if total else 1.0

    issues = []
    if unique_colors < 4:
        issues.append(f"Only {unique_colors} unique colors; the screen looks flat or dead.")
    if dominant_share > 0.95:
        issues.append(f"One color covers {dominant_share:.0%} of the screen.")

    report = {
        "status": "passed" if not issues else "failed",
        "uniqueColors": unique_colors,
        "dominantShare": round(dominant_share, 4),
        "issues": issues,
        "scope": "Liveness only; the full presentation contract still judges final visuals.",
    }
    text = json.dumps(report, indent=2)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
