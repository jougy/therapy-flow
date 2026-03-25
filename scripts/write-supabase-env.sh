#!/bin/sh

set -eu

existing_env_backup=""

cleanup() {
  if [ -n "$existing_env_backup" ] && [ -f "$existing_env_backup" ]; then
    mv "$existing_env_backup" .env.local
  fi
}

trap cleanup EXIT INT TERM

if [ -f .env.local ]; then
  existing_env_backup="$(mktemp)"
  mv .env.local "$existing_env_backup"
fi

status_output="$(npx supabase status -o env 2>/dev/null || true)"

if [ -z "$status_output" ]; then
  echo "A stack local do Supabase nao esta rodando. Use 'npm run supabase:start' ou 'npm run dev:local'." >&2
  exit 1
fi

api_url="$(printf '%s\n' "$status_output" | sed -n 's/^API_URL=//p')"
anon_key="$(printf '%s\n' "$status_output" | sed -n 's/^ANON_KEY=//p')"

strip_wrapping_quotes() {
  value="$1"

  case "$value" in
    \"*\")
      value="${value#\"}"
      value="${value%\"}"
      ;;
  esac

  printf '%s' "$value"
}

escape_env_value() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

api_url="$(strip_wrapping_quotes "$api_url")"
anon_key="$(strip_wrapping_quotes "$anon_key")"

if [ -z "$api_url" ] || [ -z "$anon_key" ]; then
  echo "Nao foi possivel obter API_URL e ANON_KEY a partir de 'supabase status -o env'." >&2
  exit 1
fi

tmp_file="$(mktemp)"

if [ -n "$existing_env_backup" ] && [ -f "$existing_env_backup" ]; then
  grep -v '^VITE_SUPABASE_' "$existing_env_backup" > "$tmp_file" || true
fi

cat <<EOF >> "$tmp_file"
VITE_SUPABASE_PROJECT_ID="local"
VITE_SUPABASE_PUBLISHABLE_KEY="$(escape_env_value "$anon_key")"
VITE_SUPABASE_URL="$(escape_env_value "$api_url")"
EOF

mv "$tmp_file" .env.local
rm -f "$existing_env_backup"
existing_env_backup=""

echo ".env.local atualizado para apontar ao Supabase local."
