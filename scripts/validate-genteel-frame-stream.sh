#!/usr/bin/env bash
set -euo pipefail

PROJECT="examples/phase0-assets"
ROM="$PROJECT/out/rom.bin"
STREAM="artifacts/phase0/phase0-assets.frames"
SCREENSHOT="artifacts/phase0/phase0-stream-proof.png"
GENTEEL_BIN="${GENTEEL_BIN:-$(scripts/build-genteel.sh)}"

scripts/generate-phase0-assets.py --check
scripts/build-sgdk.sh "$PROJECT"

"$GENTEEL_BIN" \
  --headless 180 \
  --stream-frames "$STREAM" \
  --stream-every 30 \
  --screenshot "$SCREENSHOT" \
  "$ROM"

scripts/validate-frame-stream.py "$STREAM" --min-frames 6

echo "Frame stream: $STREAM"
echo "Screenshot: $SCREENSHOT"
