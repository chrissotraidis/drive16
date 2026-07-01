#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/app"
ARTIFACT_ROOT="$ROOT/artifacts/phase6/verify-loop"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$ARTIFACT_ROOT/$RUN_ID"

REPEAT=1
UNTIL_FAIL=0
BROWSER_MODE="auto"
BROWSER_URL="${DRIVE16_VERIFY_URL:-http://127.0.0.1:1420/}"
BROWSER_ROM="${DRIVE16_VERIFY_ROM:-$ROOT/examples/app-starter-blank/out/rom.bin}"
RUN_V1_PROOF=0

usage() {
  cat <<'EOF'
Usage: scripts/verify-phase6-loop.sh [options]

Runs the repeatable Phase 6 verification loop:
  - frontend build
  - native formatting check
  - native test suite
  - optional generated CORE/V1 proof
  - git whitespace and tracked-artifact hygiene
  - optional browser smoke against a running preview

Options:
  --browser              Require browser smoke against the current preview URL.
  --no-browser           Skip browser smoke.
  --url <url>            Browser preview URL. Default: http://127.0.0.1:1420/
  --rom <path>           Local ROM for browser smoke file import.
  --with-v1-proof        Run the ignored generated CORE/V1 proof test.
  --repeat <n>           Run the whole loop n times. Default: 1.
  --until-fail           Repeat until a step fails.
  -h, --help             Show this help.

Environment:
  DRIVE16_VERIFY_URL             Default browser URL.
  DRIVE16_VERIFY_ROM             Default browser smoke ROM.
  PLAYWRIGHT_CHANNEL             Browser channel for smoke test. Default: chrome.
  PLAYWRIGHT_EXECUTABLE_PATH     Browser executable override.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --browser)
      BROWSER_MODE="required"
      shift
      ;;
    --no-browser)
      BROWSER_MODE="off"
      shift
      ;;
    --url)
      BROWSER_URL="${2:?--url requires a value}"
      shift 2
      ;;
    --rom)
      BROWSER_ROM="${2:?--rom requires a value}"
      shift 2
      ;;
    --with-v1-proof)
      RUN_V1_PROOF=1
      shift
      ;;
    --repeat)
      REPEAT="${2:?--repeat requires a value}"
      shift 2
      ;;
    --until-fail)
      UNTIL_FAIL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! [[ "$REPEAT" =~ ^[0-9]+$ ]] || [[ "$REPEAT" -lt 1 ]]; then
  echo "--repeat must be a positive integer." >&2
  exit 2
fi

mkdir -p "$RUN_DIR"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'FAILED: %s\n' "$*" >&2
  exit 1
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

safe_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-'
}

run_step() {
  local iteration="$1"
  local name="$2"
  shift 2
  local slug
  slug="$(safe_name "$name")"
  local log_file="$RUN_DIR/${iteration}-${slug}.log"

  log "==> [$iteration] $name"
  if "$@" >"$log_file" 2>&1; then
    log "    passed ($log_file)"
  else
    local code=$?
    log "    failed ($log_file)"
    tail -n 80 "$log_file" >&2 || true
    exit "$code"
  fi
}

run_hygiene_step() {
  local iteration="$1"
  local log_file="$RUN_DIR/${iteration}-tracked-artifact-and-secret-hygiene.log"

  log "==> [$iteration] tracked artifact and secret hygiene"
  if run_hygiene_check >"$log_file" 2>&1; then
    log "    passed ($log_file)"
  else
    local code=$?
    log "    failed ($log_file)"
    tail -n 80 "$log_file" >&2 || true
    exit "$code"
  fi
}

url_reachable() {
  curl -fsS --max-time 2 "$BROWSER_URL" >/dev/null 2>&1
}

playwright_available() {
  (cd "$APP" && node -e "import('playwright').then(()=>process.exit(0)).catch(()=>process.exit(1))") \
    >/dev/null 2>&1
}

run_hygiene_check() {
  local bad_artifacts
  bad_artifacts="$(git -C "$ROOT" ls-files | grep -Ei '\.(bin|gen|smd|rom|wasm|safetensors|gguf|onnx|pt|pth)$' || true)"
  if [[ -n "$bad_artifacts" ]]; then
    printf 'Tracked generated/runtime artifacts are not allowed:\n%s\n' "$bad_artifacts" >&2
    return 1
  fi

  if git -C "$ROOT" grep -I -n -E 'sk-or-v1-[A-Za-z0-9]+' -- . >/tmp/drive16-phase6-secret-scan.txt 2>/dev/null; then
    cat /tmp/drive16-phase6-secret-scan.txt >&2
    rm -f /tmp/drive16-phase6-secret-scan.txt
    return 1
  fi
  rm -f /tmp/drive16-phase6-secret-scan.txt
}

run_browser_smoke_if_needed() {
  local iteration="$1"
  if [[ "$BROWSER_MODE" == "off" ]]; then
    log "==> [$iteration] browser smoke skipped (--no-browser)"
    return
  fi

  if ! url_reachable; then
    if [[ "$BROWSER_MODE" == "required" ]]; then
      fail "Browser URL is not reachable: $BROWSER_URL"
    fi
    log "==> [$iteration] browser smoke skipped (preview not reachable at $BROWSER_URL)"
    return
  fi

  if ! playwright_available; then
    if [[ "$BROWSER_MODE" == "required" ]]; then
      fail "Playwright is not installed. Run 'pnpm --dir app install'."
    fi
    log "==> [$iteration] browser smoke skipped (Playwright not available)"
    return
  fi

  local out_dir="$RUN_DIR/${iteration}-browser-smoke"
  run_step "$iteration" "browser smoke" \
    node "$ROOT/scripts/verify-phase6-browser-smoke.mjs" \
      --url "$BROWSER_URL" \
      --rom "$BROWSER_ROM" \
      --out "$out_dir"
}

run_iteration() {
  local iteration="$1"
  run_step "$iteration" "frontend build" pnpm --dir "$APP" build
  run_step "$iteration" "native format check" cargo fmt --manifest-path "$APP/src-tauri/Cargo.toml" --check
  run_step "$iteration" "native tests" cargo test --manifest-path "$APP/src-tauri/Cargo.toml"

  if [[ "$RUN_V1_PROOF" -eq 1 ]]; then
    run_step "$iteration" "generated CORE V1 proof" \
      cargo test --manifest-path "$APP/src-tauri/Cargo.toml" \
        v1_prompt_runs_core_asset_rom_when_tools_are_available \
        -- --ignored --nocapture
  fi

  run_step "$iteration" "git whitespace check" git -C "$ROOT" diff --check
  run_hygiene_step "$iteration"
  run_browser_smoke_if_needed "$iteration"
}

need_command pnpm
need_command cargo
need_command git
need_command node
need_command curl

log "Phase 6 verification loop"
log "Run directory: $RUN_DIR"
log "Browser mode: $BROWSER_MODE ($BROWSER_URL)"
log "Browser smoke ROM: $BROWSER_ROM"
log "Generated CORE/V1 proof: $([[ "$RUN_V1_PROOF" -eq 1 ]] && echo on || echo off)"

iteration=1
while :; do
  run_iteration "$iteration"
  if [[ "$UNTIL_FAIL" -eq 1 ]]; then
    iteration=$((iteration + 1))
    continue
  fi
  if [[ "$iteration" -ge "$REPEAT" ]]; then
    break
  fi
  iteration=$((iteration + 1))
done

cat >"$RUN_DIR/summary.json" <<EOF
{
  "status": "passed",
  "checkedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "iterations": $iteration,
  "browserMode": "$BROWSER_MODE",
  "browserUrl": "$BROWSER_URL",
  "browserRom": "$BROWSER_ROM",
  "generatedCoreV1Proof": $RUN_V1_PROOF
}
EOF

log "Phase 6 verification loop passed."
log "Evidence: $RUN_DIR"
