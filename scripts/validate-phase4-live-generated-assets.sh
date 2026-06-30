#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_URL="${COMFYUI_URL:-http://127.0.0.1:8188}"
ARTIFACT_DIR="$ROOT/artifacts/phase4/live-generated-assets-proof"
LAUNCH_LOG="$ARTIFACT_DIR/comfyui-launch.log"
WAIT_SECONDS="${DRIVE16_COMFYUI_API_WAIT_SECONDS:-120}"
STARTED_PID=""

mkdir -p "$ARTIFACT_DIR"

api_ready() {
  python3 - "$COMFYUI_URL" <<'PY'
import json
import sys
import urllib.request

url = sys.argv[1].rstrip("/") + "/system_stats"
try:
    with urllib.request.urlopen(url, timeout=2) as response:
        json.loads(response.read().decode("utf-8"))
except Exception:
    raise SystemExit(1)
PY
}

comfyui_host_port() {
  python3 - "$COMFYUI_URL" <<'PY'
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
host = parsed.hostname or "127.0.0.1"
port = parsed.port or (443 if parsed.scheme == "https" else 80)
print(host, port)
PY
}

cleanup() {
  if [ -n "$STARTED_PID" ]; then
    kill "$STARTED_PID" >/dev/null 2>&1 || true
    wait "$STARTED_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

ensure_comfyui_api() {
  if api_ready; then
    echo "ComfyUI API already reachable: $COMFYUI_URL"
    return
  fi

  read -r URL_HOST URL_PORT < <(comfyui_host_port)
  case "$URL_HOST" in
    127.0.0.1|localhost|::1)
      ;;
    *)
      echo "VALIDATION REQUEST: ComfyUI API is not reachable at $COMFYUI_URL." >&2
      echo "Start ComfyUI yourself for non-local endpoints, then rerun this proof." >&2
      exit 68
      ;;
  esac

  echo "ComfyUI API is not reachable; launching local ComfyUI API."
  : > "$LAUNCH_LOG"
  COMFYUI_HOST="${COMFYUI_HOST:-$URL_HOST}" \
    COMFYUI_PORT="${COMFYUI_PORT:-$URL_PORT}" \
    "$ROOT/scripts/launch-phase4-comfyui-api.sh" >"$LAUNCH_LOG" 2>&1 &
  STARTED_PID="$!"

  for _ in $(seq 1 "$WAIT_SECONDS"); do
    if api_ready; then
      echo "ComfyUI API launched: $COMFYUI_URL"
      return
    fi
    if ! kill -0 "$STARTED_PID" >/dev/null 2>&1; then
      echo "ComfyUI exited before the API became reachable. Log: ${LAUNCH_LOG#$ROOT/}" >&2
      tail -n 80 "$LAUNCH_LOG" >&2 || true
      exit 68
    fi
    sleep 1
  done

  echo "ComfyUI API did not become reachable within ${WAIT_SECONDS}s. Log: ${LAUNCH_LOG#$ROOT/}" >&2
  tail -n 80 "$LAUNCH_LOG" >&2 || true
  exit 68
}

cat <<EOF
Phase 4 live generated-assets proof

This runs the real gate in order:
0. Start local ComfyUI API if needed
1. ComfyUI readiness
2. Live ComfyUI sprite generation and PNG validation
3. Generated-sprite plus generated-MML ROM proof

ComfyUI URL: $COMFYUI_URL
Checkpoint: ${DRIVE16_COMFYUI_CHECKPOINT:-sd_xl_base_1.0.safetensors}
LoRA: ${DRIVE16_COMFYUI_LORA:-pixel-art-xl.safetensors}
EOF

echo
echo "Step 0/3: ComfyUI API"
ensure_comfyui_api

echo
echo "Step 1/3: ComfyUI readiness"
COMFYUI_URL="$COMFYUI_URL" "$ROOT/scripts/check-phase4-comfyui-readiness.py"

echo
echo "Step 2/3: Live ComfyUI sprite workflow"
COMFYUI_URL="$COMFYUI_URL" "$ROOT/scripts/run-comfyui-sprite-workflow.py"

echo
echo "Step 3/3: Generated-assets ROM proof"
COMFYUI_URL="$COMFYUI_URL" "$ROOT/scripts/validate-phase4-generated-assets-prompt.sh"

echo
echo "Phase 4 live generated-assets proof ok"
