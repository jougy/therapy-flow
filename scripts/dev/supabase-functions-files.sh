#!/bin/sh

set -eu

env_file=".secrets/backblaze-b2.env"

if [ ! -f "$env_file" ]; then
  echo "Arquivo $env_file nao encontrado." >&2
  echo "Crie esse arquivo com os secrets B2 antes de testar uploads locais." >&2
  exit 1
fi

exec npx supabase functions serve --env-file "$env_file"
