#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Requires the existing macemu_emsdk Docker image; generated assets are committed.
"$SCRIPT_DIR/docker-shell.sh" /scripts/build-stuffit-decoder-in-docker.sh
