/**
 * WarehouseSummaryCard — Depo1/Depo2/Atanmamış için özet kartı.
 * Yönetim, Plan, Depo, Bobin, Marka Stok panellerinden çağrılabilir.
 *
 * Props:
 *  - compact?: true (single-row mini görünüm) | false (3-card detaylı görünüm — default)
 *  - className?: string
 *  - onClick?: fn (kartın tıklanması — örn. detay modali açmak için)
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Warehouse, Package, Layers, AlertTriangle, RefreshCw } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
function auth() {
  try { return { Authorization: `Bearer ${JSON.parse(localStorage.getItem("app_session"))?.token}` }; }
  catch { return {}; }
}

const META = {
  DEPO1:      { label: "Depo 1",     accent: "blue",    text: "text-blue-300",     bg: "bg-blue-500/10",    border: "border-blue-500/30",    dot: "bg-blue-400" },
  DEPO2:      { label: "Depo 2",     accent: "emerald", text: "text-emerald-300",  bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  UNASSIGNED: { label: "Atanmamış",  accent: "zinc",    text: "text-zinc-300",     bg: "bg-zinc-500/10",    border: "border-zinc-500/30",    dot: "bg-zinc-400" },
};

const ORDER = ["DEPO1", "DEPO2", "UNASSIGNED"];

export default function WarehouseSummaryCard({ compact = false, className = "", onClick = null, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await axios.get(`${API}/warehouse-summary`, { headers: auth() });
      setData(res.data);
    } catch (e) {
      setErr("Depo özeti yüklenemedi");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Listen for global warehouse changes triggered by WarehouseBadgePicker
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("warehouse:changed", handler);
    return () => window.removeEventListener("warehouse:changed", handler);
  }, [load]);

  if (loading && !data) {
    return (
      <div className={`rounded-xl border border-white/[0.06] bg-[#1a1f2e]/40 p-4 ${className}`} data-testid="wh-summary-loading">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" /> Depo özeti yükleniyor…
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className={`rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300 ${className}`} data-testid="wh-summary-error">{err}</div>
    );
  }
  if (!data) return null;

  if (compact) {
    return (
      <div className={`rounded-xl border border-white/[0.06] bg-[#1a1f2e]/40 p-3 ${className}`} data-testid="wh-summary-compact">
        <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
          <Warehouse className="h-3 w-3" /> Depo Özeti
          <button onClick={load} className="ml-auto text-zinc-600 hover:text-amber-400" title="Yenile" data-testid="wh-summary-refresh">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ORDER.map(w => {
            const meta = META[w];
            const d = data[w] || { bobin_count: 0, marka_stok_count: 0, bobin_critical: 0, marka_stok_critical: 0 };
            const crit = (d.bobin_critical || 0) + (d.marka_stok_critical || 0);
            return (
              <button
                key={w}
                type="button"
                onClick={() => onClick?.(w)}
                data-testid={`wh-summary-compact-${w}`}
                className={`rounded-lg px-2 py-2 border ${meta.bg} ${meta.border} ${meta.text} text-left hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-80">
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums">{d.bobin_count + d.marka_stok_count}</span>
                  <span className="text-[10px] opacity-60">öğe</span>
                  {crit > 0 && (
                    <span className="ml-auto text-[10px] text-red-300 font-semibold inline-flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> {crit}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] opacity-60">
                  <span title="Bobin">B:{d.bobin_count}</span> · <span title="Marka Stok">M:{d.marka_stok_count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Detaylı (3 büyük kart)
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`} data-testid="wh-summary-full">
      {ORDER.map(w => {
        const meta = META[w];
        const d = data[w] || { bobin_count: 0, marka_stok_count: 0, bobin_critical: 0, marka_stok_critical: 0 };
        const crit = (d.bobin_critical || 0) + (d.marka_stok_critical || 0);
        return (
          <button
            key={w}
            type="button"
            onClick={() => onClick?.(w)}
            data-testid={`wh-summary-full-${w}`}
            className={`text-left rounded-xl border ${meta.border} ${meta.bg} p-4 hover:scale-[1.01] transition-transform`}
          >
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${meta.text}`}>
                <Warehouse className="h-4 w-4" />
                <span className="font-bold tracking-wider">{meta.label}</span>
              </div>
              {crit > 0 && (
                <span className="text-xs text-red-300 font-semibold inline-flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                  <AlertTriangle className="h-3 w-3" /> {crit} kritik
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-0.5">
                  <Package className="h-3 w-3" /> Bobin
                </div>
                <div className={`text-2xl font-bold tabular-nums ${meta.text}`}>{d.bobin_count}</div>
                {d.bobin_critical > 0 && (
                  <div className="text-[10px] text-red-300 mt-0.5">{d.bobin_critical} stok düşük</div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-0.5">
                  <Layers className="h-3 w-3" /> Marka Stok
                </div>
                <div className={`text-2xl font-bold tabular-nums ${meta.text}`}>{d.marka_stok_count}</div>
                {d.marka_stok_critical > 0 && (
                  <div className="text-[10px] text-red-300 mt-0.5">{d.marka_stok_critical} stok düşük</div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
