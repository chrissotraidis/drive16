#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_NAME="phase4_generated_assets_prompt_runs_when_tools_are_available"
LIVE_DIR="$ROOT/artifacts/phase4/live-comfyui-sprite"
LIVE_LOG="$LIVE_DIR/last-run.json"
FIXTURE_DIR="$ROOT/artifacts/phase4/generated-assets-fixture"
FIXTURE_PNG="$FIXTURE_DIR/generated-sprite.png"
BACKUP_LOG="$FIXTURE_DIR/previous-live-run.json"
LOG="/tmp/drive16-phase4-generated-assets-fixture-prompt.log"
HAD_LIVE_LOG=0

mkdir -p "$LIVE_DIR" "$FIXTURE_DIR"

restore_live_log() {
  if [ "$HAD_LIVE_LOG" -eq 1 ]; then
    mv "$BACKUP_LOG" "$LIVE_LOG"
  else
    rm -f "$LIVE_LOG" "$BACKUP_LOG"
  fi
}
trap restore_live_log EXIT

if [ -f "$LIVE_LOG" ]; then
  HAD_LIVE_LOG=1
  cp "$LIVE_LOG" "$BACKUP_LOG"
fi

"$ROOT/scripts/validate-generated-sprite.py" --self-test --symbol drive16_player
cp "$ROOT/artifacts/phase4/generated-sprite-validation/valid-generated-sprite.png" "$FIXTURE_PNG"
"$ROOT/scripts/validate-generated-sprite.py" "$FIXTURE_PNG" --symbol drive16_player

python3 - "$ROOT" "$FIXTURE_PNG" "$LIVE_LOG" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
sprite = Path(sys.argv[2]).resolve()
live_log = Path(sys.argv[3]).resolve()

payload = {
    "ok": True,
    "downloadedPng": str(sprite.relative_to(root)),
    "fixture": True,
    "note": "Synthetic fixture for Drive16 Phase 4 generated-assets prompt validation.",
}
live_log.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

cargo test --manifest-path "$ROOT/app/src-tauri/Cargo.toml" phase4_prompt -- --nocapture

set +e
cargo test --manifest-path "$ROOT/app/src-tauri/Cargo.toml" "$TEST_NAME" -- --ignored --nocapture >"$LOG" 2>&1
STATUS=$?
set -e

cat "$LOG"
if [ "$STATUS" -ne 0 ]; then
  exit "$STATUS"
fi

echo "Phase 4 generated assets fixture prompt ok"
