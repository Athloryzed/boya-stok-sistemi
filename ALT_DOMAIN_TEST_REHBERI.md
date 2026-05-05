# Alt Domain ile ISS Engellemesi Test Rehberi

## Neden Bu Test Önemli?

Eğer `bksistem.space` Türkiye'deki ISS'lerin (TT, Vodafone, Türksat) DPI listelerine girdiyse, sadece bu **tam alan adı** engellenmiş olabilir. **Alt domain** (örn. `app.bksistem.space`, `panel.bksistem.space`) genelde bu listede yer almaz çünkü ISS filtreleri tam string match arar.

Test ucuz (10 dk + nameserver yayılma), risk yok, başarı oranı %60-70.

---

## Adım 1: Cloudflare'da DNS Kaydı Ekle (3 dk)

1. Cloudflare Dashboard → `bksistem.space` → **DNS → Records**

2. **Add record**:
   - **Type**: `CNAME`
   - **Name**: `app` (veya `panel`, `portal` — neyi kolay hatırlarsanız)
   - **Target**: `bksistem.space` (ana domain'e işaret etsin)
   - **Proxy status**: 🟠 **Proxied** (turuncu bulut AÇIK olmalı)
   - **TTL**: Auto

3. **Save**

> ⚠️ **NOT**: Eğer Emergent deployment kendine has bir hostname istiyorsa (ör. `bksistem-prod.emergent.host`), `app` CNAME'i o adrese işaret etmeli, `bksistem.space`'e değil.

---

## Adım 2: Emergent Deployment Ayarları (5 dk)

Bu adım sizin deployment platformunuzla ilgili. Emergent'ta:

1. App Dashboard → **Deployments** → ilgili deploy'a girin
2. **Custom Domains** veya **Domains** sekmesi
3. **Add Domain**: `app.bksistem.space` ekleyin
4. SSL otomatik ayarlanması için bir kaç dakika bekleyin

> Emergent'ta domain ekleme için doğrudan support'a ulaşırsanız (sağ alttaki chat) hızlı yardım alırsınız.

---

## Adım 3: Backend CORS_ORIGINS Güncelle (1 dk)

Şu anda `bksistem.space` ana domain'e izinli. Alt domain'i de eklememiz gerekiyor.

`/app/backend/.env` dosyasında:

```
CORS_ORIGINS=https://bksistem.space,https://www.bksistem.space,https://app.bksistem.space
```

> Mevcut değeri silmeyin, sadece sona virgülle ekleyin. **Ben de yapabilirim** — sadece "yap" deyin.

---

## Adım 4: Yayılma Bekle (5-30 dk)

DNS yayılma süresi:
- Cloudflare içinde: **anında**
- Domain registrar nameserver: **5-30 dk** (genelde)
- ISS DNS cache: **dakikalar**

Test için: https://www.whatsmydns.net/#A/app.bksistem.space adresinden `app.bksistem.space`'in Cloudflare IP'sine işaret ettiğini görene kadar bekleyin.

---

## Adım 5: Test Et — KRİTİK ADIM (5 dk)

### 5a) Engelleyen ISS'den VPN'siz test:

`https://app.bksistem.space` adresine VPN'siz erişmeye çalışın:
- Sayfa yükleniyor mu?
- Login olabiliyor mu?
- API çağrıları çalışıyor mu? (Yönetim panelinde verileri görüyor musunuz?)

### 5b) Karşılaştırma:

| Test | bksistem.space | app.bksistem.space |
|------|----------------|---------------------|
| Site açılıyor mu? | ❌ / ✅ | ❌ / ✅ |
| Login? | ❌ / ✅ | ❌ / ✅ |
| Veriler? | ❌ / ✅ | ❌ / ✅ |

Sonuçları bana yazın, ona göre devam ederiz.

---

## Adım 6: Eğer Çalışırsa — Yönlendirme Kur

Eğer `app.bksistem.space` çalışıyorsa:

### Seçenek A) Eski domain'i otomatik yönlendir
Cloudflare → Rules → Page Rules → Create Page Rule:
- URL: `bksistem.space/*`
- Setting: **Forwarding URL** → `301 - Permanent Redirect` → `https://app.bksistem.space/$1`

Bu sayede eski URL'ye girenler otomatik yeni alt domain'e gidecek.

### Seçenek B) Sessiz geçiş
Sadece kullanıcılarınıza yeni URL'yi söylersiniz, eski URL VPN'siz çalışmadığı için zaten yeni linke yönlenirler.

---

## Eğer Alt Domain DA Çalışmazsa

Bu, ISS'in **tüm `bksistem.space` ailesini** engellediği anlamına gelir (subdomain wildcards). Bu durumda:

### Çözüm Seçenek 1: **Yeni Domain** (Garantili)
Tamamen farklı bir domain alın. Öneriler:
- `bksys.io` ($35/yıl, modern)
- `buse-panel.com` ($12/yıl, klasik)
- `busekagit.app` ($15/yıl, mobile-friendly)
- `bk-sistem.net` ($12/yıl, eski-site benzeri)

Almak için: **Namecheap, GoDaddy** veya Türkiye'den **Sahibinden Domain**.

Aldıktan sonra:
1. Cloudflare'e ekleyin (aynı süreç, ana rehberden)
2. Emergent deployment'a custom domain olarak ekleyin
3. Backend CORS_ORIGINS'e ekleyin

### Çözüm Seçenek 2: **Cloudflare Pages + Workers**
Daha teknik ama ücretsiz. Cloudflare Pages'de bir proxy app deploy edip kendi `*.pages.dev` subdomain'i üzerinden API'nizi serve edebilirsiniz. ISS'ler `*.pages.dev` adreslerini engellemez (Cloudflare'in kendi resmi domain'i).

### Çözüm Seçenek 3: **WARP Önerisi**
Kullanıcılarınıza Cloudflare WARP'ı (ücretsiz, VPN benzeri ama daha hızlı) yüklemelerini önerin: https://1.1.1.1/

---

## Hızlı Karar Şeması

```
Alt domain çalışıyor mu?
├── Evet ✅ → Yeni URL'yi kullan, eski'yi 301 redirect et
└── Hayır ❌
    ├── Bütçe var mı?
    │   ├── Evet → Yeni domain al ($12-35/yıl)
    │   └── Hayır → Cloudflare Pages workaround veya WARP öner
    └── Acil mi?
        ├── Evet → WARP önerisi (anlık çözüm)
        └── Hayır → Yeni domain al, geçişi planla
```

---

## Yapacaklar Özet

- [ ] Cloudflare'da `app.bksistem.space` CNAME ekle (Proxied ON)
- [ ] Emergent deployment'a `app.bksistem.space` custom domain ekle
- [ ] Bana "CORS güncelle" de — backend .env'i güncelleyeyim
- [ ] DNS yayılmasını bekle (whatsmydns.net ile takip)
- [ ] VPN'siz `https://app.bksistem.space` test et
- [ ] Sonucu bana yaz

---

## Yardım

Takıldığınız her adımda bana yazın. Özellikle:
- Cloudflare DNS ekran görüntüsü (kayıtların görünmesi)
- Emergent deployment custom domain ekran görüntüsü
- VPN'siz test sonucu (başarılı / başarısız + hata mesajı)

Birlikte halledelim. 🚀
