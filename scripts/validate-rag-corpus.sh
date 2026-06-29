#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${DRIVE16_RAG_DB_PATH:-$ROOT/artifacts/phase1/rag/lancedb}"
CACHE_DIR="${DRIVE16_RAG_CACHE_DIR:-$ROOT/artifacts/phase1/rag/models}"
MODEL_NAME="${DRIVE16_RAG_MODEL_NAME:-Xenova/all-MiniLM-L6-v2}"

"$ROOT/scripts/fetch-rag-corpus.sh" >/dev/null

rm -rf "$DB_PATH"

"$ROOT/scripts/mcp-local-rag.sh" \
  --db-path "$DB_PATH" \
  --cache-dir "$CACHE_DIR" \
  --model-name "$MODEL_NAME" \
  ingest "$ROOT/corpus" >/tmp/drive16-rag-ingest.log

"$ROOT/scripts/mcp-local-rag.sh" \
  --db-path "$DB_PATH" \
  --cache-dir "$CACHE_DIR" \
  --model-name "$MODEL_NAME" \
  query "SGDK rescomp SPRITE VDP palette" >/tmp/drive16-rag-query.log

if ! grep -E "rescomp|SPRITE|VDP|palette" /tmp/drive16-rag-query.log >/dev/null; then
  echo "RAG query did not return expected SGDK or VDP terms." >&2
  cat /tmp/drive16-rag-query.log >&2
  exit 65
fi

"$ROOT/scripts/mcp-local-rag.sh" \
  --db-path "$DB_PATH" \
  --cache-dir "$CACHE_DIR" \
  --model-name "$MODEL_NAME" \
  status >/tmp/drive16-rag-status.log

echo "RAG corpus ok"
cat /tmp/drive16-rag-status.log
