/**
 * Portal rotası için yetki bekçisi — personel ProtectedRoute'tan bağımsız.
 *
 * /siparis-takip'in kendisi PortalFlow içinde hem giriş formunu hem sipariş
 * listesini gösterdiği için burada sarmalanmaz (anonim ziyaretçi giriş
 * formunu görebilmeli, anasayfaya atılmamalı). Bu bileşen, portal altında
 * ileride eklenebilecek "sadece oturum açık müşteri görsün" alt rotalar için
 * hazır tutuluyor — geçersiz/süresi dolmuş portal oturumunda /siparis-takip'e
 * (personel anasayfasına değil) yönlendirir.
 */
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isPortalSessionValid } from "../lib/portalAuth";

export default function PortalProtectedRoute({ children }) {
  const navigate = useNavigate();
  const checked = useRef(false);
  const ok = isPortalSessionValid();

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (ok) return;
    toast.error("Takip oturumunuzun süresi doldu, lütfen kodunuzu tekrar girin");
    navigate("/siparis-takip", { replace: true });
  }, [ok, navigate]);

  if (!ok) return null;
  return children;
}
