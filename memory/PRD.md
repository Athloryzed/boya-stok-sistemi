# Buse Kağıt - Üretim Yönetim Sistemi PRD

## Proje Özeti
Flexo kağıt fabrikası için kapsamlı web ve mobil üretim yönetim sistemi.

## Son Güncelleme: 14 Şubat 2026

### Bu Oturumda Tamamlanan Özellikler ✅

1. **Firebase Push Bildirimleri** ✅
   - Firebase Cloud Messaging (FCM) tam entegrasyonu
   - Web push bildirimleri (tarayıcı kapalıyken bile çalışır)
   - Android push bildirimleri (APK'da uygulama kapalıyken bile çalışır)

2. **Bildirim Akışı** ✅
   | Olay | Kime Gider |
   |------|-----------|
   | İş tamamlandı | Yöneticiler + Plan |
   | Yeni iş atandı | Operatörler |
   | Mesaj gönderildi | Operatörler |
   | Vardiya başladı | Tüm çalışanlar |
   | Vardiya bitti | Operatörler (rapor formu açılır) |

3. **Yönetim Paneli - 1 Günlük Oturum** ✅
   - 24 saat boyunca şifre sorulmayacak
   - Çıkış butonu eklendi

4. **Vardiya Bitirme İş Akışı** ✅
   - Yönetici "Vardiya Bitir" dediğinde seçenek sunuluyor:
     1. Operatörlere bildir (rapor doldurmaları için)
     2. Kendim doldurayım
   - Operatörlere push bildirimi gidiyor
   - Operatörler koli ve defo bilgisi giriyor
   - Yönetici onay bekleyen raporları görebiliyor

5. **İş Resimleri Thumbnail** ✅
   - Sıradaki işlerde resimler küçük thumbnail olarak görünüyor

6. **Android APK - GitHub Actions** ✅
   - Otomatik APK build sistemi
   - Firebase Cloud Messaging entegreli

### Backend API Endpoints

#### Yeni Endpoint'ler
- `POST /notifications/register-token` - FCM token kaydet
- `POST /managers/register` - Yönetici kaydı
- `POST /shifts/notify-end` - Vardiya bitiş bildirimi gönder
- `POST /jobs/{job_id}/pause` - İş durdur
- `POST /jobs/{job_id}/resume` - İş devam ettir

#### WebSocket Endpoint'leri
- `/ws/manager/{manager_id}` - Yönetici bildirimleri
- `/ws/operator/{machine_id}` - Operatör bildirimleri

### Bekleyen Görevler (Backlog)

#### P0 - Kritik
1. **Deploy sonrası test** - Push bildirimleri canlı ortamda test edilecek

#### P1 - Yüksek Öncelik
2. **Yönetim Müdahale Hatası** - Tekrarlayan sorun (4 kez)
3. **Beyaz Ekran / iPhone Erişim** - Deploy sonrası doğrulama

#### P2 - Orta Öncelik
4. **Sevkiyat & Sürücü Modülü**
5. **Günlük Analitik Detay**

#### P3 - Düşük Öncelik
6. **QR/Barkod Tarama**

### Teknik Detaylar

#### 3rd Party Entegrasyonlar
- **Firebase**: Push bildirimleri (FCM)
- **Twilio**: WhatsApp bildirimleri (Sandbox)
- **Capacitor**: Android APK

#### Kimlik Bilgileri (Test)
- **Yönetim**: `buse11993`
- **Operatör**: `ali` / `134679`

#### Önemli Dosyalar
- `/app/backend/firebase-service-account.json` - Firebase servis hesabı (GİZLİ)
- `/app/frontend/android/app/google-services.json` - Android Firebase config
- `/app/frontend/public/firebase-messaging-sw.js` - Web push service worker
- `/app/frontend/src/firebase.js` - Firebase client config
