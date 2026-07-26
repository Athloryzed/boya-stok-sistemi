/**
 * AIAssistant — tüm panellerde kullanılan ortak AI asistanı.
 *
 * Kullanım:  <AIAssistant panel="plan" />
 * Panel değerleri: plan | boyaci | depo | bobin | marka_stok | sofor | paint | operator | yonetim
 * Backend: POST /api/ai/panel-chat · GET/DELETE /api/ai/panel-history
 * Sohbet geçmişi kullanıcı + panel bazlı kalıcıdır (MongoDB).
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, X, Trash2, Bot, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const PANEL_SUGGESTIONS = {
  plan: ["Bugün hangi makine boş, hangi işi oraya alalım?", "Kalan koli yükü nasıl dağılmış?", "Renk geçişine göre sırayı nasıl iyileştiririm?"],
  boyaci: ["Sıradaki işleri renk geçişine göre nasıl sıralamalıyım?", "Hangi iş en uzun süredir bekliyor?", "Hangi makine boşta?"],
  depo: ["Bekleyen talepler neler?", "Hangi boyalar kritik seviyede?", "Bugün nelere hazırlık yapmalıyım?"],
  bobin: ["Kritik seviyedeki bobinler hangileri?", "Son hareketleri özetle", "Hangi bobinden sipariş vermeliyim?"],
  marka_stok: ["Düşük stoktaki ürünler hangileri?", "Stok durumunu özetle"],
  sofor: ["Bugün hangi sevkiyatlar var?", "Aktif sevkiyatları özetle"],
  paint: ["Hangi boyalar bitmek üzere?", "Sipariş listesi öner"],
  operator: ["Bu vardiyada nelere dikkat etmeliyim?", "Sıradaki işim için öneri ver"],
  yonetim: ["Fabrikanın bugünkü durumunu özetle", "Darboğazlar neler?"],
};

const AIAssistant = ({ panel, accent = "#F472B6", label = "AI Asistan" }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState("");
  const endRef = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ai/panel-history?panel=${panel}`);
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
    } catch (e) {
      if (e?.response?.status === 403) toast.error("Bu panelde AI asistanı yetkiniz yok");
    }
  }, [panel]);

  useEffect(() => {
    if (!open) return;
    loadHistory();
    axios.get(`${API}/ai/panel-info`).then((r) => setModel(r.data?.model || "")).catch(() => {});
  }, [open, loadHistory]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await axios.post(`${API}/ai/panel-chat`, { panel, message: msg });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data?.reply || "—", created_at: new Date().toISOString() }]);
      if (res.data?.model) setModel(res.data.model);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "AI yanıt vermedi");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    try {
      await axios.delete(`${API}/ai/panel-history?panel=${panel}`);
      setMessages([]);
      toast.success("Sohbet geçmişi temizlendi");
    } catch {
      toast.error("Geçmiş temizlenemedi");
    }
  };

  const suggestions = PANEL_SUGGESTIONS[panel] || [];

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        data-testid={`ai-assistant-btn-${panel}`}
        title={label}
        className="h-9 w-9 xl:w-auto xl:px-3 shrink-0 border-fuchsia-500/40 text-fuchsia-400 hover:bg-fuchsia-500/10"
      >
        <Sparkles className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline">{label}</span>
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[440px] z-[9999] bg-surface border-l border-border flex flex-col"
              data-testid={`ai-assistant-drawer-${panel}`}
            >
              <div className="p-4 border-b border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${accent}, #7C3AED)` }}>
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-text-primary truncate">{label}</p>
                    <p className="text-[11px] text-text-secondary truncate">{model || "Claude"} · sadece öneri verir</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={clearHistory} data-testid={`ai-clear-${panel}`} title="Geçmişi temizle">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} data-testid={`ai-close-${panel}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid={`ai-messages-${panel}`}>
                {messages.length === 0 && !sending && (
                  <div className="space-y-3">
                    <p className="text-sm text-text-secondary">
                      Panelin canlı verisiyle konuşabilirsin. Örnek sorular:
                    </p>
                    <div className="space-y-2">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => send(s)}
                          data-testid={`ai-suggestion-${panel}-${i}`}
                          className="w-full text-left text-sm p-2.5 rounded-xl bg-surface-highlight/50 border border-border hover:border-fuchsia-500/50 text-text-primary transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                      m.role === "user"
                        ? "bg-fuchsia-600 text-white rounded-br-md"
                        : "bg-surface-highlight/70 text-text-primary border border-border rounded-bl-md"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-3.5 py-2.5 bg-surface-highlight/70 border border-border flex items-center gap-2 text-sm text-text-secondary">
                      <Loader2 className="h-4 w-4 animate-spin" /> Düşünüyor…
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="p-3 border-t border-border flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Sorunu yaz…"
                  className="bg-background border-border h-11"
                  data-testid={`ai-input-${panel}`}
                />
                <Button
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  className="h-11 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                  data-testid={`ai-send-${panel}`}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAssistant;
