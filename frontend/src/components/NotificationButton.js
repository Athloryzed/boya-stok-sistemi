import React, { useEffect, useState } from "react";
import { BellRing, BellOff, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { requestNotificationPermission as requestFCMPermission } from "../firebase";
import { iosNotificationStatus } from "../utils/iosPwa";
import IOSInstallGuide from "./IOSInstallGuide";

/**
 * Tüm panellerde kullanılabilen ortak bildirim aç butonu.
 * - Bildirim izni yoksa BellRing (warning rengi) gösterir → tıklanınca akış başlar
 * - iOS Safari (not standalone) ise IOSInstallGuide modal'ı açılır
 * - iOS standalone veya diğer tarayıcılar → normal Firebase FCM flow
 * - İzin verilmişse Bell (success) sessizce görünür ya da hiç gösterilmez
 *
 * Props:
 *   onTokenReceived: (token) => void  — token alındığında backend'e iletmek için (opsiyonel)
 *   hideWhenGranted: boolean (default true)
 */
const NotificationButton = ({ onTokenReceived, hideWhenGranted = true, testId = "notif-btn" }) => {
  const [permission, setPermission] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const [iosOpen, setIosOpen] = useState(false);
  const [iosStatus, setIosStatus] = useState("needs_install");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    // İzin durumu değişikliklerini takip et (kullanıcı manuel açabilir)
    const onVisChange = () => setPermission(Notification.permission);
    document.addEventListener("visibilitychange", onVisChange);
    return () => document.removeEventListener("visibilitychange", onVisChange);
  }, []);

  if (permission === "unsupported") return null;
  if (hideWhenGranted && permission === "granted") return null;

  const handleClick = async () => {
    const status = iosNotificationStatus();
    // iOS Safari'de (PWA olarak yüklenmemiş) veya iOS sürümü eski ise rehber göster
    if (status === "needs_install" || status === "version_old") {
      setIosStatus(status);
      setIosOpen(true);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        toast.error("Bildirim izni reddedildi");
        setPermission(result);
        return;
      }
      // FCM token al
      const token = await requestFCMPermission();
      setPermission("granted");
      if (token && onTokenReceived) {
        try {
          await onTokenReceived(token);
        } catch (_) { /* sessiz */ }
      }
      toast.success("Bildirimler aktif edildi!");
    } catch (e) {
      toast.error("Bildirim izni alınamadı");
    }
  };

  const Icon = permission === "denied" ? BellOff : (permission === "granted" ? Bell : BellRing);
  const colorClass = permission === "denied"
    ? "text-red-500"
    : permission === "granted"
    ? "text-emerald-500"
    : "text-warning";

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handleClick}
        data-testid={testId}
        className="border-border bg-surface/60 hover:bg-surface-highlight h-9 w-9"
        title={permission === "denied" ? "Bildirim izni reddedildi — tarayıcı ayarlarından açın" : "Bildirimleri Aktif Et"}
      >
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </Button>
      <IOSInstallGuide
        open={iosOpen}
        onClose={() => setIosOpen(false)}
        status={iosStatus}
      />
    </>
  );
};

export default NotificationButton;
