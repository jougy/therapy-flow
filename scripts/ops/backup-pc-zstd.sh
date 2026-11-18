#!/bin/sh
# backup-pc-zstd.sh
# Cofre Passivo Local (Pull-Only): Puxa snapshots de Banco + Buckets S3 + Config IaC/ESC
# e grava de forma deduplicada e comprimida com Zstandard Maximo (--compression max) no Restic.
#
# Uso:
#   sh scripts/ops/backup-pc-zstd.sh init      -> Inicializa o repositorio Restic criptografado
#   sh scripts/ops/backup-pc-zstd.sh backup    -> Executa snapshot versionado (DB + Storage + IaC)
#   sh scripts/ops/backup-pc-zstd.sh list      -> Lista versoes/snapshots estilo git log
#   sh scripts/ops/backup-pc-zstd.sh restore <snapshot_id> <destino> -> Restaura versao para pasta/MinIO

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_DIR"

# Garante Homebrew Linux no PATH
if [ -d "/home/linuxbrew/.linuxbrew/bin" ]; then
  case ":$PATH:" in
    *:/home/linuxbrew/.linuxbrew/bin:*) ;;
    *) export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH" ;;
  esac
fi

BACKUP_ROOT="${PLURI_BACKUP_ROOT:-$HOME/pluri-health-vault-backup}"
RESTIC_REPO="${RESTIC_REPOSITORY:-$BACKUP_ROOT/restic-repo}"
STAGING_DIR="${PLURI_BACKUP_STAGING:-$BACKUP_ROOT/staging}"
RESTIC_PASS_FILE="${RESTIC_PASSWORD_FILE:-$BACKUP_ROOT/.restic-key}"
DB_URL="${BACKUP_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

require_tools() {
  for tool in restic zstd; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Erro: '$tool' nao encontrado. Instale com 'brew install $tool'." >&2
      exit 1
    fi
  done
}

ensure_pass_file() {
  mkdir -p "$BACKUP_ROOT" "$STAGING_DIR"
  if [ ! -f "$RESTIC_PASS_FILE" ]; then
    head -c 32 /dev/urandom | base64 > "$RESTIC_PASS_FILE"
    chmod 600 "$RESTIC_PASS_FILE"
    echo "🔑 Chave de criptografia gerada em: $RESTIC_PASS_FILE (guarde uma copia segura!)."
  fi
}

cmd_init() {
  require_tools
  ensure_pass_file
  if restic -r "$RESTIC_REPO" --password-file "$RESTIC_PASS_FILE" snapshots >/dev/null 2>&1; then
    echo "✅ Repositorio Restic ja inicializado em: $RESTIC_REPO"
    return 0
  fi
  restic init -r "$RESTIC_REPO" --password-file "$RESTIC_PASS_FILE"
  echo "✅ Repositorio Restic (Zstd + AES-256) inicializado em: $RESTIC_REPO"
}

cmd_backup() {
  require_tools
  ensure_pass_file

  if ! restic -r "$RESTIC_REPO" --password-file "$RESTIC_PASS_FILE" snapshots >/dev/null 2>&1; then
    cmd_init
  fi

  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  git_rev="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
  git_branch="$(git branch --show-current 2>/dev/null || echo 'detached')"

  echo "📦 [1/4] Preparando staging em $STAGING_DIR..."
  mkdir -p "$STAGING_DIR/db" "$STAGING_DIR/iac" "$STAGING_DIR/storage"

  # 1. Dump do Postgres (se pg_dump disponivel ou via docker supabase)
  if command -v pg_dump >/dev/null 2>&1; then
    echo "🗄️  [2/4] Exportando banco Postgres..."
    pg_dump "$DB_URL" --no-owner --no-acl | zstd -19 -T0 -f -o "$STAGING_DIR/db/postgres_${timestamp}.sql.zst" || true
  elif command -v docker >/dev/null 2>&1; then
    db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1 || true)"
    if [ -n "$db_container" ]; then
      echo "🗄️  [2/4] Exportando banco via container $db_container..."
      docker exec "$db_container" pg_dump -U postgres postgres --no-owner --no-acl | zstd -19 -T0 -f -o "$STAGING_DIR/db/postgres_${timestamp}.sql.zst" || true
    fi
  fi

  # 2. Estado IaC / Migrations / Configs (sem segredos em texto claro se nao desejado, apenas estrutura)
  echo "⚙️  [3/4] Coletando migrations, schema e definicoes IaC..."
  cp -f "$REPO_DIR/supabase/config.toml" "$STAGING_DIR/iac/" 2>/dev/null || true
  cp -f "$REPO_DIR/docker-compose.local.yml" "$STAGING_DIR/iac/" 2>/dev/null || true

  # 3. Puxar buckets S3 via rclone (se configurado com remote 'pluri-b2:' ou 'pluri-r2:')
  if command -v rclone >/dev/null 2>&1; then
    for remote in $(rclone listremotes 2>/dev/null || true); do
      case "$remote" in
        pluri-*)
          safe_name="$(printf '%s' "$remote" | tr -d ':')"
          echo "☁️  Sincronizando bucket remoto $remote -> staging/storage/$safe_name..."
          rclone sync "$remote" "$STAGING_DIR/storage/$safe_name" --checksum --fast-list || true
          ;;
      esac
    done
  fi

  # 4. Snapshot Restic com compressao Zstd maxima e tags estilo Git
  echo "🗜️  [4/4] Gravando snapshot deduplicado (Restic + Zstd max)..."
  restic -r "$RESTIC_REPO" --password-file "$RESTIC_PASS_FILE" backup \
    "$STAGING_DIR" \
    "$REPO_DIR/supabase/migrations" \
    --compression max \
    --tag "branch:${git_branch}" \
    --tag "commit:${git_rev}" \
    --tag "ts:${timestamp}"

  echo "✅ Snapshot concluido! Use 'sh scripts/ops/backup-pc-zstd.sh list' para ver as versoes."
}

cmd_list() {
  require_tools
  ensure_pass_file
  restic -r "$RESTIC_REPO" --password-file "$RESTIC_PASS_FILE" snapshots
}

cmd_restore() {
  require_tools
  ensure_pass_file
  snap_id="${1:-latest}"
  target_dir="${2:-$BACKUP_ROOT/restored/$snap_id}"
  mkdir -p "$target_dir"
  restic -r "$RESTIC_REPO" --password-file "$RESTIC_PASS_FILE" restore "$snap_id" --target "$target_dir"
  echo "✅ Snapshot '$snap_id' restaurado em: $target_dir"
  echo "💡 Para subir os arquivos restaurados no MinIO local ou nova cloud, use: rclone copy $target_dir/storage <destino>"
}

action="${1:-help}"
shift || true

case "$action" in
  init) cmd_init ;;
  backup) cmd_backup ;;
  list) cmd_list ;;
  restore) cmd_restore "$@" ;;
  *)
    echo "Uso: sh scripts/ops/backup-pc-zstd.sh {init|backup|list|restore [id] [destino]}"
    exit 1
    ;;
esac
