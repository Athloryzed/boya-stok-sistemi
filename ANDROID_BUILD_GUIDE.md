# Buse Kagit - Android APK Build Rehberi

## GitHub Actions ile Otomatik APK Oluşturma

Bu proje, GitHub Actions kullanarak otomatik Android APK oluşturma özelliğine sahiptir.

### Adım 1: Projeyi GitHub'a Yükleyin

1. Emergent platformunda **"Save to GitHub"** butonuna tıklayın
2. Yeni bir repository oluşturun veya mevcut bir repository seçin
3. Projeyi GitHub'a yükleyin

### Adım 2: APK'yı İndirin

1. GitHub repository'nize gidin
2. **"Actions"** sekmesine tıklayın
3. **"Build Android APK"** workflow'unu seçin
4. En son başarılı çalışmaya (yeşil tik işareti) tıklayın
5. Sayfanın altında **"Artifacts"** bölümünden APK dosyasını indirin:
   - `buse-kagit-debug-apk` - Test için (imzasız)
   - `buse-kagit-release-apk` - Yayın için (imzasız)

### Adım 3: APK'yı Yükleyin

1. İndirilen `.zip` dosyasını açın
2. `app-debug.apk` dosyasını Android telefonunuza aktarın
3. Telefonda **"Bilinmeyen kaynaklardan yükleme"** izni verin:
   - Ayarlar > Güvenlik > Bilinmeyen kaynaklar
   - veya dosyayı açtığınızda izin isteği gelecektir
4. APK dosyasına dokunarak yükleyin

## Önemli Notlar

- APK, canlı backend'e bağlanır: `https://job-firebase.preview.emergentagent.com`
- Tüm veriler web uygulaması ile senkronize olur
- iOS kullanıcıları web uygulamasını kullanmaya devam edebilir

## Manuel Build (Opsiyonel)

Android Studio ile manuel build yapmak isterseniz:

1. Projeyi bilgisayarınıza indirin
2. Android Studio'yu açın
3. `frontend/android` klasörünü açın
4. Build > Build Bundle(s) / APK(s) > Build APK(s)

## Sorun Giderme

- **APK yüklenmiyor**: "Bilinmeyen kaynaklar" iznini kontrol edin
- **Uygulama açılmıyor**: İnternet bağlantınızı kontrol edin
- **Veriler görünmüyor**: Backend URL'sinin doğru olduğundan emin olun
