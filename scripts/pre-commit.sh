#!/bin/bash
set -e

cd "$(git rev-parse --show-toplevel)"

run_check() {
    local script="$1"
    local status=0
    local TIMEFORMAT="Finished $script in %3Rs"

    printf 'Starting %s...\n' "$script"
    time npm run --silent "$script" || status=$?
    return "$status"
}

run_check check
