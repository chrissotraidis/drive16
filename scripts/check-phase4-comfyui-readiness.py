#!/usr/bin/env python3
"""Check local readiness for the Phase 4 ComfyUI sprite workflow."""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets" / "enhancements" / "comfyui" / "manifest.json"
WORKFLOW = ROOT / "assets" / "enhancements" / "comfyui" / "drive16-genesis-sprite.workflow.json"
ARTIFACT_DIR = ROOT / "artifacts" / "phase4" / "comfyui-readiness"
REPORT = ARTIFACT_DIR / "latest.json"
CHECKPOINT_SUFFIXES = {".safetensors", ".ckpt", ".pt"}
LORA_SUFFIXES = {".safetensors", ".ckpt", ".pt"}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def request_json(base_url: str, path: str, *, timeout: float) -> Any:
    url = base_url.rstrip("/") + path
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def checkpoint_candidates(comfyui_root: Path, checkpoint: str) -> list[Path]:
    checkpoint_path = Path(checkpoint)
    if checkpoint_path.is_absolute():
        return [checkpoint_path]
    return [
        comfyui_root / "models" / "checkpoints" / checkpoint,
        comfyui_root / "models" / checkpoint,
    ]


def lora_candidates(comfyui_root: Path, lora: str) -> list[Path]:
    lora_path = Path(lora)
    if lora_path.is_absolute():
        return [lora_path]
    return [
        comfyui_root / "models" / "loras" / lora,
        comfyui_root / "models" / "lora" / lora,
        comfyui_root / "models" / lora,
    ]


def checkpoint_hint_directories(comfyui_root: Path) -> list[Path]:
    return [
        comfyui_root / "models" / "checkpoints",
        comfyui_root / "models",
        Path.home() / "Documents" / "GitHub" / "Fooocus" / "models" / "checkpoints",
        Path.home() / ".diffusionbee" / "downloaded_assets",
    ]


def lora_hint_directories(comfyui_root: Path) -> list[Path]:
    return [
        comfyui_root / "models" / "loras",
        comfyui_root / "models" / "lora",
        comfyui_root / "models",
    ]


def nearby_checkpoint_hints(comfyui_root: Path, checked_paths: list[Path]) -> list[dict[str, str]]:
    return nearby_model_hints(checkpoint_hint_directories(comfyui_root), checked_paths, CHECKPOINT_SUFFIXES)


def nearby_lora_hints(comfyui_root: Path, checked_paths: list[Path]) -> list[dict[str, str]]:
    return nearby_model_hints(lora_hint_directories(comfyui_root), checked_paths, LORA_SUFFIXES)


def nearby_model_hints(
    directories: list[Path],
    checked_paths: list[Path],
    suffixes: set[str],
) -> list[dict[str, str]]:
    checked = {str(path.expanduser()) for path in checked_paths}
    seen: set[str] = set()
    hints: list[dict[str, str]] = []
    for directory in directories:
        if not directory.is_dir():
            continue
        for path in sorted(directory.iterdir(), key=lambda item: item.name.lower()):
            if not path.is_file() or path.suffix.lower() not in suffixes:
                continue
            path_text = str(path.expanduser())
            if path_text in checked or path_text in seen:
                continue
            seen.add(path_text)
            hints.append({"name": path.name, "path": path_text})
    return hints


def find_pixydust_candidates(comfyui_root: Path, source: str) -> list[Path]:
    custom_nodes = comfyui_root / "custom_nodes"
    if not custom_nodes.is_dir():
        return []
    source_lower = source.lower()
    return [
        path
        for path in custom_nodes.iterdir()
        if path.is_dir()
        and (
            source_lower in path.name.lower()
            or "pixydust" in path.name.lower()
            or "quantizer" in path.name.lower()
        )
    ]


def class_types(workflow: dict[str, Any]) -> list[str]:
    return sorted(
        {
            node.get("class_type", "")
            for node in workflow.values()
            if isinstance(node, dict) and isinstance(node.get("class_type"), str)
        }
    )


def object_info_classes(object_info: Any) -> set[str]:
    if not isinstance(object_info, dict):
        return set()
    return {
        key
        for key, value in object_info.items()
        if isinstance(key, str) and isinstance(value, dict)
    }


def checkpoint_names_from_object_info(object_info: Any) -> set[str]:
    if not isinstance(object_info, dict):
        return set()
    checkpoint = object_info.get("CheckpointLoaderSimple")
    if not isinstance(checkpoint, dict):
        return set()
    inputs = checkpoint.get("input", {}).get("required", {})
    ckpt_name = inputs.get("ckpt_name") if isinstance(inputs, dict) else None
    if (
        isinstance(ckpt_name, list)
        and ckpt_name
        and isinstance(ckpt_name[0], list)
    ):
        return {str(name) for name in ckpt_name[0]}
    return set()


def lora_names_from_object_info(object_info: Any) -> set[str]:
    if not isinstance(object_info, dict):
        return set()
    lora = object_info.get("LoraLoader")
    if not isinstance(lora, dict):
        return set()
    inputs = lora.get("input", {}).get("required", {})
    lora_name = inputs.get("lora_name") if isinstance(inputs, dict) else None
    if (
        isinstance(lora_name, list)
        and lora_name
        and isinstance(lora_name[0], list)
    ):
        return {str(name) for name in lora_name[0]}
    return set()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--comfyui-url",
        default=os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188"),
    )
    parser.add_argument(
        "--comfyui-root",
        default=os.environ.get("COMFYUI_ROOT", str(Path.home() / "Documents" / "ComfyUI")),
    )
    parser.add_argument(
        "--checkpoint",
        default=os.environ.get("DRIVE16_COMFYUI_CHECKPOINT"),
        help="SDXL-compatible checkpoint filename to require.",
    )
    parser.add_argument(
        "--lora",
        default=os.environ.get("DRIVE16_COMFYUI_LORA"),
        help="Pixel Art XL LoRA filename to require.",
    )
    parser.add_argument("--timeout", type=float, default=5)
    args = parser.parse_args()

    manifest = load_json(MANIFEST)
    workflow = load_json(WORKFLOW)
    comfyui_root = Path(args.comfyui_root).expanduser()
    manifest_checkpoint = str(manifest.get("model", {}).get("checkpoint", ""))
    manifest_lora = str(manifest.get("model", {}).get("lora", ""))
    checkpoint = str(args.checkpoint or manifest_checkpoint)
    lora = str(args.lora or manifest_lora)
    custom_nodes = manifest.get("customNodes", [])
    pixydust_source = ""
    if custom_nodes and isinstance(custom_nodes[0], dict):
        pixydust_source = str(custom_nodes[0].get("source", ""))

    checks: dict[str, Any] = {
        "api": {"ok": False, "url": args.comfyui_url},
        "checkpoint": {
            "ok": False,
            "name": checkpoint,
            "manifestName": manifest_checkpoint,
            "override": checkpoint != manifest_checkpoint,
        },
        "lora": {
            "ok": False,
            "name": lora,
            "manifestName": manifest_lora,
            "override": lora != manifest_lora,
        },
        "pixydustQuantizer": {"ok": False, "source": pixydust_source},
        "workflowClasses": {"ok": False, "classes": class_types(workflow)},
    }

    object_info: Any = None
    try:
        system_stats = request_json(args.comfyui_url, "/system_stats", timeout=args.timeout)
        checks["api"] = {"ok": True, "url": args.comfyui_url, "systemStatsType": type(system_stats).__name__}
        object_info = request_json(args.comfyui_url, "/object_info", timeout=args.timeout)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        checks["api"]["reason"] = str(exc)

    required_classes = set(class_types(workflow))
    if object_info is not None:
        available_classes = object_info_classes(object_info)
        missing_classes = sorted(required_classes - available_classes)
        checks["workflowClasses"].update(
            {
                "ok": not missing_classes,
                "missing": missing_classes,
                "availableRequired": sorted(required_classes & available_classes),
            }
        )
        api_checkpoints = checkpoint_names_from_object_info(object_info)
        checks["checkpoint"]["availableViaApi"] = sorted(api_checkpoints)
        if checkpoint in api_checkpoints:
            checks["checkpoint"]["ok"] = True
            checks["checkpoint"]["source"] = "api"
        api_loras = lora_names_from_object_info(object_info)
        checks["lora"]["availableViaApi"] = sorted(api_loras)
        if lora in api_loras:
            checks["lora"]["ok"] = True
            checks["lora"]["source"] = "api"
        if "Quantizer" in available_classes:
            checks["pixydustQuantizer"]["ok"] = True
            checks["pixydustQuantizer"]["source"] = "api"
    else:
        checks["workflowClasses"]["reason"] = (
            "ComfyUI API was not reachable, so node classes could not be inspected."
        )

    if not checks["checkpoint"]["ok"]:
        candidates = checkpoint_candidates(comfyui_root, checkpoint)
        existing = [path for path in candidates if path.is_file()]
        hints = nearby_checkpoint_hints(comfyui_root, candidates)
        checks["checkpoint"].update(
            {
                "ok": bool(existing),
                "checkedPaths": [str(path) for path in candidates],
                "nearbyCandidates": hints[:12],
                "nearbyCandidatesAreHintsOnly": True,
            }
        )
        if existing:
            checks["checkpoint"]["source"] = "filesystem"
            checks["checkpoint"]["path"] = str(existing[0])

    if not checks["lora"]["ok"]:
        candidates = lora_candidates(comfyui_root, lora)
        existing = [path for path in candidates if path.is_file()]
        hints = nearby_lora_hints(comfyui_root, candidates)
        checks["lora"].update(
            {
                "ok": bool(existing),
                "checkedPaths": [str(path) for path in candidates],
                "nearbyCandidates": hints[:12],
                "nearbyCandidatesAreHintsOnly": True,
            }
        )
        if existing:
            checks["lora"]["source"] = "filesystem"
            checks["lora"]["path"] = str(existing[0])

    if not checks["pixydustQuantizer"]["ok"]:
        candidates = find_pixydust_candidates(comfyui_root, pixydust_source)
        checks["pixydustQuantizer"].update(
            {
                "ok": bool(candidates),
                "checkedDirectory": str(comfyui_root / "custom_nodes"),
                "candidates": [str(path) for path in candidates],
            }
        )
        if candidates:
            checks["pixydustQuantizer"]["source"] = "filesystem"

    ok = all(
        checks[name]["ok"]
        for name in ["api", "checkpoint", "lora", "pixydustQuantizer", "workflowClasses"]
    )
    report = {
        "ok": ok,
        "comfyuiRoot": str(comfyui_root),
        "manifest": str(MANIFEST.relative_to(ROOT)),
        "workflow": str(WORKFLOW.relative_to(ROOT)),
        "checks": checks,
        "next": (
            "Run COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py"
            if ok
            else "Install/start the missing ComfyUI prerequisites, then rerun this readiness check."
        ),
    }
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    if ok:
        print(f"ComfyUI Phase 4 readiness ok: report saved to {REPORT.relative_to(ROOT)}")
        return 0

    print("VALIDATION REQUEST: Phase 4 ComfyUI sprite prerequisites are not ready.")
    print(f"Readiness report: {REPORT.relative_to(ROOT)}")
    for name in ["api", "checkpoint", "lora", "pixydustQuantizer", "workflowClasses"]:
        check = checks[name]
        if not check["ok"]:
            reason = (
                check.get("reason")
                or check.get("missing")
                or check.get("checkedPaths")
                or check.get("checkedDirectory")
            )
            print(f"- {name}: {reason}")
            if name in {"checkpoint", "lora"} and check.get("nearbyCandidates"):
                print(f"  Nearby {name} hints, not accepted automatically:")
                for candidate in check["nearbyCandidates"][:5]:
                    print(f"  - {candidate['name']}: {candidate['path']}")
    print(
        "Expected: local ComfyUI API on 127.0.0.1:8188, "
        "SDXL base checkpoint, Pixel Art XL LoRA, and Pixydust Quantizer node."
    )
    return 68


if __name__ == "__main__":
    raise SystemExit(main())
