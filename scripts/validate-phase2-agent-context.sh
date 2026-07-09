#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL="$ROOT/agent/skills/phase2-core-assets.md"
DB_PATH="${DRIVE16_RAG_DB_PATH:-$ROOT/artifacts/phase1/rag/lancedb}"
CACHE_DIR="${DRIVE16_RAG_CACHE_DIR:-$ROOT/artifacts/phase1/rag/models}"
MODEL_NAME="${DRIVE16_RAG_MODEL_NAME:-Xenova/all-MiniLM-L6-v2}"
QUERY_LOG="/tmp/drive16-phase2-agent-context-query.log"

require_term() {
  local file="$1"
  local term="$2"
  if ! grep -F "$term" "$file" >/dev/null; then
    echo "Missing expected term '$term' in $file" >&2
    exit 65
  fi
}

for term in \
  "drive16_player" \
  "drive16_loop" \
  "resources.res" \
  "XGM_startPlay" \
  "SPR_addSprite" \
  "send_input" \
  "capture_frame" \
  "verify_audio"; do
  require_term "$SKILL" "$term"
done

"$ROOT/scripts/validate-rag-corpus.sh" >/tmp/drive16-phase2-rag-refresh.log

"$ROOT/scripts/mcp-local-rag.sh" \
  --db-path "$DB_PATH" \
  --cache-dir "$CACHE_DIR" \
  --model-name "$MODEL_NAME" \
  query "Drive16 Phase 2 drive16_player drive16_loop resources.res SPRITE XGM" \
  >"$QUERY_LOG"

for term in "drive16_player" "drive16_loop" "SPRITE" "XGM"; do
  require_term "$QUERY_LOG" "$term"
done

echo "Phase 2 agent context ok: $SKILL"
