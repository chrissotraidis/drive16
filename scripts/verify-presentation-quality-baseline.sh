#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/artifacts/phase9/presentation-baseline"

mkdir -p "$OUTPUT_DIR"
python3 "$ROOT_DIR/scripts/validate-game-screenshot.py" --self-test

for game in snake pong tetris asteroids; do
  project="$ROOT_DIR/examples/game-skeletons/${game}-basic"
  screenshot="$OUTPUT_DIR/${game}.png"
  report="$OUTPUT_DIR/${game}.json"
  audio_report="$OUTPUT_DIR/${game}-audio.json"
  interaction_report="$OUTPUT_DIR/${game}-interaction.json"

  "$ROOT_DIR/scripts/build-sgdk.sh" "$project"
  python3 "$ROOT_DIR/scripts/capture-game-screenshot.py" \
    "$project/out/rom.bin" "$screenshot" --frames 180 \
    --audio-report "$audio_report"
  python3 "$ROOT_DIR/scripts/validate-game-screenshot.py" \
    "$screenshot" --out "$report" >/dev/null
  python3 "$ROOT_DIR/scripts/verify-skeleton-interaction.py" \
    "$game" "$project/out/rom.bin" --out "$interaction_report" >/dev/null

  printf '%s: ' "$game"
  jq -r '"colors=\(.metrics.visibleColors), dominant=\(.metrics.dominantRatio), foreground=\(.metrics.foregroundRatio)"' "$report"
  jq -e '.ok == true and .audio.nonSilent == true' "$audio_report" >/dev/null
  jq -e '.inputChangedFrame == true and .restartMatchedFreshState == true' \
    "$interaction_report" >/dev/null
done

printf 'Presentation baseline passed for Snake, Pong, Tetris, and Asteroids.\n'
