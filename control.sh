#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_NAME="therapy-flow"
STATE_DIR="$SCRIPT_DIR/.control"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"
FRONTEND_LOG_FILE="$STATE_DIR/frontend.log"

ensure_profile() {
  # Load the user's shell profile before Node/npm/npx/Supabase commands.
  # shellcheck disable=SC1090
  . "$HOME/.profile"
}

compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  echo "Docker Compose nao esta disponivel." >&2
  exit 1
}

run_node_cmd() {
  ensure_profile
  "$@"
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

print_env_summary() {
  echo "Projeto: $PROJECT_NAME"
  echo "Diretorio: $SCRIPT_DIR"
  echo "Sistema: $(uname -s)"
  echo ".env: $(if [ -f .env ]; then echo presente; else echo ausente; fi)"
  echo ".env.local: $(if [ -f .env.local ]; then echo presente; else echo ausente; fi)"
  echo "node_modules: $(if [ -d node_modules ]; then echo presente; else echo ausente; fi)"
  echo "docker-compose: $(if command -v docker-compose >/dev/null 2>&1; then echo disponivel; else echo ausente; fi)"
  echo "docker compose plugin: $(if docker compose version >/dev/null 2>&1; then echo disponivel; else echo ausente; fi)"
}

ensure_mac() {
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "Este atalho foi adaptado para macOS." >&2
    exit 1
  fi
}

load_supabase_env() {
  ensure_profile

  status_output="$(npx supabase status -o env 2>/dev/null || true)"
  if [ -z "$status_output" ]; then
    echo "Supabase local nao esta rodando." >&2
    exit 1
  fi

  temp_env="$(mktemp)"
  printf '%s\n' "$status_output" > "$temp_env"
  set -a
  # shellcheck disable=SC1090
  . "$temp_env"
  set +a
  rm -f "$temp_env"
}

open_url() {
  url="$1"

  ensure_mac
  open "$url"
}

prompt_value() {
  label="$1"
  printf "%s: " "$label"
  IFS= read -r value
  printf '%s' "$value"
}

prompt_secret() {
  label="$1"
  printf "%s: " "$label"
  stty -echo
  IFS= read -r value
  stty echo
  printf '\n'
  printf '%s' "$value"
}

start_frontend_headless() {
  ensure_state_dir

  if [ -f "$FRONTEND_PID_FILE" ]; then
    current_pid="$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)"
    if [ -n "$current_pid" ] && kill -0 "$current_pid" 2>/dev/null; then
      echo "Frontend ja esta rodando com PID $current_pid."
      exit 0
    fi
    rm -f "$FRONTEND_PID_FILE"
  fi

  nohup sh -lc '. "$HOME/.profile" && cd "'"$SCRIPT_DIR"'" && npm run dev -- --host 0.0.0.0 --port 8080' > "$FRONTEND_LOG_FILE" 2>&1 &
  frontend_pid=$!
  echo "$frontend_pid" > "$FRONTEND_PID_FILE"
  echo "Frontend iniciado em background. PID: $frontend_pid"
  echo "Logs: $FRONTEND_LOG_FILE"
}

stop_frontend_headless() {
  if [ ! -f "$FRONTEND_PID_FILE" ]; then
    echo "Frontend nao esta rodando em background."
    return
  fi

  frontend_pid="$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)"
  if [ -n "$frontend_pid" ] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid"
    echo "Frontend parado. PID: $frontend_pid"
  else
    echo "PID do frontend nao estava ativo."
  fi

  rm -f "$FRONTEND_PID_FILE"
}

action_docker_start() {
  ensure_mac

  if ! command -v colima >/dev/null 2>&1; then
    echo "Colima nao encontrado. Instale com 'brew install colima'." >&2
    exit 1
  fi

  colima start
  docker info >/dev/null
  echo "Docker pronto com Colima."
}

action_docker_clean() {
  echo "Containers ativos antes:"
  docker ps || true
  echo
  echo "Containers do compose antes:"
  compose_cmd -f docker-compose.local.yml ps || true

  compose_cmd -f docker-compose.local.yml down --remove-orphans || true

  running_containers="$(docker ps -q || true)"
  if [ -n "$running_containers" ]; then
    docker stop $running_containers
  fi

  docker container prune -f >/dev/null 2>&1 || true
  docker volume prune -f >/dev/null 2>&1 || true
  echo "Docker parado/limpo para este ambiente local."
}

action_supabase_start() {
  run_node_cmd npm run supabase:start
}

action_supabase_restart() {
  run_node_cmd npm run supabase:stop || true
  run_node_cmd npm run supabase:start
}

action_supabase_stop() {
  run_node_cmd npm run supabase:stop
}

action_supabase_install() {
  ensure_profile

  if command -v supabase >/dev/null 2>&1; then
    echo "Supabase CLI ja esta instalado: $(supabase --version)"
    exit 0
  fi

  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew nao encontrado. Instale o Homebrew ou rode 'npm exec supabase' manualmente." >&2
    exit 1
  fi

  brew install supabase/tap/supabase
}

action_supabase_reinit() {
  ensure_profile
  npx supabase stop --no-backup || true
  npx supabase start
  npx supabase db reset
}

action_db_update() {
  ensure_profile
  npx supabase db push --local
}

action_db_reset() {
  run_node_cmd npm run supabase:reset
}

action_account_create() {
  load_supabase_env
  ensure_profile

  email="$(prompt_value "Email da conta")"
  password="$(prompt_secret "Senha da conta")"
  cnpj="$(prompt_value "CNPJ da clinica (14 digitos)")"
  full_name="$(prompt_value "Nome completo")"

  if [ -z "$email" ] || [ -z "$password" ] || [ -z "$cnpj" ]; then
    echo "Email, senha e CNPJ sao obrigatorios." >&2
    exit 1
  fi

  SUPABASE_URL="$API_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  ACCOUNT_EMAIL="$email" \
  ACCOUNT_PASSWORD="$password" \
  ACCOUNT_CNPJ="$cnpj" \
  ACCOUNT_FULL_NAME="$full_name" \
  node --input-type=module <<'EOF'
import { createClient } from "@supabase/supabase-js";

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.env.ACCOUNT_EMAIL;
const password = process.env.ACCOUNT_PASSWORD;
const cnpj = process.env.ACCOUNT_CNPJ;
const fullName = process.env.ACCOUNT_FULL_NAME || null;

const { data, error } = await client.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

const { error: setupError } = await client.rpc("handle_signup", {
  _user_id: data.user.id,
  _email: email,
  _cnpj: cnpj,
  _full_name: fullName,
});

if (setupError) {
  console.error(setupError.message);
  process.exit(1);
}

console.log(`Conta criada: ${email}`);
console.log(`User ID: ${data.user.id}`);
EOF
}

action_account_list() {
  load_supabase_env
  ensure_profile

  SUPABASE_URL="$API_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  node --input-type=module <<'EOF'
import { createClient } from "@supabase/supabase-js";

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [{ data: authData, error: authError }, { data: profiles, error: profileError }] = await Promise.all([
  client.auth.admin.listUsers(),
  client.from("profiles").select("id, full_name, email, clinic_id"),
]);

if (authError) {
  console.error(authError.message);
  process.exit(1);
}

if (profileError) {
  console.error(profileError.message);
  process.exit(1);
}

const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
const rows = (authData.users ?? []).map((user) => {
  const profile = profileById.get(user.id);
  return {
    email: user.email,
    confirmed: Boolean(user.email_confirmed_at),
    full_name: profile?.full_name ?? "",
    clinic_id: profile?.clinic_id ?? "",
    user_id: user.id,
  };
});

console.table(rows);
EOF
}

action_frontend_install() {
  run_node_cmd npm ci
}

action_frontend_start() {
  start_frontend_headless
}

action_frontend_restart() {
  stop_frontend_headless
  start_frontend_headless
}

action_frontend_stop() {
  stop_frontend_headless
}

action_frontend_logs() {
  ensure_state_dir

  if [ ! -f "$FRONTEND_LOG_FILE" ]; then
    echo "Ainda nao existem logs do frontend."
    exit 0
  fi

  tail -n 100 "$FRONTEND_LOG_FILE"
}

action_install_all() {
  action_frontend_install
  action_supabase_install || true
}

action_update_packages() {
  ensure_profile
  npm outdated || true
  npm update
}

action_start_all() {
  action_docker_start
  action_supabase_start
  run_node_cmd npm run supabase:env:local
  action_frontend_start
  open_url "http://localhost:8080"
}

action_stop_all() {
  action_frontend_stop
  action_supabase_stop || true
  action_docker_clean || true
}

action_tdd_checks() {
  ensure_profile
  npm run test
  npm run build
  npm run lint
}

list_actions() {
  cat <<'EOF'
docker-start|Iniciar o Docker com Colima
docker-clean|Parar e limpar Docker e docker-compose
supabase-start|Iniciar Supabase local
supabase-restart|Reiniciar Supabase local
supabase-stop|Parar Supabase local
supabase-install|Instalar Supabase CLI localmente
supabase-reinit|Resetar Supabase local do zero
db-update|Atualizar banco de dados local
db-reset|Resetar banco de dados local
account-create|Criar nova conta local
account-list|Listar contas existentes
frontend-install|Instalar dependencias do frontend
frontend-start|Iniciar frontend em background
frontend-restart|Reiniciar frontend
frontend-stop|Parar frontend
frontend-logs|Ver logs do frontend
install-all|Instalar todas as dependencias
update-packages|Verificar e atualizar pacotes
start-all|Iniciar tudo
stop-all|Parar tudo
tdd-check|Rodar verificacoes TDD
quit|Sair
EOF
}

run_action() {
  action="$1"

  case "$action" in
    docker-start) action_docker_start ;;
    docker-clean) action_docker_clean ;;
    supabase-start) action_supabase_start ;;
    supabase-restart) action_supabase_restart ;;
    supabase-stop) action_supabase_stop ;;
    supabase-install) action_supabase_install ;;
    supabase-reinit) action_supabase_reinit ;;
    db-update) action_db_update ;;
    db-reset) action_db_reset ;;
    account-create) action_account_create ;;
    account-list) action_account_list ;;
    frontend-install) action_frontend_install ;;
    frontend-start) action_frontend_start ;;
    frontend-restart) action_frontend_restart ;;
    frontend-stop) action_frontend_stop ;;
    frontend-logs) action_frontend_logs ;;
    install-all) action_install_all ;;
    update-packages) action_update_packages ;;
    start-all) action_start_all ;;
    stop-all) action_stop_all ;;
    tdd-check) action_tdd_checks ;;
    env-summary) print_env_summary ;;
    quit) exit 0 ;;
    *)
      echo "Acao desconhecida: $action" >&2
      exit 1
      ;;
  esac
}

print_menu() {
  cat <<'EOF'

Control Center - Therapy Flow
Docker
1)  docker-start     Iniciar o docker (colima start + docker)
2)  docker-clean     Parar e limpar docker ps + docker-compose ps

Supabase
3)  supabase-start   Iniciar Supabase local
4)  supabase-restart Reiniciar Supabase local
5)  supabase-stop    Parar Supabase local
6)  supabase-install Instalar Supabase local
7)  supabase-reinit  Resetar Supabase local do zero
8)  db-update        Atualizar banco de dados
9)  db-reset         Resetar banco de dados
10) account-create   Criar nova conta
11) account-list     Listar contas existentes

Frontend
12) frontend-install Instalar dependencias
13) frontend-start   Iniciar frontend headless
14) frontend-restart Reiniciar frontend
15) frontend-stop    Parar frontend
16) frontend-logs    Logs do frontend

Geral
17) install-all      Instalar todas as dependencias
18) update-packages  Verificar e atualizar pacotes/dependencias
19) start-all        Iniciar tudo
20) stop-all         Parar tudo
21) tdd-check        Verificacoes de testes TDD
0)  quit             Sair
EOF
}

resolve_menu_choice() {
  case "$1" in
    1) echo "docker-start" ;;
    2) echo "docker-clean" ;;
    3) echo "supabase-start" ;;
    4) echo "supabase-restart" ;;
    5) echo "supabase-stop" ;;
    6) echo "supabase-install" ;;
    7) echo "supabase-reinit" ;;
    8) echo "db-update" ;;
    9) echo "db-reset" ;;
    10) echo "account-create" ;;
    11) echo "account-list" ;;
    12) echo "frontend-install" ;;
    13) echo "frontend-start" ;;
    14) echo "frontend-restart" ;;
    15) echo "frontend-stop" ;;
    16) echo "frontend-logs" ;;
    17) echo "install-all" ;;
    18) echo "update-packages" ;;
    19) echo "start-all" ;;
    20) echo "stop-all" ;;
    21) echo "tdd-check" ;;
    0) echo "quit" ;;
    *) echo "" ;;
  esac
}

interactive_menu() {
  while :; do
    print_menu
    printf "Escolha uma opcao: "
    IFS= read -r choice || exit 0

    action="$(resolve_menu_choice "$choice")"
    if [ -z "$action" ]; then
      echo "Opcao invalida."
      continue
    fi

    run_action "$action"
  done
}

case "${1:-}" in
  --list)
    list_actions
    ;;
  --run)
    if [ $# -lt 2 ]; then
      echo "Uso: sh control.sh --run <acao>" >&2
      exit 1
    fi
    run_action "$2"
    ;;
  "")
    interactive_menu
    ;;
  *)
    echo "Uso: sh control.sh [--list | --run <acao>]" >&2
    exit 1
    ;;
esac
