#!/usr/bin/env bash
set -euo pipefail

PROJECT="examples/phase0-assets"
ROM="$PROJECT/out/rom.bin"
SCREENSHOT="artifacts/phase0/phase0-assets.png"

scripts/generate-phase0-assets.py --check
scripts/build-sgdk.sh "$PROJECT"
scripts/validate-genteel.sh "$ROM" "$SCREENSHOT"

echo "If the screenshot exists, also run the ROM in a normal Genteel window."
echo "Expected live result: the D-pad moves the bundled sprite and the PSG loop is audible."
