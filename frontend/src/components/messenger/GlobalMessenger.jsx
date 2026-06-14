/**
 * GlobalMessenger — App.js'in en üst seviyesinde render edilir.
 * - Yalnızca kullanıcı GEÇERLİ oturum açtığında ve "/dashboard" (TV view) DIŞINDA gösterilir
 * - isSessionValid() ile 24h / remember_me politikası kontrol edilir
 * - LiveDashboard büyük TV ekranı için FAB'i kapatır
 */
import React, { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { getSession, isSessionValid } from "../../lib/auth";
import { disconnectChatWS } from "../../lib/messenger";

const MessengerPanel = lazy(() => import("./MessengerPanel"));

function readAuthState() {
  return isSessionValid() ? getSession() : null;
}

export default function GlobalMessenger() {
  const location = useLocation();
  const [session, setSession] = useState(readAuthState());

  useEffect(() => {
    const handler = () => {
      const next = readAuthState();
      setSession((prev) => {
        // Oturum kaybedildiyse / kullanıcı değiştiyse WS'i kapat — eski token ile gelen mesajları engelle
        const prevId = prev?.user_id || prev?.id || null;
        const curId = next?.user_id || next?.id || null;
        if (prevId !== curId || (!next && prev)) {
          try { disconnectChatWS(); } catch (_) { /* noop */ }
        }
        return next;
      });
    };
    window.addEventListener("auth-changed", handler);
    window.addEventListener("storage", handler);
    // Polling fallback — session geçerliliğini sık kontrol et (örn. 24h dolunca FAB hemen kaybolur)
    const t = setInterval(handler, 2000);
    return () => {
      window.removeEventListener("auth-changed", handler);
      window.removeEventListener("storage", handler);
      clearInterval(t);
    };
  }, []);

  if (!session) return null;
  // TV / Canlı Pano ekranında gösterme
  if (location.pathname.startsWith("/dashboard")) return null;
  // Tracking page (müşteri takip linki) da kapalı
  if (location.pathname.startsWith("/takip/")) return null;

  return (
    <Suspense fallback={null}>
      <MessengerPanel />
    </Suspense>
  );
}
