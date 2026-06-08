#!/usr/bin/env bash
set -euo pipefail

devices="$(adb devices | awk 'NR>1 && NF { print $1, $2 }')"

if [[ -z "${devices}" ]]; then
  echo "Nenhum dispositivo encontrado."
  exit 0
fi

echo "Dispositivos ADB:"
echo "${devices}"
echo

while IFS=' ' read -r device state; do
  [[ -z "${device}" ]] && continue
  echo "Reverse em ${device} (${state}):"
  adb -s "${device}" reverse --list || true
  echo
done <<< "${devices}"
