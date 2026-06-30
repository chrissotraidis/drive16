#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_URL="${COMFYUI_URL:-http://127.0.0.1:8188}"

cat <<EOF
Phase 4 live generated-assets proof

This runs the real gate in order:
1. ComfyUI readiness
2. Live ComfyUI sprite generation and PNG validation
3. Generated-sprite plus generated-MML ROM proof

ComfyUI URL: $COMFYUI_URL
Checkpoint: ${DRIVE16_COMFYUI_CHECKPOINT:-pixel-art-diffusion-xl.safetensors}
EOF

echo
echo "Step 1/3: ComfyUI readiness"
COMFYUI_URL="$COMFYUI_URL" "$ROOT/scripts/check-phase4-comfyui-readiness.py"

echo
echo "Step 2/3: Live ComfyUI sprite workflow"
COMFYUI_URL="$COMFYUI_URL" "$ROOT/scripts/run-comfyui-sprite-workflow.py"

echo
echo "Step 3/3: Generated-assets ROM proof"
COMFYUI_URL="$COMFYUI_URL" "$ROOT/scripts/validate-phase4-generated-assets-prompt.sh"

echo
echo "Phase 4 live generated-assets proof ok"
