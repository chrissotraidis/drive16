#!/usr/bin/env bash
set -euo pipefail

COMMIT="846b1a3c8551392eebbab33182b80cf4291fd2e8"
BASE_URL="https://raw.githubusercontent.com/Stephane-D/SGDK/$COMMIT"
ROM_URL="$BASE_URL/sample/basics/hello-world/out/release/rom.bin"
SRC_URL="$BASE_URL/sample/basics/hello-world/src/main.c"
LICENSE_URL="$BASE_URL/license.txt"
EXPECTED_SHA256="bb92580661f957cbe1286c047a91614b3716d7c174bf3dede95b9df3477ac916"

OUT_DIR="artifacts/phase0/known-good"
ROM="$OUT_DIR/sgdk-hello-world.bin"
META="$OUT_DIR/sgdk-hello-world.txt"
SCREENSHOT="${1:-artifacts/phase0/known-good-homebrew.png}"

FETCH_ONLY=0
if [ "${1:-}" = "--fetch-only" ]; then
  FETCH_ONLY=1
  SCREENSHOT="artifacts/phase0/known-good-homebrew.png"
fi

mkdir -p "$OUT_DIR"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to fetch the known-good homebrew ROM." >&2
  exit 127
fi

curl -fsSL -o "$ROM" "$ROM_URL"

if command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(shasum -a 256 "$ROM" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(sha256sum "$ROM" | awk '{print $1}')"
else
  echo "shasum or sha256sum is required to verify the known-good ROM." >&2
  exit 127
fi

if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
  echo "Known-good ROM hash mismatch." >&2
  echo "Expected: $EXPECTED_SHA256" >&2
  echo "Actual:   $ACTUAL_SHA256" >&2
  exit 65
fi

cat > "$META" <<EOF
Source: $ROM_URL
Source code: $SRC_URL
License: MIT, $LICENSE_URL
Pinned commit: $COMMIT
SHA-256: $EXPECTED_SHA256
Expected behavior: SGDK hello-world sample draws "Hello world !" near screen center.
EOF

echo "Known-good homebrew ROM fetched and verified: $ROM"
echo "Metadata: $META"

if [ "$FETCH_ONLY" -eq 1 ]; then
  exit 0
fi

scripts/validate-genteel.sh "$ROM" "$SCREENSHOT"
