#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="${DRIVE16_CTRMML_REPO_URL:-https://github.com/superctr/ctrmml.git}"
COMMIT="${DRIVE16_CTRMML_COMMIT:-ca87769a5e73d69a514401e15a8d8bb193a3c0ef}"
BASE_DIR="${DRIVE16_CTRMML_BASE_DIR:-$ROOT/artifacts/phase4/ctrmml}"
SRC_DIR="$BASE_DIR/src-$COMMIT"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to fetch ctrmml." >&2
  exit 127
fi

if ! command -v make >/dev/null 2>&1; then
  echo "make is required to build ctrmml." >&2
  exit 127
fi

if [ ! -d "$SRC_DIR/.git" ]; then
  mkdir -p "$BASE_DIR"
  git clone "$REPO_URL" "$SRC_DIR" >&2
  git -C "$SRC_DIR" checkout "$COMMIT" >&2
fi

HEAD="$(git -C "$SRC_DIR" rev-parse HEAD)"
if [ "$HEAD" != "$COMMIT" ]; then
  echo "ctrmml source is at $HEAD, expected $COMMIT." >&2
  echo "Remove $SRC_DIR and retry if the ignored artifact drifted." >&2
  exit 65
fi

if [ ! -x "$SRC_DIR/mmlc" ]; then
  make -C "$SRC_DIR" RELEASE=1 mmlc >&2
fi

if [ ! -x "$SRC_DIR/mmlc" ]; then
  echo "ctrmml build did not create $SRC_DIR/mmlc." >&2
  exit 66
fi

printf '%s\n' "$SRC_DIR/mmlc"
