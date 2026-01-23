# Buse Kağıt - Üretim Yönetim Sistemi PRD

## Proje Özeti
Flexo kağıt fabrikası için kapsamlı web ve mobil üretim yönetim sistemi.

## Kullanıcı Rolleri ve Şifreler
- **Yönetim**: Şifre `432122` - Vardiya kontrolü, makine durumu, analitik, bakım, mesaj gönderme
- **Operatör**: İsim girişi - Makine seçimi, iş başlatma/tamamlama, mesaj alma
- **Plan**: Şifre `12341` - İş ekleme, makine durumu, geçmiş işler, mesaj gönderme
- **Depo**: Şifresiz - Malzeme talepleri
- **Boya**: Şifre `432122` - Boya stok yönetimi

## Tamamlanan Özellikler

### Ana Modüller ✅
1. **Yönetim Paneli**
   - Vardiya başlatma/bitirme
   - Makine durumu takibi
   - Günlük/Haftalık/Aylık analitik (hafta seçimli)
   - Bakım kayıtları
   - Excel rapor dışa aktarma
   - **Boya Stok Tablosu** (YENİ)
   - **Makineye Mesaj Gönderme** (YENİ)
   - **Düşük Stok Uyarısı** (YENİ)

2. **Operatör Paneli**
   - Makine seçimi
   - İş başlatma/tamamlama
   - Malzeme talebi gönderme
   - **Mesaj Alma ve Bildirim** (YENİ)
   - **Sohbet Ekranı** (YENİ)

3. **Plan Paneli**
   - Yeni iş ekleme (koli sayısı, renk, format, termin)
   - Makine durumu görüntüleme
   - Geçmiş işler ve iş klonlama
   - İş arama
   - **Makineye Mesaj Gönderme** (YENİ)

4. **Depo Paneli**
   - Malzeme talepleri listesi
   - Talep tamamlama

5. **Boya Modülü** ✅
   - 12 boya türü: **Siyah, Beyaz, Mavi, Lacivert, Refleks, Kırmızı, Magenta, Rhodam, Sarı, Gold, Gümüş, Pasta**
   - Her boya gerçek rengine uygun görsel
   - Stok takibi (L cinsinden)
   - Stok ekleme/çıkarma
   - Makineye gönderme/makineden alma
   - Hareket geçmişi
   - Haftalık/Aylık tüketim analitikleri
   - **Düşük Stok Uyarısı (5L altı)** (YENİ)

### Mesajlaşma Sistemi ✅ (İKİ YÖNLÜ + YÖNETİM GELEN KUTUSU)
- Yönetim ve Plan panelinden makineye mesaj gönderme
- **Operatör yanıt yazabilme**
- Operatör tarafında mesaj alma ve bildirim
- Sohbet ekranı ile mesaj geçmişi görüntüleme
- Okunmamış mesaj sayısı badge
- Farklı renklerle gönderen ayırt etme (Yönetim: sarı, Plan: yeşil, Operatör: mavi)
- **Yönetim "Mesajlar" sekmesi** (YENİ) - Operatör mesajlarını takip
- **Okundu işaretleme ve hızlı yanıt** (YENİ)

### Genel Özellikler ✅
- PWA (Progressive Web App) desteği
- Mobil uyumlu responsive tasarım
- Gece/Gündüz modu
- Dinamik ana sayfa (İstanbul saatine göre arkaplan)
- Türk bayrağı ve Atatürk görseli

## Makine Listesi
- 40x40
- 40x40 ICM
- 33x33 (Büyük)
- 33x33 ICM
- 33x33 (Eski)
- 30x30
- 24x24
- Dispanser

## Boya Renk Haritası
| Boya | Renk Kodu |
|------|-----------|
| Siyah | #1a1a1a |
| Beyaz | #f5f5f5 |
| Mavi | #2196F3 |
| Lacivert | #1a237e |
| Refleks | #00e5ff |
| Kırmızı | #f44336 |
| Magenta | #e91e63 |
| Rhodam | #9c27b0 |
| Sarı | #ffeb3b |
| Gold | #ffc107 |
| Gümüş | #9e9e9e |
| Pasta | #bcaaa4 |

## API Endpoints

### Mesaj Sistemi (YENİ)
- `POST /api/messages` - Mesaj gönder
- `GET /api/messages/{machine_id}` - Makine mesajlarını getir
- `GET /api/messages/{machine_id}/unread` - Okunmamış mesaj sayısı
- `PUT /api/messages/{machine_id}/mark-read` - Mesajları okundu işaretle

### Boya Modülü
- `POST /api/paints/init` - Başlangıç boyalarını oluştur
- `GET /api/paints` - Tüm boyaları listele
- `GET /api/paints/low-stock` - Düşük stoklu boyalar (5L altı)
- `POST /api/paints/transaction` - Boya hareketi
- `GET /api/paints/movements` - Hareket geçmişi
- `GET /api/paints/analytics` - Tüketim analitikleri

### Analitik
- `GET /api/analytics/daily-by-week?week_offset=0` - Hafta seçimli günlük analitik

## Bekleyen Görevler (Backlog)

### P1 - Yüksek Öncelik
- [ ] Depo için gerçek zamanlı bildirimler (WebSocket)

### P2 - Orta Öncelik
- [ ] QR/Barkod tarama özelliği

## Test Durumu
- Boya modülü: %100 çalışıyor
- Mesajlaşma sistemi: %100 çalışıyor
- Analitik hafta seçimi: %100 çalışıyor
- Düşük stok uyarısı: %100 çalışıyor
- Son güncelleme: 23 Ocak 2026
