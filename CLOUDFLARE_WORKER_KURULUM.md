# Cloudflare Worker Proxy — Adım Adım Kurulum Rehberi

## Ne Yapıyoruz?

`app.bksistem.space` → `bksistem.space` arasında **görünmez bir köprü** kuruyoruz. ISS'ler `app.bksistem.space`'i engellemez (yeni alt domain), Worker arka planda Cloudflare ağı üzerinden `bksistem.space`'e bağlanır.

```
Kullanıcı → app.bksistem.space (ISS engellemez)
              ↓
     Cloudflare Worker
              ↓
     bksistem.space (CF içinde, ISS bypass)
              ↓
        Geri kullanıcıya
```

---

## ÖN KOŞULLAR

✅ Cloudflare hesabı (zaten var)  
✅ `bksistem.space` Cloudflare'da Active (zaten Active)  
✅ Frontend kodu güncellendi (ben yaptım — alt domain'den geldiğinde same-origin kullanır)  
🔲 **Frontend yeniden deploy edilmeli** (en sonda yapacaksınız)

---

## ADIM 1: Worker Oluştur (5 dk)

1. Cloudflare Dashboard → sol menüden **Workers & Pages**
2. **Create application** → **Create Worker** butonuna basın
3. İsim olarak: `bksistem-proxy` yazın → **Deploy**
4. Açılan sayfada **Edit code** butonuna basın
5. Sağda gelen kod editöründe **TÜM mevcut kodu silin**
6. `/app/cloudflare-worker.js` dosyasındaki kodu **tamamen kopyalayıp yapıştırın**
7. Sağ üstteki **Save and deploy** butonuna basın
8. Onay sonrası: ✅ Worker URL'iniz: `bksistem-proxy.{hesap-adınız}.workers.dev`

### Worker'ı test edin:
Tarayıcıda açın: `https://bksistem-proxy.{hesap-adınız}.workers.dev/__worker_health`

Şuna benzer JSON görmelisiniz:
```json
{"status":"ok","proxy":"bksistem.space","timestamp":"2026-..."}
```

Eğer JSON döndü → Worker çalışıyor ✅  
Hata gelirse: kod yapıştırma hatası, baştan deneyin.

---

## ADIM 2: DNS Kaydı Ekle (2 dk)

1. Cloudflare Dashboard → `bksistem.space` → **DNS → Records**
2. **Add record**:
   - **Type**: `AAAA` (Worker AAAA kullanır, A da olur)
   - **Name**: `app`
   - **IPv6 address**: `100::` (placeholder — Worker route'u override edecek)
   - **Proxy status**: 🟠 **Proxied** (turuncu bulut AÇIK)
   - **TTL**: Auto
3. **Save**

> Alternatif: A kaydı kullanmak isterseniz IP olarak `192.0.2.1` yazın (RFC 5737 "TEST-NET" placeholder).

---

## ADIM 3: Worker'ı Subdomain'e Bağla — Route Ekle (3 dk)

1. Cloudflare Dashboard → `bksistem.space` → **Workers Routes**
2. **Add route** butonuna basın
3. **Route**: `app.bksistem.space/*` (yıldız önemli, tüm path'leri yakalasın)
4. **Worker**: az önce oluşturduğunuz `bksistem-proxy`'yi seçin
5. **Save**

Bu adım kritik: Bundan sonra `app.bksistem.space`'e gelen her istek Worker'a yönlenir.

---

## ADIM 4: SSL/TLS Kontrolü (1 dk)

1. Dashboard → SSL/TLS → **Edge Certificates**
2. **Edge Certificates** listesinde `*.bksistem.space` veya `app.bksistem.space` var mı bakın
3. Yoksa: Cloudflare otomatik 5-15 dk içinde Universal SSL ekler
4. Sertifika aktif olunca (Active yazar) devam edin

---

## ADIM 5: Frontend'i Yeniden Deploy Et (KRİTİK)

Az önce kodu güncelledim — alt domain'den geldiğinde same-origin kullanıyor (Worker proxy'sine uygun).

**Şu an preview ortamındayım, üretime push etmek için:**

1. Emergent App Dashboard'da uygulamanızı bulun
2. **"Deploy"** veya **"Redeploy"** butonuna basın
3. Deployment tamamlanmasını bekleyin (~2-5 dk)
4. Production (https://bksistem.space) yeni kodla güncellensin

Bu adım atlanırsa: Eski frontend, alt domain'den de hala `bksistem.space`'e API çağrıları atar → ISS engellemesi devam eder.

---

## ADIM 6: TEST ZAMANI! (5 dk)

### 6a) Genel Erişim Testi
VPN'siz olarak: `https://app.bksistem.space` açın
- Anasayfa yükleniyor mu? ✅
- Login sayfası açılıyor mu? ✅
- Şifre yazıp giriş olabiliyor musunuz? ✅
- Yönetim panelinde veriler geliyor mu? ✅

### 6b) Worker Health Check
`https://app.bksistem.space/__worker_health` açın → JSON dönmeli (Worker aktif demek)

### 6c) WebSocket Testi (real-time mesajlar)
- Operatör panelinde 2 farklı tarayıcıdan giriş yapın
- Birinden mesaj gönderin → diğerinde anında görünmeli
- Görünmüyorsa: F12 → Console'da "WebSocket" hatası var mı bakın

### 6d) Mobil VPN'siz Test (Asıl test)
Etkilenen kullanıcılarınızdan birinden Wi-Fi/mobil veride VPN'siz `https://app.bksistem.space` açmasını isteyin.

**Sonuç:**
- ✅ Çalışırsa → BÜYÜK BAŞARI! Tüm kullanıcılarınıza yeni URL'yi paylaşın.
- ❌ Çalışmazsa → ISS hem ana hem alt domain'i engelliyor demek. **Yeni domain almak gerekiyor**.

---

## ADIM 7 (İsteğe Bağlı): Eski URL'yi Yönlendir

Eğer Worker çözümü çalışırsa, kullanıcıların eski URL'yi kullanmasını engellemek için:

1. Cloudflare Dashboard → `bksistem.space` → **Rules → Page Rules**
2. **Create Page Rule**:
   - URL: `bksistem.space/*`
   - Setting: **Forwarding URL** → `301 - Permanent Redirect`
   - Destination: `https://app.bksistem.space/$1`
3. **Save**

Bu yapılırsa: `bksistem.space`'e girenler otomatik `app.bksistem.space`'e gider. **VPN'siz girenler için bu gerekli değil çünkü onlar zaten yeni URL'yi kullanacak.** Ama temizlik için iyi.

---

## SORUN GİDERME

### ❌ "1101 Worker exceeded resource limits"
Worker free planda CPU 10ms/istek limit var. Görüşülüyorsa: **Workers Paid Plan** ($5/ay, sınırsız).

### ❌ "525 SSL handshake failed"
Cloudflare → SSL/TLS → Origin Server → **Create Certificate** ile origin sertifika ekleyin, Emergent destek ile sertifikayı sunucuya kurun.

### ❌ "Worker'a istek gidiyor ama hata dönüyor"
- F12 → Network sekmesi → İstekleri inceleyin
- Hangi URL'ye istek atıyor? Eğer `bksistem.space` görüyorsanız → frontend deploy edilmemiş, Adım 5'i tekrar yapın

### ❌ Login oluyor ama hemen çıkıyor
Cookie domain sorunu. Worker kodunda zaten Domain= directive'ini temizliyorum ama yine sorun olursa bana yazın, alternatif çözüm var.

### ❌ WebSocket çalışmıyor
Cloudflare → Network → **WebSockets**: AÇIK olduğunu kontrol edin. Free planda WS desteği var ama bağlantı süresi limiti var (~100s).

---

## EK: Worker'ın Faydaları

Sadece engelleme bypass'ı değil, ek bonuslar:
- Cloudflare CDN cache (statik dosyalar uçar)
- DDoS koruması (Cloudflare otomatik)
- Origin IP gizli (saldırılara kapalı)
- Free plan'da 100,000 istek/gün (sizin trafiğiniz için fazlasıyla yeter)

---

## ÖZET KONTROL LİSTESİ

- [ ] Adım 1: Worker oluşturuldu, kod yapıştırıldı, deploy edildi
- [ ] Adım 1: `/__worker_health` test JSON döndü
- [ ] Adım 2: DNS'e `app` AAAA kaydı (Proxied) eklendi
- [ ] Adım 3: Workers Routes'da `app.bksistem.space/*` Worker'a bağlandı
- [ ] Adım 4: SSL Edge Certificates aktif
- [ ] Adım 5: **Frontend redeploy edildi** (ÇOK KRİTİK)
- [ ] Adım 6a: VPN'siz `app.bksistem.space` çalışıyor mu test edildi
- [ ] Adım 6d: Etkilenen kullanıcı VPN'siz test etti

Tüm adımlar bitince sonuçları bana yazın 🚀

---

## YARDIM

Adım 1 veya 3'te takılırsanız ekran görüntüsü gönderin, anında çözeriz.
