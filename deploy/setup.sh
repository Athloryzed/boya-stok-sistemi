#!/usr/bin/env bash
# Buse Kağıt — Hetzner VPS Initial Setup
# OS: Ubuntu 22.04 OR 24.04 LTS (otomatik tespit)
# Usage: sudo bash setup.sh

set -euo pipefail

echo "=============================================="
echo " Buse Kagit VPS Setup"
echo "=============================================="

if [ "$EUID" -ne 0 ]; then
  echo "Bu script root olarak çalıştırılmalı (sudo bash setup.sh)"
  exit 1
fi

# Ubuntu codename tespit (jammy=22.04, noble=24.04)
. /etc/os-release
CODENAME="${VERSION_CODENAME}"
echo "Tespit edilen: $PRETTY_NAME (codename: $CODENAME)"

if [ "$CODENAME" != "jammy" ] && [ "$CODENAME" != "noble" ]; then
  echo "Bu script yalnızca Ubuntu 22.04 (jammy) veya 24.04 (noble) destekler"
  exit 1
fi

# Python versiyonu: 22.04 → 3.11, 24.04 → 3.12 (default)
if [ "$CODENAME" = "noble" ]; then
  PY="python3.12"
else
  PY="python3.11"
fi

# 1. System update
echo "[1/9] System update..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# 2. Essentials
echo "[2/9] Essential packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl wget gnupg lsb-release ca-certificates \
  software-properties-common build-essential git ufw fail2ban htop \
  unzip zip jq

# 3. Python
echo "[3/9] $PY..."
if [ "$CODENAME" = "noble" ]; then
  # Python 3.12 default in 24.04, sadece venv'i yükle
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3.12 python3.12-venv python3.12-dev python3-pip
else
  add-apt-repository -y ppa:deadsnakes/ppa
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
fi

# 4. Node.js 20 + Yarn
echo "[4/9] Node.js 20 + Yarn..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
npm install -g yarn --silent

# 5. MongoDB 7.0
echo "[5/9] MongoDB 7.0..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mongodb-org
systemctl enable --now mongod

# 6. Nginx + Certbot
echo "[6/9] Nginx + Certbot..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx certbot python3-certbot-nginx

# 7. Firewall
echo "[7/9] UFW Firewall..."
ufw --force reset >/dev/null
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
$PY --version
node --version
yarn --version
mongod --version | head -1
nginx -v 2>&1
echo ""
echo " Disk kullanımı:"
df -h / | tail -1
echo ""
echo " Bellek:"
free -h | head -2
echo "=============================================="
echo ""
echo " Sonraki adım: Uygulama kodunu /opt/buse-kagit'e yükleyin"
