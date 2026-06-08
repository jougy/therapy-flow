#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"

curl -fsS "http://127.0.0.1:${PORT}/json/version"
