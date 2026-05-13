#!/usr/bin/env bash
# Buse Kağıt — Update Deployment Script
# Usage: cd /opt/buse-kagit && sudo bash deploy/deploy.sh
#
# Yapacaklar:
# 1. Git pull (yeni kod çek)
# 2. Backend dependencies güncelle
# 3. Frontend yeniden build
# 4. Backend yeniden başlat (zero-downtime)
# 5. Nginx reload

set -euo pipefail

APP_DIR="/opt/buse-kagit"
cd "$APP_DIR"

echo "=========================================="
echo " Buse Kagit Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# Pre-deploy yedek (güvenlik)
echo "[1/6] Pre-deploy yedek alınıyor..."
bash "$APP_DIR/deploy/backup.sh" || echo "  ⚠ Yedek başarısız, yine de devam ediliyor"

# Git pull
echo "[2/6] Kod güncelleniyor..."
git fetch --all
git reset --hard origin/main

# Backend
echo "[3/6] Backend dependencies..."
sudo -u buse bash -c "
    cd $APP_DIR/backend
    source venv/bin/activate
    pip install -q -r requirements.txt
    pip install -q emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
"

# Frontend build
echo "[4/6] Frontend build..."
sudo -u buse bash -c "
    cd $APP_DIR/frontend
    yarn install --frozen-lockfile --silent
    yarn build
"

# Restart backend
echo "[5/6] Backend yeniden başlatılıyor..."
systemctl restart buse-backend
sleep 3
if ! systemctl is-active --quiet buse-backend; then
    echo "  ❌ Backend başlatılamadı!"
    journalctl -u buse-backend --no-pager -n 30
    exit 1
fi

# Nginx reload (static dosyalar değiştiyse cache temizlenmiş olur)
echo "[6/6] Nginx reload..."
nginx -t
systemctl reload nginx

echo ""
echo "=========================================="
echo " ✓ Deploy tamamlandı!"
echo " Backend: $(systemctl is-active buse-backend)"
echo " Nginx:   $(systemctl is-active nginx)"
echo " MongoDB: $(systemctl is-active mongod)"
echo "=========================================="
