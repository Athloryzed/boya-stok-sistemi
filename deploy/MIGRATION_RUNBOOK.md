# Buse Kağıt — Hetzner VPS Geçiş Rehberi

> **Hedef:** Sıfır veri kaybı + sıfır indirme süresi ile Emergent'tan Hetzner VPS'e geçiş.

---

## 📋 Önkoşullar (Sizin Yapacağınız)

### 1. Hetzner hesabı + VPS
- [https://accounts.hetzner.com/signUp](https://accounts.hetzner.com/signUp) → Hesap aç
- **Hetzner Cloud** → New Project → "buse-kagit" oluştur
- **Önerilen Plan: CPX21**
  - 3 vCPU AMD, 4 GB RAM, 80 GB NVMe SSD, 20 TB trafik
  - **Aylık ~5.83 €** (~200 ₺)
  - **Konum: Falkenstein veya Nuremberg (Almanya)** — TR'ye latency ~25-35 ms
- **OS:** Ubuntu 22.04 LTS
- **SSH Key:** Önce yerel makinenizde key oluşturun:
  ```bash
  ssh-keygen -t ed25519 -C "buse-kagit"
  cat ~/.ssh/id_ed25519.pub  # Bu içeriği Hetzner'a yapıştırın
  ```
- VPS oluşturduktan sonra **IP adresini not alın** (örn: `5.75.xxx.xxx`)

### 2. Domain ayarı
- `bksistem.space` registrar paneline gidin
- **A kaydı:** `bksistem.space` → Hetzner IP (yeni VPS IP)
- **A kaydı:** `www.bksistem.space` → Hetzner IP
- **TTL: 300 saniye** (geçiş günü düşürün — sonra 3600'e çıkın)

> ⚠️ DNS değişikliğini **henüz yapmayın** — kurulum tamamen bitene kadar Emergent çalışsın.

---

## 🚀 Kurulum (Birlikte Yapacağız)

### Adım 1: VPS'e ilk giriş ve temel kurulum
```bash
ssh root@<HETZNER_IP>
```

Sonra script ile kurulum:
```bash
curl -fsSL https://raw.githubusercontent.com/<sizin-repo>/main/deploy/setup.sh | bash
```

VEYA script'i manuel kopyalayıp çalıştırın (`deploy/setup.sh` dosyasından).

Bu script şunları kurar:
- Sistem güncellemeleri
- Python 3.11 + venv
- Node.js 20 + Yarn
- MongoDB 7.0
- Nginx
- Certbot (Let's Encrypt)
- UFW firewall (22, 80, 443 açık)
- Fail2ban (SSH brute force koruması)
- `buse` kullanıcısı oluşturma
- `/opt/buse-kagit` dizini hazırlama

### Adım 2: Uygulama kodunu yükleme
```bash
# VPS'te
cd /opt/buse-kagit
git clone https://github.com/<sizin-repo>.git .
# VEYA scp ile yükle:
# scp -r /app root@<IP>:/opt/buse-kagit
```

### Adım 3: Environment dosyaları
```bash
# Backend
nano /opt/buse-kagit/backend/.env
```
İçerik:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=buse_kagit_prod
JWT_SECRET=<güçlü-rastgele-string-min-32-char>
MANAGEMENT_PASSWORD=buse11993
DASHBOARD_PASSWORD=buse4
CORS_ORIGINS=https://bksistem.space,https://www.bksistem.space
EMERGENT_LLM_KEY=<emergent-key-buradan-kopyala>
TZ=Europe/Istanbul
```

```bash
# Frontend
nano /opt/buse-kagit/frontend/.env
```
İçerik:
```
REACT_APP_BACKEND_URL=https://bksistem.space
```

### Adım 4: Backend kurulum + build
```bash
cd /opt/buse-kagit/backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
deactivate

cd /opt/buse-kagit/frontend
yarn install
yarn build
# build/ klasörü Nginx ile servis edilecek
```

### Adım 5: Systemd servisi başlatma
```bash
cp /opt/buse-kagit/deploy/buse-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now buse-backend
systemctl status buse-backend  # active (running) olmalı
```

### Adım 6: Nginx config + SSL
```bash
cp /opt/buse-kagit/deploy/nginx.conf /etc/nginx/sites-available/buse-kagit
ln -s /etc/nginx/sites-available/buse-kagit /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t  # config test
systemctl reload nginx

# SSL sertifika (Let's Encrypt)
certbot --nginx -d bksistem.space -d www.bksistem.space --non-interactive --agree-tos -m sizin@email.com
```

### Adım 7: Veri Migrasyonu (KRİTİK — bu adımı dikkatli yapın)

**A — Emergent'tan yedek alın:**
1. Yönetim paneline gir → "Yedek" butonuna bas → "Şimdi Yedekle"
2. En son yedeği "İndir" butonuyla indirin (`backup_YYYYMMDD_HHMMSS.archive.gz`)

**B — VPS'e yedek yükleyin:**
```bash
scp backup_*.archive.gz root@<HETZNER_IP>:/tmp/
```

**C — VPS'te restore:**
```bash
ssh root@<HETZNER_IP>
cd /tmp

# Mongodump formatı mı yoksa Python BSON fallback mı kontrol et:
file backup_*.archive.gz
# "gzip compressed data" → mongodump formatıysa:
mongorestore --uri="mongodb://localhost:27017" --db=buse_kagit_prod --gzip --archive=backup_*.archive.gz --drop

# Eğer Python BSON fallback ise (tar.gz BSON arşivi):
mkdir -p /tmp/restore && cd /tmp/restore
tar -xzf ../backup_*.archive.gz
for f in *.bson; do
  COLL="${f%.bson}"
  mongorestore --uri="mongodb://localhost:27017" --db=buse_kagit_prod --collection="$COLL" "$f" --drop
done

# Doğrulama
mongosh buse_kagit_prod --eval "db.getCollectionNames().forEach(c => print(c, '=', db[c].countDocuments()))"
```

### Adım 8: Smoke Test (DNS değişmeden önce)
```bash
# Hosts dosyası ile local override:
# /etc/hosts (macOS/Linux): "<HETZNER_IP> bksistem.space www.bksistem.space"
# Windows: C:\Windows\System32\drivers\etc\hosts

# Sonra tarayıcıdan https://bksistem.space açın
```

Test listesi:
- [ ] Ana sayfa açılıyor
- [ ] Yönetim paneline giriş (`buse11993`)
- [ ] Plan paneline giriş (`emrecan / testtest12`)
- [ ] Operator: `ali / 134679`
- [ ] Bobin listesi geliyor, detay modalı merkezde açılıyor
- [ ] Yeni iş ekle → operator panelinde görünüyor
- [ ] **WebSocket çalışıyor** — başka tab'da otomatik güncelleme
- [ ] "Bobin Yeniden Hesapla" tetikleyince doğru sonuç
- [ ] "Yedek Al" çalışıyor, dosya `/opt/buse-kagit/backups/`'da görünüyor

### Adım 9: DNS Cutover (Fabrika çalışmazken — Pazar gecesi öneririm)
1. Emergent'ta son yedek alın → VPS'e restore edin (yukarıdaki adımı tekrar).
2. Domain panel → A kaydı → Hetzner IP'ye çevirin.
3. **TTL 300 sn olduğu için en geç 5 dakikada herkese yayılır.**
4. İlk 24 saat Emergent'ı kapatmayın — geri dönüş için elinizde yedek versiyon kalsın.

---

## 🔁 Sonraki Günler: Bakım

### Kod güncelleme
```bash
cd /opt/buse-kagit
./deploy/deploy.sh
```

### Manuel yedek
```bash
/opt/buse-kagit/deploy/backup.sh
```

### Otomatik yedek (cron)
```bash
crontab -e
# Her gün 03:00'te yedek:
0 3 * * * /opt/buse-kagit/deploy/backup.sh >> /var/log/buse-backup.log 2>&1
```

### Logları görüntüleme
```bash
journalctl -u buse-backend -f         # Backend canlı log
tail -f /var/log/nginx/access.log     # HTTP istekleri
tail -f /var/log/nginx/error.log      # Nginx hataları
```

### Disaster Recovery (felaket kurtarma)
```bash
/opt/buse-kagit/deploy/restore.sh /opt/buse-kagit/backups/backup_YYYYMMDD_HHMMSS.archive.gz
```

---

## 💸 Maliyet Özeti
| Kalem | Aylık |
|---|---|
| Hetzner CPX21 | ~5.83 € (~200 ₺) |
| bksistem.space domain | ~5 ₺ |
| Let's Encrypt SSL | **Ücretsiz** |
| Toplam | **~205 ₺/ay** |

---

## ⚠️ Riskler ve Önlemler
| Risk | Önlem |
|---|---|
| SSH key kaybedersek | Hetzner Console'dan "Rescue Mode" + yeni key |
| MongoDB veri bozulması | Saatlik otomatik snapshot + 30 gün retention |
| Disk dolması | `df -h` monitoring + 80GB ile başlangıçta 2 yıl yeterli |
| Hetzner ödeme aksaması | Ödeme yöntemi (kart) tanımlı tutun, e-posta uyarı açın |
| DDoS / kötü niyetli trafik | Nginx rate limit (zaten ekli) + Cloudflare proxy (opsiyonel) |

---

## 🆘 Geri Dönüş Planı
Eğer Hetzner'da bir şey ters giderse:
1. DNS'i Emergent IP'ye geri çevir → 5 dakikada eski sistem geri gelir
2. Emergent'taki yedek hala duruyor — kayıp yok
3. Soruna VPS'te zaman ayırıp birlikte düzeltiriz

---

## 📞 Sırası gelince benim yardımım
- VPS açıldıktan sonra IP'yi bana iletin
- SSH ile ben de bağlanmıyorum (güvenlik), siz komutları yapıştırıp çıktıyı paylaşırsınız
- Her adımda doğrulama beraber

**HAZIR MISINIZ? Hetzner CPX21'i Falkenstein'da Ubuntu 22.04 ile açın, sonra IP'yi bana söyleyin, beraber sıradaki adıma geçelim.** 🚀
