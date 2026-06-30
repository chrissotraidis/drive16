#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMFYUI_URL="${COMFYUI_URL:-http://127.0.0.1:8188}"
ARTIFACT_DIR="$ROOT/artifacts/phase4/comfyui-api-smoke"
LAUNCH_LOG="$ARTIFACT_DIR/comfyui-launch.log"
READINESS_LOG="$ARTIFACT_DIR/readiness.log"
REPORT="$ARTIFACT_DIR/latest.json"
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

cleanup() {
  if [ -n "$STARTED_PID" ]; then
    kill "$STARTED_PID" >/dev/null 2>&1 || true
    wait "$STARTED_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if api_ready; then
  echo "ComfyUI API already reachable: $COMFYUI_URL"
else
  : > "$LAUNCH_LOG"
  "$ROOT/scripts/launch-phase4-comfyui-api.sh" >"$LAUNCH_LOG" 2>&1 &
  STARTED_PID="$!"

  for _ in $(seq 1 "$WAIT_SECONDS"); do
    if api_ready; then
      break
    fi
    if ! kill -0 "$STARTED_PID" >/dev/null 2>&1; then
      echo "ComfyUI exited before the API became reachable. Log: ${LAUNCH_LOG#$ROOT/}" >&2
      tail -n 80 "$LAUNCH_LOG" >&2 || true
      exit 68
    fi
    sleep 1
  done

  if ! api_ready; then
    echo "ComfyUI API did not become reachable within ${WAIT_SECONDS}s. Log: ${LAUNCH_LOG#$ROOT/}" >&2
    tail -n 80 "$LAUNCH_LOG" >&2 || true
    exit 68
  fi
fi

READINESS_STATUS=0
"$ROOT/scripts/check-phase4-comfyui-readiness.py" --comfyui-url "$COMFYUI_URL" >"$READINESS_LOG" 2>&1 || READINESS_STATUS=$?
cat "$READINESS_LOG"

python3 - "$ROOT" "$REPORT" "$READINESS_STATUS" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
report = Path(sys.argv[2])
readiness_status = int(sys.argv[3])
readiness_path = root / "artifacts/phase4/comfyui-readiness/latest.json"
readiness = json.loads(readiness_path.read_text(encoding="utf-8"))
checks = readiness.get("checks", {})
api_ok = bool(checks.get("api", {}).get("ok"))
workflow_ok = bool(checks.get("workflowClasses", {}).get("ok"))
checkpoint_ok = bool(checks.get("checkpoint", {}).get("ok"))
pixydust_ok = bool(checks.get("pixydustQuantizer", {}).get("ok"))

payload = {
    "ok": api_ok and workflow_ok and pixydust_ok,
    "apiOk": api_ok,
    "workflowClassesOk": workflow_ok,
    "pixydustOk": pixydust_ok,
    "checkpointOk": checkpoint_ok,
    "readinessStatus": readiness_status,
    "readinessReport": "artifacts/phase4/comfyui-readiness/latest.json",
    "remainingGate": None if checkpoint_ok else "Pixel Art Diffusion XL compatible checkpoint",
}
report.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

if not api_ok:
    print("ComfyUI API smoke failed: API was not reachable.")
    raise SystemExit(68)
if not workflow_ok:
    print("ComfyUI API smoke failed: required workflow classes are missing.")
    raise SystemExit(68)
if not pixydust_ok:
    print("ComfyUI API smoke failed: Pixydust Quantizer is missing.")
    raise SystemExit(68)

print(f"ComfyUI API smoke ok: report saved to {report.relative_to(root)}")
if not checkpoint_ok:
    print("VALIDATION REQUEST: install the compatible checkpoint, then run the live sprite workflow.")
PY
