/**
 * Sesli ve titreşimli bildirim yardımcısı.
 * - Web Audio API ile kısa "ding" sesi üretir
 * - navigator.vibrate ile telefon titreşimi (destekleyen cihazlar)
 *
 * Kullanim:
 *   import { notifyAlert } from "../utils/notify";
 *   notifyAlert();              // varsayılan: bildirim
 *   notifyAlert("urgent");      // acil: 3'lü uyarı
 *   notifyAlert("subtle");      // hafif: tek kısa
 */

let _audioCtx = null;
function getAudioCtx() {
  if (typeof window === "undefined") return null;
  if (_audioCtx) return _audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  } catch {
    return null;
  }
}

function beep(freq = 880, durationMs = 140, volume = 0.18) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    // Yumuşak fade-out
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch { /* sessiz */ }
}

function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* sessiz */ }
}

export function notifyAlert(level = "default") {
  if (level === "urgent") {
    // 3 yüksek frekanslı bip + uzun titreşim
    beep(1100, 130);
    setTimeout(() => beep(1100, 130), 180);
    setTimeout(() => beep(1100, 180), 360);
    vibrate([200, 80, 200, 80, 300]);
  } else if (level === "subtle") {
    // Tek hafif tık
    beep(660, 80, 0.1);
    vibrate(40);
  } else {
    // Standart: 2 tonlu "ding-dong"
    beep(880, 140);
    setTimeout(() => beep(660, 180), 150);
    vibrate([120, 60, 180]);
  }
}

// Kullanıcı sayfaya ilk dokunduğunda AudioContext'i resume et (tarayıcı kısıtlaması için)
if (typeof window !== "undefined") {
  const resume = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    window.removeEventListener("click", resume);
    window.removeEventListener("touchstart", resume);
  };
  window.addEventListener("click", resume, { once: true });
  window.addEventListener("touchstart", resume, { once: true });
}
