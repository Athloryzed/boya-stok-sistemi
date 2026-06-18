/**
 * CustomerCombobox — Müşteri seçimi + yeni ekle inline.
 *
 * Props:
 *   value         — { id, name, code, phone } veya null
 *   onChange      — (customer) => void
 *   label         — alanın başlığı (opsiyonel, default: "Müşteri")
 *   placeholder   — search placeholder (opsiyonel)
 *   testIdPrefix  — data-testid prefix
 *   required      — Required indicator
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Search, Plus, User, X as XIcon, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function authHeaders() {
  try {
    const sess = JSON.parse(localStorage.getItem("app_session") || "null");
    return sess?.token ? { Authorization: `Bearer ${sess.token}` } : {};
  } catch {
    return {};
  }
}

export default function CustomerCombobox({
  value,
  onChange,
  label = "Müşteri",
  placeholder = "Müşteri ara veya seç...",
  testIdPrefix = "customer",
  required = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "", email: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  // Search (debounced)
  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/customers/search`, {
        params: { q, limit: 30 },
        headers: authHeaders(),
      });
      setItems(res.data || []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [open, query, search]);

  const handleSelect = (c) => {
    onChange?.({ id: c.id, name: c.name, code: c.code, phone: c.phone });
    setOpen(false);
    setQuery("");
  };

  const handleCreate = async () => {
    const name = (newCustomer.name || "").trim();
    if (!name) {
      toast.error("Müşteri adı zorunlu");
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(
        `${API}/customers`,
        newCustomer,
        { headers: authHeaders() }
      );
      const c = res.data;
      onChange?.({ id: c.id, name: c.name, code: c.code, phone: c.phone });
      toast.success(c._existed ? "Mevcut müşteri seçildi" : `${c.code} — ${c.name} eklendi`);
      setCreateOpen(false);
      setOpen(false);
      setNewCustomer({ name: "", phone: "", address: "", email: "", notes: "" });
    } catch (e) {
      toast.error("Müşteri eklenemedi");
    } finally {
      setCreating(false);
    }
  };

  const clear = (e) => {
    e?.stopPropagation();
    onChange?.(null);
    setQuery("");
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
          <User className="h-3 w-3" />
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}

      {/* Trigger — seçili müşteri veya boş input */}
      <div className="relative">
        {value ? (
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
            data-testid={`${testIdPrefix}-selected`}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-amber-300" />
              </div>
              <div className="text-left min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">{value.name}</div>
                <div className="text-[10px] font-mono text-amber-300/80 truncate">{value.code}{value.phone ? ` · ${value.phone}` : ""}</div>
              </div>
            </div>
            <span
              role="button"
              onClick={clear}
              data-testid={`${testIdPrefix}-clear`}
              className="opacity-50 group-hover:opacity-100 text-text-secondary hover:text-error transition-opacity p-1 rounded hover:bg-error/10"
              aria-label="Müşteriyi kaldır"
            >
              <XIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            data-testid={`${testIdPrefix}-open`}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-surface/40 hover:bg-surface-highlight hover:border-amber-500/40 transition-colors text-left"
          >
            <Search className="h-4 w-4 text-text-secondary shrink-0" />
            <span className="text-sm text-text-secondary">{placeholder}</span>
          </button>
        )}

        {/* Dropdown */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-xl border border-amber-500/20 bg-gradient-to-b from-[#1a1410] to-[#0c0904] shadow-2xl shadow-black/40 overflow-hidden"
              data-testid={`${testIdPrefix}-dropdown`}
            >
              {/* Search input */}
              <div className="p-2 border-b border-amber-500/15 flex items-center gap-2">
                <Search className="h-4 w-4 text-amber-300/70 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="İsim, telefon, kod ile ara..."
                  className="flex-1 bg-transparent text-sm text-amber-50 placeholder-amber-200/40 outline-none"
                  data-testid={`${testIdPrefix}-search-input`}
                />
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />}
              </div>

              {/* Sonuç listesi */}
              <div className="max-h-64 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="py-6 text-center text-xs text-amber-200/60">
                    {query ? "Müşteri bulunamadı" : "Müşteri arayın veya yeni ekleyin"}
                  </div>
                ) : (
                  items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c)}
                      data-testid={`${testIdPrefix}-item-${c.id}`}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-amber-500/10 active:bg-amber-500/15 border-b border-amber-500/5 last:border-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-[10px] font-black text-amber-300">
                        {c.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-amber-50 truncate">{c.name}</div>
                        <div className="text-[10px] font-mono text-amber-300/60 truncate">
                          {c.code}{c.phone ? ` · ${c.phone}` : ""}{c.total_jobs ? ` · ${c.total_jobs} sipariş` : ""}
                        </div>
                      </div>
                      {value?.id === c.id && <Check className="h-4 w-4 text-amber-400 shrink-0" />}
                    </button>
                  ))
                )}
              </div>

              {/* Yeni Müşteri Ekle */}
              <div className="border-t border-amber-500/20 p-1.5">
                {!createOpen ? (
                  <button
                    type="button"
                    onClick={() => { setCreateOpen(true); setNewCustomer((s) => ({ ...s, name: query })); }}
                    data-testid={`${testIdPrefix}-add-new`}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 text-sm font-bold transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Yeni Müşteri Ekle{query ? `: "${query}"` : ""}
                  </button>
                ) : (
                  <div className="p-2 space-y-2">
                    <Input
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                      placeholder="Müşteri adı *"
                      data-testid={`${testIdPrefix}-new-name`}
                      className="bg-surface/60 border-amber-500/20 text-sm h-9"
                      autoFocus
                    />
                    <Input
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      placeholder="Telefon (opsiyonel)"
                      data-testid={`${testIdPrefix}-new-phone`}
                      className="bg-surface/60 border-amber-500/20 text-sm h-9"
                    />
                    <Input
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                      placeholder="Adres (opsiyonel)"
                      data-testid={`${testIdPrefix}-new-address`}
                      className="bg-surface/60 border-amber-500/20 text-sm h-9"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setCreateOpen(false)}
                        variant="outline"
                        className="flex-1 h-8 text-xs"
                      >
                        İptal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreate}
                        disabled={creating || !newCustomer.name.trim()}
                        data-testid={`${testIdPrefix}-new-save`}
                        className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-[#1a1410]"
                      >
                        {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ekle"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
