#!/bin/sh

set -eu

if ! npx supabase status >/dev/null 2>&1; then
  echo "Iniciando a stack local do Supabase..."
  npx supabase start
fi

sh "$(dirname "$0")/write-supabase-env.sh"

functions_pid=""
cleanup() {
  if [ "$functions_pid" != "" ] && kill -0 "$functions_pid" >/dev/null 2>&1; then
    kill "$functions_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [ -f ".secrets/backblaze-b2.env" ]; then
  echo "Iniciando Edge Functions locais para uploads B2..."
  sh "$(dirname "$0")/dev/supabase-functions-files.sh" &
  functions_pid="$!"
else
  echo "Aviso: .secrets/backblaze-b2.env nao encontrado; uploads B2 locais nao funcionarao." >&2
fi

echo "Iniciando o frontend em http://localhost:8080 ..."
vite
