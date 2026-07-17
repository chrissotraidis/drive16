#!/usr/bin/env bash
set -euo pipefail

# Pre-build the local verification toolchains so the first run_rom /
# compile_music MCP call never pays a multi-minute git-clone + compile inside
# a tool-call timeout. Both build scripts are stamp-cached: warm runs return
# in well under a second.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Prewarming Genteel (verification emulator)..."
"$ROOT/scripts/build-genteel.sh" >/dev/null
echo "Genteel ready."

echo "Prewarming ctrmml (MML music compiler)..."
"$ROOT/scripts/build-ctrmml.sh" >/dev/null
echo "ctrmml ready."

echo "Prewarming ComfyUI checkpoint (skipped when ComfyUI is down)..."
python3 "$ROOT/scripts/prewarm-comfyui-checkpoint.py" || echo "ComfyUI checkpoint prewarm did not finish; first sprite may be slower." >&2

echo "Local tools are warm."
