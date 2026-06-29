#!/usr/bin/env bash
set -euo pipefail

PROJECT="examples/phase2-core-assets"
ROM="$PROJECT/out/rom.bin"
ARTIFACT_DIR="artifacts/phase2/core-assets"
SCREENSHOT="$ARTIFACT_DIR/phase2-core-assets.png"
INPUT_SCRIPT="$ARTIFACT_DIR/hold-right.csv"
RIGHT_SCREENSHOT="$ARTIFACT_DIR/phase2-core-assets-right.png"
AUDIO_DUMP="$ARTIFACT_DIR/phase2-core-assets.wav"
FRAMES="${GENTEEL_FRAMES:-180}"

if [ -z "${GENTEEL_BIN:-}" ]; then
  GENTEEL_BIN="$(scripts/build-genteel.sh)"
fi

scripts/validate-core-assets.py
scripts/build-sgdk.sh "$PROJECT"
GENTEEL_BIN="$GENTEEL_BIN" scripts/validate-genteel.sh "$ROM" "$SCREENSHOT"

mkdir -p "$ARTIFACT_DIR"
printf '0,...R....,........\n' > "$INPUT_SCRIPT"

"$GENTEEL_BIN" \
  --script "$INPUT_SCRIPT" \
  --headless "$FRAMES" \
  --screenshot "$RIGHT_SCREENSHOT" \
  --dump-audio "$AUDIO_DUMP" \
  "$ROM"

python3 - "$SCREENSHOT" "$RIGHT_SCREENSHOT" "$AUDIO_DUMP" <<'PY'
import sys
import wave
from pathlib import Path

neutral = Path(sys.argv[1])
right = Path(sys.argv[2])
audio = Path(sys.argv[3])

if not neutral.exists():
    raise SystemExit(f"Neutral screenshot missing: {neutral}")
if not right.exists():
    raise SystemExit(f"Right-input screenshot missing: {right}")

with wave.open(str(audio), "rb") as wav:
    frames = wav.readframes(wav.getnframes())
    samples = [
        int.from_bytes(frames[i:i + 2], "little", signed=True)
        for i in range(0, len(frames), 2)
    ]

if not samples:
    raise SystemExit("Audio dump contains no samples")

max_abs = max(abs(sample) for sample in samples)
if max_abs == 0:
    raise SystemExit("Audio dump is silent")

print(f"Audio dump is non-silent: max abs sample {max_abs}")
PY

scripts/validate-sprite-movement.py "$SCREENSHOT" "$RIGHT_SCREENSHOT" \
  --direction right \
  --min-delta 24 \
  --min-changed 40

echo "Neutral screenshot: $SCREENSHOT"
echo "Right-input screenshot: $RIGHT_SCREENSHOT"
echo "Audio dump: $AUDIO_DUMP"
