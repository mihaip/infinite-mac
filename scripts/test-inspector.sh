#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
INSPECTOR_TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/infinite-mac-inspector.XXXXXX")"
trap 'rm -rf "$INSPECTOR_TEST_DIR"' EXIT
node_modules/.bin/tsc --module commonjs --moduleResolution node --target es2022 --esModuleInterop --skipLibCheck --strict --outDir "$INSPECTOR_TEST_DIR" tests/inspector.test.ts
node --test "$INSPECTOR_TEST_DIR/tests/inspector.test.js"
