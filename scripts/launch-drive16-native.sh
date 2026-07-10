#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"
APP_BUNDLE="$APP_DIR/src-tauri/target/debug/bundle/macos/Drive16.app"

pkill -x drive16 2>/dev/null || true

VITE_DRIVE16_ALLOW_STREAMED_CORE=1 pnpm --dir "$APP_DIR" tauri build --debug --bundles app
open "$APP_BUNDLE"

printf 'Opened %s\n' "$APP_BUNDLE"
