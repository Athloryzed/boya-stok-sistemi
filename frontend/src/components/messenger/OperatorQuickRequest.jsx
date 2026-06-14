/**
 * OperatorQuickRequest — Operatör panelinde sağ alt FAB
 * Tek dokunuşla Bobin / Boya / Bakım / Acil Yardım talebi
 */
import React, { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Zap, Package, Paintbrush, Wrench, AlertOctagon, X, Send } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAINT_COLORS = ["Beyaz", "Siyah", "Mavi", "Lacivert", "Refleks", "Kırmızı", "Magenta", "Rhodam", "Sarı", "Gold", "Gümüş", "Pasta"];
const BOBIN_QUICK_QTY = [3, 5, 10, 20];

export default function OperatorQuickRequest({ machine, operatorName }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("menu"); // menu | bobin | paint | maintenance | emergency
  const [bobinQty, setBobinQty] = useState("");
  const [paintColor, setPaintColor] = useState("Beyaz");
  const [paintQty, setPaintQty] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  if (!machine) return null;

  const reset = () => {
    setView("menu");
    setBobinQty("");
    setPaintQty("");
    setPaintColor("Beyaz");
    setNote("");
    setSending(false);
  };

  const close = () => { setOpen(false); setTimeout(reset, 200); };

  const send = async (payload) => {
    setSending(true);
    try {
      const token = (() => {
        try {
          const s = JSON.parse(localStorage.getItem("app_session") || "null");
          return s?.token || null;
        } catch (_) { return null; }
      })();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/chat/quick-request`, {
        ...payload,
        machine_id: machine.id,
        machine_name: machine.name,
      }, { headers });
      toast.success("Talep gönderildi!");
      close();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Talep gönderilemedi");
      setSending(false);
    }
  };

  return (
    <>
      {/* FAB — Sağ alt (Messenger sol altta, çakışmaz) */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 250 }}
        onClick={() => setOpen(true)}
        data-testid="quick-request-fab"
        aria-label="Hızlı Talep — Bobin, Boya, Bakım veya Acil Yardım"
        className="fixed bottom-5 right-5 z-40 h-14 px-4 sm:px-5 rounded-full bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 shadow-xl shadow-rose-500/40 flex items-center gap-2 text-white font-bold text-sm hover:scale-105 active:scale-95 transition-transform border border-rose-300/50"
      >
        <Zap className="h-5 w-5" />
        <span className="hidden sm:inline">Hızlı Talep</span>
      </motion.button>

      {/* Drawer / Bottom Sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={close}
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 240 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-[#1a1410] to-[#0c0904] border-t border-amber-500/30 rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-request-title"
              data-testid="quick-request-sheet"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 id="quick-request-title" className="text-base font-bold text-white flex items-center gap-2 font-heading">
                    <Zap className="w-5 h-5 text-rose-400" />
                    {view === "menu" ? "Hızlı Talep" :
                     view === "bobin" ? "Bobin Talebi" :
                     view === "paint" ? "Boya Talebi" :
                     view === "maintenance" ? "Bakım Talebi" :
                     "Acil Yardım"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{machine.name} · {operatorName}</p>
                </div>
                <button
                  onClick={close}
                  className="text-zinc-500 hover:text-white text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
                  aria-label="Kapat"
                  data-testid="quick-request-close"
                >×</button>
              </div>

              {/* MENU VIEW */}
              {view === "menu" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setView("bobin")}
                    data-testid="quick-bobin-btn"
                    className="bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 border border-emerald-500/40 rounded-xl p-5 flex flex-col items-center gap-2 hover:scale-[1.03] active:scale-95 transition-transform"
                  >
                    <Package className="w-8 h-8 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-200">Bobin İste</span>
                  </button>
                  <button
                    onClick={() => setView("paint")}
                    data-testid="quick-paint-btn"
                    className="bg-gradient-to-br from-purple-500/25 to-purple-600/10 border border-purple-500/40 rounded-xl p-5 flex flex-col items-center gap-2 hover:scale-[1.03] active:scale-95 transition-transform"
                  >
                    <Paintbrush className="w-8 h-8 text-purple-400" />
                    <span className="text-sm font-bold text-purple-200">Boya İste</span>
                  </button>
                  <button
                    onClick={() => setView("maintenance")}
                    data-testid="quick-maintenance-btn"
                    className="bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/40 rounded-xl p-5 flex flex-col items-center gap-2 hover:scale-[1.03] active:scale-95 transition-transform"
                  >
                    <Wrench className="w-8 h-8 text-amber-400" />
                    <span className="text-sm font-bold text-amber-200">Bakım Talep Et</span>
                  </button>
                  <button
                    onClick={() => setView("emergency")}
                    data-testid="quick-emergency-btn"
                    className="bg-gradient-to-br from-rose-500/40 to-rose-700/20 border-2 border-rose-500/60 rounded-xl p-5 flex flex-col items-center gap-2 hover:scale-[1.03] active:scale-95 transition-transform animate-pulse"
                  >
                    <AlertOctagon className="w-8 h-8 text-rose-300" />
                    <span className="text-sm font-bold text-rose-100">ACİL YARDIM</span>
                  </button>
                </div>
              )}

              {/* BOBIN */}
              {view === "bobin" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">Hızlı miktar seçin:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {BOBIN_QUICK_QTY.map((q) => (
                        <button
                          key={q}
                          onClick={() => setBobinQty(String(q))}
                          data-testid={`bobin-qty-${q}`}
                          className={`py-3 rounded-lg font-bold text-lg transition-colors ${
                            bobinQty === String(q)
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"
                              : "bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Veya özel miktar:</label>
                    <input
                      type="number" min="1" max="100"
                      value={bobinQty}
                      onChange={(e) => setBobinQty(e.target.value)}
                      placeholder="Adet"
                      data-testid="bobin-qty-input"
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-base focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setView("menu")} className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-semibold">Geri</button>
                    <button
                      onClick={() => send({ kind: "bobin", quantity: parseInt(bobinQty) || 1 })}
                      disabled={!bobinQty || sending}
                      data-testid="bobin-send"
                      className="flex-2 py-3 px-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-emerald-500/30"
                    >
                      {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Gönder</>}
                    </button>
                  </div>
                </div>
              )}

              {/* PAINT */}
              {view === "paint" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Renk:</label>
                    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                      {PAINT_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setPaintColor(c)}
                          data-testid={`paint-color-${c}`}
                          className={`py-2 px-2 rounded-lg text-sm font-semibold transition-colors ${
                            paintColor === c
                              ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                              : "bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Miktar (L):</label>
                    <input
                      type="number" min="0.5" step="0.5" max="50"
                      value={paintQty}
                      onChange={(e) => setPaintQty(e.target.value)}
                      placeholder="Litre"
                      data-testid="paint-qty-input"
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-base focus:border-purple-400 focus:ring-4 focus:ring-purple-400/20 outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setView("menu")} className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-semibold">Geri</button>
                    <button
                      onClick={() => send({ kind: "paint", color: paintColor, quantity_l: parseFloat(paintQty) || 1 })}
                      disabled={!paintQty || sending}
                      data-testid="paint-send"
                      className="flex-2 py-3 px-6 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-purple-500/30"
                    >
                      {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Gönder</>}
                    </button>
                  </div>
                </div>
              )}

              {/* MAINTENANCE */}
              {view === "maintenance" && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Açıklama (opsiyonel):</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Örn: Boya basıncı düştü, kalıp sıkıştı..."
                      rows={4}
                      data-testid="maintenance-note"
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20 outline-none resize-none"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Bakım talebiniz <strong className="text-amber-300">Yönetim</strong> ve <strong className="text-amber-300">Plan</strong> ekibine anında iletilecek.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setView("menu")} className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-semibold">Geri</button>
                    <button
                      onClick={() => send({ kind: "maintenance", note })}
                      disabled={sending}
                      data-testid="maintenance-send"
                      className="flex-2 py-3 px-6 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-zinc-900 font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-amber-500/30"
                    >
                      {sending ? <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Gönder</>}
                    </button>
                  </div>
                </div>
              )}

              {/* EMERGENCY */}
              {view === "emergency" && (
                <div className="space-y-4">
                  <div className="bg-rose-500/20 border-2 border-rose-500/50 rounded-xl p-4">
                    <p className="text-sm text-rose-100 font-semibold flex items-start gap-2">
                      <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>
                        Acil yardım talebiniz <strong>Yönetim, Plan, Operatör ve Depo</strong> ekiplerinin <strong>HEPSİNE</strong> anında iletilecek ve yüksek öncelikli tarayıcı bildirimi yollayacaktır. Sadece <strong>gerçek acil durumlarda</strong> kullanın.
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Durumu kısaca açıklayın (opsiyonel):</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Örn: Bobin sıkıştı, motor durdu..."
                      rows={3}
                      data-testid="emergency-note"
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/15 text-white text-sm focus:border-rose-400 focus:ring-4 focus:ring-rose-400/20 outline-none resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setView("menu")} className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-semibold">Geri</button>
                    <button
                      onClick={() => send({ kind: "emergency", note })}
                      disabled={sending}
                      data-testid="emergency-send"
                      className="flex-2 py-3 px-6 rounded-lg bg-gradient-to-br from-rose-500 to-rose-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-rose-500/50 border border-rose-300/40"
                    >
                      {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><AlertOctagon className="w-4 h-4" /> ACİL YARDIM GÖNDER</>}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
