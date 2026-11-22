#!/usr/bin/env bash
# ==============================================================================
# Pluri Growth OS — Assistente 1-Comando para Sincronizar o Celular (11) 96512-0431
# Uso: npm run marketing:conectar-celular [-- --with-local-ai --with-typebot --with-tunnel]
# ==============================================================================

set -euo pipefail

INSTANCE_KEY="pluri-mkt-5511965120431"
PHONE_DISPLAY="(11) 96512-0431"
COMPOSE_FILE="infra/marketing-node/docker-compose.marketing.yml"
ENV_FILE="infra/marketing-node/.env"
EVO_LOCAL_URL="http://127.0.0.1:8085"
WORKER_LOCAL_URL="http://127.0.0.1:8086"

WITH_LOCAL_AI=0
WITH_TYPEBOT=0
WITH_TUNNEL=0

for arg in "$@"; do
  case "$arg" in
    --with-local-ai) WITH_LOCAL_AI=1 ;;
    --with-typebot) WITH_TYPEBOT=1 ;;
    --with-tunnel) WITH_TUNNEL=1 ;;
    *)
      echo "⚠️  Flag desconhecida ignorada: $arg"
      ;;
  esac
done

echo ""
echo "=================================================================="
echo " 📱 Pluri Growth OS — Node Marketing & Chip ${PHONE_DISPLAY}"
echo "=================================================================="
echo ""

# 1. Verifica Docker ou Podman
COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v podman >/dev/null 2>&1; then
  COMPOSE_CMD="podman compose"
else
  echo "❌ Docker/Podman não encontrado ou parado."
  echo "   Inicie o Docker Desktop / Podman e rode novamente: npm run marketing:conectar-celular"
  exit 1
fi

gen_secret() {
  openssl rand -hex 24 2>/dev/null || printf '%s%s' "$(date +%s)" "$$"
}

ensure_env_key() {
  local key="$1"
  local value="$2"
  if ! grep -qE "^${key}=" "$ENV_FILE"; then
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

# 2. Cria ou completa .env local seguro sem sobrescrever chaves existentes
if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  echo "✅ Arquivo local ${ENV_FILE} criado."
fi

ensure_env_key "EVOLUTION_API_KEY" "$(gen_secret)"
ensure_env_key "EVOLUTION_PUBLIC_URL" "${EVO_LOCAL_URL}"
ensure_env_key "SUPABASE_WEBHOOK_URL" "https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/marketing-zap-gateway?action=webhook_evolution"
ensure_env_key "MARKETING_DEFAULT_INSTANCE_KEY" "${INSTANCE_KEY}"
ensure_env_key "MARKETING_DEFAULT_PHONE_E164" "5511965120431"
ensure_env_key "SUPABASE_URL" "https://ggytwbnintrftgzvjczs.supabase.co"
ensure_env_key "SUPABASE_SERVICE_ROLE_KEY" ""
ensure_env_key "WORKER_SHARED_SECRET" "$(gen_secret)"
ensure_env_key "WORKER_PORT" "8086"
ensure_env_key "OLLAMA_BASE_URL" "http://host.docker.internal:11434/v1"
ensure_env_key "OPENCODE_API_KEY" "public"
ensure_env_key "ANDROID_BRIDGE_SECRET" "$(gen_secret)"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PROFILE_ARGS=()
RAM_CAP_MB=768
ACTIVE_PROFILES=("core (redis:128m + evolution:384m + worker:256m)")

if [ "$WITH_LOCAL_AI" -eq 1 ]; then
  PROFILE_ARGS+=(--profile local-ai)
  RAM_CAP_MB=$((RAM_CAP_MB + 6144))
  ACTIVE_PROFILES+=("local-ai (ollama:6g, keep_alive=5m)")
fi

if [ "$WITH_TYPEBOT" -eq 1 ]; then
  PROFILE_ARGS+=(--profile typebot)
  RAM_CAP_MB=$((RAM_CAP_MB + 896))
  ACTIVE_PROFILES+=("typebot (builder:512m + viewer:384m)")
fi

if [ "$WITH_TUNNEL" -eq 1 ]; then
  PROFILE_ARGS+=(--profile tunnel)
  RAM_CAP_MB=$((RAM_CAP_MB + 64))
  ACTIVE_PROFILES+=("tunnel (cloudflared:64m)")
fi

echo "🧠 Orçamento de RAM (Teto Cgroups): ~${RAM_CAP_MB} MB máx (~250 MB típico em idle)"
for p in "${ACTIVE_PROFILES[@]}"; do
  echo "   • ${p}"
done
echo ""

echo "🚀 Subindo Evolution API v2 + Redis BullMQ + Marketing Worker (:8086)..."
$COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "${PROFILE_ARGS[@]}" up -d --build

echo "⏳ Aguardando Evolution API ficar pronta em ${EVO_LOCAL_URL}..."
for _ in $(seq 1 30); do
  if curl -fsS "${EVO_LOCAL_URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "⏳ Verificando Worker BullMQ em ${WORKER_LOCAL_URL}/health..."
for _ in $(seq 1 15); do
  if curl -fsS "${WORKER_LOCAL_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "🔌 Criando/verificando instância ${INSTANCE_KEY}..."
curl -sS -X POST "${EVO_LOCAL_URL}/instance/create" \
  -H "apikey: ${EVOLUTION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"${INSTANCE_KEY}\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}" >/dev/null || true

echo ""
echo "✅ Tudo pronto! Agora siga estes 3 passos simples:"
echo ""
echo "   1) Abra o Backoffice em: http://localhost:8080/platform/marketing?subtab=agentes"
echo "      (ou abra o Manager direto da Evolution API em: ${EVO_LOCAL_URL}/manager)"
echo "      Chave local (apikey): ${EVOLUTION_API_KEY}"
echo "      Worker BullMQ Health: ${WORKER_LOCAL_URL}/health"
echo ""
echo "   2) No celular do chip ${PHONE_DISPLAY}, abra o WhatsApp:"
echo "      Configurações (ou 3 pontinhos) -> Aparelhos conectados -> Conectar um aparelho"
echo ""
echo "   3) Aponte a câmera para o QR Code da instância '${INSTANCE_KEY}'!"
echo "      Pronto: seu chip estará sincronizado com a blindagem Anti-Ban ativa."
echo ""
