#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="${DRIVE16_GENTEEL_REPO:-https://github.com/segin/genteel}"
COMMIT="${DRIVE16_GENTEEL_COMMIT:-8043061f50782d6066cd39925f0f808f06d665ea}"
SRC_DIR="${DRIVE16_GENTEEL_SRC_DIR:-$ROOT/artifacts/phase0/genteel-src}"
RUSTUP_HOME_DIR="${DRIVE16_RUSTUP_HOME:-$ROOT/artifacts/phase0/rustup}"
CARGO_HOME_DIR="${DRIVE16_CARGO_HOME:-$ROOT/artifacts/phase0/cargo}"
PATCH_FILE="${DRIVE16_GENTEEL_PATCH:-$ROOT/patches/genteel/phase0-frame-stream.patch}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to fetch Genteel." >&2
  exit 127
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "rustup is required to build Genteel reproducibly." >&2
  exit 127
fi

mkdir -p "$(dirname "$SRC_DIR")" "$RUSTUP_HOME_DIR" "$CARGO_HOME_DIR"

if [ -d "$SRC_DIR/.git" ]; then
  git -C "$SRC_DIR" fetch origin >&2
else
  git clone "$REPO_URL" "$SRC_DIR" >&2
fi

git -C "$SRC_DIR" checkout --quiet "$COMMIT" >&2
git -C "$SRC_DIR" reset --hard --quiet "$COMMIT" >&2

if [ -f "$PATCH_FILE" ]; then
  git -C "$SRC_DIR" apply "$PATCH_FILE"
fi

if ! RUSTUP_HOME="$RUSTUP_HOME_DIR" CARGO_HOME="$CARGO_HOME_DIR" \
  rustup run stable cargo --version >/dev/null 2>&1; then
  RUSTUP_HOME="$RUSTUP_HOME_DIR" CARGO_HOME="$CARGO_HOME_DIR" \
    rustup toolchain install stable --profile minimal >&2 || true
fi

RUSTUP_HOME="$RUSTUP_HOME_DIR" CARGO_HOME="$CARGO_HOME_DIR" \
  rustup run stable cargo --version >/dev/null

RUSTUP_HOME="$RUSTUP_HOME_DIR" CARGO_HOME="$CARGO_HOME_DIR" \
  rustup run stable cargo build --release --manifest-path "$SRC_DIR/Cargo.toml" >&2

echo "$SRC_DIR/target/release/genteel"
