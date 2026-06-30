#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_ROOT="${COMFYUI_ROOT:-$HOME/Documents/ComfyUI}"
COMFYUI_REPO="${DRIVE16_COMFYUI_REPO:-https://github.com/comfyanonymous/ComfyUI.git}"
COMFYUI_REV="${DRIVE16_COMFYUI_REV:-785141051163612f0e471a242c1f33341f60b9bd}"
BASE_DIR="${DRIVE16_COMFYUI_BASE_DIR:-$ROOT/artifacts/phase4/comfyui-api}"
SRC_DIR="${DRIVE16_COMFYUI_SRC_DIR:-$BASE_DIR/src-$COMFYUI_REV}"
HOST="${COMFYUI_HOST:-127.0.0.1}"
PORT="${COMFYUI_PORT:-8188}"
EXTRA_MODELS_CONFIG="${COMFYUI_EXTRA_MODELS_CONFIG:-$HOME/Library/Application Support/ComfyUI/extra_models_config.yaml}"
GENERATED_EXTRA_MODELS_CONFIG="$BASE_DIR/drive16-extra-models.yaml"
DATABASE_URL="${COMFYUI_DATABASE_URL:-sqlite:///$COMFYUI_ROOT/user/comfyui.db}"
PREPARE_ONLY=0
INSTALL_REQUIREMENTS=0

if [ -n "${DRIVE16_COMFYUI_PYTHON:-}" ]; then
  PYTHON_BIN="$DRIVE16_COMFYUI_PYTHON"
elif [ -x "$COMFYUI_ROOT/.venv/bin/python" ]; then
  PYTHON_BIN="$COMFYUI_ROOT/.venv/bin/python"
else
  PYTHON_BIN="$(command -v python3 || true)"
fi

usage() {
  cat <<EOF
Usage: scripts/launch-phase4-comfyui-api.sh [--prepare-only] [--install-requirements]

Fetches a pinned ComfyUI source checkout into ignored artifacts/ storage and
launches it against the local ComfyUI data folder on 127.0.0.1:8188 by default.
This avoids depending on Comfy Desktop bundle internals.

Options:
  --prepare-only          Fetch and verify the pinned source, then exit.
  --install-requirements  Install ComfyUI Python requirements into the selected
                          Python environment before launching.

Environment:
  COMFYUI_ROOT            Local ComfyUI data folder. Default: $HOME/Documents/ComfyUI
  COMFYUI_HOST            Listen host. Default: 127.0.0.1
  COMFYUI_PORT            Listen port. Default: 8188
  COMFYUI_EXTRA_MODELS_CONFIG
                          Optional explicit extra model paths config. When
                          unset, Drive16 generates a clean config from
                          COMFYUI_ROOT.
  COMFYUI_DATABASE_URL    ComfyUI database URL. Default: sqlite:///COMFYUI_ROOT/user/comfyui.db
  DRIVE16_COMFYUI_PYTHON  Python executable. Default: COMFYUI_ROOT/.venv/bin/python
  DRIVE16_COMFYUI_REV     Pinned ComfyUI source revision.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --prepare-only)
      PREPARE_ONLY=1
      shift
      ;;
    --install-requirements)
      INSTALL_REQUIREMENTS=1
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

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to fetch ComfyUI source." >&2
  exit 127
fi

if [ -z "$PYTHON_BIN" ] || [ ! -x "$PYTHON_BIN" ]; then
  echo "Python is required to launch ComfyUI." >&2
  exit 127
fi

if [ ! -d "$COMFYUI_ROOT" ]; then
  cat <<EOF
VALIDATION REQUEST: local ComfyUI data folder was not found.

Create or select a local ComfyUI data folder, then rerun with:

COMFYUI_ROOT=/path/to/ComfyUI scripts/launch-phase4-comfyui-api.sh
EOF
  exit 68
fi

if [ ! -d "$SRC_DIR/.git" ]; then
  mkdir -p "$BASE_DIR"
  git clone "$COMFYUI_REPO" "$SRC_DIR" >&2
  git -C "$SRC_DIR" checkout "$COMFYUI_REV" >&2
fi

HEAD="$(git -C "$SRC_DIR" rev-parse HEAD)"
if [ "$HEAD" != "$COMFYUI_REV" ]; then
  echo "ComfyUI source is at $HEAD, expected $COMFYUI_REV." >&2
  echo "Remove $SRC_DIR and retry if the ignored artifact drifted." >&2
  exit 65
fi

if [ "$INSTALL_REQUIREMENTS" -eq 1 ]; then
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python "$PYTHON_BIN" -r "$SRC_DIR/requirements.txt" >&2
  else
    "$PYTHON_BIN" -m pip install -r "$SRC_DIR/requirements.txt" >&2
  fi
fi

mkdir -p "$COMFYUI_ROOT/input" "$COMFYUI_ROOT/output" "$COMFYUI_ROOT/user"
mkdir -p "$BASE_DIR"

if [ -n "${COMFYUI_EXTRA_MODELS_CONFIG:-}" ]; then
  ACTIVE_EXTRA_MODELS_CONFIG="$EXTRA_MODELS_CONFIG"
else
  cat > "$GENERATED_EXTRA_MODELS_CONFIG" <<EOF
drive16:
  base_path: $COMFYUI_ROOT
  custom_nodes: custom_nodes/
  download_model_base: models
EOF
  ACTIVE_EXTRA_MODELS_CONFIG="$GENERATED_EXTRA_MODELS_CONFIG"
fi

echo "ComfyUI source: $SRC_DIR"
echo "ComfyUI revision: $HEAD"
echo "ComfyUI root: $COMFYUI_ROOT"
echo "Python: $PYTHON_BIN"
echo "URL: http://$HOST:$PORT"
echo "Extra models config: $ACTIVE_EXTRA_MODELS_CONFIG"
echo "Database URL: $DATABASE_URL"

if [ "$PREPARE_ONLY" -eq 1 ]; then
  exit 0
fi

ARGS=(
  "$SRC_DIR/main.py"
  --base-directory "$COMFYUI_ROOT"
  --user-directory "$COMFYUI_ROOT/user"
  --input-directory "$COMFYUI_ROOT/input"
  --output-directory "$COMFYUI_ROOT/output"
  --database-url "$DATABASE_URL"
  --listen "$HOST"
  --port "$PORT"
)

if [ -f "$ACTIVE_EXTRA_MODELS_CONFIG" ]; then
  ARGS+=(--extra-model-paths-config "$ACTIVE_EXTRA_MODELS_CONFIG")
fi

exec "$PYTHON_BIN" "${ARGS[@]}"
