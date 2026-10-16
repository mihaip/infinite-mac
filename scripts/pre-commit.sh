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

run_check ts:types
run_check ts:lint
run_check ts:format
run_check py:types
run_check py:lint
run_check py:format
