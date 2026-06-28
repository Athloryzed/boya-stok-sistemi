/**
 * WarehouseTransferLogDialog — Depo transfer log görüntüleme dialog'u.
 * Filtre: tip (bobin/marka_stok), depo (DEPO1/DEPO2).
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { ArrowRight, RefreshCw, History as HistoryIcon, Search } from "lucide-react";
import { Input } from "./ui/input";
import { getWHStyle } from "./WarehouseBadgePicker";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
function auth() {
  try { return { Authorization: `Bearer ${JSON.parse(localStorage.getItem("app_session"))?.token}` }; }
  catch { return {}; }
}

export default function WarehouseTransferLogDialog({ open, onOpenChange, defaultWarehouse = "all", defaultItemType = "all" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState(defaultItemType);
  const [filterWh, setFilterWh] = useState(defaultWarehouse);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterType !== "all") params.set("item_type", filterType);
      if (filterWh !== "all") params.set("warehouse", filterWh);
      const res = await axios.get(`${API}/warehouse-transfers?${params}`, { headers: auth() });
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setLogs([]);
    } finally { setLoading(false); }
  }, [open, filterType, filterWh]);

  useEffect(() => { load(); }, [load]);

  // Live refresh on warehouse changes (when dialog open)
  useEffect(() => {
    if (!open) return;
    const handler = () => load();
    window.addEventListener("warehouse:changed", handler);
    return () => window.removeEventListener("warehouse:changed", handler);
  }, [open, load]);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.item_name || "").toLowerCase().includes(s)
      || (l.by_user || "").toLowerCase().includes(s)
      || (l.notes || "").toLowerCase().includes(s);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto bg-[#1a1410] border-amber-500/30" data-testid="wh-transfer-log-dialog">
        <DialogHeader>
          <DialogTitle className="text-amber-300 flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" /> Depo Transfer Geçmişi
          </DialogTitle>
          <DialogDescription className="text-zinc-500">Bobin ve Marka/Stok için tüm depo değişiklikleri.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Filtreler */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">Tip:</span>
              {[
                { v: "all", label: "Hepsi" },
                { v: "bobin", label: "Bobin" },
                { v: "marka_stok", label: "Marka Stok" },
              ].map(o => (
                <button key={o.v} onClick={() => setFilterType(o.v)} data-testid={`log-filter-type-${o.v}`}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                    filterType === o.v
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                  }`}>{o.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">Depo:</span>
              {[
                { v: "all", label: "Hepsi" },
                { v: "DEPO1", label: "Depo 1" },
                { v: "DEPO2", label: "Depo 2" },
              ].map(o => (
                <button key={o.v} onClick={() => setFilterWh(o.v)} data-testid={`log-filter-wh-${o.v}`}
                  className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                    filterWh === o.v
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                  }`}>{o.label}</button>
              ))}
            </div>
            <button onClick={load} className="ml-auto text-zinc-500 hover:text-amber-300 inline-flex items-center gap-1 text-xs" data-testid="log-refresh">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Yenile
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ürün adı / kullanıcı / not"
              className="pl-9 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-9 text-sm"
              data-testid="log-search-input"
            />
          </div>

          {/* Liste */}
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-zinc-600 text-sm" data-testid="log-empty">
                {loading ? "Yükleniyor…" : "Henüz transfer kaydı yok"}
              </div>
            )}
            {filtered.map(l => {
              const fromS = getWHStyle(l.from_warehouse || "UNASSIGNED");
              const toS = getWHStyle(l.to_warehouse || "UNASSIGNED");
              return (
                <div key={l.id} className="bg-[#0d0907]/60 border border-amber-500/10 rounded-lg p-3" data-testid={`log-row-${l.id}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${l.item_type === "bobin" ? "bg-sky-500/10 text-sky-300 border-sky-500/30" : "bg-violet-500/10 text-violet-300 border-violet-500/30"}`}>
                      {l.item_type === "bobin" ? "BOBİN" : "MARKA STOK"}
                    </span>
                    <span className="text-sm text-zinc-200 font-medium truncate">{l.item_name || l.item_id?.slice(0, 8)}</span>
                    <span className="ml-auto text-[10px] text-zinc-500">{l.at ? new Date(l.at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full border ${fromS.bg} ${fromS.text} ${fromS.border} font-semibold`}>{fromS.label}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
                    <span className={`px-2 py-0.5 rounded-full border ${toS.bg} ${toS.text} ${toS.border} font-semibold`}>{toS.label}</span>
                    <span className="ml-auto text-[11px] text-zinc-500 truncate">{l.by_user || "-"}</span>
                  </div>
                  {l.notes && <div className="mt-1.5 text-[11px] text-zinc-500 italic">&quot;{l.notes}&quot;</div>}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
