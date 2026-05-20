/**
 * iOS Safari / PWA tespit utility'leri.
 * iOS'ta Web Push sadece "Ana Ekrana Eklenmiş" PWA (standalone mode) içinde çalışır.
 * iOS 16.4+ gerekir (Mart 2023+).
 */

export const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPhone, iPad, iPod + modern iPad Safari (Mac UA gibi davranır, touch ile ayırt ederiz)
  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Mac/.test(ua) && typeof document !== "undefined" && "ontouchend" in document)
  );
};

export const isSafari = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
};

/** Uygulama PWA olarak yüklenmiş ve standalone modda mı? */
export const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator?.standalone === true
  );
};

/** iOS sürümünü çıkarır (örn. 16.4 → 16.4). Bilinmiyorsa null. */
export const getIOSVersion = () => {
  if (!isIOS()) return null;
  const ua = navigator.userAgent || "";
  const m = ua.match(/OS (\d+)_(\d+)(?:_(\d+))?/);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  return major + minor / 100; // 16.04 ≈ 16.4 kıyaslaması için yeterli
};

/** iOS Web Push destekliyor mu? (iOS 16.4+ AND standalone mode) */
export const iosSupportsWebPush = () => {
  if (!isIOS()) return false;
  const v = getIOSVersion();
  if (v === null) return false;
  return v >= 16.04 && isStandalone();
};

/**
 * Bildirim izni isteği için iOS özelinde yapılması gerekenler:
 * - "blocked": kullanıcı tarayıcıdan değil yüklü PWA'dan girmeli
 * - "needs_install": iPhone Safari ama PWA olarak yüklenmemiş
 * - "version_old": iOS 16.4 altı (Web Push desteklemiyor)
 * - "ready": iOS PWA olarak yüklü ve iOS 16.4+, normal flow devam edebilir
 * - "not_ios": iOS değil, mevcut flow devam etsin
 */
export const iosNotificationStatus = () => {
  if (!isIOS()) return "not_ios";
  const v = getIOSVersion();
  if (v !== null && v < 16.04) return "version_old";
  if (!isStandalone()) return "needs_install";
  return "ready";
};
