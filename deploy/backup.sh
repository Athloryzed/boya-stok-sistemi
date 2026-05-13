#!/usr/bin/env bash
# Buse Kağıt — MongoDB Backup Script
# Cron: 0 3 * * * /opt/buse-kagit/deploy/backup.sh >> /var/log/buse-backup.log 2>&1

set -euo pipefail

APP_DIR="/opt/buse-kagit"
BACKUP_DIR="$APP_DIR/backups"
RETENTION_DAYS=30
DB_NAME="${DB_NAME:-buse_kagit_prod}"
TS=$(date -u +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/backup_${TS}.archive.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup başlıyor → $OUT"

# Mongodump native
mongodump --uri="mongodb://localhost:27017" --db="$DB_NAME" --gzip --archive="$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Yedek alındı: $OUT ($SIZE)"

# Eski yedekleri temizle
DELETED=$(find "$BACKUP_DIR" -name 'backup_*.archive.gz' -mtime +$RETENTION_DAYS -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $DELETED eski yedek silindi (>$RETENTION_DAYS gün)"
fi

# (Opsiyonel) Off-site upload — uncomment etmek için:
# rclone copy "$OUT" gdrive:buse-kagit-backups/ 2>/dev/null || echo "  ⚠ Rclone upload başarısız"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup tamamlandı"
