#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

export NPM_CONFIG_PREFIX=""
export NPM_CONFIG_GLOBALCONFIG="/dev/null"

if [ -n "${HOME:-}" ] && [ -f "$HOME/.profile" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.profile" 2>/dev/null || true
fi

export THERAPY_FLOW_ADMIN_CLI_NAME="./scripts/ops/account-admin-linux.sh"
export PRONTO_HEALTH_FISIO_ADMIN_HOME="${PRONTO_HEALTH_FISIO_ADMIN_HOME:-$HOME/.pronto-health-fisio-admin-linux}"
export THERAPY_FLOW_ADMIN_HOME="$PRONTO_HEALTH_FISIO_ADMIN_HOME"

exec node "$SCRIPT_DIR/account-admin.mjs" "$@"
