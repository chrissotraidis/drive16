#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${DRIVE16_COMFYUI_MCP_VERSION:-0.21.0}"
PREFIX="${DRIVE16_COMFYUI_MCP_PREFIX:-$ROOT/artifacts/phase4/comfyui-mcp}"
BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if [ -n "${DRIVE16_NODE:-}" ]; then
  NODE_BIN="$DRIVE16_NODE"
elif [ -x "$BUNDLED_NODE" ]; then
  NODE_BIN="$BUNDLED_NODE"
else
  NODE_BIN="$(command -v node || true)"
fi

if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "Node.js 22 or newer is required to run comfyui-mcp." >&2
  exit 127
fi

NODE_MAJOR="$("$NODE_BIN" -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "comfyui-mcp requires Node.js 22 or newer; found $("$NODE_BIN" --version)." >&2
  echo "Set DRIVE16_NODE=/path/to/node if a newer Node is installed." >&2
  exit 65
fi

CLI="$PREFIX/node_modules/comfyui-mcp/dist/index.js"
PACKAGE_JSON="$PREFIX/node_modules/comfyui-mcp/package.json"
INSTALLED_VERSION=""
if [ -f "$PACKAGE_JSON" ]; then
  INSTALLED_VERSION="$("$NODE_BIN" -e 'const fs = require("fs"); const p = process.argv[1]; try { console.log(JSON.parse(fs.readFileSync(p, "utf8")).version || ""); } catch { process.exit(1); }' "$PACKAGE_JSON" 2>/dev/null || true)"
fi

if [ ! -f "$CLI" ] || [ "$INSTALLED_VERSION" != "$VERSION" ]; then
  NPM_BIN="${DRIVE16_NPM:-$(command -v npm || true)}"
  if [ -z "$NPM_BIN" ]; then
    echo "npm is required to install comfyui-mcp into artifacts/." >&2
    exit 127
  fi
  mkdir -p "$PREFIX"
  "$NPM_BIN" install \
    --prefix "$PREFIX" \
    --cache "$PREFIX/.npm-cache" \
    --no-audit \
    --no-fund \
    --loglevel=error \
    "comfyui-mcp@$VERSION" >&2
fi

export COMFYUI_URL="${COMFYUI_URL:-http://127.0.0.1:8188}"
export COMFYUI_DOWNLOAD_CACHE_DIR="${COMFYUI_DOWNLOAD_CACHE_DIR:-$PREFIX/cache}"
export COMFYUI_MCP_AUTOUPDATE="${COMFYUI_MCP_AUTOUPDATE:-0}"

exec "$NODE_BIN" "$CLI" "$@"
