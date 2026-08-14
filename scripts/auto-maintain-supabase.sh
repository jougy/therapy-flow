#!/usr/bin/env sh
set -eu

PROJECT_DIR="/Users/jougy/Documents/therapy-flow"
LOG_FILE="$PROJECT_DIR/backups/supabase/maintenance.log"

mkdir -p "$PROJECT_DIR/backups/supabase"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Starting Automated Supabase & Docker Maintenance ===" >> "$LOG_FILE"

cd "$PROJECT_DIR"

# 1. Perform Database Backup if local Supabase is running
if command -v supabase >/dev/null 2>&1 || [ -f "node_modules/.bin/supabase" ]; then
  echo "[1/3] Running database backup (npm run backup:local)..." >> "$LOG_FILE"
  if sh scripts/backup-supabase-prod.sh --local --full >> "$LOG_FILE" 2>&1; then
    echo "Backup completed successfully." >> "$LOG_FILE"
  else
    echo "Warning: Backup skipped or failed (Supabase local might be stopped)." >> "$LOG_FILE"
  fi
fi

# 2. Prune unused Docker build caches and dangling images
echo "[2/3] Cleaning Docker build cache and unused images..." >> "$LOG_FILE"
if command -v docker >/dev/null 2>&1; then
  docker system prune -af --volumes >> "$LOG_FILE" 2>&1 || true
  echo "Docker prune finished." >> "$LOG_FILE"
fi

# 3. Rotate old backups (keep latest 5 backups)
echo "[3/3] Rotating old backups (keeping latest 5)..." >> "$LOG_FILE"
ls -dt "$PROJECT_DIR/backups/supabase/local-local-"* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo "=== [$(date '+%Y-%m-%d %H:%M:%S')] Maintenance finished cleanly ===" >> "$LOG_FILE"
