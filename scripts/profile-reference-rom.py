#!/usr/bin/env python3
"""Play a Genesis ROM through Genteel and measure its game feel.

Drives scripted play sessions (attract + active play) via Genteel TAS input
scripts, streams RGB565 frames and WAV audio, and computes a behavioral
"feel profile": scroll velocity, residual object motion, moving-region
counts, animation churn, palette depth, HUD share, and audio transient
density. Behavior analysis only — no assets are extracted or stored beyond
gitignored evidence frames for human review.

Usage:
  python3 scripts/profile-reference-rom.py <rom> --label sonic \
      [--out artifacts/reference-profiles] [--play-style runner|brawler|generic] \
      [--frames 1800] [--stream-every 2]
"""

from __future__ import annotations

import argparse
import json
import struct
import subprocess
import wave
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GENTEEL = ROOT / "artifacts" / "phase0" / "genteel-src" / "target" / "release" / "genteel"
HEADER = struct.Struct("<4sHHHHQI")
MASK = "UDLRABCSXYZM"


def buttons(*names: str) -> str:
    mask = ["."] * 12
    for name in names:
        mask[MASK.index(name)] = name
    return "".join(mask)


def play_script(style: str, frames: int) -> list[tuple[int, str]]:
    """A scripted 'player': start through menus, then genre-shaped play."""
    events: list[tuple[int, str]] = []
    # Punch through publisher logo, title, and menu layers: the SEGA screen
    # alone eats ~250 frames, titles fade in around 600.
    for f in (420, 620, 820, 1020, 1180):
        events.append((f, buttons("S")))
        events.append((f + 4, buttons()))
    cursor = 1300
    step = 0
    while cursor < frames - 30:
        if style == "runner":
            # Hold right, jump periodically, occasional down-roll.
            events.append((cursor, buttons("R")))
            events.append((cursor + 34, buttons("R", "A")))
            events.append((cursor + 40, buttons("R")))
            if step % 4 == 3:
                events.append((cursor + 60, buttons("D")))
                events.append((cursor + 80, buttons("R")))
            cursor += 90
        elif style == "brawler":
            # Walk right, punch bursts, occasional jump-kick and up/down lane change.
            events.append((cursor, buttons("R")))
            events.append((cursor + 40, buttons("B")))
            events.append((cursor + 44, buttons()))
            events.append((cursor + 50, buttons("B")))
            events.append((cursor + 54, buttons()))
            lane = "U" if step % 2 == 0 else "D"
            events.append((cursor + 70, buttons(lane)))
            events.append((cursor + 90, buttons("R", "C")))
            events.append((cursor + 96, buttons("R")))
            cursor += 110
        else:  # generic
            direction = "RLUD"[step % 4]
            action = "ABC"[step % 3]
            events.append((cursor, buttons(direction)))
            events.append((cursor + 30, buttons(direction, action)))
            events.append((cursor + 36, buttons(direction)))
            cursor += 60
        step += 1
    return events


def write_script(path: Path, events: list[tuple[int, str]]) -> None:
    lines = ["# frame,p1_buttons,p2_buttons"]
    for frame, mask in sorted(events):
        lines.append(f"{frame},{mask},{'.' * 12}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_session(rom: Path, out: Path, label: str, session: str, frames: int, stream_every: int, events: list[tuple[int, str]]) -> dict:
    session_dir = out / label
    session_dir.mkdir(parents=True, exist_ok=True)
    script = session_dir / f"{session}.script.csv"
    stream = session_dir / f"{session}.frames.bin"
    audio = session_dir / f"{session}.wav"
    shot = session_dir / f"{session}.final.png"
    write_script(script, events)
    subprocess.run(
        [str(GENTEEL), str(rom), "--script", str(script), "--headless", str(frames),
         "--stream-frames", str(stream), "--stream-every", str(stream_every),
         "--dump-audio", str(audio), "--screenshot", str(shot)],
        cwd=ROOT, check=True, capture_output=True, timeout=900,
    )
    return {"stream": stream, "audio": audio, "shot": shot}


def read_stream(path: Path) -> np.ndarray:
    """Return (N, H, W) luma frames from the D16F RGB565 stream."""
    data = path.read_bytes()
    offset = 0
    frames = []
    while offset + HEADER.size <= len(data):
        magic, _v, width, height, _fmt, _idx, payload_len = HEADER.unpack_from(data, offset)
        offset += HEADER.size
        if magic != b"D16F" or offset + payload_len > len(data):
            break
        raw = np.frombuffer(data, dtype="<u2", count=width * height, offset=offset)
        offset += payload_len
        r = (raw >> 11) & 0x1F
        g = (raw >> 5) & 0x3F
        b = raw & 0x1F
        luma = (r.astype(np.float32) * 2.1 + g.astype(np.float32) + b.astype(np.float32) * 0.7)
        frames.append(luma.reshape(height, width))
    return np.stack(frames) if frames else np.zeros((0, 240, 320), np.float32)


def rgb_frames(path: Path, indices: list[int]) -> list[Image.Image]:
    data = path.read_bytes()
    offset = 0
    out = []
    want = set(indices)
    i = 0
    while offset + HEADER.size <= len(data):
        magic, _v, width, height, _fmt, _idx, payload_len = HEADER.unpack_from(data, offset)
        offset += HEADER.size
        if magic != b"D16F":
            break
        if i in want:
            raw = np.frombuffer(data, dtype="<u2", count=width * height, offset=offset).reshape(height, width)
            rgb = np.zeros((height, width, 3), np.uint8)
            rgb[..., 0] = ((raw >> 11) & 0x1F) << 3
            rgb[..., 1] = ((raw >> 5) & 0x3F) << 2
            rgb[..., 2] = (raw & 0x1F) << 3
            out.append(Image.fromarray(rgb))
        offset += payload_len
        i += 1
    return out


def estimate_scroll(a: np.ndarray, b: np.ndarray, radius: int = 8) -> tuple[int, int]:
    """Dominant camera shift between two luma frames (coarse SAD search)."""
    small_a = a[8:-8:2, 8:-8:2]
    best = (0, 0)
    best_err = None
    for dy in range(-radius, radius + 1, 2):
        for dx in range(-radius, radius + 1, 2):
            shifted = np.roll(np.roll(a, dy, axis=0), dx, axis=1)[8:-8:2, 8:-8:2]
            err = np.mean(np.abs(shifted - b[8:-8:2, 8:-8:2]))
            if best_err is None or err < best_err:
                best_err = err
                best = (dx, dy)
    return best


def analyze_frames(frames: np.ndarray, stream_every: int) -> dict:
    if len(frames) < 12:
        return {"error": "too few frames"}
    n, h, w = frames.shape
    scroll_mags = []
    residual_ratios = []
    region_counts = []
    change_maps = np.zeros((h, w), np.float64)
    # Sample consecutive pairs across the run (cap work at ~140 pairs).
    step = max(1, (n - 1) // 140)
    pairs = list(range(0, n - 1, step))
    for i in pairs:
        a, b = frames[i], frames[i + 1]
        dx, dy = estimate_scroll(a, b)
        per_frame = np.hypot(dx, dy) / stream_every
        scroll_mags.append(per_frame)
        comp = np.roll(np.roll(a, dy, axis=0), dx, axis=1)
        diff = np.abs(comp - b) > 14
        diff[:8], diff[-8:], diff[:, :8], diff[:, -8:] = False, False, False, False
        residual_ratios.append(float(diff.mean()))
        change_maps += diff
        # Moving regions: coarse 16x16 grid cells with enough changed pixels.
        cells = diff[: h // 16 * 16, : w // 16 * 16].reshape(h // 16, 16, w // 16, 16).sum(axis=(1, 3))
        region_counts.append(int((cells > 24).sum()))
    # HUD share: rows almost never changing across the session.
    row_change = change_maps.sum(axis=1) / (len(pairs) * w)
    hud_rows = int((row_change < 0.002).sum())
    # Palette depth: unique colors on sampled frames need RGB — approximated by luma histogram spread here;
    # exact color counts are computed on saved sample frames by the caller.
    moving = [r for r, s in zip(region_counts, scroll_mags)]
    return {
        "framePairsAnalyzed": len(pairs),
        "scrollPxPerFrame": {
            "median": round(float(np.median(scroll_mags)), 2),
            "p90": round(float(np.percentile(scroll_mags, 90)), 2),
            "movingShare": round(float(np.mean(np.array(scroll_mags) > 0.4)), 3),
        },
        "residualChangeRatio": {
            "median": round(float(np.median(residual_ratios)), 4),
            "p90": round(float(np.percentile(residual_ratios, 90)), 4),
        },
        "movingRegions16px": {
            "median": int(np.median(moving)),
            "p90": int(np.percentile(moving, 90)),
        },
        "hudStaticRowShare": round(hud_rows / h, 3),
    }


def analyze_audio(path: Path) -> dict:
    with wave.open(str(path), "rb") as wav:
        rate = wav.getframerate()
        channels = wav.getnchannels()
        samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float32)
    if channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    if len(samples) < rate:
        return {"error": "too little audio"}
    hop = rate // 60
    frames = samples[: len(samples) // hop * hop].reshape(-1, hop)
    energy = np.sqrt((frames ** 2).mean(axis=1))
    smooth = np.convolve(energy, np.ones(9) / 9, mode="same")
    jumps = energy[1:] > np.maximum(smooth[:-1] * 1.3, smooth[:-1] + 30)
    # Count rising edges only, so one long hit is one transient.
    onsets = np.logical_and(jumps[1:], ~jumps[:-1])
    onsets_per_sec = float(onsets.sum()) / (len(energy) / 60)
    spectrum = np.abs(np.fft.rfft(samples[: rate * 8] * np.hanning(min(len(samples), rate * 8))))
    freqs = np.fft.rfftfreq(min(len(samples), rate * 8), 1 / rate)
    band_energy = spectrum ** 2
    total = band_energy.sum() or 1.0
    high_share = float(band_energy[freqs > 4000].sum() / total)
    return {
        "maxAbs": int(np.abs(samples).max()),
        "onsetsPerSecond": round(onsets_per_sec, 2),
        "highBandShare": round(high_share, 4),
        "silentShare": round(float((energy < 40).mean()), 3),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rom", type=Path)
    parser.add_argument("--label", required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts" / "reference-profiles")
    parser.add_argument("--play-style", default="generic", choices=["runner", "brawler", "generic"])
    parser.add_argument("--frames", type=int, default=3600)
    parser.add_argument("--stream-every", type=int, default=2)
    args = parser.parse_args()

    profile: dict = {"label": args.label, "rom": args.rom.name, "sessions": {}}
    sessions = {
        "attract": [(0, "." * 12)],
        "play": play_script(args.play_style, args.frames),
    }
    for session, events in sessions.items():
        paths = run_session(args.rom, args.out, args.label, session, args.frames, args.stream_every, events)
        frames = read_stream(paths["stream"])
        metrics = analyze_frames(frames, args.stream_every)
        audio = analyze_audio(paths["audio"])
        # Exact palette depth from three sampled RGB frames.
        n = len(frames)
        sample_idx = [n // 4, n // 2, (3 * n) // 4] if n >= 8 else []
        colors = []
        for image_index, image in enumerate(rgb_frames(paths["stream"], sample_idx)):
            image.save(args.out / args.label / f"{session}.sample{image_index}.png")
            colors.append(len(set(image.getdata())))
        metrics["uniqueColorsSampled"] = colors
        profile["sessions"][session] = {"frames": metrics, "audio": audio}
        # Streams are large; keep the evidence, drop the raw frames.
        paths["stream"].unlink(missing_ok=True)
    out_path = args.out / f"{args.label}.profile.json"
    out_path.write_text(json.dumps(profile, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(profile, indent=2))
    print(f"Profile: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
