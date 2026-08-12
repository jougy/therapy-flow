#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"
URL="${2:-http://localhost:8080}"
PROFILE_DIR="${HOME}/.cache/brave-codex-profile"
LOG_FILE="${HOME}/.cache/brave-codex.log"

mkdir -p "${PROFILE_DIR}"

BRAVE_BIN="/usr/bin/brave"
if [ ! -x "${BRAVE_BIN}" ] && [ -x "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" ]; then
  BRAVE_BIN="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
fi

exec "${BRAVE_BIN}" \
  --remote-debugging-port="${PORT}" \
  --remote-allow-origins="*" \
  --user-data-dir="${PROFILE_DIR}" \
  --new-window \
  "${URL}" \
  >>"${LOG_FILE}" 2>&1
