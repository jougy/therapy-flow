#!/bin/sh

set -eu

if ! npx supabase status >/dev/null 2>&1; then
  echo "Iniciando a stack local do Supabase..."
  npx supabase start
fi

sh "$(dirname "$0")/write-supabase-env.sh"

echo "Iniciando o frontend em http://localhost:8080 ..."
exec vite
