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
  THERAPY_FLOW_BACKUP_NATIVE_PG
                        Use local pg_dump/pg_dumpall instead of the Supabase
                        CLI Docker helper. Values: auto, 1, 0. Default: auto.

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

native_pg_dump_mode="${THERAPY_FLOW_BACKUP_NATIVE_PG:-auto}"

can_use_native_pg_dump() {
  [ "$TARGET" = "prod" ] || return 1
  command -v pg_dump >/dev/null 2>&1 || return 1
  command -v pg_dumpall >/dev/null 2>&1 || return 1
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

  if [ "$native_pg_dump_mode" = "1" ] || { [ "$native_pg_dump_mode" = "auto" ] && can_use_native_pg_dump; }; then
    dry_run_output="$(run_supabase db dump $target_flag $password_args "$@" --dry-run --file "$file")"
    generated_script="$(printf '%s\n' "$dry_run_output" | sed -n '/^#!\/usr\/bin\/env bash/,$p')"

    if [ -z "$generated_script" ]; then
      echo "Nao foi possivel extrair o script nativo de pg_dump gerado pelo Supabase CLI." >&2
      return 1
    fi

    printf '%s\n' "$generated_script" | bash > "$file"
    return
  fi

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
