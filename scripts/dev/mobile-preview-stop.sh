#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${1:-8080}"
SUPABASE_PORT="${2:-54321}"

devices="$(adb devices | awk 'NR>1 && $2 == "device" { print $1 }')"

if [[ -z "${devices}" ]]; then
  echo "Nenhum dispositivo Android ativo encontrado. Nada para remover."
  exit 0
fi

while IFS= read -r device; do
  [[ -z "${device}" ]] && continue
  echo "Removendo túneis de ${device}..."
  adb -s "${device}" reverse --remove "tcp:${APP_PORT}" || true
  adb -s "${device}" reverse --remove "tcp:${SUPABASE_PORT}" || true
done <<< "${devices}"

echo "Túneis removidos."
