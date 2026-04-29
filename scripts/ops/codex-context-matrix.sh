#!/bin/sh

set -eu

python3 "$(dirname "$0")/codex-context-matrix.py" "$@"
