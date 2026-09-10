/**
 * Panel rotası için yetki bekçisi.
 * - localStorage'da geçerli oturum yoksa → anasayfaya redirect
 * - Oturum varsa ama rol yetersizse → anasayfaya redirect + toast
 *
 * Tek doğruluk kaynağı: app_session (bkz. lib/auth.js). Eski panel-bazlı
 * session anahtarları (plan_session, yonetim_master, vb.) erişim kararına
 * artık karışmaz — sadece geçiş toast'ı için okunur (hasLegacySessionArtifacts).
 */
import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isSessionValid, canAccessRoute, hasLegacySessionArtifacts } from "../lib/auth";

function evaluateAuth(pathname) {
  if (!isSessionValid()) {
    return { ok: false, reason: "no-session" };
  }
  if (!canAccessRoute(pathname)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, reason: "ok" };
}

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const checked = useRef(false);
  const auth = evaluateAuth(location.pathname);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (auth.ok) return;
    if (auth.reason === "forbidden") {
      toast.error("Bu panele erişim yetkiniz yok");
    } else if (auth.reason === "no-session" && hasLegacySessionArtifacts()) {
      toast.error("Oturum sistemi güncellendi, lütfen tekrar giriş yapın");
    }
    navigate("/", { replace: true });
  }, [auth.ok, auth.reason, navigate]);

  if (!auth.ok) return null;
  return children;
}
