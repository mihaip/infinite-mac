#!/bin/bash
set -e

cd "$(git rev-parse --show-toplevel)"

run_check() {
    local script="$1"
    local status=0
    local TIMEFORMAT="Ran $script in %3Rs"

    time npm run --silent "$script" || status=$?
    return "$status"
}

run_check typecheck
run_check vpcheck
