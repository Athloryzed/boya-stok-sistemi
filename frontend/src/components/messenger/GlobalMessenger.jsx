/**
 * GlobalMessenger — App.js'in en üst seviyesinde render edilir.
 * - Yalnızca kullanıcı oturum açtığında ve "/dashboard" (TV view) DIŞINDA gösterilir
 * - LiveDashboard büyük TV ekranı için FAB'i kapatır
 */
import React, { useEffect, useState, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { getSession } from "../../lib/auth";

const MessengerPanel = lazy(() => import("./MessengerPanel"));

export default function GlobalMessenger() {
  const location = useLocation();
  const [session, setSession] = useState(getSession());

  useEffect(() => {
    const handler = () => setSession(getSession());
    window.addEventListener("auth-changed", handler);
    window.addEventListener("storage", handler);
    // Polling fallback (sekme içi değişiklikler için)
    const t = setInterval(() => {
      const cur = getSession();
      setSession((prev) => {
        if ((prev?.user_id || prev?.id) === (cur?.user_id || cur?.id)) return prev;
        return cur;
      });
    }, 2000);
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
