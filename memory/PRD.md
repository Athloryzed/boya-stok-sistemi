# Buse Kağıt - Üretim Yönetim Sistemi PRD

## Proje Özeti
Flexo kağıt fabrikası için kapsamlı web ve mobil üretim yönetim sistemi.

## Son Güncelleme: 14 Şubat 2026

### Bu Oturumda Tamamlanan Özellikler ✅

1. **Firebase Push Bildirimleri** ✅ YENİ
   - Firebase Cloud Messaging (FCM) tam entegrasyonu
   - Web push bildirimleri (tarayıcı kapalıyken bile çalışır)
   - Android push bildirimleri (APK'da uygulama kapalıyken bile çalışır)
   - Sadece yöneticilere bildirim gönderimi
   - İş tamamlandığında otomatik push bildirimi

2. **Yönetim Paneli - 1 Günlük Oturum** ✅ YENİ
   - 24 saat boyunca şifre sorulmayacak (localStorage)
   - Çıkış butonu eklendi
   - Oturum süresi dolunca otomatik çıkış

3. **İş Resimleri Thumbnail Görünümü** ✅ YENİ
   - Sıradaki işlerde resimler küçük thumbnail olarak görünüyor
   - Resme tıklayınca büyük formatta açılıyor

4. **Android APK - GitHub Actions** ✅ YENİ
   - Otomatik APK build sistemi
   - Firebase Cloud Messaging entegreli
   - Canlı URL'ye bağlı (busemgmt.emergent.host)

### Önceki Oturumlarda Tamamlanan Özellikler

5. **İş Durdurma/Devam Ettirme** ✅
   - Operatör veya yönetici işi durdurabilir
   - Durdurma sebebi kaydedilir
   - Duraklatılmış işler listesi

6. **Yönetici Vardiya Sonu Raporlama** ✅
   - İki seçenek: Operatörlere bildir veya kendisi doldur
   - Toplu rapor onaylama

7. **WhatsApp Bildirimleri (Twilio)** ✅
   - İş tamamlandığında WhatsApp bildirimi
   - Sandbox mode

## Backend API Endpoints

### Yeni Endpoint'ler
- `POST /notifications/register-token` - FCM token kaydet
- `POST /managers/register` - Yönetici kaydı
- `POST /jobs/{job_id}/pause` - İş durdur
- `POST /jobs/{job_id}/resume` - İş devam ettir

### WebSocket Endpoint'leri
- `/ws/manager/{manager_id}` - Yönetici bildirimleri
- `/ws/operator/{machine_id}` - Operatör bildirimleri
- `/ws/warehouse` - Depo bildirimleri

## Bekleyen Görevler (Backlog)

### P0 - Kritik (Deploy Sonrası Test)
1. **Beyaz Ekran / iPhone Erişim Sorunu**
   - Service Worker kaldırıldı
   - ⚠️ Deploy sonrası kullanıcı testi gerekli

2. **Push Bildirimi Testi**
   - Firebase entegrasyonu tamamlandı
   - ⚠️ Canlı ortamda test edilecek

### P1 - Yüksek Öncelik
3. **Yönetim Müdahale Hatası**
   - Operatör başlattığı işe yönetimin müdahale edememesi
   - Tekrarlayan sorun (4 kez)

### P2 - Orta Öncelik
4. **Sevkiyat & Sürücü Modülü**
   - Harita/konum takibi
   - Sürücü durum güncelleme

5. **Günlük Analitik Detay**
   - Grafiğe tıklayınca makine bazlı detay

### P3 - Düşük Öncelik
6. **QR/Barkod Tarama**

## Teknik Detaylar

### 3rd Party Entegrasyonlar
- **Firebase**: Push bildirimleri (FCM)
- **Twilio**: WhatsApp bildirimleri (Sandbox)
- **Capacitor**: Android APK

### Kimlik Bilgileri (Test)
- **Yönetim**: `buse11993`
- **Operatör**: `ali` / `134679`

### Önemli Dosyalar
- `/app/backend/firebase-service-account.json` - Firebase servis hesabı (GİZLİ)
- `/app/frontend/android/app/google-services.json` - Android Firebase config
- `/app/frontend/public/firebase-messaging-sw.js` - Web push service worker
