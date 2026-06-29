#!/usr/bin/env python3
"""Generate original Phase 0 validation assets."""

from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "phase0"
PLAYER_PNG = ASSET_DIR / "player.png"
LOOP_VGM = ASSET_DIR / "loop.vgm"


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    body = kind + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def make_player_png(path: Path) -> None:
    width = 32
    height = 32
    rows: list[bytes] = []

    for y in range(height):
        row = bytearray()
        for x in range(width):
            color = 0
            if 7 <= x <= 24 and 6 <= y <= 25:
                color = 1
            if 10 <= x <= 21 and 9 <= y <= 22:
                color = 2
            if 13 <= x <= 18 and 12 <= y <= 19:
                color = 3
            if (x in (7, 24) and 6 <= y <= 25) or (y in (6, 25) and 7 <= x <= 24):
                color = 3
            if 14 <= x <= 17 and 24 <= y <= 29:
                color = 1
            if 12 <= x <= 19 and y == 30:
                color = 3
            row.append(color)
        rows.append(b"\x00" + bytes(row))

    palette = bytes(
        [
            0x00,
            0x00,
            0x00,
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
    transparency = bytes([0x00, 0xFF, 0xFF, 0xFF])
    raw = b"".join(rows)

    data = b"\x89PNG\r\n\x1a\n"
    data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 3, 0, 0, 0))
    data += png_chunk(b"PLTE", palette)
    data += png_chunk(b"tRNS", transparency)
    data += png_chunk(b"IDAT", zlib.compress(raw, 9))
    data += png_chunk(b"IEND", b"")

    path.write_bytes(data)


def sn_write(value: int) -> bytes:
    return bytes([0x50, value & 0xFF])


def wait_frames(frames: int) -> bytes:
    return bytes([0x62]) * frames


def psg_note(divider: int, frames: int) -> bytes:
    low = 0x80 | (divider & 0x0F)
    high = (divider >> 4) & 0x3F
    return sn_write(low) + sn_write(high) + sn_write(0x90) + wait_frames(frames)


def make_loop_vgm(path: Path) -> None:
    header_len = 0x40
    init = b"".join([sn_write(0x9F), sn_write(0xBF), sn_write(0xDF), sn_write(0xFF)])
    body = (
        psg_note(254, 15)
        + psg_note(319, 15)
        + psg_note(380, 15)
        + psg_note(319, 15)
    )
    silence_and_end = sn_write(0x9F) + bytes([0x66])
    data = init + body + silence_and_end

    total_samples = 735 * 60
    loop_start_abs = header_len + len(init)
    loop_samples = total_samples
    eof_offset = header_len + len(data) - 4

    header = bytearray(header_len)
    header[0:4] = b"Vgm "
    struct.pack_into("<I", header, 0x04, eof_offset)
    struct.pack_into("<I", header, 0x08, 0x00000150)
    struct.pack_into("<I", header, 0x0C, 3579545)
    struct.pack_into("<I", header, 0x18, total_samples)
    struct.pack_into("<I", header, 0x1C, loop_start_abs - 0x1C)
    struct.pack_into("<I", header, 0x20, loop_samples)
    struct.pack_into("<I", header, 0x24, 60)
    struct.pack_into("<I", header, 0x34, header_len - 0x34)

    path.write_bytes(bytes(header) + data)


def verify_assets() -> None:
    png = PLAYER_PNG.read_bytes()
    vgm = LOOP_VGM.read_bytes()

    if png[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("player.png is not a PNG")
    if struct.unpack(">II", png[16:24]) != (32, 32):
        raise SystemExit("player.png is not 32x32")
    if png[25] != 3:
        raise SystemExit("player.png is not indexed-color PNG")
    if vgm[:4] != b"Vgm ":
        raise SystemExit("loop.vgm is not a VGM")
    if vgm[8] < 0x50:
        raise SystemExit("loop.vgm version is below 1.50")
    if struct.unpack_from("<I", vgm, 0x0C)[0] != 3579545:
        raise SystemExit("loop.vgm does not set the SN76489 clock")
    if struct.unpack_from("<I", vgm, 0x1C)[0] == 0:
        raise SystemExit("loop.vgm does not declare a loop")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify existing assets without rewriting them")
    args = parser.parse_args()

    ASSET_DIR.mkdir(parents=True, exist_ok=True)

    if not args.check:
        make_player_png(PLAYER_PNG)
        make_loop_vgm(LOOP_VGM)

    verify_assets()
    print(f"Phase 0 assets ok: {PLAYER_PNG} and {LOOP_VGM}")


if __name__ == "__main__":
    main()
