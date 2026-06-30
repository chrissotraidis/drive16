#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REFERENCE="$ROOT/corpus/mml/ctrmml-megadrive.md"
PRESETS="$ROOT/assets/enhancements/mml/manifest.json"
DB_PATH="${DRIVE16_RAG_DB_PATH:-$ROOT/artifacts/phase1/rag/lancedb}"
CACHE_DIR="${DRIVE16_RAG_CACHE_DIR:-$ROOT/artifacts/phase1/rag/models}"
MODEL_NAME="${DRIVE16_RAG_MODEL_NAME:-Xenova/all-MiniLM-L6-v2}"
QUERY_LOG="/tmp/drive16-mml-rag-query.log"

require_term() {
  local file="$1"
  local term="$2"
  if ! grep -F "$term" "$file" >/dev/null; then
    echo "Missing expected term '$term' in $file" >&2
    exit 65
  fi
}

for term in \
  "#platform megadrive" \
  "compile_music" \
  "drive16_generated_music" \
  "XGM_startPlay" \
  "drive16_round_bass" \
  "drive16_clear_lead" \
  "FM Instrument Table Shape"; do
  require_term "$REFERENCE" "$term"
done

for term in \
  "drive16_round_bass" \
  "drive16_clear_lead" \
  "drive16_soft_pad" \
  "drive16_chip_pluck" \
  "drive16_bright_bell" \
  "drive16_brass_stab"; do
  require_term "$PRESETS" "$term"
done

"$ROOT/scripts/validate-rag-corpus.sh" >/tmp/drive16-mml-rag-refresh.log

"$ROOT/scripts/mcp-local-rag.sh" \
  --db-path "$DB_PATH" \
  --cache-dir "$CACHE_DIR" \
  --model-name "$MODEL_NAME" \
  query "Drive16 ctrmml Megadrive MML compile_music drive16_round_bass XGM_startPlay" \
  >"$QUERY_LOG"

for term in "compile_music" "drive16_round_bass" "XGM_startPlay"; do
  require_term "$QUERY_LOG" "$term"
done

echo "MML RAG corpus ok: $REFERENCE"
