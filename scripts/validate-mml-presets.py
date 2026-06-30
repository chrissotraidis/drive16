#!/usr/bin/env python3
"""Validate Drive16 Phase 4 MML FM presets."""

from __future__ import annotations

import json
import re
import struct
import subprocess
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
BUILD_CTRMML = REPO_ROOT / "scripts" / "build-ctrmml.sh"
PRESET_DIR = REPO_ROOT / "assets" / "enhancements" / "mml"
MANIFEST = PRESET_DIR / "manifest.json"
ARTIFACT_DIR = REPO_ROOT / "artifacts" / "phase4" / "mml-presets"
VALIDATION_FILE = ARTIFACT_DIR / "validation.json"


def load_manifest() -> dict[str, Any]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1:
        raise RuntimeError("manifest schemaVersion must be 1.")
    if manifest.get("format") != "drive16-ctrmml-fm-presets":
        raise RuntimeError("manifest format is not drive16-ctrmml-fm-presets.")
    if manifest.get("platform") != "megadrive":
        raise RuntimeError("manifest platform must be megadrive.")
    presets = manifest.get("presets")
    if not isinstance(presets, list) or not presets:
        raise RuntimeError("manifest presets must be a non-empty list.")
    return manifest


def build_compiler() -> Path:
    process = subprocess.run(
        [str(BUILD_CTRMML)],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=300,
        check=False,
    )
    if process.returncode != 0:
        raise RuntimeError(f"ctrmml build failed:\n{process.stdout}\n{process.stderr}")
    path_text = process.stdout.strip().splitlines()[-1] if process.stdout.strip() else ""
    compiler = Path(path_text).resolve()
    if not compiler.is_file():
        raise RuntimeError(f"ctrmml compiler was not created: {compiler}")
    return compiler


def validate_vgm(path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    if len(data) < 0x40 or data[:4] != b"Vgm ":
        raise RuntimeError(f"not a VGM file: {path}")
    version = struct.unpack_from("<I", data, 0x08)[0]
    ym2612_clock = struct.unpack_from("<I", data, 0x2C)[0] if len(data) >= 0x30 else 0
    if version < 0x00000150:
        raise RuntimeError(f"VGM version is below 1.50: 0x{version:08x}")
    if ym2612_clock == 0:
        raise RuntimeError(f"VGM has no YM2612 clock: {path}")
    return {
        "size": len(data),
        "version": f"0x{version:08x}",
        "ym2612Clock": ym2612_clock,
    }


def require_preset_shape(preset: Any, seen_ids: set[str], seen_instruments: set[int]) -> dict[str, Any]:
    if not isinstance(preset, dict):
        raise RuntimeError("preset entries must be objects.")
    preset_id = preset.get("id")
    if not isinstance(preset_id, str) or not re.fullmatch(r"[a-z0-9_]+", preset_id):
        raise RuntimeError(f"invalid preset id: {preset_id}")
    if preset_id in seen_ids:
        raise RuntimeError(f"duplicate preset id: {preset_id}")
    seen_ids.add(preset_id)

    instrument = preset.get("instrument")
    if not isinstance(instrument, int) or instrument < 0 or instrument > 65535:
        raise RuntimeError(f"invalid instrument for {preset_id}: {instrument}")
    if instrument in seen_instruments:
        raise RuntimeError(f"duplicate instrument number: {instrument}")
    seen_instruments.add(instrument)

    role = preset.get("role")
    channel = preset.get("defaultChannel")
    octave = preset.get("octave")
    volume = preset.get("volume")
    phrase = preset.get("samplePhrase")
    if not isinstance(role, str) or not role:
        raise RuntimeError(f"{preset_id} role must be set.")
    if not isinstance(channel, str) or channel not in "ABCDEF":
        raise RuntimeError(f"{preset_id} defaultChannel must be an FM channel A-F.")
    if not isinstance(octave, int) or octave < 1 or octave > 7:
        raise RuntimeError(f"{preset_id} octave must be 1-7.")
    if not isinstance(volume, int) or volume < 0 or volume > 15:
        raise RuntimeError(f"{preset_id} volume must be 0-15.")
    if not isinstance(phrase, str) or not phrase.strip():
        raise RuntimeError(f"{preset_id} samplePhrase must be set.")
    return preset


def compile_preset(compiler: Path, preset_mml: str, preset: dict[str, Any]) -> dict[str, Any]:
    preset_id = preset["id"]
    mml_path = ARTIFACT_DIR / f"{preset_id}.mml"
    vgm_path = ARTIFACT_DIR / f"{preset_id}.vgm"
    log_path = ARTIFACT_DIR / f"{preset_id}.log"
    sample = f"""#title Drive16 Preset {preset_id}
#platform megadrive

{preset_mml}
{preset["defaultChannel"]} t128 @{preset["instrument"]} v{preset["volume"]} o{preset["octave"]} l8 {preset["samplePhrase"]} L c4 r4
"""
    mml_path.write_text(sample, encoding="utf-8")
    process = subprocess.run(
        [str(compiler), "--output", str(vgm_path), "--format", "vgm", str(mml_path)],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        timeout=120,
        check=False,
    )
    log_text = process.stdout
    if process.stderr:
        log_text = f"{log_text}\n{process.stderr}" if log_text else process.stderr
    log_path.write_text(log_text, encoding="utf-8")
    if process.returncode != 0 or not vgm_path.is_file():
        raise RuntimeError(f"{preset_id} failed to compile:\n{log_text}")
    return {
        "id": preset_id,
        "instrument": preset["instrument"],
        "role": preset["role"],
        "mmlPath": str(mml_path),
        "vgmPath": str(vgm_path),
        "vgm": validate_vgm(vgm_path),
    }


def main() -> int:
    manifest = load_manifest()
    mml_file = manifest.get("mml")
    if not isinstance(mml_file, str):
        raise RuntimeError("manifest mml must be set.")
    preset_mml_path = (PRESET_DIR / mml_file).resolve()
    preset_mml_path.relative_to(PRESET_DIR)
    preset_mml = preset_mml_path.read_text(encoding="utf-8")

    seen_ids: set[str] = set()
    seen_instruments: set[int] = set()
    presets = [
        require_preset_shape(preset, seen_ids, seen_instruments)
        for preset in manifest["presets"]
    ]
    for preset in presets:
        pattern = rf"^@{preset['instrument']}\s+fm\b"
        if not re.search(pattern, preset_mml, flags=re.MULTILINE):
            raise RuntimeError(f"missing FM instrument @{preset['instrument']} for {preset['id']}")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    compiler = build_compiler()
    results = [compile_preset(compiler, preset_mml, preset) for preset in presets]
    validation = {
        "ok": True,
        "manifest": str(MANIFEST.relative_to(REPO_ROOT)),
        "mml": str(preset_mml_path.relative_to(REPO_ROOT)),
        "presetCount": len(results),
        "presets": results,
    }
    VALIDATION_FILE.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    print(
        "MML FM presets ok: "
        f"{len(results)} presets compiled, validation saved to {VALIDATION_FILE.relative_to(REPO_ROOT)}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc))
        raise SystemExit(1)
