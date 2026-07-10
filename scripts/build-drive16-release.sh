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

# An interrupted DMG layout pass can leave Finder metadata on the reusable app
# bundle. Clear only those build artifacts before Tauri signs the next package.
if [[ -d "$APP_DIR/src-tauri/target/release/bundle" ]]; then
  xattr -cr "$APP_DIR/src-tauri/target/release/bundle"
fi

pnpm --dir "$APP_DIR" tauri build --bundles app,dmg "$@"
"$ROOT_DIR/scripts/verify-drive16-release.sh"
