#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${1:-8080}"
SUPABASE_PORT="${2:-54321}"
SCRCPY_MAX_SIZE="${SCRCPY_MAX_SIZE:-1600}"

echo "======================================================"
echo "    Configuração Scrcpy Wireless Automática"
echo "======================================================"
echo

# Verifica se já existe algum dispositivo conectado via Wi-Fi (IP:PORTA)
WIFI_DEVICE=$(adb devices | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+\s+device' | awk '{print $1}' | head -n 1 || true)

if [[ -n "${WIFI_DEVICE}" ]]; then
  echo "Dispositivo Wi-Fi já conectado detectado: ${WIFI_DEVICE}"
  echo "Pulando etapa de configuração USB..."
  DEVICE_ID="${WIFI_DEVICE}"
else
  echo "Nenhum dispositivo Wi-Fi conectado no momento."
  echo "1. Conecte o seu dispositivo ao PC usando o cabo USB."
  echo "2. Certifique-se de estar com a depuração USB ativada."
  read -p "Pressione ENTER quando o dispositivo estiver conectado via USB..."

  echo "Aguardando dispositivo USB..."
  adb wait-for-usb-device

  echo "Buscando IP do dispositivo na rede Wi-Fi..."
  DEVICE_IP=$(adb -d shell ip route | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -n 1)

  if [[ -z "${DEVICE_IP}" ]]; then
    echo "Erro: Não foi possível descobrir o IP do dispositivo. Verifique se ele está no Wi-Fi." >&2
    exit 1
  fi

  echo "IP do dispositivo encontrado: ${DEVICE_IP}"

  echo "Reiniciando ADB em modo TCP/IP na porta 5555..."
  adb -d tcpip 5555
  sleep 3

  echo
  echo "======================================================"
  echo " OK! Agora DESCONECTE seu dispositivo do cabo USB."
  echo " Aguardando a inicialização do modo sem fio..."
  echo "======================================================"
  echo
  sleep 5

  echo "Conectando ao dispositivo via Wi-Fi (${DEVICE_IP}:5555)..."
  adb connect "${DEVICE_IP}:5555"
  sleep 2

  DEVICE_ID="${DEVICE_IP}:5555"
fi

echo "Usando dispositivo: ${DEVICE_ID}"
echo "Criando túneis de rede com adb reverse..."
adb -s "${DEVICE_ID}" reverse "tcp:${APP_PORT}" "tcp:${APP_PORT}" || true
adb -s "${DEVICE_ID}" reverse "tcp:${SUPABASE_PORT}" "tcp:${SUPABASE_PORT}" || true

echo
echo "Agora, no navegador do celular, abra:"
echo "  http://localhost:${APP_PORT}"
echo
echo "Abrindo scrcpy..."
exec scrcpy -s "${DEVICE_ID}" --stay-awake --max-size "${SCRCPY_MAX_SIZE}"
