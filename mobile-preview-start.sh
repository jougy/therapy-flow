#!/usr/bin/env bash
# Wrapper na raiz para scripts/dev/mobile-preview-start.sh
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$DIR/scripts/dev/mobile-preview-start.sh" "$@"
