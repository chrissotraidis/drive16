#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/Documents/ComfyUI}"
CHECKPOINT_NAME="${DRIVE16_COMFYUI_CHECKPOINT:-sd_xl_base_1.0.safetensors}"
LORA_NAME="${DRIVE16_COMFYUI_LORA:-pixel-art-xl.safetensors}"
CHECKPOINT_URL="https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
LORA_URL="https://huggingface.co/nerijs/pixel-art-xl/resolve/main/pixel-art-xl.safetensors"
RUN_CHECK=0
ACCEPT_LICENSES=0
DRY_RUN=0

usage() {
  cat <<EOF
Usage: scripts/install-phase4-comfyui-models.sh --accept-model-licenses [options]

Installs Drive16's default Phase 4 local ComfyUI model dependencies:

  Checkpoint: stabilityai/stable-diffusion-xl-base-1.0
  LoRA:       nerijs/pixel-art-xl

These model weights are not bundled or committed to Drive16. Review the
upstream model cards and licenses before downloading. The default sources are
Hugging Face repositories with OpenRAIL-family licenses, not plain OSI
open-source software licenses.

Options:
  --accept-model-licenses  Required before downloading model weights.
  --checkpoint-url <url>   Override the SDXL checkpoint URL.
  --checkpoint <name>      Destination checkpoint filename.
                           Default: $CHECKPOINT_NAME
  --lora-url <url>         Override the Pixel Art XL LoRA URL.
  --lora <name>            Destination LoRA filename.
                           Default: $LORA_NAME
  --check                  Run scripts/check-phase4-comfyui-readiness.py after.
  --dry-run                Print the install plan without downloading.
  -h, --help               Show this help.

Environment:
  COMFYUI_ROOT             Local ComfyUI data folder. Default: $HOME/Documents/ComfyUI
  DRIVE16_COMFYUI_CHECKPOINT
                           Destination checkpoint filename default.
  DRIVE16_COMFYUI_LORA     Destination LoRA filename default.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --accept-model-licenses)
      ACCEPT_LICENSES=1
      shift
      ;;
    --checkpoint-url)
      if [ "$#" -lt 2 ]; then
        echo "--checkpoint-url requires a URL." >&2
        exit 64
      fi
      CHECKPOINT_URL="$2"
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
    --lora-url)
      if [ "$#" -lt 2 ]; then
        echo "--lora-url requires a URL." >&2
        exit 64
      fi
      LORA_URL="$2"
      shift 2
      ;;
    --lora)
      if [ "$#" -lt 2 ]; then
        echo "--lora requires a filename." >&2
        exit 64
      fi
      LORA_NAME="$2"
      shift 2
      ;;
    --check)
      RUN_CHECK=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

validate_filename() {
  local label="$1"
  local filename="$2"
  if [[ "$filename" == */* ]] || [[ "$filename" == "."* ]]; then
    echo "$label must be a filename, not a path: $filename" >&2
    exit 64
  fi
}

validate_filename "Checkpoint name" "$CHECKPOINT_NAME"
validate_filename "LoRA name" "$LORA_NAME"

CHECKPOINT_DIR="$COMFYUI_ROOT/models/checkpoints"
LORA_DIR="$COMFYUI_ROOT/models/loras"
CHECKPOINT_PATH="$CHECKPOINT_DIR/$CHECKPOINT_NAME"
LORA_PATH="$LORA_DIR/$LORA_NAME"

cat <<EOF
Drive16 Phase 4 ComfyUI model install plan

ComfyUI root: $COMFYUI_ROOT
Checkpoint:  $CHECKPOINT_PATH
Source:      $CHECKPOINT_URL
LoRA:        $LORA_PATH
Source:      $LORA_URL

Review:
  https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
  https://huggingface.co/nerijs/pixel-art-xl
EOF

if [ "$DRY_RUN" -eq 1 ]; then
  exit 0
fi

if [ "$ACCEPT_LICENSES" -ne 1 ]; then
  cat <<'EOF' >&2

VALIDATION REQUEST: rerun with --accept-model-licenses after reviewing the
upstream model licenses. Drive16 does not auto-accept model terms.
EOF
  exit 64
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to download model files." >&2
  exit 127
fi

download_if_missing() {
  local label="$1"
  local url="$2"
  local target="$3"
  local tmp="$target.tmp.$$"

  mkdir -p "$(dirname "$target")"
  if [ -s "$target" ]; then
    echo "$label already exists: $target"
    return
  fi

  echo "Downloading $label..."
  curl --fail --location --continue-at - --show-error --output "$tmp" "$url"
  if [ ! -s "$tmp" ]; then
    echo "$label download produced an empty file." >&2
    rm -f "$tmp"
    exit 66
  fi
  mv "$tmp" "$target"
  echo "$label installed: $target"
}

download_if_missing "SDXL base checkpoint" "$CHECKPOINT_URL" "$CHECKPOINT_PATH"
download_if_missing "Pixel Art XL LoRA" "$LORA_URL" "$LORA_PATH"

if [ "$RUN_CHECK" -eq 1 ]; then
  echo
  COMFYUI_ROOT="$COMFYUI_ROOT" \
    DRIVE16_COMFYUI_CHECKPOINT="$CHECKPOINT_NAME" \
    DRIVE16_COMFYUI_LORA="$LORA_NAME" \
    "$ROOT/scripts/check-phase4-comfyui-readiness.py"
fi
