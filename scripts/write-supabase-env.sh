#!/bin/sh

set -eu

status_output="$(npx supabase status -o env 2>/dev/null || true)"

if [ -z "$status_output" ]; then
  echo "A stack local do Supabase nao esta rodando. Use 'npm run supabase:start' ou 'npm run dev:local'." >&2
  exit 1
fi

api_url="$(printf '%s\n' "$status_output" | sed -n 's/^API_URL=//p')"
anon_key="$(printf '%s\n' "$status_output" | sed -n 's/^ANON_KEY=//p')"

if [ -z "$api_url" ] || [ -z "$anon_key" ]; then
  echo "Nao foi possivel obter API_URL e ANON_KEY a partir de 'supabase status -o env'." >&2
  exit 1
fi

tmp_file="$(mktemp)"

if [ -f .env.local ]; then
  grep -v '^VITE_SUPABASE_' .env.local > "$tmp_file" || true
fi

cat <<EOF >> "$tmp_file"
VITE_SUPABASE_PROJECT_ID="local"
VITE_SUPABASE_PUBLISHABLE_KEY="$anon_key"
VITE_SUPABASE_URL="$api_url"
EOF

mv "$tmp_file" .env.local

echo ".env.local atualizado para apontar ao Supabase local."
