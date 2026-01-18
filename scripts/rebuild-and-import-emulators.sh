#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building emulators in Docker..."
"$SCRIPT_DIR/docker-shell.sh" /scripts/rebuild-all-emulators.sh

echo "Importing emulators..."
cd "$PROJECT_ROOT"
EMULATORS=(
    "basiliskii"
    "sheepshaver"
    "minivmac-Plus"
    "minivmac-128K"
    "minivmac-512Ke"
    "minivmac-SE"
    "minivmac-II"
    "minivmac-IIx"
    "dingusppc"
    "previous"
    "pearpc"
    "snow"
)
for emulator in "${EMULATORS[@]}"; do
    echo "Importing ${emulator}..."
    "$SCRIPT_DIR/import-emulator.sh" "$emulator"
done

echo "✓ All emulators rebuilt and imported successfully."
