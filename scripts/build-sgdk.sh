#!/usr/bin/env bash
set -euo pipefail

IMAGE="${DRIVE16_SGDK_IMAGE:-registry.gitlab.com/doragasu/docker-sgdk:v2.11}"
PLATFORM="${DRIVE16_DOCKER_PLATFORM:-linux/amd64}"
PROJECT="${1:-examples/sgdk-hello-world}"
TARGET="${2:-all}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the Phase 0 SGDK build." >&2
  exit 127
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed, but the Docker daemon is not reachable." >&2
  echo "Start Docker Desktop, then rerun this script." >&2
  exit 70
fi

PROJECT_DIR="$(cd "$PROJECT" && pwd)"
REPO_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"

if [ -n "$REPO_ROOT" ] && [ "$PROJECT_DIR" != "$REPO_ROOT" ]; then
  PROJECT_REL="${PROJECT_DIR#"$REPO_ROOT"/}"
  MOUNT_DIR="$REPO_ROOT"
  WORK_DIR="/workspace/$PROJECT_REL"
else
  MOUNT_DIR="$PROJECT_DIR"
  WORK_DIR="/workspace"
fi

docker run \
  --rm \
  --platform "$PLATFORM" \
  -v "$MOUNT_DIR:/workspace" \
  -w "$WORK_DIR" \
  "$IMAGE" \
  "$TARGET"

if [ -f "$PROJECT_DIR/out/rom.bin" ]; then
  echo "Built ROM: $PROJECT_DIR/out/rom.bin"
else
  echo "Build finished, but $PROJECT_DIR/out/rom.bin was not found." >&2
  exit 66
fi
