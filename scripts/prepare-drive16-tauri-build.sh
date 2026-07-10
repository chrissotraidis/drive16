#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GENERATED_DIR="$ROOT_DIR/app/src-tauri/generated"

VITE_DRIVE16_ALLOW_STREAMED_CORE=1 pnpm --dir "$ROOT_DIR/app" build

GENTEEL_BIN="$("$ROOT_DIR/scripts/build-genteel.sh")"
if [[ ! -x "$GENTEEL_BIN" ]]; then
  printf 'Genteel build did not produce an executable: %s\n' "$GENTEEL_BIN" >&2
  exit 1
fi

mkdir -p "$GENERATED_DIR"
cp "$GENTEEL_BIN" "$GENERATED_DIR/genteel"
chmod +x "$GENERATED_DIR/genteel"
printf 'Prepared bundled Genteel verifier: %s\n' "$GENERATED_DIR/genteel"
