/**
 * WeeklyMenuEditor — Yönetim için haftalık yemek menüsü editörü.
 *
 * Özellikler:
 * - 7 günü tek sayfada göster (mobilde dikey, masaüstünde grid)
 * - Her gün için yemek chip'leri (ekle/sil)
 * - Drag&drop: gün başlığını başka güne sürükle → o günün listesini KOPYALA
 * - "Bu haftayı sonraki haftaya kopyala" tek tık
 * - Hafta gezme (önceki/sonraki)
 * - Tek "Kaydet" — bulk endpoint
 *
 * Props:
 *   open, onClose, onSaved?
 */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { UtensilsCrossed, X as XIcon, Loader2, ChevronLeft, ChevronRight, Plus, Trash2, Copy, Save, GripVertical, Calendar } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function authHeaders() {
  try {
    const sess = JSON.parse(localStorage.getItem("app_session") || "null");
    return sess?.token ? { Authorization: `Bearer ${sess.token}` } : {};
  } catch { return {}; }
}

// Türkiye saatiyle YYYY-MM-DD
function fmtKey(d) {
  const t = new Date(d);
  // UTC+3
  const tz = new Date(t.getTime() + (3 * 60 + t.getTimezoneOffset()) * 60 * 1000);
  return tz.toISOString().slice(0, 10);
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return {
    name: d.toLocaleDateString("tr-TR", { weekday: "long" }),
    short: d.toLocaleDateString("tr-TR", { weekday: "short" }),
    day: d.getDate().toString().padStart(2, "0"),
    month: d.toLocaleDateString("tr-TR", { month: "short" }),
  };
}

// Bir tarihi içeren haftanın PAZARTESİ'sini bul (Türkçe iş haftası)
function weekStartMonday(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = (dow === 0 ? -6 : 1 - dow);
  d.setDate(d.getDate() + diff);
  return fmtKey(d);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return fmtKey(d);
}

export default function WeeklyMenuEditor({ open, onClose, onSaved }) {
  const todayKey = useMemo(() => fmtKey(new Date()), []);
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(fmtKey(new Date())));
  // weekData: { "YYYY-MM-DD": { items: [], notes: "", exists: bool, dirty: bool } }
  const [weekData, setWeekData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingDate, setDraggingDate] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Hafta verisini yükle
  const loadWeek = async (start) => {
    setLoading(true);
    try {
      const dStart = new Date(start + "T00:00:00");
      const today = new Date();
      const diffDays = Math.round((dStart - today) / (1000 * 60 * 60 * 24));
      // Server zaten today merkez/back/forward'a göre arıyor — burası kalıcı: filter by date range
      const res = await axios.get(`${API}/menu/week`, {
        params: { days_back: Math.max(-diffDays + 14, 14), days_forward: Math.max(diffDays + 14, 14) },
      });
      const map = {};
      const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      const byDate = {};
      (res.data?.menus || []).forEach((m) => { byDate[m.date] = m; });
      dates.forEach((d) => {
        const m = byDate[d];
        map[d] = {
          items: (m?.items || []).slice(),
          notes: m?.notes || "",
          exists: !!m?.exists,
          dirty: false,
        };
      });
      setWeekData(map);
    } catch (e) {
      toast.error("Hafta verisi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadWeek(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, weekStart]);

  const update = (date, patch) => {
    setWeekData((s) => ({ ...s, [date]: { ...(s[date] || { items: [], notes: "", exists: false }), ...patch, dirty: true } }));
  };

  const addItem = (date) => {
    const cur = weekData[date]?.items || [];
    update(date, { items: [...cur, ""] });
  };

  const removeItem = (date, idx) => {
    const cur = weekData[date]?.items || [];
    update(date, { items: cur.filter((_, i) => i !== idx) });
  };

  const setItem = (date, idx, val) => {
    const cur = weekData[date]?.items || [];
    const next = cur.slice();
    next[idx] = val;
    update(date, { items: next });
  };

  const setNotes = (date, val) => update(date, { notes: val });

  // Drag handlers — bir gün başlığını başka güne sürükle → kopyala
  const onDragStart = (e, date) => {
    setDraggingDate(date);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", date);
  };
  const onDragOver = (e, date) => {
    e.preventDefault();
    setDragOverDate(date);
  };
  const onDragLeave = () => setDragOverDate(null);
  const onDrop = (e, targetDate) => {
    e.preventDefault();
    const source = draggingDate || e.dataTransfer.getData("text/plain");
    setDraggingDate(null);
    setDragOverDate(null);
    if (!source || source === targetDate) return;
    const sourceData = weekData[source];
    if (!sourceData || sourceData.items.length === 0) {
      toast.error("Kaynak günde menü yok");
      return;
    }
    update(targetDate, {
      items: sourceData.items.slice(),
      notes: sourceData.notes || "",
    });
    toast.success(`${dayLabel(source).name} → ${dayLabel(targetDate).name} kopyalandı`);
  };

  const copyToNextWeek = async () => {
    if (!window.confirm("Bu haftanın tüm menülerini SONRAKI haftaya kopyalamak istiyor musun?")) return;
    const nextWeekStart = addDays(weekStart, 7);
    const payload = {
      menus: weekDates.map((d, i) => ({
        date: addDays(nextWeekStart, i),
        items: (weekData[d]?.items || []).filter((x) => x.trim()),
        notes: weekData[d]?.notes || "",
      })),
    };
    setSaving(true);
    try {
      const res = await axios.post(`${API}/menu/bulk`, payload, { headers: authHeaders() });
      toast.success(`${res.data.saved} gün sonraki haftaya kopyalandı`);
      setWeekStart(nextWeekStart);
    } catch (e) {
      toast.error("Kopyalama başarısız");
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const payload = {
      menus: weekDates.map((d) => ({
        date: d,
        items: (weekData[d]?.items || []).filter((x) => x.trim()),
        notes: weekData[d]?.notes || "",
      })),
    };
    setSaving(true);
    try {
      const res = await axios.post(`${API}/menu/bulk`, payload, { headers: authHeaders() });
      toast.success(`${res.data.saved} gün kaydedildi${res.data.deleted ? ` · ${res.data.deleted} boş gün silindi` : ""}`);
      // dirty flag'leri temizle
      setWeekData((s) => {
        const next = { ...s };
        Object.keys(next).forEach((k) => { next[k] = { ...next[k], dirty: false, exists: (next[k].items || []).some(x => x.trim()) }; });
        return next;
      });
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const dirtyCount = useMemo(() => Object.values(weekData).filter((v) => v?.dirty).length, [weekData]);
  const weekRangeLabel = useMemo(() => {
    const s = dayLabel(weekStart);
    const e = dayLabel(weekDates[6]);
    return `${s.day} ${s.month} — ${e.day} ${e.month}`;
  }, [weekStart, weekDates]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[85]"
      />
      <div className="fixed inset-0 z-[86] flex items-center justify-center p-3 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", damping: 24, stiffness: 220 }}
          className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-b from-[#1a1410] to-[#0c0904] ring-1 ring-amber-500/30 pointer-events-auto flex flex-col"
          data-testid="weekly-menu-editor"
          role="dialog"
          aria-modal="true"
        >
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-amber-500/15 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 ring-1 ring-amber-500/40 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="h-5 w-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-heading font-black text-amber-50 tracking-tight">Haftalık Yemek Menüsü</h3>
                <p className="text-[11px] text-amber-300/70 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> {weekRangeLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline" size="icon"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                disabled={loading}
                data-testid="week-prev-btn"
                className="h-9 w-9 border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                aria-label="Önceki hafta"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setWeekStart(weekStartMonday(todayKey))}
                disabled={loading}
                data-testid="week-today-btn"
                className="h-9 border-amber-500/30 text-amber-200 hover:bg-amber-500/10 text-xs"
              >
                Bu Hafta
              </Button>
              <Button
                variant="outline" size="icon"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                disabled={loading}
                data-testid="week-next-btn"
                className="h-9 w-9 border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
                aria-label="Sonraki hafta"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={onClose} data-testid="weekly-menu-close"
                className="h-9 w-9 border-amber-500/30 text-amber-200 hover:bg-amber-500/10 ml-1">
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Hint */}
          <div className="px-4 sm:px-6 py-2 text-[11px] text-amber-300/60 bg-amber-500/5 border-b border-amber-500/10 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-amber-300/80">💡 İpucu:</span>
            <span>Bir günün başlığını başka güne <span className="font-bold text-amber-200">sürükle bırak</span> → menü kopyalanır.</span>
            <span className="hidden sm:inline">Boş bırakırsan o günün menüsü silinir.</span>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[...Array(7)].map((_, i) => <div key={i} className="h-44 rounded-xl bg-amber-500/5 animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {weekDates.map((d) => {
                  const data = weekData[d] || { items: [], notes: "", exists: false, dirty: false };
                  const lbl = dayLabel(d);
                  const isToday = d === todayKey;
                  const isDragOver = dragOverDate === d;
                  return (
                    <div
                      key={d}
                      data-testid={`weekly-menu-day-${d}`}
                      onDragOver={(e) => onDragOver(e, d)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, d)}
                      className={`rounded-xl p-3 ring-1 transition-all ${isDragOver ? "bg-amber-500/15 ring-amber-400 scale-[1.02]" : isToday ? "bg-amber-500/8 ring-amber-500/50 shadow-lg shadow-amber-500/10" : "bg-amber-500/5 ring-amber-500/15 hover:ring-amber-500/30"} ${data.dirty ? "outline outline-1 outline-amber-400/60 outline-offset-[-1px]" : ""}`}
                    >
                      {/* Sürüklenebilir başlık */}
                      <div
                        draggable
                        onDragStart={(e) => onDragStart(e, d)}
                        data-testid={`weekly-menu-day-${d}-drag`}
                        className="flex items-center justify-between mb-2 cursor-move select-none group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical className="h-3.5 w-3.5 text-amber-300/40 group-hover:text-amber-300/80 transition-colors shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-bold capitalize ${isToday ? "text-amber-100" : "text-amber-50"}`}>{lbl.name}</span>
                              {isToday && <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-400 text-[#1a1410]">Bugün</span>}
                            </div>
                            <span className="text-[10px] font-mono text-amber-300/70">{lbl.day} {lbl.month}</span>
                          </div>
                        </div>
                        {data.dirty && <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider">Değişti</span>}
                      </div>

                      {/* Yemek listesi */}
                      <div className="space-y-1.5">
                        {(data.items || []).map((it, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <Input
                              value={it}
                              onChange={(e) => setItem(d, idx, e.target.value)}
                              placeholder={`Yemek ${idx + 1}`}
                              data-testid={`weekly-menu-item-${d}-${idx}`}
                              className="h-7 text-xs bg-surface/60 border-amber-500/20 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => removeItem(d, idx)}
                              data-testid={`weekly-menu-item-del-${d}-${idx}`}
                              className="p-1 rounded text-rose-400 hover:bg-rose-500/15"
                              aria-label="Sil"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addItem(d)}
                          data-testid={`weekly-menu-add-${d}`}
                          className="w-full flex items-center justify-center gap-1 py-1 rounded-md text-[10px] text-amber-300/80 hover:bg-amber-500/10 hover:text-amber-200 transition-colors border border-dashed border-amber-500/20"
                        >
                          <Plus className="h-3 w-3" /> Yemek ekle
                        </button>
                      </div>

                      {/* Notlar */}
                      <textarea
                        value={data.notes}
                        onChange={(e) => setNotes(d, e.target.value)}
                        placeholder="Not (ops.)"
                        data-testid={`weekly-menu-notes-${d}`}
                        rows={1}
                        className="w-full mt-2 px-2 py-1 text-[11px] italic bg-surface/40 border border-amber-500/10 rounded text-amber-100/90 placeholder-amber-200/30 outline-none focus:border-amber-500/40 resize-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-amber-500/15 flex items-center justify-between gap-2 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={copyToNextWeek}
              disabled={loading || saving}
              data-testid="copy-to-next-week"
              className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10 h-9 text-xs"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Sonraki Haftaya Kopyala
            </Button>
            <div className="flex items-center gap-2">
              {dirtyCount > 0 && (
                <span className="text-xs text-amber-300/80">{dirtyCount} gün değişti</span>
              )}
              <Button
                onClick={saveAll}
                disabled={saving || loading}
                data-testid="weekly-menu-save"
                className="bg-amber-500 hover:bg-amber-600 text-[#1a1410] font-bold h-9"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Tümünü Kaydet
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
