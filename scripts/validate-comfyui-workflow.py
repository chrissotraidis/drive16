#!/usr/bin/env python3
"""Validate the Phase 4 ComfyUI Genesis sprite workflow contract."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets" / "enhancements" / "comfyui" / "manifest.json"
WORKFLOW = ROOT / "assets" / "enhancements" / "comfyui" / "drive16-genesis-sprite.workflow.json"
ARTIFACT_DIR = ROOT / "artifacts" / "phase4" / "comfyui-workflow"
VALIDATION_FILE = ARTIFACT_DIR / "validation.json"


def fail(message: str) -> None:
    raise SystemExit(message)


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{path.relative_to(ROOT)} is not valid JSON: {exc}")


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def nodes_by_class(workflow: dict[str, Any], class_type: str) -> list[tuple[str, dict[str, Any]]]:
    return [
        (node_id, node)
        for node_id, node in workflow.items()
        if isinstance(node, dict) and node.get("class_type") == class_type
    ]


def one_node(workflow: dict[str, Any], class_type: str) -> tuple[str, dict[str, Any]]:
    matches = nodes_by_class(workflow, class_type)
    require(len(matches) == 1, f"Expected exactly one {class_type} node, found {len(matches)}.")
    return matches[0]


def input_link(
    workflow: dict[str, Any],
    node: dict[str, Any],
    input_name: str,
    expected_source: str | None = None,
) -> list[Any]:
    inputs = node.get("inputs")
    require(isinstance(inputs, dict), "Node inputs must be an object.")
    value = inputs.get(input_name)
    require(
        isinstance(value, list)
        and len(value) == 2
        and isinstance(value[0], str)
        and isinstance(value[1], int),
        f"Input {input_name} must be a ComfyUI link pair.",
    )
    require(value[0] in workflow, f"Input {input_name} links to missing node {value[0]}.")
    require(value[1] >= 0, f"Input {input_name} must use a non-negative output index.")
    if expected_source is not None:
        require(value[0] == expected_source, f"Input {input_name} must link from node {expected_source}.")
    return value


def validate_api_prompt(workflow: Any) -> dict[str, dict[str, Any]]:
    require(isinstance(workflow, dict), "Workflow must be a ComfyUI API prompt object.")
    require("nodes" not in workflow and "links" not in workflow, "Workflow must be API format, not UI format.")

    for node_id, node in workflow.items():
        require(node_id.isdigit(), f"Workflow node id {node_id!r} must be a numeric string.")
        require(isinstance(node, dict), f"Workflow node {node_id} must be an object.")
        require(isinstance(node.get("class_type"), str), f"Workflow node {node_id} needs class_type.")
        require(isinstance(node.get("inputs"), dict), f"Workflow node {node_id} needs inputs.")
    return workflow


def main() -> int:
    manifest = load_json(MANIFEST)
    workflow = validate_api_prompt(load_json(WORKFLOW))

    require(manifest.get("schemaVersion") == 1, "Manifest schemaVersion must be 1.")
    require(manifest.get("packId") == "drive16-comfyui-genesis-sprite", "Unexpected manifest packId.")
    require(manifest.get("runtime", {}).get("mcpServer") == "drive16-comfyui", "Manifest must target drive16-comfyui.")
    require(manifest.get("runtime", {}).get("tool") == "enqueue_workflow", "Manifest must target enqueue_workflow.")
    require(manifest.get("runtime", {}).get("format") == "comfyui-api-prompt", "Manifest must declare API prompt format.")
    require(manifest.get("runtime", {}).get("localOnly") is True, "Manifest must be local-only.")
    require(manifest.get("workflow", {}).get("path") == str(WORKFLOW.relative_to(ROOT)), "Manifest workflow path mismatch.")
    require(manifest.get("workflow", {}).get("nodeCount") == len(workflow), "Manifest node count mismatch.")

    required_classes = {
        "CheckpointLoaderSimple",
        "CLIPTextEncode",
        "EmptyLatentImage",
        "KSampler",
        "LoraLoader",
        "VAEDecode",
        "ImageScale",
        "Quantizer",
        "SaveImage",
    }
    present_classes = {node["class_type"] for node in workflow.values()}
    missing = sorted(required_classes - present_classes)
    require(not missing, f"Workflow missing required node classes: {missing}")

    forbidden_fragments = ["api", "bfl", "fluxpro", "openai", "hosted"]
    for node_id, node in workflow.items():
        class_type = node["class_type"].lower()
        require(
            not any(fragment in class_type for fragment in forbidden_fragments),
            f"Workflow node {node_id} appears to use a hosted/API class: {node['class_type']}",
        )

    checkpoint_id, checkpoint = one_node(workflow, "CheckpointLoaderSimple")
    checkpoint_name = checkpoint["inputs"].get("ckpt_name")
    require(checkpoint_name == manifest["model"]["checkpoint"], "Checkpoint name must match manifest.")

    lora_id, lora = one_node(workflow, "LoraLoader")
    require(lora["inputs"].get("lora_name") == manifest["model"]["lora"], "LoRA name must match manifest.")
    input_link(workflow, lora, "model", checkpoint_id)
    input_link(workflow, lora, "clip", checkpoint_id)
    require(0.1 <= lora["inputs"].get("strength_model", 0) <= 2.0, "LoRA model strength must be in range.")
    require(0.1 <= lora["inputs"].get("strength_clip", 0) <= 2.0, "LoRA clip strength must be in range.")

    prompt_nodes = nodes_by_class(workflow, "CLIPTextEncode")
    require(len(prompt_nodes) == 2, f"Expected two CLIPTextEncode nodes, found {len(prompt_nodes)}.")
    prompt_text = " ".join(str(node["inputs"].get("text", "")) for _, node in prompt_nodes).lower()
    for token in ["genesis", "sprite", "pixel", "32x32", "16 color"]:
        require(token in prompt_text, f"Prompt text must include {token!r}.")
    for _, prompt in prompt_nodes:
        input_link(workflow, prompt, "clip", lora_id)

    latent_id, latent = one_node(workflow, "EmptyLatentImage")
    source_size = manifest["generation"]["sourceSize"]
    require(latent["inputs"].get("width") == source_size["width"], "Latent width must match manifest.")
    require(latent["inputs"].get("height") == source_size["height"], "Latent height must match manifest.")
    require(latent["inputs"].get("batch_size") == 1, "Workflow must generate one sprite at a time.")
    require(source_size["width"] >= 32 and source_size["height"] >= 32, "Source size must be at least 32x32.")
    require(source_size["width"] % 8 == 0 and source_size["height"] % 8 == 0, "Source size must align to 8-pixel tiles.")

    sampler_id, sampler = one_node(workflow, "KSampler")
    for name in ["model", "positive", "negative", "latent_image"]:
        input_link(workflow, sampler, name)
    require(sampler["inputs"]["model"][0] == lora_id, "Sampler model must link from LoRA output.")
    require(sampler["inputs"]["latent_image"][0] == latent_id, "Sampler latent image must link from latent node.")
    require(12 <= sampler["inputs"].get("steps", 0) <= 40, "Sampler steps must be in the tuned sprite range.")
    require(4 <= sampler["inputs"].get("cfg", 0) <= 12, "Sampler cfg must be in the tuned sprite range.")
    require(isinstance(sampler["inputs"].get("seed"), int), "Sampler seed must be an integer.")

    decode_id, decode = one_node(workflow, "VAEDecode")
    input_link(workflow, decode, "samples", sampler_id)
    input_link(workflow, decode, "vae", checkpoint_id)

    scale_id, scale = one_node(workflow, "ImageScale")
    output_size = manifest["generation"]["outputSize"]
    input_link(workflow, scale, "image", decode_id)
    require(scale["inputs"].get("width") == output_size["width"] == 32, "Scaled output width must be 32.")
    require(scale["inputs"].get("height") == output_size["height"] == 32, "Scaled output height must be 32.")
    require("nearest" in str(scale["inputs"].get("upscale_method", "")).lower(), "Scale method must be nearest-neighbor.")

    quantizer_id, quantizer = one_node(workflow, "Quantizer")
    input_link(workflow, quantizer, "reduced_image", scale_id)
    palette = manifest["generation"]["palette"]
    require(quantizer["inputs"].get("fixed_colors") == palette["maxColors"] == 16, "Quantizer must use 16 colors.")
    require(quantizer["inputs"].get("dither_pattern") == "None", "Quantizer dithering must be off for sprite readability.")
    require(quantizer["inputs"].get("batch_mode") == "All Batches", "Quantizer must process all batches.")
    require(quantizer["inputs"].get("max_batch_size") == 1, "Quantizer must process one generated sprite.")
    require(palette["transparentIndex"] == 0, "Manifest must reserve palette index 0 for transparency.")

    _, save = one_node(workflow, "SaveImage")
    input_link(workflow, save, "images", quantizer_id)
    require(
        save["inputs"].get("filename_prefix") == manifest["workflow"]["outputPrefix"],
        "SaveImage filename_prefix must match manifest.",
    )

    require(manifest["generation"].get("tilesWide") == 4, "Manifest tilesWide must be 4.")
    require(manifest["generation"].get("tilesHigh") == 4, "Manifest tilesHigh must be 4.")
    require("4 4" in manifest["generation"].get("rescomp", ""), "Manifest rescomp contract must use 4x4 tiles.")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    validation = {
        "ok": True,
        "manifest": str(MANIFEST.relative_to(ROOT)),
        "workflow": str(WORKFLOW.relative_to(ROOT)),
        "nodeCount": len(workflow),
        "outputSize": output_size,
        "maxColors": palette["maxColors"],
        "checkpoint": checkpoint_name,
        "lora": lora["inputs"].get("lora_name"),
    }
    VALIDATION_FILE.write_text(json.dumps(validation, indent=2) + "\n", encoding="utf-8")
    print(
        "ComfyUI workflow ok: "
        f"{validation['nodeCount']} nodes, {output_size['width']}x{output_size['height']}, "
        f"{palette['maxColors']} colors, validation saved to {VALIDATION_FILE.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
