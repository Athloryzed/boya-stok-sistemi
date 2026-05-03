# bksistem.space için Cloudflare Kurulum Rehberi

## Neden Cloudflare?
Türkiye'deki bazı ISS'ler (TTNet, Türk Telekom, Vodafone vb.) yeni veya küçük domainleri **DNS / SNI** seviyesinde otomatik engelleyebiliyor. Bu yüzden bazı kullanıcılarınız VPN olmadan `bksistem.space`'e giremiyor. Cloudflare:
- Sunucunuzun gerçek IP'sini gizler (ISS'ler engelliyemez)
- Türkiye'deki en yakın CDN noktasından bağlantı sağlar (hız artar)
- DDoS koruması verir
- **Tamamen ücretsizdir** (Free Plan yeterli)

---

## Adım 1: Cloudflare Hesabı Oluştur (2 dk)

1. https://dash.cloudflare.com/sign-up adresine gidin
2. Email + şifre ile kayıt olun
3. Email doğrulama linkine tıklayın

---

## Adım 2: Domain Ekle (3 dk)

1. Cloudflare Dashboard'da **"Add a Site"** butonuna tıklayın
2. Domain olarak: `bksistem.space` yazın → **Continue**
3. **Free Plan** seçin → **Continue**
4. Cloudflare otomatik olarak mevcut DNS kayıtlarınızı tarayacak

---

## Adım 3: DNS Kayıtlarını Doğrula (5 dk)

Cloudflare size mevcut DNS kayıtlarınızı gösterecek. Şu kayıtların **mutlaka** olduğundan emin olun:

| Type | Name | Content | Proxy Status |
|------|------|---------|--------------|
| A    | `bksistem.space` (veya `@`) | Sunucu IP'niz | 🟠 **Proxied** (turuncu bulut AÇIK) |
| A    | `www` | Sunucu IP'niz | 🟠 **Proxied** |

**ÖNEMLİ:**
- Turuncu bulut **AÇIK** olmalı (Proxied) → Cloudflare devreye girer, IP gizlenir
- Turuncu bulut KAPALI ise (DNS only) → Sadece DNS sunucusu olur, ISS engellemesi devam eder

Eksik kayıt varsa **+ Add record** ile ekleyin.

---

## Adım 4: Nameserver Değiştirme — EN KRİTİK ADIM (10 dk)

1. Cloudflare size **2 adet özel nameserver** verecek (örnek):
   ```
   xena.ns.cloudflare.com
   pablo.ns.cloudflare.com
   ```
   (Sizdeki farklı olacak, **bu kendi panelinizdeki değerleri** kullanın)

2. Domain'inizi aldığınız yere giriş yapın (GoDaddy, Namecheap, Sahibinden Domain, NameSilo vb.):

3. `bksistem.space` domain'ini bulun → **DNS / Nameserver Yönetimi** bölümüne gidin

4. Mevcut nameserver'ları **siliñ**, Cloudflare'in verdiği iki nameserver'ı **ekleyin**

5. **Save** butonuna basın

> ⏱ **Yayılma süresi**: 5 dakika - 24 saat arasında. Genelde 30 dk içinde hazır olur.

6. Cloudflare'e geri dönün → **"Done, check nameservers"** butonuna basın

7. Üst tarafta yeşil ✓ **"Active"** işareti görene kadar bekleyin

---

## Adım 5: Cloudflare Önerilen Ayarlar (5 dk)

Aktif olduktan sonra dashboard'da `bksistem.space` üzerine tıklayın, sol menüden:

### 🔒 SSL/TLS → Overview
- **Encryption mode**: `Full` veya `Full (strict)` seçin
  - Full: Self-signed sertifika varsa
  - Full (strict): Geçerli SSL sertifikası varsa (önerilen)

### 🔒 SSL/TLS → Edge Certificates
- **Always Use HTTPS**: AÇIK
- **Automatic HTTPS Rewrites**: AÇIK
- **Minimum TLS Version**: `TLS 1.2`

### ⚡ Speed → Optimization
- **Auto Minify**: JavaScript ✓ CSS ✓ HTML ✓
- **Brotli**: AÇIK
- **Early Hints**: AÇIK

### 🛡️ Security → Settings
- **Security Level**: `Medium`
- **Bot Fight Mode**: AÇIK
- **Challenge Passage**: 30 minutes

### 🌍 Network
- **HTTP/2**: AÇIK
- **HTTP/3 (with QUIC)**: AÇIK ← **Çok önemli**, TR ISS engellemesini büyük oranda atlatır
- **WebSockets**: AÇIK ← Real-time mesajlar/dashboard için **mutlaka açık olmalı**

---

## Adım 6: Test Et

### A) DNS Yayılımı Kontrolü
https://www.whatsmydns.net/#A/bksistem.space adresinde IP'nizin Cloudflare IP'si olduğunu görmelisiniz (`104.x.x.x` veya `172.x.x.x` aralığında)

### B) Site Erişimi
Tarayıcıdan `https://bksistem.space` açın → site yüklenmeli

### C) VPN'siz Test (En Önemli)
VPN'siz erişemediği için şikayetçi olan kullanıcılarınızdan birinden test etmesini isteyin. Cloudflare aktif olduktan sonra ISS'ler artık IP'yi göremeyecek, VPN gerekmemeli.

---

## Adım 7: SORUN ÇIKARSA — Sık Karşılaşılan Sorunlar

### ❌ "Site açılmıyor / 521 hatası"
**Sebep**: Cloudflare sunucunuza bağlanamıyor.
**Çözüm**:
- Sunucu firewall'ında Cloudflare IP aralıklarına izin verin: https://www.cloudflare.com/ips/
- Ya da SSL/TLS modunu `Flexible`'a alın (geçici test için)

### ❌ "WebSocket bağlanmıyor / mesajlar yenilenmiyor"
**Sebep**: WebSocket Cloudflare'da kapalı.
**Çözüm**: Network → WebSockets: **AÇIK** olduğunu kontrol edin

### ❌ "API çağrıları 522 / 524 timeout veriyor"
**Sebep**: Backend yanıt vermesi 100 saniyeden uzun sürüyor.
**Çözüm**:
- Free planda max 100s timeout var. AI sorularınız uzun sürebilir.
- Geçici çözüm: Specific API path için "Page Rule" ile cache bypass + retry
- Kalıcı çözüm: Pro plana geçiş ($20/ay) — 200s timeout

### ❌ "Sürekli giriş tekrar isteniyor / cookie kayboluyor"
**Sebep**: Cloudflare bazı cookie'leri filtreleyebilir.
**Çözüm**: Rules → Page Rules → `bksistem.space/api/*` için **Cache Level: Bypass**

---

## Adım 8: API Path'leri için Page Rule Ekle (Önerilen)

Dashboard → **Rules → Page Rules → Create Page Rule**:

| URL Pattern | Settings |
|-------------|----------|
| `bksistem.space/api/*` | Cache Level: **Bypass**, Disable Apps, Disable Performance |
| `bksistem.space/static/*` | Cache Level: **Cache Everything**, Edge Cache TTL: **1 month** |

Bu, API'lerin cache'lenmemesini ve statik dosyaların hızlı cache'lenmesini sağlar.

---

## Adım 9: Önbellek Temizleme

Değişiklik yaptıktan sonra: **Caching → Configuration → Purge Everything** ile cache temizleyin.

---

## ⚠️ DİKKAT EDİLECEKLER

1. **Mevcut SSL sertifikanızı silmeyin**. Cloudflare kendi SSL'ini ekleyecek ama origin sertifika hala gerekli.
2. **Domain transfer YAPMAYIN** — sadece nameserver değişiyor. Domain hâlâ sizde kalıyor.
3. **Cron job, email, FTP gibi hizmetleriniz varsa** ek subdomain'lerde **Proxied OFF** (DNS only - gri bulut) yapın. Sadece web ve API için Proxied ON kalsın.
4. **İlk 24 saat** dikkatli izleyin — tüm kullanıcı geri bildirimleri toplayın.

---

## 🎯 Beklenen Sonuçlar

✅ TR ISS'lerinin DNS engellemesi: **bypass edilir**  
✅ VPN gereksinimi: **ortadan kalkar**  
✅ Sayfa yükleme hızı: **%30-50 artar** (CDN sayesinde)  
✅ DDoS koruması: **otomatik**  
✅ SSL: **otomatik yenilenir**

---

## Yardım Gerekirse

Sorun yaşarsanız bana şunları gönderin:
1. Cloudflare dashboard'unda hangi adımdasınız
2. Test eden kullanıcıların hatası (ekran görüntüsü)
3. `https://www.cloudflare.com/cdn-cgi/trace` çıktısı (`fl=` satırı önemli)

Birlikte hallederiz. **Geçiş yaklaşık 1-2 saatlik süreç ama nameserver yayılması bekleme dahil**, aktif iş 30 dk.

---

## Cloudflare Çalışmazsa Plan B

Eğer Cloudflare sonrasında da bazı kullanıcılar erişemiyorsa, kod tarafında şunları yapabilirim:
- WebSocket'i opsiyonel hale getirmek (fallback polling)
- AI çağrılarını lazy-load yapmak (sadece sekme açılınca)
- Tüm parallel API'leri sıralı/sıralı bölmek (TCP connection limit)
- Service Worker ile offline-first cache stratejisi

Bunlar ek 1-2 saat. Önce Cloudflare'i deneyin.
