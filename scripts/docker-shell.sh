#!/bin/bash

# Assumes that the Docker image has been built:
# docker build -t macemu_emsdk .
#
# Usage:
#   ./scripts/docker-shell.sh              # Start interactive shell
#   ./scripts/docker-shell.sh <command>    # Run command in container

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

VOLUME_MOUNTS=(
    -v "$PROJECT_ROOT/macemu":/macemu
    -v "$PROJECT_ROOT/minivmac":/minivmac
    -v "$PROJECT_ROOT/dingusppc":/dingusppc
    -v "$PROJECT_ROOT/previous":/previous
    -v "$PROJECT_ROOT/pearpc":/pearpc
    -v "$PROJECT_ROOT/scripts":/scripts
)

if [ $# -eq 0 ]; then
    docker run --rm -it "${VOLUME_MOUNTS[@]}" --entrypoint bash macemu_emsdk
else
    docker run --rm  "${VOLUME_MOUNTS[@]}" --entrypoint bash macemu_emsdk "$@"
fi
