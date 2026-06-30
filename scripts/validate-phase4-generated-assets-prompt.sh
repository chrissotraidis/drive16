#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_NAME="phase4_generated_assets_prompt_runs_when_tools_are_available"
LOG="/tmp/drive16-phase4-generated-assets-prompt.log"

cargo test --manifest-path "$ROOT/app/src-tauri/Cargo.toml" phase4_prompt -- --nocapture

set +e
cargo test --manifest-path "$ROOT/app/src-tauri/Cargo.toml" "$TEST_NAME" -- --ignored --nocapture >"$LOG" 2>&1
STATUS=$?
set -e

cat "$LOG"

if [ "$STATUS" -eq 0 ]; then
  echo "Phase 4 generated assets prompt ok"
  exit 0
fi

if grep -E "Live ComfyUI sprite run|scripts/run-comfyui-sprite-workflow.py|local ComfyUI" "$LOG" >/dev/null; then
  cat <<'EOF'
VALIDATION REQUEST: live ComfyUI sprite output is required for the generated-assets ROM proof.

Place a Pixel Art Diffusion XL compatible checkpoint at:

~/Documents/ComfyUI/models/checkpoints/pixel-art-diffusion-xl.safetensors

If the compatible checkpoint uses a different local filename, set:

export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors

Start local ComfyUI:

scripts/launch-phase4-comfyui-api.sh

In another shell, confirm readiness and generate the sprite:

scripts/check-phase4-comfyui-readiness.py

COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py

Expected result: artifacts/phase4/live-comfyui-sprite/last-run.json records
ok: true and a downloaded PNG that passes scripts/validate-generated-sprite.py.

Then rerun:

scripts/validate-phase4-generated-assets-prompt.sh
EOF
  exit 66
fi

if grep -F "Phase 4 generated sprite validation failed" "$LOG" >/dev/null; then
  cat <<'EOF'
VALIDATION REQUEST: the live ComfyUI sprite PNG was generated but did not pass the Drive16 SGDK sprite validator.

Regenerate the sprite with:

scripts/check-phase4-comfyui-readiness.py
COMFYUI_URL=http://127.0.0.1:8188 scripts/run-comfyui-sprite-workflow.py

Expected result: the generated PNG is 32x32, uses at most 16 colors including
transparent index 0, resolves inside the repo, and validates as drive16_player.
EOF
  exit 67
fi

if grep -F "Docker daemon is not reachable" "$LOG" >/dev/null; then
  cat <<'EOF'
VALIDATION REQUEST: Docker Desktop is required for the SGDK generated-assets ROM build proof.

Start Docker Desktop, then run:

scripts/validate-phase4-generated-assets-prompt.sh

Expected result: the ignored native test builds the generated-assets SGDK
project, runs it in Genteel, captures neutral and Right-input screenshots,
proves Right-input sprite movement, and verifies non-silent generated music.
EOF
  exit 65
fi

exit "$STATUS"
