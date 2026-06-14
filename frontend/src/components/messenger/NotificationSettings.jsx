/**
 * NotificationSettings — Yönetim için Bildirim Tetikleyici Ayarları
 * Her olay tipi için aç/kapa + hedef rol/kanal seçimi + eşik (low_stock için)
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Bell, X, Save, Package, Paintbrush, AlertTriangle, ClipboardList, CheckCircle, RotateCcw } from "lucide-react";
import { chatApi } from "../../lib/messenger";

const EVENT_TYPES = [
  {
    key: "bobin_request", label: "Bobin Talebi", icon: Package, color: "#10B981",
    description: "Operatör bobin istediğinde otomatik mesaj",
  },
  {
    key: "paint_request", label: "Boya Talebi", icon: Paintbrush, color: "#A78BFA",
    description: "Operatör boya istediğinde otomatik mesaj",
  },
  {
    key: "low_stock", label: "Düşük Stok Alarmı", icon: AlertTriangle, color: "#F59E0B",
    description: "Stok eşik altına düştüğünde uyarı",
    hasThreshold: true,
  },
  {
    key: "job_assigned", label: "Yeni İş Atandı", icon: ClipboardList, color: "#60A5FA",
    description: "Plan yeni iş atadığında makine kanalına bildirim",
  },
  {
    key: "job_completed", label: "İş Tamamlandı", icon: CheckCircle, color: "#22C55E",
    description: "Operatör iş tamamladığında Plan + Yönetim'e bildirim",
  },
];

const CHANNEL_OPTIONS = [
  { k: "genel", label: "Genel", icon: "📢" },
  { k: "yonetim", label: "Yönetim", icon: "👑" },
  { k: "plan", label: "Plan", icon: "📋" },
  { k: "operator", label: "Operatör", icon: "👷" },
  { k: "depo", label: "Depo", icon: "📦" },
  { k: "sofor", label: "Sürücü", icon: "🚚" },
];

export default function NotificationSettings({ open, onClose }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) loadSettings();
  }, [open]);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await chatApi.getNotificationSettings();
      setSettings(data.settings || {});
      setDirty(false);
    } catch (e) {
      toast.error("Ayarlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  function update(eventKey, patch) {
    setSettings((prev) => ({
      ...prev,
      [eventKey]: { ...(prev[eventKey] || {}), ...patch },
    }));
    setDirty(true);
  }

  function toggleChannel(eventKey, channelKey) {
    const cur = settings[eventKey] || {};
    const channels = new Set(cur.target_channels || []);
    if (channels.has(channelKey)) channels.delete(channelKey);
    else channels.add(channelKey);
    update(eventKey, { target_channels: Array.from(channels) });
  }

  async function save() {
    setSaving(true);
    try {
      await chatApi.updateNotificationSettings(settings);
      toast.success("Bildirim ayarları kaydedildi");
      setDirty(false);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!window.confirm("Tüm bildirim ayarlarını varsayılana sıfırlayalım mı?")) return;
    setLoading(true);
    try {
      // Tüm event'leri varsayılana çevir (backend default'ları otomatik döner)
      await chatApi.updateNotificationSettings({
        bobin_request: { enabled: true, target_channels: ["depo"] },
        paint_request: { enabled: true, target_channels: ["depo"] },
        low_stock: { enabled: true, target_channels: ["depo", "yonetim"], threshold_l: 5.0 },
        job_assigned: { enabled: true, target_channels: ["machine"] },
        job_completed: { enabled: true, target_channels: ["plan", "yonetim"] },
      });
      await loadSettings();
      toast.success("Varsayılana sıfırlandı");
    } catch (e) {
      toast.error("Sıfırlama başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 250 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-settings-title"
            data-testid="notification-settings-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-b from-[#1a1410] to-[#0c0904] border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/20 max-w-3xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="header-premium px-5 py-4 flex items-center justify-between border-b border-amber-500/15 rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <div className="panel-logo-tile" style={{ "--tile-from": "#FFD24C", "--tile-to": "#B8860B", "--tile-rgb": "255,191,0" }} aria-hidden="true">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-amber-300/80 leading-none">Buse Kâğıt · Yönetim</p>
                    <h2 id="notif-settings-title" className="text-base font-heading font-black text-white leading-tight tracking-tight">
                      Bildirim Yönetimi
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-zinc-400"
                  aria-label="Kapat"
                  data-testid="notification-settings-close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {loading ? (
                  <div className="text-center py-12 text-zinc-500">Yükleniyor...</div>
                ) : (
                  <>
                    <p className="text-xs text-zinc-400 leading-relaxed bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      Burada her otomatik bildirim olayını <strong className="text-amber-300">açabilir/kapatabilir</strong>, hangi <strong className="text-amber-300">kanallara</strong> gideceğini seçebilirsiniz. Değişiklikler anında etkili olur — yeni gelen bobin/boya talepleri buradaki ayarlara göre yönlendirilir.
                    </p>
                    {EVENT_TYPES.map((ev) => {
                      const s = settings[ev.key] || {};
                      const enabled = s.enabled !== false;
                      const channels = s.target_channels || [];
                      return (
                        <div
                          key={ev.key}
                          data-testid={`event-${ev.key}`}
                          className={`rounded-xl border p-4 transition-all ${enabled ? "bg-white/5 border-white/15" : "bg-white/[0.02] border-white/5 opacity-60"}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-start gap-3 flex-1">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${ev.color}22`, border: `1px solid ${ev.color}55` }}
                              >
                                <ev.icon className="w-5 h-5" style={{ color: ev.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white">{ev.label}</h4>
                                <p className="text-[11px] text-zinc-400 mt-0.5">{ev.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => update(ev.key, { enabled: !enabled })}
                              data-testid={`toggle-${ev.key}`}
                              role="switch"
                              aria-checked={enabled}
                              aria-label={`${ev.label} ${enabled ? "kapat" : "aç"}`}
                              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${enabled ? "translate-x-5" : ""}`} />
                            </button>
                          </div>

                          {enabled && (
                            <div className="ml-12 space-y-2">
                              <p className="text-[10px] uppercase tracking-widest text-amber-300/70 font-bold">Hedef Kanallar</p>
                              <div className="flex flex-wrap gap-1.5">
                                {CHANNEL_OPTIONS.map((c) => (
                                  <button
                                    key={c.k}
                                    onClick={() => toggleChannel(ev.key, c.k)}
                                    data-testid={`channel-${ev.key}-${c.k}`}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                      channels.includes(c.k)
                                        ? "bg-amber-500/25 border-amber-500/60 text-amber-200"
                                        : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                                    }`}
                                  >
                                    {c.icon} {c.label}
                                  </button>
                                ))}
                                {/* Machine channel option (only for job_assigned) */}
                                {ev.key === "job_assigned" && (
                                  <button
                                    onClick={() => toggleChannel(ev.key, "machine")}
                                    data-testid={`channel-${ev.key}-machine`}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                      channels.includes("machine")
                                        ? "bg-amber-500/25 border-amber-500/60 text-amber-200"
                                        : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                                    }`}
                                  >
                                    🏭 Makine Kanalı
                                  </button>
                                )}
                              </div>
                              {/* Threshold (low_stock) */}
                              {ev.hasThreshold && (
                                <div className="flex items-center gap-2 mt-2">
                                  <label className="text-xs text-zinc-400">Eşik (L):</label>
                                  <input
                                    type="number" min="0.5" step="0.5"
                                    value={s.threshold_l ?? 5}
                                    onChange={(e) => update(ev.key, { threshold_l: parseFloat(e.target.value) || 5 })}
                                    data-testid={`threshold-${ev.key}`}
                                    className="w-20 px-2 py-1 rounded-md bg-white/5 border border-white/15 text-white text-xs focus:border-amber-400 outline-none"
                                  />
                                  <span className="text-[10px] text-zinc-500">Bu seviyenin altına düşünce uyarı gönderilir</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-amber-500/15 flex items-center justify-between gap-2 rounded-b-2xl bg-black/30">
                <button
                  onClick={resetDefaults}
                  disabled={loading || saving}
                  data-testid="notification-reset"
                  className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Varsayılana sıfırla
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/10"
                  >
                    Kapat
                  </button>
                  <button
                    onClick={save}
                    disabled={!dirty || saving}
                    data-testid="notification-save"
                    className="px-4 py-2 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-900 font-bold flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-amber-500/30"
                  >
                    {saving ? <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" /> Kaydet</>}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
