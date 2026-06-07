/**
 * Panel rotası için yetki bekçisi.
 * - localStorage'da geçerli oturum yoksa → anasayfaya redirect
 * - Oturum varsa ama rol yetersizse → anasayfaya redirect + toast
 */
import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isSessionValid, canAccessRoute } from "../lib/auth";

function evaluateAuth(pathname) {
  const valid = isSessionValid();
  if (!valid) {
    // Mevcut panel-bazlı login formuna izin ver (geriye dönük uyumluluk).
    const anyOldSession = [
      "operator_session", "plan_session", "depo_session",
      "warehouse_session", "bobin_session", "yonetim_master"
    ].some((k) => {
      try { return !!JSON.parse(localStorage.getItem(k) || "null"); } catch (_) { return false; }
    });
    return { ok: anyOldSession, reason: anyOldSession ? "compat" : "no-session" };
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
    }
    navigate("/", { replace: true });
  }, [auth.ok, auth.reason, navigate]);

  if (!auth.ok) return null;
  return children;
}
