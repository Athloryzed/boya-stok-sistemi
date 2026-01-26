# Buse Kağıt - Üretim Yönetim Sistemi PRD

## Proje Özeti
Flexo kağıt fabrikası için kapsamlı web ve mobil üretim yönetim sistemi.

## Kullanıcı Yönetimi (24 Ocak 2025 Güncellemesi)

### Yönetim Paneli (Tek şifre ile giriş)
- **Şifre**: `buse11993`
- Kullanıcı oluşturma/silme yetkisi
- Tüm panellere erişim
- Şoför konumlarını görme

### Rol Bazlı Giriş Sistemi
Tüm roller kullanıcı adı + şifre ile giriş yapar. Yönetim panelinden oluşturulur.

| Rol | Sayfa | Test Kullanıcı | Şifre |
|-----|-------|----------------|-------|
| Operatör | /operator | operator1 | op123 |
| Planlama | /plan | plan1 | plan123 |
| Depo | /depo | depo1 | depo123 |
| Şoför | /driver | sofor1 | sofor123 |

### Boya Modülü
- **Şifre**: `buse11993`

## Son Güncelleme: 26 Ocak 2025

### Yeni Özellikler ✅

1. **İş Sıralama (Drag & Drop)**
   - Operatör panelinde işleri sürükle-bırak ile sıralama
   - İş sırası görsel olarak numaralandırılmış
   - Sıra değişikliği anında veritabanına kaydedilir

2. **Vardiya Sonu Raporu**
   - Aktif iş varken vardiya bitirirken üretim ve defo sayısı girilebilir
   - Makine bazlı rapor formu
   - Otomatik defo kaydı oluşturma

3. **Defo (Hatalı Ürün) Takibi**
   - Yönetim panelinde "Defo" sekmesi
   - Toplam defo istatistikleri
   - Makine bazlı defo grafiği
   - Günlük defo dağılımı tablosu

### Önceki Özellikler (24 Ocak 2025)

1. **Merkezi Kullanıcı Yönetimi**
   - Yönetim panelinde "Kullanıcılar" sekmesi
   - Kullanıcı oluşturma: Kullanıcı adı + Şifre + Rol seçimi
   - Rol seçenekleri: Operatör, Planlama, Depo, Şoför
   - Kullanıcı silme
   - Aktif kullanıcı listesi

2. **Rol Bazlı Erişim Kontrolü**
   - Her kullanıcı sadece atandığı sayfaya girebilir
   - Yanlış sayfaya girmeye çalışınca "Bu sayfaya erişim yetkiniz yok" hatası

3. **Şoför Konum Takibi**
   - Yönetim panelinde şoförlerin anlık konumları
   - "Haritada Gör" butonu ile Google Maps'te konum
   - Son güncelleme zamanı

4. **Şifre Güncellemeleri**
   - Yönetim: `432122` → `buse11993`
   - Boya: `432122` → `buse11993`


5. **Oturum Yönetimi**
   - Tüm panellerde localStorage ile oturum hatırlama
   - Çıkış yapma butonu
   - Sayfa yenilendiğinde oturum korunur

## Tamamlanan Özellikler

### Ana Modüller ✅

1. **Yönetim Paneli**
   - Kullanıcı yönetimi (YENİ)
   - Şoför konum takibi (YENİ)
   - Vardiya başlatma/bitirme
   - Makine durumu takibi
   - Analitik (günlük/haftalık/aylık)
   - Bakım kayıtları
   - Boya stok tablosu
   - Mesajlaşma

2. **Operatör Paneli**
   - Kullanıcı adı + şifre ile giriş (YENİ)
   - Makine seçimi
   - İş başlatma/tamamlama
   - Malzeme talebi
   - Mesaj alma/gönderme

3. **Plan Paneli**
   - Kullanıcı adı + şifre ile giriş (YENİ)
   - Yeni iş ekleme
   - Sevkiyat yönetimi
   - Araç/Şoför ekleme
   - Mesajlaşma

4. **Depo Paneli**
   - Kullanıcı adı + şifre ile giriş (YENİ)
   - Malzeme talepleri (WebSocket)
   - Palet tarama
   - Sevkiyat teslimi

5. **Şoför Paneli**
   - Kullanıcı adı + şifre ile giriş
   - Sevkiyat listesi
   - Google Maps yol tarifi
   - Konum paylaşımı
   - Teslimat durumu güncelleme

6. **Boya Modülü**
   - Şifreli giriş (`buse11993`)
   - Stok takibi
   - Hareket geçmişi

## Teknik Altyapı

### Backend
- FastAPI + Motor (async MongoDB)
- WebSocket (depo bildirimleri)
- Pydantic modeller

### Frontend
- React + TailwindCSS
- Shadcn/UI bileşenleri
- localStorage oturum yönetimi

### Veritabanı Şemaları
- `users` (YENİ): username, password, role, display_name, phone, location
- `machines`, `jobs`, `shifts`, `maintenance_logs`
- `warehouse_requests`, `pallets`
- `paints`, `paint_movements`
- `machine_messages`, `visitors`
- `vehicles`, `shipments`

## API Endpoints (Yeni)

### Kullanıcı Yönetimi
- `POST /api/users` - Kullanıcı oluştur
- `GET /api/users` - Kullanıcı listesi
- `POST /api/users/login` - Giriş (rol kontrolü ile)
- `DELETE /api/users/{id}` - Kullanıcı sil
- `PUT /api/users/{id}/location` - Konum güncelle
- `GET /api/users/drivers/locations` - Şoför konumları

## Bekleyen Özellikler

### P1 (Yüksek Öncelik)
- Google Maps API entegrasyonu

### P2 (Orta Öncelik)
- Günlük analiz detayı
- QR/Barkod tarama

### P3 (Düşük Öncelik)
- WebSocket mesajlaşma
