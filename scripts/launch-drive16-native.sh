#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"
APP_BUNDLE="$APP_DIR/src-tauri/target/debug/bundle/macos/Drive16.app"

pkill -x drive16 2>/dev/null || true

# Warm Genteel/ctrmml in parallel with the app build so the first emulator or
# music tool call never compiles a toolchain inside its timeout.
"$ROOT_DIR/scripts/prewarm-local-tools.sh" >/dev/null 2>&1 &
PREWARM_PID=$!

VITE_DRIVE16_ALLOW_STREAMED_CORE=1 pnpm --dir "$APP_DIR" tauri build --debug --bundles app
wait "$PREWARM_PID" || echo "Local tool prewarm did not finish cleanly; first Verify may be slower." >&2
open "$APP_BUNDLE"

printf 'Opened %s\n' "$APP_BUNDLE"
