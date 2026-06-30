#!/usr/bin/env python3
"""Validate a generated ComfyUI sprite against Drive16 SGDK sprite limits."""

from __future__ import annotations

import argparse
import json
import struct
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets" / "enhancements" / "comfyui" / "manifest.json"
ARTIFACT_DIR = ROOT / "artifacts" / "phase4" / "generated-sprite-validation"
VALIDATION_FILE = ARTIFACT_DIR / "last-validation.json"


class SpriteValidationError(Exception):
    pass


@dataclass(frozen=True)
class DecodedPng:
    path: Path
    width: int
    height: int
    color_type: int
    pixels: list[tuple[int, int, int, int]]
    palette: list[tuple[int, int, int]]
    transparency: bytes


@dataclass(frozen=True)
class SpriteReport:
    path: Path
    width: int
    height: int
    palette_slots: int
    opaque_colors: list[tuple[int, int, int]]
    transparent_pixels: int
    rescomp: str


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


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


def parse_rgb(text: str) -> tuple[int, int, int]:
    parts = text.split(",")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("RGB values must be comma-separated, for example 255,0,255.")
    try:
        rgb = tuple(int(part.strip()) for part in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("RGB values must be integers.") from exc
    if any(value < 0 or value > 255 for value in rgb):
        raise argparse.ArgumentTypeError("RGB values must be between 0 and 255.")
    return rgb  # type: ignore[return-value]


def unfilter_rows(raw: bytes, width: int, height: int, channels: int, path: Path) -> list[bytes]:
    row_bytes = width * channels
    expected = height * (row_bytes + 1)
    if len(raw) != expected:
        raise SpriteValidationError(f"Unexpected PNG data size in {path}: {len(raw)} != {expected}.")

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
                raise SpriteValidationError(f"Unsupported PNG filter {filter_type} in {path}.")
        rows.append(bytes(decoded))
        previous = decoded
    return rows


def decode_png(path: Path) -> DecodedPng:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SpriteValidationError(f"Not a PNG: {path}")

    offset = 8
    width = height = bit_depth = color_type = interlace = None
    compressed = bytearray()
    palette: list[tuple[int, int, int]] = []
    transparency = b""

    while offset < len(data):
        if offset + 12 > len(data):
            raise SpriteValidationError(f"Truncated PNG chunk in {path}.")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        payload_start = offset + 8
        payload_end = payload_start + length
        crc_end = payload_end + 4
        if crc_end > len(data):
            raise SpriteValidationError(f"Truncated PNG payload in {path}.")
        payload = data[payload_start:payload_end]
        expected_crc = struct.unpack(">I", data[payload_end:crc_end])[0]
        actual_crc = zlib.crc32(kind + payload) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise SpriteValidationError(f"PNG chunk CRC mismatch in {path}: {kind!r}.")

        if kind == b"IHDR":
            width, height, bit_depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", payload)
        elif kind == b"PLTE":
            if len(payload) % 3:
                raise SpriteValidationError(f"Invalid PNG palette in {path}.")
            palette = [(payload[index], payload[index + 1], payload[index + 2]) for index in range(0, len(payload), 3)]
        elif kind == b"tRNS":
            transparency = payload
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
        offset = crc_end

    if None in (width, height, bit_depth, color_type, interlace):
        raise SpriteValidationError(f"Missing PNG header in {path}.")
    if bit_depth != 8:
        raise SpriteValidationError(f"Only 8-bit PNGs are supported: {path}.")
    if interlace != 0:
        raise SpriteValidationError(f"Interlaced PNGs are not supported: {path}.")
    channels_by_type = {0: 1, 2: 3, 3: 1, 6: 4}
    if color_type not in channels_by_type:
        raise SpriteValidationError(f"Unsupported PNG color type {color_type} in {path}.")
    if color_type == 3 and not palette:
        raise SpriteValidationError(f"Indexed PNG has no palette: {path}.")

    rows = unfilter_rows(zlib.decompress(bytes(compressed)), width, height, channels_by_type[color_type], path)
    pixels: list[tuple[int, int, int, int]] = []
    channels = channels_by_type[color_type]
    for row in rows:
        for x in range(width):
            index = x * channels
            if color_type == 0:
                gray = row[index]
                pixels.append((gray, gray, gray, 255))
            elif color_type == 2:
                pixels.append((row[index], row[index + 1], row[index + 2], 255))
            elif color_type == 3:
                palette_index = row[index]
                if palette_index >= len(palette):
                    raise SpriteValidationError(f"Palette index out of range in {path}.")
                alpha = transparency[palette_index] if palette_index < len(transparency) else 255
                pixels.append((*palette[palette_index], alpha))
            elif color_type == 6:
                pixels.append((row[index], row[index + 1], row[index + 2], row[index + 3]))

    return DecodedPng(
        path=path,
        width=width,
        height=height,
        color_type=color_type,
        pixels=pixels,
        palette=palette,
        transparency=transparency,
    )


def validate_sprite(
    path: Path,
    *,
    width: int,
    height: int,
    max_colors: int,
    transparent_rgb: tuple[int, int, int],
    symbol: str,
) -> SpriteReport:
    png = decode_png(path)
    if (png.width, png.height) != (width, height):
        raise SpriteValidationError(f"{path} is {png.width}x{png.height}, expected {width}x{height}.")
    if png.width % 8 or png.height % 8:
        raise SpriteValidationError(f"{path} dimensions must align to 8x8 tiles.")
    if png.width // 8 > 4 or png.height // 8 > 4:
        raise SpriteValidationError(f"{path} exceeds the Genesis 4x4 tile hardware sprite limit.")

    opaque_colors: set[tuple[int, int, int]] = set()
    transparent_pixels = 0
    for red, green, blue, alpha in png.pixels:
        if alpha not in (0, 255):
            raise SpriteValidationError(f"{path} has partial alpha {alpha}; generated sprites need binary transparency.")
        if alpha == 0 or (red, green, blue) == transparent_rgb:
            transparent_pixels += 1
            continue
        opaque_colors.add((red, green, blue))

    if transparent_pixels == 0:
        raise SpriteValidationError(
            f"{path} has no transparent pixels. Use alpha 0 or the reserved RGB color {transparent_rgb}."
        )

    palette_slots = len(opaque_colors) + 1
    if palette_slots > max_colors:
        raise SpriteValidationError(
            f"{path} uses {palette_slots} palette slots including transparency, expected at most {max_colors}."
        )

    if png.color_type == 3:
        if not png.transparency and (not png.palette or png.palette[0] != transparent_rgb):
            raise SpriteValidationError(
                f"{path} is indexed but does not mark palette index 0 transparent or reserved RGB {transparent_rgb}."
            )
        if png.transparency and png.transparency[0] != 0:
            raise SpriteValidationError(f"{path} must reserve palette index 0 for transparency.")

    rescomp = f'SPRITE {symbol} "{path}" {png.width // 8} {png.height // 8} NONE 0'
    return SpriteReport(
        path=path,
        width=png.width,
        height=png.height,
        palette_slots=palette_slots,
        opaque_colors=sorted(opaque_colors),
        transparent_pixels=transparent_pixels,
        rescomp=rescomp,
    )


def write_indexed_png(path: Path, width: int, height: int, rows: Iterable[bytes], palette: bytes, transparency: bytes) -> None:
    raw = b"".join(b"\x00" + row for row in rows)
    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 3, 0, 0, 0))
    data += png_chunk(b"PLTE", palette)
    data += png_chunk(b"tRNS", transparency)
    data += png_chunk(b"IDAT", zlib.compress(raw, 9))
    data += png_chunk(b"IEND", b"")
    path.write_bytes(data)


def make_valid_fixture(path: Path) -> None:
    width = height = 32
    rows: list[bytes] = []
    for y in range(height):
        row = bytearray()
        for x in range(width):
            color = 0
            if 8 <= x <= 23 and 6 <= y <= 25:
                color = 1
            if 11 <= x <= 20 and 10 <= y <= 22:
                color = 2
            if (x in (8, 23) and 6 <= y <= 25) or (y in (6, 25) and 8 <= x <= 23):
                color = 3
            row.append(color)
        rows.append(bytes(row))
    palette = bytes(
        [
            0xFF,
            0x00,
            0xFF,
            0x20,
            0x90,
            0xD0,
            0xF0,
            0xD0,
            0x40,
            0xF8,
            0xF8,
            0xF8,
        ]
    )
    write_indexed_png(path, width, height, rows, palette, bytes([0x00, 0xFF, 0xFF, 0xFF]))


def make_too_many_colors_fixture(path: Path) -> None:
    width = height = 32
    rows: list[bytes] = []
    palette_bytes = bytearray([0xFF, 0x00, 0xFF])
    for index in range(1, 18):
        palette_bytes.extend([(index * 13) % 256, (index * 29) % 256, (index * 47) % 256])
    for y in range(height):
        row = bytearray()
        for x in range(width):
            if x < 2 or y < 2 or x > 29 or y > 29:
                row.append(0)
            else:
                row.append(1 + ((x + y) % 17))
        rows.append(bytes(row))
    write_indexed_png(path, width, height, rows, bytes(palette_bytes), bytes([0] + [255] * 17))


def run_self_test(args: argparse.Namespace, manifest: dict[str, object]) -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    valid = ARTIFACT_DIR / "valid-generated-sprite.png"
    invalid = ARTIFACT_DIR / "invalid-too-many-colors.png"
    make_valid_fixture(valid)
    make_too_many_colors_fixture(invalid)

    valid_report = validate_sprite(
        valid,
        width=args.width,
        height=args.height,
        max_colors=args.max_colors,
        transparent_rgb=args.transparent_rgb,
        symbol=args.symbol,
    )
    try:
        validate_sprite(
            invalid,
            width=args.width,
            height=args.height,
            max_colors=args.max_colors,
            transparent_rgb=args.transparent_rgb,
            symbol=args.symbol,
        )
    except SpriteValidationError as exc:
        rejected = str(exc)
    else:
        raise SpriteValidationError("Self-test invalid fixture unexpectedly passed.")

    payload = report_payload(valid_report, manifest)
    payload["selfTest"] = {
        "validFixture": str(valid.relative_to(ROOT)),
        "invalidFixture": str(invalid.relative_to(ROOT)),
        "invalidRejected": rejected,
    }
    VALIDATION_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        "Generated sprite validator self-test ok: "
        f"accepted {valid.relative_to(ROOT)}, rejected {invalid.relative_to(ROOT)}"
    )


def report_payload(report: SpriteReport, manifest: dict[str, object]) -> dict[str, object]:
    return {
        "ok": True,
        "source": str(report.path.relative_to(ROOT)) if report.path.is_relative_to(ROOT) else str(report.path),
        "manifest": str(MANIFEST.relative_to(ROOT)),
        "packId": manifest.get("packId"),
        "width": report.width,
        "height": report.height,
        "paletteSlots": report.palette_slots,
        "transparentPixels": report.transparent_pixels,
        "opaqueColors": ["#{:02x}{:02x}{:02x}".format(*color) for color in report.opaque_colors],
        "rescomp": report.rescomp,
    }


def load_manifest() -> dict[str, object]:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def defaults_from_manifest(manifest: dict[str, object]) -> tuple[int, int, int]:
    generation = manifest.get("generation")
    if not isinstance(generation, dict):
        raise SpriteValidationError("ComfyUI manifest has no generation object.")
    output_size = generation.get("outputSize")
    palette = generation.get("palette")
    if not isinstance(output_size, dict) or not isinstance(palette, dict):
        raise SpriteValidationError("ComfyUI manifest has no outputSize or palette object.")
    return int(output_size["width"]), int(output_size["height"]), int(palette["maxColors"])


def main() -> int:
    manifest = load_manifest()
    default_width, default_height, default_max_colors = defaults_from_manifest(manifest)

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("png", nargs="?", type=Path, help="generated sprite PNG to validate")
    parser.add_argument("--symbol", default="drive16_generated_sprite", help="SGDK resource symbol to report")
    parser.add_argument("--width", type=int, default=default_width)
    parser.add_argument("--height", type=int, default=default_height)
    parser.add_argument("--max-colors", type=int, default=default_max_colors)
    parser.add_argument(
        "--transparent-rgb",
        type=parse_rgb,
        default=(255, 0, 255),
        help="reserved transparent RGB color for truecolor ComfyUI output",
    )
    parser.add_argument("--self-test", action="store_true", help="run validator against ignored synthetic fixtures")
    args = parser.parse_args()

    try:
        if args.self_test:
            run_self_test(args, manifest)
            return 0
        if args.png is None:
            raise SpriteValidationError("Provide a generated PNG path or use --self-test.")
        report = validate_sprite(
            args.png,
            width=args.width,
            height=args.height,
            max_colors=args.max_colors,
            transparent_rgb=args.transparent_rgb,
            symbol=args.symbol,
        )
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        VALIDATION_FILE.write_text(json.dumps(report_payload(report, manifest), indent=2) + "\n", encoding="utf-8")
        print(
            "Generated sprite ok: "
            f"{report.path} {report.width}x{report.height}, "
            f"{report.palette_slots} palette slots, {report.transparent_pixels} transparent pixels"
        )
        print(report.rescomp)
        return 0
    except SpriteValidationError as exc:
        print(f"Generated sprite validation failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
