# Buse Kağıt - Android APK Build Rehberi

## Gereksinimler

1. **Android Studio** (en son sürüm)
   - Download: https://developer.android.com/studio

2. **Java JDK 17+**
   - Android Studio ile birlikte gelir

## APK Build Adımları

### 1. Android Studio'da Projeyi Açın

```bash
# Proje klasörü
/app/frontend/android
```

Android Studio'yu açın ve "Open an existing project" seçeneği ile `/app/frontend/android` klasörünü açın.

### 2. Gradle Sync

Android Studio otomatik olarak Gradle sync yapacak. Bekleyin.

### 3. Debug APK Build

**Menüden:**
- Build → Build Bundle(s) / APK(s) → Build APK(s)

**Veya Terminal'den:**
```bash
cd /app/frontend/android
./gradlew assembleDebug
```

APK dosyası burada oluşacak:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 4. Release APK Build (İmzalı)

Release APK için keystore oluşturmanız gerekiyor:

```bash
keytool -genkey -v -keystore buse-kagit-release.keystore -alias busekagit -keyalg RSA -keysize 2048 -validity 10000
```

Sonra `android/app/build.gradle` dosyasına signing config ekleyin.

## Önemli Dosyalar

- `capacitor.config.json` - Uygulama yapılandırması
- `android/app/src/main/AndroidManifest.xml` - Android izinleri
- `android/app/src/main/res/` - İkon ve kaynaklar

## Uygulama Özellikleri

- **Live URL:** https://shift-end-manager.preview.emergentagent.com
- **Senkronizasyon:** Web sitesi ile aynı backend, otomatik senkron
- **Push Notifications:** Firebase entegrasyonu ile (yapılandırma gerekli)

## Firebase Push Notifications Kurulumu (Opsiyonel)

1. Firebase Console'da proje oluşturun
2. `google-services.json` dosyasını indirin
3. `android/app/` klasörüne kopyalayın
4. Backend'e Firebase Admin SDK entegre edin

## Sorun Giderme

### Build Hatası
```bash
cd /app/frontend/android
./gradlew clean
./gradlew assembleDebug
```

### Capacitor Sync
```bash
cd /app/frontend
npx cap sync android
```

## iOS Kullanıcıları

iOS kullanıcıları web sitesine erişmeye devam edebilir:
- Safari'den https://shift-end-manager.preview.emergentagent.com adresine gidin
- "Ana Ekrana Ekle" seçeneği ile PWA olarak kurabilirler
