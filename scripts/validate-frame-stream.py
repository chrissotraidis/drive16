#!/usr/bin/env python3
"""Validate Drive16's Phase 0 raw RGB565 frame stream format."""

from __future__ import annotations

import argparse
import struct
from pathlib import Path


HEADER = struct.Struct("<4sHHHHQI")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("stream", type=Path)
    parser.add_argument("--min-frames", type=int, default=1)
    args = parser.parse_args()

    data = args.stream.read_bytes()
    offset = 0
    frames = []
    nonzero_pixels = 0

    while offset < len(data):
        if len(data) - offset < HEADER.size:
            raise SystemExit(f"Truncated frame header at byte {offset}")

        magic, version, width, height, fmt, frame_index, payload_len = HEADER.unpack_from(data, offset)
        offset += HEADER.size

        if magic != b"D16F":
            raise SystemExit(f"Bad magic at frame {len(frames)}: {magic!r}")
        if version != 1:
            raise SystemExit(f"Unsupported stream version: {version}")
        if (width, height, fmt) != (320, 240, 565):
            raise SystemExit(f"Unexpected frame metadata: {width}x{height} fmt {fmt}")
        expected_payload_len = width * height * 2
        if payload_len != expected_payload_len:
            raise SystemExit(f"Unexpected payload length: {payload_len}")
        if len(data) - offset < payload_len:
            raise SystemExit(f"Truncated payload at frame {len(frames)}")

        payload = data[offset:offset + payload_len]
        offset += payload_len
        frames.append(frame_index)

        for index in range(0, len(payload), 2):
            if payload[index] or payload[index + 1]:
                nonzero_pixels += 1

    if len(frames) < args.min_frames:
        raise SystemExit(f"Expected at least {args.min_frames} frames, found {len(frames)}")
    if frames != sorted(frames):
        raise SystemExit(f"Frame indices are not monotonic: {frames}")
    if nonzero_pixels == 0:
        raise SystemExit("Frame stream payload is entirely black")

    print(
        f"Frame stream ok: {len(frames)} frames, "
        f"indices {frames[0]}..{frames[-1]}, nonzero pixels {nonzero_pixels}"
    )


if __name__ == "__main__":
    main()
