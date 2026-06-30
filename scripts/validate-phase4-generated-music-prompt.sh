#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_NAME="phase4_music_prompt_runs_when_tools_are_available"
LOG="/tmp/drive16-phase4-generated-music-prompt.log"

cargo test --manifest-path "$ROOT/app/src-tauri/Cargo.toml" phase4_prompt -- --nocapture

set +e
cargo test --manifest-path "$ROOT/app/src-tauri/Cargo.toml" "$TEST_NAME" -- --ignored --nocapture >"$LOG" 2>&1
STATUS=$?
set -e

cat "$LOG"

if [ "$STATUS" -eq 0 ]; then
  echo "Phase 4 generated music prompt ok"
  exit 0
fi

if grep -F "Docker daemon is not reachable" "$LOG" >/dev/null; then
  cat <<'EOF'
VALIDATION REQUEST: Docker Desktop is required for the SGDK ROM build proof.

Start Docker Desktop, then run:

scripts/validate-phase4-generated-music-prompt.sh

Expected result: the ignored native test builds the generated-MML SGDK project,
runs it in Genteel, captures neutral and Right-input screenshots, proves
Right-input sprite movement, and verifies non-silent audio.
EOF
  exit 65
fi

exit "$STATUS"
