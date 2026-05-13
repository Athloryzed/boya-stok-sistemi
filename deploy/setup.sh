#!/usr/bin/env bash
# Buse Kağıt — Hetzner VPS Initial Setup
# Usage: bash setup.sh
# OS: Ubuntu 22.04 LTS

set -euo pipefail

echo "=============================================="
echo " Buse Kagit VPS Setup — Ubuntu 22.04"
echo "=============================================="

if [ "$EUID" -ne 0 ]; then
  echo "Bu script root olarak çalıştırılmalı (sudo bash setup.sh)"
  exit 1
fi

# 1. System update
echo "[1/9] System update..."
apt-get update -qq
apt-get upgrade -y -qq

# 2. Essentials
echo "[2/9] Essential packages..."
apt-get install -y -qq curl wget gnupg lsb-release ca-certificates \
  software-properties-common build-essential git ufw fail2ban htop \
  unzip zip jq

# 3. Python 3.11
echo "[3/9] Python 3.11..."
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update -qq
apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip

# 4. Node.js 20 + Yarn
echo "[4/9] Node.js 20 + Yarn..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y -qq nodejs
npm install -g yarn

# 5. MongoDB 7.0
echo "[5/9] MongoDB 7.0..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -qq
apt-get install -y -qq mongodb-org
systemctl enable --now mongod

# 6. Nginx + Certbot
echo "[6/9] Nginx + Certbot..."
apt-get install -y -qq nginx certbot python3-certbot-nginx

# 7. Firewall
echo "[7/9] UFW Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

# 8. Fail2ban
echo "[8/9] Fail2ban..."
systemctl enable --now fail2ban

# 9. App user + directories
echo "[9/9] App user + directories..."
if ! id -u buse >/dev/null 2>&1; then
  useradd -m -s /bin/bash buse
fi
mkdir -p /opt/buse-kagit
mkdir -p /opt/buse-kagit/backups
chown -R buse:buse /opt/buse-kagit

# Timezone
timedatectl set-timezone Europe/Istanbul

echo ""
echo "=============================================="
echo " ✓ VPS hazır!"
echo "=============================================="
echo " Versiyonlar:"
python3.11 --version
node --version
yarn --version
mongod --version | head -1
nginx -v 2>&1
echo "=============================================="
echo ""
echo " Sonraki adım: Uygulama kodunu /opt/buse-kagit'e yükleyin"
echo " (git clone veya scp)"
echo ""
