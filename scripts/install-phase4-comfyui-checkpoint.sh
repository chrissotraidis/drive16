#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/Documents/ComfyUI}"
CHECKPOINT_NAME="${DRIVE16_COMFYUI_CHECKPOINT:-pixel-art-diffusion-xl.safetensors}"
SOURCE=""
SHA256_EXPECTED=""
RUN_CHECK=0

usage() {
  cat <<EOF
Usage: scripts/install-phase4-comfyui-checkpoint.sh --source <path-or-url> [options]

Places a user-provided Pixel Art Diffusion XL compatible checkpoint into the
local ComfyUI checkpoints folder. Drive16 does not choose or bundle model
weights automatically.

Options:
  --source <path-or-url>  Local file or https URL to a compatible checkpoint.
  --checkpoint <name>     Destination checkpoint filename.
                         Default: $CHECKPOINT_NAME
  --sha256 <hash>         Optional SHA-256 to verify after copy/download.
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
  --checkpoint pixel-art-diffusion-xl.safetensors \
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

cleanup() {
  rm -f "$TMP_PATH"
}
trap cleanup EXIT

case "$SOURCE" in
  http://*|https://*)
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
    cp "$SOURCE" "$TMP_PATH"
    ;;
esac

if [ ! -s "$TMP_PATH" ]; then
  echo "Checkpoint source produced an empty file." >&2
  exit 66
fi

if [ -n "$SHA256_EXPECTED" ]; then
  SHA256_ACTUAL="$(shasum -a 256 "$TMP_PATH" | awk '{print $1}')"
  if [ "$SHA256_ACTUAL" != "$SHA256_EXPECTED" ]; then
    echo "Checkpoint SHA-256 mismatch." >&2
    echo "Expected: $SHA256_EXPECTED" >&2
    echo "Actual:   $SHA256_ACTUAL" >&2
    exit 66
  fi
fi

mv "$TMP_PATH" "$CHECKPOINT_PATH"

echo "Checkpoint installed: $CHECKPOINT_PATH"
if [ -n "$SHA256_EXPECTED" ]; then
  echo "SHA-256 verified: $SHA256_EXPECTED"
fi

if [ "$RUN_CHECK" -eq 1 ]; then
  echo
  COMFYUI_ROOT="$COMFYUI_ROOT" DRIVE16_COMFYUI_CHECKPOINT="$CHECKPOINT_NAME" "$ROOT/scripts/check-phase4-comfyui-readiness.py"
fi
