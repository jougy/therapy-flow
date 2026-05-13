#!/usr/bin/env sh
set -eu

MODE="full"
TARGET="prod"
OUTPUT_ROOT="backups/supabase"

usage() {
  cat <<'EOF'
Usage:
  sh scripts/backup-supabase-prod.sh [options]

Options:
  --full             Dump roles, schema and data. Default.
  --schema-only      Dump roles and schema only.
  --data-only        Dump data only.
  --prod             Dump linked Supabase project. Default.
  --local            Dump local Supabase database.
  --output-dir DIR   Backup root directory. Default: backups/supabase.
  -h, --help         Show this help.

Environment:
  SUPABASE_DB_PASSWORD  Optional remote Postgres password for Supabase db dump.

Examples:
  npm run backup:prod
  npm run backup:prod:schema
  sh scripts/backup-supabase-prod.sh --local --full
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --full)
      MODE="full"
      ;;
    --schema-only)
      MODE="schema"
      ;;
    --data-only)
      MODE="data"
      ;;
    --prod)
      TARGET="prod"
      ;;
    --local)
      TARGET="local"
      ;;
    --output-dir)
      shift
      if [ "$#" -eq 0 ]; then
        echo "Missing value for --output-dir" >&2
        exit 2
      fi
      OUTPUT_ROOT="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
project_ref="local"

if [ "$TARGET" = "prod" ] && [ -f "supabase/.temp/project-ref" ]; then
  project_ref="$(tr -d '\n' < supabase/.temp/project-ref)"
fi

backup_dir="$OUTPUT_ROOT/$TARGET-$project_ref-$timestamp"
mkdir -p "$backup_dir"

run_supabase() {
  if command -v supabase >/dev/null 2>&1; then
    supabase "$@"
  else
    npx supabase "$@"
  fi
}

if [ "$TARGET" = "local" ]; then
  target_flag="--local"
else
  target_flag="--linked"
fi

password_args=""
if [ "$TARGET" = "prod" ] && [ "${SUPABASE_DB_PASSWORD:-}" != "" ]; then
  password_args="--password $SUPABASE_DB_PASSWORD"
fi

run_dump() {
  description="$1"
  file="$2"
  shift 2

  echo "Creating $description: $file"
  # shellcheck disable=SC2086
  run_supabase db dump $target_flag $password_args "$@" --file "$file"
}

{
  echo "created_at_utc=$timestamp"
  echo "target=$TARGET"
  echo "project_ref=$project_ref"
  echo "git_branch=$(git branch --show-current 2>/dev/null || true)"
  echo "git_commit=$(git rev-parse HEAD 2>/dev/null || true)"
  echo "mode=$MODE"
} > "$backup_dir/manifest.txt"

if [ "$TARGET" = "local" ]; then
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort > "$backup_dir/migrations.txt"
else
  run_supabase migration list > "$backup_dir/migrations.txt"
fi

case "$MODE" in
  full)
    run_dump "roles dump" "$backup_dir/roles.sql" --role-only
    run_dump "schema dump" "$backup_dir/schema.sql"
    run_dump "data dump" "$backup_dir/data.sql" --data-only --use-copy
    ;;
  schema)
    run_dump "roles dump" "$backup_dir/roles.sql" --role-only
    run_dump "schema dump" "$backup_dir/schema.sql"
    ;;
  data)
    run_dump "data dump" "$backup_dir/data.sql" --data-only --use-copy
    ;;
  *)
    echo "Invalid backup mode: $MODE" >&2
    exit 2
    ;;
esac

echo "Backup created at: $backup_dir"
