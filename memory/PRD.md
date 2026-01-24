# Buse Kağıt - Üretim Yönetim Sistemi PRD

## Proje Özeti
Flexo kağıt fabrikası için kapsamlı web ve mobil üretim yönetim sistemi.

## Kullanıcı Rolleri ve Şifreler
- **Yönetim**: Şifre `432122` - Vardiya kontrolü, makine durumu, analitik, bakım, mesaj gönderme
- **Operatör**: İsim girişi - Makine seçimi, iş başlatma/tamamlama, mesaj alma (oturum hatırlama)
- **Plan**: Şifre `12341` - İş ekleme, sevkiyat yönetimi, makine durumu, geçmiş işler, mesaj gönderme
- **Depo**: Şifresiz - Malzeme talepleri, palet tarama, sevkiyat teslimi
- **Boya**: Şifre `432122` - Boya stok yönetimi
- **Şoför**: Şifreli giriş - Sevkiyat takibi, konum paylaşımı, teslimat durumu

## Son Güncelleme: 24 Ocak 2025

### Yeni Eklenen Özellikler (24 Ocak 2025) ✅

1. **Operatör Oturum Hatırlama**
   - Aynı cihaz/tarayıcıda gün içinde isim hatırlama (localStorage + backend session)
   - Sayfa yenilendiğinde otomatik giriş
   - Gün sonunda oturum süresi dolar

2. **Şoför Modülü (Yeni)**
   - Ana sayfada "Şoför" butonu
   - Şifreli giriş sistemi
   - Atanan sevkiyatları görme (adres, telefon, koli sayısı)
   - Google Maps ile yol tarifi
   - Toplu rota oluşturma (tüm teslimatlar için)
   - Teslim durumu: "Teslim Edildi" veya "Teslim Edilemedi" + sebep
   - Anlık konum takibi (tarayıcı izni ile)

3. **Sevkiyat Modülü (Plan Paneli)**
   - Yeni "Sevkiyat" sekmesi
   - Araç ekleme (plaka ile)
   - Şoför ekleme (isim + şifre + telefon)
   - Sevkiyat oluşturma:
     - Araç seçimi
     - Şoför atama
     - Teslimat adresi + telefon
     - Koli sayısı (manuel veya palet bazlı)
     - Palet arama ve ekleme
   - Sevkiyat listesi ve durum takibi

4. **Depo Geliştirmeleri**
   - Yeni "Sevkiyat Teslim" sekmesi
   - Bekleyen sevkiyatları görme
   - Kısmi veya tam teslim kaydı
   - "Geçmiş" sekmesi - sevkiyat kayıtları

5. **Mobil Responsive Güncellemeleri**
   - Yönetim: 2x3 grid sekmeler
   - Plan: 2x2 grid sekmeler
   - Depo: 2x2 grid sekmeler
   - Tüm paneller mobil uyumlu

## Tamamlanan Özellikler

### Ana Modüller ✅

1. **Yönetim Paneli**
   - Vardiya başlatma/bitirme
   - Makine durumu takibi
   - Günlük/Haftalık/Aylık analitik
   - Bakım kayıtları
   - Excel rapor dışa aktarma
   - Boya Stok Tablosu
   - Makineye Mesaj Gönderme
   - Düşük Stok Uyarısı
   - Ziyaretçi Takibi

2. **Operatör Paneli**
   - Oturum hatırlama (gün içinde)
   - Makine seçimi
   - İş başlatma/tamamlama
   - Malzeme talebi gönderme
   - Mesaj alma ve bildirim
   - Sohbet ekranı

3. **Plan Paneli**
   - Yeni iş ekleme
   - Sevkiyat yönetimi (YENİ)
   - Araç/Şoför ekleme (YENİ)
   - Makine durumu görüntüleme
   - Geçmiş işler ve klonlama
   - Mesajlar sekmesi

4. **Depo Paneli**
   - Malzeme talepleri (WebSocket)
   - Palet tarama
   - Sevkiyat teslimi (YENİ)
   - Sevkiyat geçmişi (YENİ)

5. **Boya Modülü**
   - 12 boya türü
   - Stok takibi
   - Hareket geçmişi
   - Tüketim analitikleri
   - Düşük stok uyarısı

6. **Şoför Modülü (YENİ)**
   - Şifreli giriş
   - Sevkiyat listesi
   - Google Maps entegrasyonu
   - Konum paylaşımı
   - Teslimat durumu güncelleme

## Teknik Altyapı

### Backend
- FastAPI + Motor (async MongoDB)
- WebSocket (depo bildirimleri)
- Pydantic modeller

### Frontend
- React + TailwindCSS
- Shadcn/UI bileşenleri
- Framer Motion animasyonlar
- Recharts grafikler

### Veritabanı Şemaları
- `machines`, `jobs`, `shifts`, `maintenance_logs`
- `warehouse_requests`, `pallets`
- `paints`, `paint_movements`
- `machine_messages`, `visitors`
- `operator_sessions` (YENİ)
- `vehicles`, `drivers`, `shipments` (YENİ)
- `warehouse_shipment_logs` (YENİ)

## Bekleyen Özellikler

### P1 (Yüksek Öncelik)
- Google Maps API entegrasyonu (API key gerekli)
- Anlık şoför konum görüntüleme (Plan panelinde)

### P2 (Orta Öncelik)
- Günlük analiz detayı (güne tıklayarak makine bazlı üretim)
- QR/Barkod tarama ile palet kaydı

### P3 (Düşük Öncelik)
- WebSocket mesajlaşma (polling yerine)
- Raporlama geliştirmeleri
