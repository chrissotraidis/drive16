#!/usr/bin/env python3
"""Validate the Phase 2 CORE bundled asset pack."""

from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "assets" / "core"
MANIFEST = PACK_DIR / "manifest.json"


def png_chunks(data: bytes) -> dict[bytes, list[bytes]]:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("player.png is not a PNG")

    chunks: dict[bytes, list[bytes]] = {}
    offset = 8
    while offset < len(data):
        if offset + 12 > len(data):
            raise SystemExit("player.png has a truncated chunk")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        payload_start = offset + 8
        payload_end = payload_start + length
        crc_start = payload_end
        crc_end = crc_start + 4
        if crc_end > len(data):
            raise SystemExit("player.png has a truncated payload")
        expected_crc = struct.unpack(">I", data[crc_start:crc_end])[0]
        actual_crc = zlib.crc32(kind + data[payload_start:payload_end]) & 0xFFFFFFFF
        if actual_crc != expected_crc:
            raise SystemExit(f"player.png chunk {kind.decode('ascii', 'replace')} CRC mismatch")
        chunks.setdefault(kind, []).append(data[payload_start:payload_end])
        offset = crc_end
        if kind == b"IEND":
            break
    return chunks


def verify_png(path: Path, width: int, height: int) -> None:
    chunks = png_chunks(path.read_bytes())
    ihdr = chunks.get(b"IHDR", [None])[0]
    if ihdr is None:
        raise SystemExit("player.png has no IHDR chunk")
    actual_width, actual_height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", ihdr)
    if (actual_width, actual_height) != (width, height):
        raise SystemExit(f"player.png is {actual_width}x{actual_height}, expected {width}x{height}")
    if bit_depth != 8 or color_type != 3:
        raise SystemExit("player.png must be an 8-bit indexed-color PNG")
    if not chunks.get(b"PLTE"):
        raise SystemExit("player.png has no palette")
    transparency = chunks.get(b"tRNS", [b""])[0]
    if not transparency or transparency[0] != 0:
        raise SystemExit("player.png palette index 0 must be transparent")


def verify_vgm(path: Path) -> None:
    data = path.read_bytes()
    if len(data) < 0x40 or data[:4] != b"Vgm ":
        raise SystemExit("loop.vgm is not a VGM file")
    version = struct.unpack_from("<I", data, 0x08)[0]
    sn76489_clock = struct.unpack_from("<I", data, 0x0C)[0]
    loop_offset = struct.unpack_from("<I", data, 0x1C)[0]
    loop_samples = struct.unpack_from("<I", data, 0x20)[0]
    if version < 0x00000150:
        raise SystemExit("loop.vgm must be VGM 1.50 or newer")
    if sn76489_clock != 3579545:
        raise SystemExit("loop.vgm must declare the SN76489 PSG clock")
    if loop_offset == 0 or loop_samples == 0:
        raise SystemExit("loop.vgm must declare a loop")


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("packId") != "drive16-core":
        raise SystemExit("manifest packId must be drive16-core")

    sprite = manifest["sprites"][0]
    music = manifest["music"][0]
    if sprite["id"] != "drive16_player":
        raise SystemExit("sprite id must be drive16_player")
    if music["id"] != "drive16_loop":
        raise SystemExit("music id must be drive16_loop")

    verify_png(ROOT / sprite["path"], sprite["width"], sprite["height"])
    verify_vgm(ROOT / music["path"])
    print(f"Core assets ok: {PACK_DIR}")


if __name__ == "__main__":
    main()
