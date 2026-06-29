#!/usr/bin/env bash
set -euo pipefail

ROM="${1:-examples/sgdk-hello-world/out/rom.bin}"
SCREENSHOT="${2:-artifacts/phase0/genteel-hello.png}"
GENTEEL_BIN="${GENTEEL_BIN:-genteel}"
FRAMES="${GENTEEL_FRAMES:-180}"

if [ ! -f "$ROM" ]; then
  echo "ROM not found: $ROM" >&2
  echo "Build it first with: scripts/build-sgdk.sh examples/sgdk-hello-world" >&2
  exit 66
fi

if ! command -v "$GENTEEL_BIN" >/dev/null 2>&1; then
  echo "Genteel binary not found: $GENTEEL_BIN" >&2
  echo "Set GENTEEL_BIN=/path/to/genteel and rerun this script." >&2
  exit 127
fi

mkdir -p "$(dirname "$SCREENSHOT")"

HELP_OUTPUT="$("$GENTEEL_BIN" --help 2>&1 || true)"

if printf '%s\n' "$HELP_OUTPUT" | grep -q -- "--screenshot" &&
  printf '%s\n' "$HELP_OUTPUT" | grep -q -- "--headless"; then
  "$GENTEEL_BIN" \
    --headless \
    "$FRAMES" \
    --screenshot "$SCREENSHOT" \
    "$ROM"

  if [ -f "$SCREENSHOT" ]; then
    echo "Captured screenshot: $SCREENSHOT"
    exit 0
  fi

  echo "Genteel ran, but screenshot was not created: $SCREENSHOT" >&2
  exit 66
fi

echo "Genteel was found, but this script could not confirm headless screenshot flags." >&2
echo "Please paste the output of this command back into the worklog loop:" >&2
echo "$GENTEEL_BIN --help" >&2
exit 65
