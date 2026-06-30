#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/Documents/ComfyUI}"
PIXYDUST_REPO="${DRIVE16_PIXYDUST_REPO:-https://github.com/sousakujikken/ComfyUI-PixydustQuantizer.git}"
PIXYDUST_REV="${DRIVE16_PIXYDUST_REV:-6ffbb1ca23637f61559c3bd13f7be2b37d1dae03}"
PIXYDUST_DIR="$COMFYUI_ROOT/custom_nodes/ComfyUI-PixydustQuantizer"
CHECKPOINT_NAME="${DRIVE16_COMFYUI_CHECKPOINT:-sd_xl_base_1.0.safetensors}"
LORA_NAME="${DRIVE16_COMFYUI_LORA:-pixel-art-xl.safetensors}"
CHECKPOINT_PATH="$COMFYUI_ROOT/models/checkpoints/$CHECKPOINT_NAME"
LORA_PATH="$COMFYUI_ROOT/models/loras/$LORA_NAME"
INSTALL_PIXYDUST=0
INSTALL_PIXYDUST_REQUIREMENTS=0
RUN_CHECK=0

if [ -n "${DRIVE16_COMFYUI_PYTHON:-}" ]; then
  PYTHON_BIN="$DRIVE16_COMFYUI_PYTHON"
elif [ -x "$COMFYUI_ROOT/.venv/bin/python" ]; then
  PYTHON_BIN="$COMFYUI_ROOT/.venv/bin/python"
else
  PYTHON_BIN="$(command -v python3 || true)"
fi

usage() {
  cat <<EOF
Usage: scripts/setup-phase4-comfyui-prereqs.sh [--install-pixydust] [--install-pixydust-requirements] [--check]

Dry-run by default. Prints the local ComfyUI prerequisites for the Phase 4
generated-sprite workflow.

Options:
  --install-pixydust   Clone the Pixydust Quantizer node into COMFYUI_ROOT.
  --install-pixydust-requirements
                       Install Pixydust Python requirements into the selected
                       ComfyUI Python environment.
  --checkpoint <name>  SDXL-compatible checkpoint filename.
  --lora <name>        Pixel Art XL LoRA filename.
  --check              Run scripts/check-phase4-comfyui-readiness.py afterward.

Environment:
  COMFYUI_ROOT         Local ComfyUI data folder. Default: $HOME/Documents/ComfyUI
  DRIVE16_COMFYUI_PYTHON
                       Python executable. Default: COMFYUI_ROOT/.venv/bin/python
  DRIVE16_COMFYUI_CHECKPOINT
                       Checkpoint filename. Default: sd_xl_base_1.0.safetensors
  DRIVE16_COMFYUI_LORA
                       LoRA filename. Default: pixel-art-xl.safetensors
  DRIVE16_PIXYDUST_REPO
  DRIVE16_PIXYDUST_REV
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --install-pixydust)
      INSTALL_PIXYDUST=1
      shift
      ;;
    --install-pixydust-requirements)
      INSTALL_PIXYDUST_REQUIREMENTS=1
      shift
      ;;
    --checkpoint)
      if [ "$#" -lt 2 ]; then
        echo "--checkpoint requires a filename." >&2
        exit 64
      fi
      CHECKPOINT_NAME="$2"
      CHECKPOINT_PATH="$COMFYUI_ROOT/models/checkpoints/$CHECKPOINT_NAME"
      shift 2
      ;;
    --lora)
      if [ "$#" -lt 2 ]; then
        echo "--lora requires a filename." >&2
        exit 64
      fi
      LORA_NAME="$2"
      LORA_PATH="$COMFYUI_ROOT/models/loras/$LORA_NAME"
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

echo "Drive16 Phase 4 ComfyUI prerequisite setup"
echo "ComfyUI root: $COMFYUI_ROOT"
echo "Pixydust node: $PIXYDUST_DIR"
echo "Checkpoint path: $CHECKPOINT_PATH"
echo "LoRA path: $LORA_PATH"
echo

if [ ! -d "$COMFYUI_ROOT" ]; then
  cat <<EOF
VALIDATION REQUEST: local ComfyUI data folder was not found.

Create or select a local ComfyUI data folder, then rerun with:

COMFYUI_ROOT=/path/to/ComfyUI scripts/setup-phase4-comfyui-prereqs.sh
EOF
  exit 68
fi

if [ "$INSTALL_PIXYDUST" -eq 1 ]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "git is required to install the Pixydust custom node." >&2
    exit 127
  fi
  mkdir -p "$COMFYUI_ROOT/custom_nodes"
  if [ -e "$PIXYDUST_DIR" ]; then
    echo "Pixydust directory already exists, leaving it untouched:"
    echo "$PIXYDUST_DIR"
  else
    git clone "$PIXYDUST_REPO" "$PIXYDUST_DIR"
    git -C "$PIXYDUST_DIR" checkout "$PIXYDUST_REV"
  fi
else
  if [ -d "$PIXYDUST_DIR" ]; then
    echo "Pixydust directory present:"
    echo "$PIXYDUST_DIR"
  else
    cat <<EOF
Dry run: Pixydust was not installed.

To install the required Pixydust Quantizer custom node:

scripts/setup-phase4-comfyui-prereqs.sh --install-pixydust
EOF
  fi
fi

if [ "$INSTALL_PIXYDUST_REQUIREMENTS" -eq 1 ]; then
  if [ -z "$PYTHON_BIN" ] || [ ! -x "$PYTHON_BIN" ]; then
    echo "Python is required to install Pixydust requirements." >&2
    exit 127
  fi
  REQUIREMENTS="$PIXYDUST_DIR/requirements.txt"
  if [ ! -f "$REQUIREMENTS" ]; then
    echo "Pixydust requirements were not found at $REQUIREMENTS." >&2
    echo "Run with --install-pixydust first if the node is not installed." >&2
    exit 68
  fi
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python "$PYTHON_BIN" -r "$REQUIREMENTS" >&2
  else
    "$PYTHON_BIN" -m pip install -r "$REQUIREMENTS" >&2
  fi
  echo "Pixydust requirements installed with: $PYTHON_BIN"
fi

if [ ! -f "$CHECKPOINT_PATH" ] || [ ! -f "$LORA_PATH" ]; then
  cat <<EOF

VALIDATION REQUEST: Drive16's default ComfyUI model files are still required.

Default files:

$CHECKPOINT_PATH
$LORA_PATH

Install them from the reviewed Hugging Face sources after accepting the
upstream model licenses:

scripts/install-phase4-comfyui-models.sh --accept-model-licenses --check

Or use custom local files with:

export DRIVE16_COMFYUI_CHECKPOINT=your-checkpoint-name.safetensors
export DRIVE16_COMFYUI_LORA=your-lora-name.safetensors
EOF
else
  echo
  echo "Checkpoint present: $CHECKPOINT_PATH"
  echo "LoRA present: $LORA_PATH"
fi

if [ "$RUN_CHECK" -eq 1 ]; then
  echo
  COMFYUI_ROOT="$COMFYUI_ROOT" DRIVE16_COMFYUI_CHECKPOINT="$CHECKPOINT_NAME" DRIVE16_COMFYUI_LORA="$LORA_NAME" "$ROOT/scripts/check-phase4-comfyui-readiness.py"
fi
