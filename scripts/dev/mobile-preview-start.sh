#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${1:-8080}"
SUPABASE_PORT="${2:-54321}"
SCRCPY_MAX_SIZE="${SCRCPY_MAX_SIZE:-1600}"

ensure_device_connected() {
  local devices
  devices="$(adb devices | awk 'NR>1 && $2 == "device" { print $1 }')"

  if [[ -z "${devices}" ]]; then
    echo "Nenhum dispositivo Android autorizado foi encontrado via ADB." >&2
    echo "Conecte o celular por USB, aceite a depuração USB e tente novamente." >&2
    exit 1
  fi

  echo "${devices}" | head -n 1
}

DEVICE_ID="$(ensure_device_connected)"

echo "Usando dispositivo: ${DEVICE_ID}"
echo "Criando túneis USB com adb reverse..."
adb -s "${DEVICE_ID}" reverse "tcp:${APP_PORT}" "tcp:${APP_PORT}"
adb -s "${DEVICE_ID}" reverse "tcp:${SUPABASE_PORT}" "tcp:${SUPABASE_PORT}"

echo
echo "Agora, no navegador do celular, abra:"
echo "  http://localhost:${APP_PORT}"
echo
echo "Abrindo scrcpy..."
exec scrcpy -s "${DEVICE_ID}" --stay-awake --max-size "${SCRCPY_MAX_SIZE}"
