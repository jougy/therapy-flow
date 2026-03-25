#!/bin/sh

set -eu

action="${1:-up}"

compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  echo "Docker Compose nao esta disponivel. Instale 'docker-compose' ou o plugin 'docker compose'." >&2
  exit 1
}

case "$action" in
  up)
    if ! npx supabase status >/dev/null 2>&1; then
      echo "Iniciando a stack local do Supabase..."
      npx supabase start
    fi

    sh "$(dirname "$0")/write-supabase-env.sh"
    exec compose_cmd -f docker-compose.local.yml up --build
    ;;
  down)
    exec compose_cmd -f docker-compose.local.yml down
    ;;
  *)
    echo "Uso: sh scripts/compose-local.sh [up|down]" >&2
    exit 1
    ;;
esac
