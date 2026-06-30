#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="$ROOT/artifacts/phase4/generated-sprite-sgdk-resource"
PROJECT="$ARTIFACT_DIR/project"
SPRITE="$PROJECT/res/generated-sprite.png"
ROM="$PROJECT/out/rom.bin"
SCREENSHOT="$ARTIFACT_DIR/generated-sprite-resource.png"
REPORT="$ARTIFACT_DIR/latest.json"

mkdir -p "$ARTIFACT_DIR" "$PROJECT/src/boot" "$PROJECT/src" "$PROJECT/res"
rm -rf "$PROJECT/out"

"$ROOT/scripts/validate-generated-sprite.py" --self-test --symbol drive16_player
cp "$ROOT/artifacts/phase4/generated-sprite-validation/valid-generated-sprite.png" "$SPRITE"
cp "$ROOT/examples/sgdk-hello-world/src/boot/rom_head.c" "$PROJECT/src/boot/rom_head.c"
cp "$ROOT/examples/sgdk-hello-world/src/boot/sega.s" "$PROJECT/src/boot/sega.s"

cat >"$PROJECT/Makefile" <<'MAKEFILE'
GDK ?= /sgdk

include $(GDK)/makefile.gen
MAKEFILE

cat >"$PROJECT/res/resources.res" <<'RESOURCES'
SPRITE drive16_player "generated-sprite.png" 4 4 NONE 0
RESOURCES

cat >"$PROJECT/src/main.c" <<'MAIN'
#include <genesis.h>
#include "resources.h"

int main(bool hardReset)
{
    if (!hardReset)
        SYS_hardReset();

    SPR_init();

    PAL_setPalette(PAL1, drive16_player.palette->data, DMA);
    VDP_setTextPalette(PAL1);
    VDP_drawText("Drive16 Phase 4", 8, 3);
    VDP_drawText("Generated SPRITE", 7, 5);

    Sprite *player = SPR_addSprite(&drive16_player, 144, 104, TILE_ATTR(PAL1, TRUE, FALSE, FALSE));
    if (player == NULL)
        SYS_die("Generated sprite allocation failed");

    while (TRUE)
    {
        SPR_update();
        SYS_doVBlankProcess();
    }

    return 0;
}
MAIN

"$ROOT/scripts/validate-generated-sprite.py" "$SPRITE" --symbol drive16_player
"$ROOT/scripts/build-sgdk.sh" "$PROJECT"

if [ -z "${GENTEEL_BIN:-}" ]; then
  GENTEEL_BIN="$("$ROOT/scripts/build-genteel.sh")"
fi

GENTEEL_BIN="$GENTEEL_BIN" "$ROOT/scripts/validate-genteel.sh" "$ROM" "$SCREENSHOT"

python3 - "$ROOT" "$PROJECT" "$SPRITE" "$ROM" "$SCREENSHOT" "$REPORT" <<'PY'
import json
import sys
from pathlib import Path

root, project, sprite, rom, screenshot, report = [Path(value).resolve() for value in sys.argv[1:]]

def rel(path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)

payload = {
    "ok": True,
    "project": rel(project),
    "sprite": rel(sprite),
    "rom": rel(rom),
    "screenshot": rel(screenshot),
    "rescomp": 'SPRITE drive16_player "generated-sprite.png" 4 4 NONE 0',
}
report.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

echo "Generated sprite SGDK resource ok:"
echo "Project: ${PROJECT#$ROOT/}"
echo "ROM: ${ROM#$ROOT/}"
echo "Screenshot: ${SCREENSHOT#$ROOT/}"
echo "Report: ${REPORT#$ROOT/}"
