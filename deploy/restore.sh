#!/usr/bin/env bash
# Buse Kağıt — Disaster Recovery / Restore Script
# Usage: bash restore.sh /path/to/backup_YYYYMMDD_HHMMSS.archive.gz
#
# Bu script:
# 1. Mongodump arşivi mi yoksa Python BSON fallback mi tespit eder
# 2. Uygun yöntemle restore eder
# 3. Restore öncesi otomatik "pre-restore" yedek alır (geri dönüş için)

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Kullanim: bash restore.sh /path/to/backup_*.archive.gz"
    exit 1
fi

ARCHIVE="$1"
DB_NAME="${DB_NAME:-buse_kagit_prod}"
BACKUP_DIR="/opt/buse-kagit/backups"

if [ ! -f "$ARCHIVE" ]; then
    echo "❌ Yedek dosyası bulunamadı: $ARCHIVE"
    exit 1
fi

echo "=========================================="
echo " RESTORE: $ARCHIVE → $DB_NAME"
echo "=========================================="

read -p " ⚠ Mevcut '$DB_NAME' veritabanı ÜZERİNE yazılacak. Emin misiniz? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "İptal edildi."
    exit 0
fi

# 1. Pre-restore yedek
PRE_TS=$(date -u +%Y%m%d_%H%M%S)
PRE_BACKUP="$BACKUP_DIR/PRE_RESTORE_${PRE_TS}.archive.gz"
echo "[1/3] Pre-restore yedek alınıyor → $PRE_BACKUP"
mongodump --uri="mongodb://localhost:27017" --db="$DB_NAME" --gzip --archive="$PRE_BACKUP" 2>/dev/null || echo "  ⚠ Pre-restore yedek alınamadı (DB belki boş)"

# 2. Format tespiti — mongodump arşivi mi yoksa tar.gz BSON mu?
echo "[2/3] Arşiv formatı tespit ediliyor..."
FIRST_BYTES=$(zcat "$ARCHIVE" | head -c 4 | xxd -p)
# tar arşivi "ustar" magic'i 257. byte'tan başlar; mongodump kendi formatı
# Heuristic: tar.gz ise dosya içinde .bson uzantılı dosya olur
if zcat "$ARCHIVE" | tar -tf - 2>/dev/null | grep -q '\.bson$'; then
    echo "  → Python BSON fallback formatı"
    METHOD="python_bson"
else
    echo "  → Mongodump archive formatı"
    METHOD="mongodump"
fi

# 3. Restore
echo "[3/3] Restore başlıyor..."
case "$METHOD" in
    mongodump)
        mongorestore --uri="mongodb://localhost:27017" \
            --gzip --archive="$ARCHIVE" \
            --nsInclude="${DB_NAME}.*" \
            --drop
        ;;
    python_bson)
        TMP_DIR=$(mktemp -d)
        tar -xzf "$ARCHIVE" -C "$TMP_DIR"
        for bson_file in "$TMP_DIR"/*.bson; do
            COLL=$(basename "$bson_file" .bson)
            echo "    → $COLL"
            mongorestore --uri="mongodb://localhost:27017" \
                --db="$DB_NAME" --collection="$COLL" \
                "$bson_file" --drop > /dev/null
        done
        rm -rf "$TMP_DIR"
        ;;
esac

echo ""
echo "=========================================="
echo " ✓ Restore tamamlandı"
echo "=========================================="
echo " Doğrulama:"
mongosh "$DB_NAME" --quiet --eval "db.getCollectionNames().sort().forEach(c => print('  ' + c + ' = ' + db[c].countDocuments() + ' kayıt'))"
echo ""
echo " Pre-restore yedek: $PRE_BACKUP"
echo " (Geri dönmek için bu dosyayı restore.sh ile yükleyebilirsiniz)"
