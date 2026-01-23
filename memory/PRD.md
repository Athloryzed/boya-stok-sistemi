# Buse Kağıt - Üretim Yönetim Sistemi PRD

## Proje Özeti
Flexo kağıt fabrikası için kapsamlı web ve mobil üretim yönetim sistemi.

## Kullanıcı Rolleri ve Şifreler
- **Yönetim**: Şifre `432122` - Vardiya kontrolü, makine durumu, analitik, bakım
- **Operatör**: İsim girişi - Makine seçimi, iş başlatma/tamamlama
- **Plan**: Şifre `12341` - İş ekleme, makine durumu, geçmiş işler
- **Depo**: Şifresiz - Malzeme talepleri
- **Boya**: Şifre `432122` - Boya stok yönetimi

## Tamamlanan Özellikler

### Ana Modüller ✅
1. **Yönetim Paneli**
   - Vardiya başlatma/bitirme
   - Makine durumu takibi
   - Günlük/Haftalık/Aylık analitik
   - Bakım kayıtları
   - Excel rapor dışa aktarma

2. **Operatör Paneli**
   - Makine seçimi
   - İş başlatma/tamamlama
   - Malzeme talebi gönderme

3. **Plan Paneli**
   - Yeni iş ekleme (koli sayısı, renk, format, termin)
   - Makine durumu görüntüleme
   - Geçmiş işler ve iş klonlama
   - İş arama

4. **Depo Paneli**
   - Malzeme talepleri listesi
   - Talep tamamlama

5. **Boya Modülü (YENİ - 23 Ocak 2026)** ✅
   - 12 boya türü: Siyah, Beyaz, Kırmızı, Mavi, Yeşil, Sarı, Turuncu, Mor, Pembe, Kahverengi, Gri, Turkuaz
   - Stok takibi (kg cinsinden)
   - Stok ekleme/çıkarma
   - Makineye gönderme/makineden alma
   - Hareket geçmişi
   - Haftalık/Aylık tüketim analitikleri
   - Boya bazında ve makine bazında grafikler

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

## Teknik Mimari
- **Backend**: FastAPI + Motor (MongoDB async)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Veritabanı**: MongoDB
- **Grafikler**: Recharts
- **Animasyon**: Framer Motion

## API Endpoints

### Boya Modülü
- `POST /api/paints/init` - Başlangıç boyalarını oluştur
- `GET /api/paints` - Tüm boyaları listele
- `POST /api/paints` - Yeni boya ekle
- `DELETE /api/paints/{paint_id}` - Boya sil
- `POST /api/paints/transaction` - Boya hareketi (add, remove, to_machine, from_machine)
- `GET /api/paints/movements` - Hareket geçmişi
- `GET /api/paints/analytics` - Tüketim analitikleri

### Mevcut Endpoints
- `/api/machines` - Makine işlemleri
- `/api/jobs` - İş işlemleri
- `/api/shifts` - Vardiya işlemleri
- `/api/maintenance-logs` - Bakım kayıtları
- `/api/warehouse-requests` - Depo talepleri
- `/api/analytics/*` - Analitik endpoints

## Bekleyen Görevler (Backlog)

### P1 - Yüksek Öncelik
- [ ] Yönetim müdahale hatası düzeltmesi (operatör işine müdahale)
- [ ] Depo için gerçek zamanlı bildirimler (WebSocket)

### P2 - Orta Öncelik
- [ ] Günlük analitik drill-down (güne tıklayınca makine detayı)
- [ ] Plan/Yönetim'de boya stok görünümü

### P3 - Düşük Öncelik
- [ ] QR/Barkod tarama özelliği

## Test Durumu
- Backend: %100 (16/16 test geçti)
- Frontend: %100 (tüm UI akışları çalışıyor)
- Son test: 23 Ocak 2026

## Dosya Yapısı
```
/app/
├── backend/
│   ├── server.py          # Ana API
│   ├── tests/             # Test dosyaları
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.js
│   │   │   ├── ManagementFlow.js
│   │   │   ├── OperatorFlow.js
│   │   │   ├── PlanFlow.js
│   │   │   ├── WarehouseFlow.js
│   │   │   └── PaintFlow.js
│   │   └── App.js
│   └── public/
│       ├── manifest.json
│       └── service-worker.js
└── test_reports/
```
