#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${DRIVE16_SGDK_TAG:-v2.11}"
BASE_URL="https://raw.githubusercontent.com/Stephane-D/SGDK/$TAG"
DEST="$ROOT/corpus/sgdk"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to fetch the RAG corpus sources." >&2
  exit 127
fi

mkdir -p "$DEST/api" "$DEST/tools"

fetch() {
  local source_path="$1"
  local dest_path="$2"
  local url="$BASE_URL/$source_path"
  local output="$DEST/$dest_path"

  mkdir -p "$(dirname "$output")"
  curl -fsSL "$url" -o "$output"
  echo "Fetched SGDK $TAG: $source_path -> corpus/sgdk/$dest_path"
}

fetch "readme.md" "README.md"
fetch "license.txt" "license.txt"
fetch "bin/rescomp.txt" "tools/rescomp.txt"
fetch "bin/xgm.txt" "tools/xgm.txt"
fetch "bin/xgm2.txt" "tools/xgm2.txt"
fetch "inc/genesis.h" "api/genesis.h.txt"
fetch "inc/vdp.h" "api/vdp.h.txt"
fetch "inc/vdp_tile.h" "api/vdp_tile.h.txt"
fetch "inc/vdp_spr.h" "api/vdp_spr.h.txt"
fetch "inc/sprite_eng.h" "api/sprite_eng.h.txt"
fetch "inc/joy.h" "api/joy.h.txt"
fetch "inc/tools.h" "api/tools.h.txt"
