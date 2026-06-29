#!/usr/bin/env python3
"""Validate that two PNG screenshots show a sprite-like movement."""

from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path


class MovementError(Exception):
    pass


def paeth(left: int, up: int, upper_left: int) -> int:
    estimate = left + up - upper_left
    left_distance = abs(estimate - left)
    up_distance = abs(estimate - up)
    upper_left_distance = abs(estimate - upper_left)
    if left_distance <= up_distance and left_distance <= upper_left_distance:
        return left
    if up_distance <= upper_left_distance:
        return up
    return upper_left


def parse_png(path: Path) -> tuple[int, int, list[tuple[int, int, int]]]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise MovementError(f"Not a PNG: {path}")

    offset = 8
    width = height = bit_depth = color_type = None
    compressed = bytearray()
    palette: list[tuple[int, int, int]] = []

    while offset < len(data):
        if offset + 12 > len(data):
            raise MovementError(f"Truncated PNG chunk in {path}")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        payload_start = offset + 8
        payload_end = payload_start + length
        crc_end = payload_end + 4
        if crc_end > len(data):
            raise MovementError(f"Truncated PNG payload in {path}")
        payload = data[payload_start:payload_end]
        expected_crc = struct.unpack(">I", data[payload_end:crc_end])[0]
        actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise MovementError(f"PNG chunk CRC mismatch in {path}: {kind!r}")

        if kind == b"IHDR":
            width, height, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", payload)
            if bit_depth != 8:
                raise MovementError(f"Only 8-bit PNGs are supported: {path}")
            if interlace != 0:
                raise MovementError(f"Interlaced PNGs are not supported: {path}")
        elif kind == b"PLTE":
            if len(payload) % 3:
                raise MovementError(f"Invalid PNG palette in {path}")
            palette = [
                (payload[index], payload[index + 1], payload[index + 2])
                for index in range(0, len(payload), 3)
            ]
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
        offset = crc_end

    if width is None or height is None or bit_depth is None or color_type is None:
        raise MovementError(f"Missing PNG header in {path}")

    channels_by_type = {0: 1, 2: 3, 3: 1, 6: 4}
    if color_type not in channels_by_type:
        raise MovementError(f"Unsupported PNG color type {color_type} in {path}")

    channels = channels_by_type[color_type]
    row_bytes = width * channels
    raw = zlib.decompress(bytes(compressed))
    expected = height * (row_bytes + 1)
    if len(raw) != expected:
        raise MovementError(f"Unexpected PNG data size in {path}: {len(raw)} != {expected}")

    rows: list[bytes] = []
    previous = bytearray(row_bytes)
    cursor = 0
    for _ in range(height):
        filter_type = raw[cursor]
        cursor += 1
        encoded = raw[cursor : cursor + row_bytes]
        cursor += row_bytes
        decoded = bytearray(row_bytes)
        for index, value in enumerate(encoded):
            left = decoded[index - channels] if index >= channels else 0
            up = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 0:
                decoded[index] = value
            elif filter_type == 1:
                decoded[index] = (value + left) & 0xFF
            elif filter_type == 2:
                decoded[index] = (value + up) & 0xFF
            elif filter_type == 3:
                decoded[index] = (value + ((left + up) // 2)) & 0xFF
            elif filter_type == 4:
                decoded[index] = (value + paeth(left, up, upper_left)) & 0xFF
            else:
                raise MovementError(f"Unsupported PNG filter {filter_type} in {path}")
        rows.append(bytes(decoded))
        previous = decoded

    pixels: list[tuple[int, int, int]] = []
    for row in rows:
        for x in range(width):
            index = x * channels
            if color_type == 0:
                gray = row[index]
                pixels.append((gray, gray, gray))
            elif color_type == 2:
                pixels.append((row[index], row[index + 1], row[index + 2]))
            elif color_type == 3:
                palette_index = row[index]
                if palette_index >= len(palette):
                    raise MovementError(f"Palette index out of range in {path}")
                pixels.append(palette[palette_index])
            elif color_type == 6:
                pixels.append((row[index], row[index + 1], row[index + 2]))
    return width, height, pixels


def percentile(values: list[int], fraction: float) -> int:
    if not values:
        raise MovementError("No values for percentile")
    ordered = sorted(values)
    index = round((len(ordered) - 1) * fraction)
    return ordered[index]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("neutral", type=Path)
    parser.add_argument("moved", type=Path)
    parser.add_argument("--direction", choices=("right", "left", "up", "down"), default="right")
    parser.add_argument("--min-delta", type=int, default=24)
    parser.add_argument("--min-changed", type=int, default=40)
    parser.add_argument("--max-orthogonal-span", type=int, default=96)
    args = parser.parse_args()

    width_a, height_a, neutral = parse_png(args.neutral)
    width_b, height_b, moved = parse_png(args.moved)
    if (width_a, height_a) != (width_b, height_b):
        raise MovementError("Screenshots have different dimensions")

    changed = [
        (index % width_a, index // width_a)
        for index, (left, right) in enumerate(zip(neutral, moved))
        if left != right
    ]
    if len(changed) < args.min_changed:
        raise MovementError(f"Too few changed pixels: {len(changed)} < {args.min_changed}")

    xs = [x for x, _ in changed]
    ys = [y for _, y in changed]

    if args.direction in {"right", "left"}:
        low = percentile(xs, 0.10)
        high = percentile(xs, 0.90)
        delta = high - low
        orthogonal_span = max(ys) - min(ys) + 1
    else:
        low = percentile(ys, 0.10)
        high = percentile(ys, 0.90)
        delta = high - low
        orthogonal_span = max(xs) - min(xs) + 1

    if delta < args.min_delta:
        raise MovementError(f"Movement delta too small: {delta} < {args.min_delta}")
    if orthogonal_span > args.max_orthogonal_span:
        raise MovementError(
            f"Changed region is too broad for a sprite movement: {orthogonal_span} > {args.max_orthogonal_span}"
        )

    print(
        "Sprite movement ok: "
        f"direction={args.direction} changed_pixels={len(changed)} "
        f"delta={delta} orthogonal_span={orthogonal_span}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except MovementError as exc:
        print(f"Sprite movement validation failed: {exc}")
        raise SystemExit(1)
