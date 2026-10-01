#!/usr/bin/env bash
# ==============================================================================
# Pluri-Health — Mobile Preview Wireless Automático (Scrcpy & ADB Reverse)
# ==============================================================================
# Fluxo:
# 1. Conecta o smartphone via cabo USB para handshake inicial (ou detecta Wi-Fi já ativo).
# 2. Ativa o modo TCP/IP (5555) e conecta via Wi-Fi ENQUANTO o cabo ainda está plugado.
# 3. Pede para DESCONECTAR o cabo USB.
# 4. Cria túneis reversos (localhost:8080) e abre o scrcpy 100% sem fio.
# ==============================================================================

set -eo pipefail

APP_PORT="${1:-8080}"
SUPABASE_PORT="${2:-54321}"
SCRCPY_MAX_SIZE="${SCRCPY_MAX_SIZE:-1600}"

echo "======================================================"
echo "    Configuração Scrcpy Wireless Automática"
echo "======================================================"
echo

# Função para capturar o IP Wi-Fi real do celular
get_android_wifi_ip() {
  local target="$1"
  local ip=""

  # 1. Tenta interface wlan0
  ip=$(adb -s "$target" shell "ip -f inet addr show wlan0 2>/dev/null" | awk '/inet / {print $2}' | cut -d/ -f1 | head -n 1 || true)

  # 2. Tenta interface wlan1 caso seja dual band
  if [[ -z "$ip" ]]; then
    ip=$(adb -s "$target" shell "ip -f inet addr show wlan1 2>/dev/null" | awk '/inet / {print $2}' | cut -d/ -f1 | head -n 1 || true)
  fi

  # 3. Tenta propriedade do sistema dhcp.wlan0.ipaddress
  if [[ -z "$ip" ]]; then
    ip=$(adb -s "$target" shell getprop dhcp.wlan0.ipaddress 2>/dev/null | tr -d '\r\n' || true)
  fi

  # 4. Fallback: extrai de ip route
  if [[ -z "$ip" ]]; then
    ip=$(adb -s "$target" shell ip route 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}' | head -n 1 || true)
  fi

  echo "$ip"
}

# Verifica se já existe algum dispositivo conectado via Wi-Fi (IP:PORTA)
WIFI_DEVICE=$(adb devices | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+\s+device' | awk '{print $1}' | head -n 1 || true)

if [[ -n "${WIFI_DEVICE}" ]]; then
  echo "✔ Dispositivo Wi-Fi já conectado detectado: ${WIFI_DEVICE}"
  
  # Checa se o cabo USB ainda está plugado para avisar o usuário que pode tirar
  CURRENT_USB=$(adb devices | grep -E '^[a-zA-Z0-9_-]+\s+device' | grep -v ':' | awk '{print $1}' | head -n 1 || true)
  if [[ -n "${CURRENT_USB}" ]]; then
    echo
    echo "======================================================"
    echo " 👉 Se o cabo USB ainda estiver plugado, pode DESCONECTÁ-LO agora!"
    echo "======================================================"
    echo
  fi
  DEVICE_ID="${WIFI_DEVICE}"
else
  # Verifica se já há um dispositivo USB conectado
  USB_DEVICE=$(adb devices | grep -E '^[a-zA-Z0-9_-]+\s+device' | grep -v ':' | awk '{print $1}' | head -n 1 || true)

  if [[ -z "${USB_DEVICE}" ]]; then
    echo "Nenhum dispositivo Wi-Fi conectado no momento."
    echo "1. Conecte o seu smartphone ao PC usando o cabo USB."
    echo "2. Certifique-se de estar com a Depuração USB ativada."
    read -p "Pressione ENTER quando o dispositivo estiver conectado via USB..."
    
    echo "Aguardando dispositivo USB..."
    adb wait-for-device
    
    USB_DEVICE=$(adb devices | grep -E '^[a-zA-Z0-9_-]+\s+device' | grep -v ':' | awk '{print $1}' | head -n 1 || true)
    if [[ -z "${USB_DEVICE}" ]]; then
      echo "Erro: Dispositivo conectado mas não autorizado no ADB." >&2
      echo "Verifique a tela do celular e autorize a Depuração USB." >&2
      exit 1
    fi
  else
    echo "Dispositivo USB detectado: ${USB_DEVICE}"
  fi

  echo "Buscando IP do dispositivo na rede Wi-Fi..."
  DEVICE_IP=$(get_android_wifi_ip "${USB_DEVICE}")

  if [[ -z "${DEVICE_IP}" ]]; then
    echo "Erro: Não foi possível descobrir o IP do dispositivo. Verifique se ele está no Wi-Fi." >&2
    exit 1
  fi

  echo "IP do smartphone encontrado: ${DEVICE_IP}"

  # Mostra IP do PC para comparação rápida de rede
  MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  if [[ -n "${MAC_IP}" ]]; then
    echo "IP deste computador: ${MAC_IP}"
  fi

  echo "Reiniciando ADB em modo TCP/IP na porta 5555..."
  adb -s "${USB_DEVICE}" tcpip 5555
  sleep 2

  echo "Estabelecendo pareamento Wi-Fi (${DEVICE_IP}:5555) com o cabo ainda plugado..."
  
  CONNECTED=0
  for attempt in 1 2 3; do
    echo "Tentativa ${attempt} de conexão Wi-Fi..."
    CONNECT_RES=$(adb connect "${DEVICE_IP}:5555" 2>&1 || true)
    echo "Resposta: ${CONNECT_RES}"
    
    if echo "${CONNECT_RES}" | grep -qE "connected to ${DEVICE_IP}:5555|already connected"; then
      CONNECTED=1
      break
    fi

    # Se der 'No route to host', limpa o socket do daemon ADB zumbi e tenta novamente
    if echo "${CONNECT_RES}" | grep -q "No route to host"; then
      echo "⚡ Detectado cache de socket antigo no ADB. Reiniciando daemon do ADB..."
      adb kill-server
      sleep 1
      adb start-server
      sleep 1
      adb -s "${USB_DEVICE}" tcpip 5555 || true
      sleep 1
    fi
    sleep 2
  done

  if [[ $CONNECTED -eq 0 ]]; then
    echo
    echo "================================================================="
    echo "❌ FALHA NA CONEXÃO WI-FI: No route to host / Conexão recusada"
    echo "================================================================="
    echo "O computador não conseguiu conversar com o IP ${DEVICE_IP} na rede Wi-Fi."
    echo
    echo "Possíveis causas:"
    echo "1. Celular e computador estão em redes Wi-Fi diferentes ou separadas"
    echo "   (ex: um está no 5GHz e outro no 2.4GHz, ou em rede de Convidados/Visitantes)."
    echo "2. O roteador Wi-Fi está com 'Isolamento de Clientes' (AP Isolation) ATIVO,"
    echo "   impedindo que aparelhos na mesma rede conversem entre si."
    echo "3. O Wi-Fi do celular mudou de IP ou desconectou."
    echo
    read -p "Deseja continuar usando temporariamente o Cabo USB? [S/n]: " USE_USB_FALLBACK
    USE_USB_FALLBACK="${USE_USB_FALLBACK:-s}"
    if [[ "${USE_USB_FALLBACK}" =~ ^[sSyY]$ ]]; then
      DEVICE_ID="${USB_DEVICE}"
      echo "✔ Prosseguindo via Cabo USB..."
    else
      echo "Cancelado pelo usuário. Verifique a rede Wi-Fi e tente novamente."
      exit 1
    fi
  else
    DEVICE_ID="${DEVICE_IP}:5555"
    sleep 1

    echo
    echo "======================================================"
    echo " ✔ MODO SEM FIO ATIVADO COM SUCESSO!"
    echo " 👉 Agora DESCONECTE seu dispositivo do cabo USB."
    echo "======================================================"
    echo
    
    # Aguarda o cabo USB ser desconectado (ou dá timeout/ENTER)
    echo "Aguardando desconexão do cabo USB..."
    for i in {1..15}; do
      CURRENT_USB=$(adb devices | grep -E '^[a-zA-Z0-9_-]+\s+device' | grep -v ':' | awk '{print $1}' || true)
      if [[ -z "${CURRENT_USB}" ]]; then
        echo "✔ Cabo USB desconectado! Operando 100% sem fio."
        break
      fi
      sleep 1
    done
  fi
fi

# Confirma que o dispositivo sem fio está respondendo
if ! adb devices | grep -q "${DEVICE_ID}"; then
  echo "Erro: O dispositivo '${DEVICE_ID}' não respondeu após desconectar o cabo." >&2
  echo "Dispositivos ativos:"
  adb devices
  exit 1
fi

echo "Usando dispositivo: ${DEVICE_ID}"
echo "Criando túneis de rede com adb reverse..."
adb -s "${DEVICE_ID}" reverse "tcp:${APP_PORT}" "tcp:${APP_PORT}" || true
adb -s "${DEVICE_ID}" reverse "tcp:${SUPABASE_PORT}" "tcp:${SUPABASE_PORT}" || true

echo
echo "======================================================"
echo " Agora, no navegador do celular (Chrome / Edge / Safari):"
echo "   👉 http://localhost:${APP_PORT}"
echo "======================================================"
echo
echo "Abrindo scrcpy sem fio..."
exec scrcpy -s "${DEVICE_ID}" --stay-awake --max-size "${SCRCPY_MAX_SIZE}" --window-title "Mobile Preview Wireless (Pluri Health)"
