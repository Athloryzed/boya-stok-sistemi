import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, RefreshCw } from "lucide-react";

/**
 * BAĞLANTI DURUMU BANNER'I
 *
 * - Backend API çağrıları başarısız olduğunda (mobil ISP blokajı, timeout vs.)
 *   üstten kayarak görünür.
 * - Tarayıcı online'a dönerse veya başarılı bir API çağrısı geldiğinde otomatik kaybolur.
 * - Kullanıcıya manuel "Yeniden Dene" butonu verir (sayfayı reload eder).
 *
 * `axios` interceptor'ları `api-online` ve `api-offline` event'leri yayınlar.
 */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => { setOffline(false); setRetrying(false); };

    window.addEventListener("api-offline", onOffline);
    window.addEventListener("api-online", onOnline);

    // Browser-level online/offline events
    const onBrowserOnline = () => setOffline(false);
    const onBrowserOffline = () => setOffline(true);
    window.addEventListener("online", onBrowserOnline);
    window.addEventListener("offline", onBrowserOffline);

    // Sayfa açılır açılmaz tarayıcı offline ise göster
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setOffline(true);
    }

    return () => {
      window.removeEventListener("api-offline", onOffline);
      window.removeEventListener("api-online", onOnline);
      window.removeEventListener("online", onBrowserOnline);
      window.removeEventListener("offline", onBrowserOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetrying(true);
    // Kısa bir bekleme sonrası sayfayı yenile (cache bypass)
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 to-orange-600 text-zinc-900 shadow-xl"
          data-testid="connection-banner"
        >
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <WifiOff className="h-4 w-4 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">Sunucuya ulaşılamıyor</p>
                <p className="text-[11px] opacity-80 leading-tight mt-0.5">
                  Mobil veride engelleme olabilir. Wi-Fi'ye geçmeyi veya yeniden denemeyi deneyin.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              data-testid="connection-retry-btn"
              className="inline-flex items-center gap-1.5 bg-zinc-900/90 hover:bg-zinc-900 text-amber-300 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors disabled:opacity-60 flex-shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Yenileniyor..." : "Yeniden Dene"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
