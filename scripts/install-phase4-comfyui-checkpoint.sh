#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/Documents/ComfyUI}"
CHECKPOINT_NAME="${DRIVE16_COMFYUI_CHECKPOINT:-sd_xl_base_1.0.safetensors}"
SOURCE=""
SHA256_EXPECTED=""
RUN_CHECK=0
LINK_MODE=0

usage() {
  cat <<EOF
Usage: scripts/install-phase4-comfyui-checkpoint.sh --source <path-or-url> [options]

Places a user-provided SDXL-compatible checkpoint into the local ComfyUI
checkpoints folder. Drive16 does not bundle model weights.

Options:
  --source <path-or-url>  Local file or https URL to an SDXL-compatible checkpoint.
  --checkpoint <name>     Destination checkpoint filename.
                         Default: $CHECKPOINT_NAME
  --sha256 <hash>         Optional SHA-256 to verify after copy/download.
  --link                  Symlink a local source file instead of copying it.
  --check                 Run scripts/check-phase4-comfyui-readiness.py after.
  -h, --help              Show this help.

Environment:
  COMFYUI_ROOT            Local ComfyUI data folder. Default: $HOME/Documents/ComfyUI
  DRIVE16_COMFYUI_CHECKPOINT
                         Destination filename default.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source)
      if [ "$#" -lt 2 ]; then
        echo "--source requires a path or URL." >&2
        exit 64
      fi
      SOURCE="$2"
      shift 2
      ;;
    --checkpoint)
      if [ "$#" -lt 2 ]; then
        echo "--checkpoint requires a filename." >&2
        exit 64
      fi
      CHECKPOINT_NAME="$2"
      shift 2
      ;;
    --sha256)
      if [ "$#" -lt 2 ]; then
        echo "--sha256 requires a hash." >&2
        exit 64
      fi
      SHA256_EXPECTED="$2"
      shift 2
      ;;
    --link)
      LINK_MODE=1
      shift
      ;;
    --check)
      RUN_CHECK=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

if [ -z "$SOURCE" ]; then
  usage >&2
  cat <<'EOF' >&2

VALIDATION REQUEST: provide an explicit compatible checkpoint source.

Example:

scripts/install-phase4-comfyui-checkpoint.sh \
  --source /path/to/compatible-checkpoint.safetensors \
  --checkpoint sd_xl_base_1.0.safetensors \
  --sha256 <optional-known-hash> \
  --check
EOF
  exit 64
fi

if [[ "$CHECKPOINT_NAME" == */* ]] || [[ "$CHECKPOINT_NAME" == "."* ]]; then
  echo "Checkpoint name must be a filename, not a path: $CHECKPOINT_NAME" >&2
  exit 64
fi

CHECKPOINT_DIR="$COMFYUI_ROOT/models/checkpoints"
CHECKPOINT_PATH="$CHECKPOINT_DIR/$CHECKPOINT_NAME"
mkdir -p "$CHECKPOINT_DIR"
TMP_PATH="$CHECKPOINT_PATH.tmp.$$"
SOURCE_PATH=""
INSTALL_PATH="$TMP_PATH"
INSTALL_MODE="installed"

cleanup() {
  rm -f "$TMP_PATH"
}
trap cleanup EXIT

case "$SOURCE" in
  http://*|https://*)
    if [ "$LINK_MODE" -eq 1 ]; then
      echo "--link requires a local source file, not a URL." >&2
      exit 64
    fi
    if ! command -v curl >/dev/null 2>&1; then
      echo "curl is required to download checkpoint URLs." >&2
      exit 127
    fi
    curl --fail --location --show-error --output "$TMP_PATH" "$SOURCE"
    ;;
  *)
    if [ ! -f "$SOURCE" ]; then
      echo "Checkpoint source file not found: $SOURCE" >&2
      exit 66
    fi
    SOURCE_DIR="$(cd "$(dirname "$SOURCE")" && pwd -P)"
    SOURCE_PATH="$SOURCE_DIR/$(basename "$SOURCE")"
    if [ "$LINK_MODE" -eq 1 ]; then
      if [ "$SOURCE_PATH" = "$CHECKPOINT_PATH" ]; then
        INSTALL_PATH="$CHECKPOINT_PATH"
        INSTALL_MODE="already installed"
      else
        ln -s "$SOURCE_PATH" "$TMP_PATH"
        INSTALL_MODE="linked"
      fi
    else
      cp "$SOURCE_PATH" "$TMP_PATH"
    fi
    ;;
esac

if [ ! -s "$INSTALL_PATH" ]; then
  echo "Checkpoint source produced an empty file." >&2
  exit 66
fi

if [ -n "$SHA256_EXPECTED" ]; then
  SHA256_ACTUAL="$(shasum -a 256 "$INSTALL_PATH" | awk '{print $1}')"
  if [ "$SHA256_ACTUAL" != "$SHA256_EXPECTED" ]; then
    echo "Checkpoint SHA-256 mismatch." >&2
    echo "Expected: $SHA256_EXPECTED" >&2
    echo "Actual:   $SHA256_ACTUAL" >&2
    exit 66
  fi
fi

if [ "$INSTALL_PATH" != "$CHECKPOINT_PATH" ]; then
  mv "$TMP_PATH" "$CHECKPOINT_PATH"
fi

case "$INSTALL_MODE" in
  linked)
    echo "Checkpoint linked: $CHECKPOINT_PATH -> $SOURCE_PATH"
    ;;
  "already installed")
    echo "Checkpoint already installed: $CHECKPOINT_PATH"
    ;;
  *)
    echo "Checkpoint installed: $CHECKPOINT_PATH"
    ;;
esac
if [ -n "$SHA256_EXPECTED" ]; then
  echo "SHA-256 verified: $SHA256_EXPECTED"
fi

if [ "$RUN_CHECK" -eq 1 ]; then
  echo
  COMFYUI_ROOT="$COMFYUI_ROOT" DRIVE16_COMFYUI_CHECKPOINT="$CHECKPOINT_NAME" "$ROOT/scripts/check-phase4-comfyui-readiness.py"
fi
