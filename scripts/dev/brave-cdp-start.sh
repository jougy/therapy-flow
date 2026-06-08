#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"
URL="${2:-http://localhost:8080}"
PROFILE_DIR="${HOME}/.cache/brave-codex-profile"
LOG_FILE="${HOME}/.cache/brave-codex.log"

mkdir -p "${PROFILE_DIR}"

exec /usr/bin/brave \
  --remote-debugging-port="${PORT}" \
  --user-data-dir="${PROFILE_DIR}" \
  --new-window \
  "${URL}" \
  >>"${LOG_FILE}" 2>&1
