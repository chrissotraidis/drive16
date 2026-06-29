#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${DRIVE16_MCP_LOCAL_RAG_VERSION:-0.15.3}"
PREFIX="${DRIVE16_MCP_LOCAL_RAG_PREFIX:-$ROOT/artifacts/phase1/mcp-local-rag}"
BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if [ -n "${DRIVE16_NODE:-}" ]; then
  NODE_BIN="$DRIVE16_NODE"
elif [ -x "$BUNDLED_NODE" ]; then
  NODE_BIN="$BUNDLED_NODE"
else
  NODE_BIN="$(command -v node || true)"
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "Node.js 22 or newer is required to run mcp-local-rag." >&2
  exit 127
fi

NODE_MAJOR="$("$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "mcp-local-rag requires Node.js 22 or newer; found $("$NODE_BIN" --version)." >&2
  echo "Set DRIVE16_NODE=/path/to/node if a newer Node is installed." >&2
  exit 65
fi

CLI="$PREFIX/node_modules/mcp-local-rag/dist/index.js"
if [ ! -f "$CLI" ]; then
  NPM_BIN="${DRIVE16_NPM:-$(command -v npm || true)}"
  if [ -z "$NPM_BIN" ]; then
    echo "npm is required to install mcp-local-rag into artifacts/." >&2
    exit 127
  fi
  mkdir -p "$PREFIX"
  "$NPM_BIN" install --prefix "$PREFIX" "mcp-local-rag@$VERSION" >&2
fi

exec "$NODE_BIN" "$CLI" "$@"
