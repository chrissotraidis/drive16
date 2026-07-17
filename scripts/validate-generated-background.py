#!/usr/bin/env python3
"""Validate and normalize a generated background for SGDK IMAGE use.

Requirements: dimensions multiples of 8 (within 320x224), at most 16 colors
after indexing (one Genesis palette line). Writes the normalized indexed PNG
to --out and prints a JSON report.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    image = Image.open(args.source).convert("RGB")
    width, height = image.size
    issues = []
    if width % 8 or height % 8:
        issues.append(f"Dimensions {width}x{height} are not multiples of 8.")
    if width > 320 or height > 224:
        issues.append(f"Dimensions {width}x{height} exceed the 320x224 plane.")

    indexed = image.quantize(colors=16, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    palette_used = len({pixel for pixel in indexed.getdata()})
    if not issues:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        indexed.save(args.out)

    report = {
        "status": "passed" if not issues else "failed",
        "width": width,
        "height": height,
        "paletteEntriesUsed": palette_used,
        "out": args.out if not issues else None,
        "issues": issues,
    }
    print(json.dumps(report, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
