#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"

# A Developer ID can optionally replace the direct-download default later.
export APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:--}"

if [[ "$APPLE_SIGNING_IDENTITY" == "-" ]]; then
  printf 'Building an ad-hoc-signed direct-download release. Internet downloads may require macOS Open Anyway.\n'
else
  printf 'Building with Apple signing identity: %s\n' "$APPLE_SIGNING_IDENTITY"
fi

pnpm --dir "$APP_DIR" tauri build --bundles app,dmg "$@"
"$ROOT_DIR/scripts/verify-drive16-release.sh"
