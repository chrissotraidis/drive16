#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUNDLE="$ROOT_DIR/app/src-tauri/target/release/bundle/macos/Drive16.app"
DMG_PATH="${DRIVE16_DMG_PATH:-}"
if [[ -z "$DMG_PATH" ]]; then
  DMG_PATH="$(find "$ROOT_DIR/app/src-tauri/target/release/bundle/dmg" -maxdepth 1 -type f -name 'Drive16_*.dmg' -print -quit)"
fi
WORK_DIR="$(mktemp -d /private/tmp/drive16-release-smoke.XXXXXX)"
MOUNT_DIR="$WORK_DIR/mount"
INSTALL_DIR="$WORK_DIR/Applications"
CLEAN_HOME="$WORK_DIR/home"
LOG_PATH="$WORK_DIR/drive16.log"
APP_PID=""
MOUNTED=0

cleanup() {
  if [[ -n "$APP_PID" ]]; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [[ "$MOUNTED" == "1" ]]; then
    hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

for artifact in "$APP_BUNDLE" "$DMG_PATH"; do
  if [[ ! -e "$artifact" ]]; then
    printf 'Missing release artifact: %s\n' "$artifact" >&2
    exit 1
  fi
done

codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"
hdiutil verify "$DMG_PATH" >/dev/null

mkdir -p "$MOUNT_DIR" "$INSTALL_DIR" "$CLEAN_HOME"
hdiutil attach -readonly -nobrowse -mountpoint "$MOUNT_DIR" "$DMG_PATH" >/dev/null
MOUNTED=1
ditto "$MOUNT_DIR/Drive16.app" "$INSTALL_DIR/Drive16.app"
hdiutil detach "$MOUNT_DIR" >/dev/null
MOUNTED=0

codesign --verify --deep --strict --verbose=2 "$INSTALL_DIR/Drive16.app"

env \
  HOME="$CLEAN_HOME" \
  PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
  "$INSTALL_DIR/Drive16.app/Contents/MacOS/drive16" >"$LOG_PATH" 2>&1 &
APP_PID=$!

RUNTIME_ROOT="$CLEAN_HOME/Library/Application Support/dev.drive16.desktop/runtime"
ACTIVE_PROJECT="$RUNTIME_ROOT/artifacts/phase3/active-project"
for _ in {1..120}; do
  if [[ -f "$ACTIVE_PROJECT/Makefile" ]]; then
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    printf 'Packaged app exited during clean first launch.\n' >&2
    tail -n 120 "$LOG_PATH" >&2
    exit 1
  fi
  sleep 0.1
done

for entry in agent assets corpus examples mcp-servers patches scripts LICENSE opencode.json; do
  if [[ ! -e "$RUNTIME_ROOT/$entry" ]]; then
    printf 'Clean runtime is missing: %s\n' "$entry" >&2
    exit 1
  fi
done

if [[ ! -f "$ACTIVE_PROJECT/Makefile" ]]; then
  printf 'Clean first launch did not create the active project.\n' >&2
  tail -n 120 "$LOG_PATH" >&2
  exit 1
fi

if [[ ! -x "$RUNTIME_ROOT/scripts/build-sgdk.sh" ]]; then
  printf 'Packaged SGDK build script is not executable.\n' >&2
  exit 1
fi

printf 'Release smoke passed: strict signature, valid DMG, isolated install, writable runtime, active project.\n'
shasum -a 256 "$DMG_PATH"
