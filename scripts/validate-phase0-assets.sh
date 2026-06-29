#!/usr/bin/env bash
set -euo pipefail

PROJECT="examples/phase0-assets"
ROM="$PROJECT/out/rom.bin"
SCREENSHOT="artifacts/phase0/phase0-assets.png"
INPUT_SCRIPT="artifacts/phase0/phase0-hold-right.csv"
RIGHT_SCREENSHOT="artifacts/phase0/phase0-assets-right.png"
AUDIO_DUMP="artifacts/phase0/phase0-assets.wav"
GENTEEL_BIN="${GENTEEL_BIN:-genteel}"
FRAMES="${GENTEEL_FRAMES:-180}"

scripts/generate-phase0-assets.py --check
scripts/build-sgdk.sh "$PROJECT"
scripts/validate-genteel.sh "$ROM" "$SCREENSHOT"

mkdir -p "$(dirname "$INPUT_SCRIPT")"
printf '0,...R....,........\n' > "$INPUT_SCRIPT"

"$GENTEEL_BIN" \
  --script "$INPUT_SCRIPT" \
  --headless "$FRAMES" \
  --screenshot "$RIGHT_SCREENSHOT" \
  --dump-audio "$AUDIO_DUMP" \
  "$ROM"

python3 - "$AUDIO_DUMP" <<'PY'
import sys
import wave

path = sys.argv[1]
with wave.open(path, "rb") as wav:
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

echo "Neutral screenshot: $SCREENSHOT"
echo "Right-input screenshot: $RIGHT_SCREENSHOT"
echo "Audio dump: $AUDIO_DUMP"
