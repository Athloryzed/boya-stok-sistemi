/**
 * WarehouseBadgePicker — Bir ürünün depo atamasını gösterip değiştirir.
 * Props: itemType ("bobin"|"marka_stok"), itemId, currentWarehouse, onChange?
 */
import React, { useState } from "react";
import axios from "axios";
import { Warehouse, Check, X as XIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
function auth() {
  try { return { Authorization: `Bearer ${JSON.parse(localStorage.getItem("app_session"))?.token}` }; }
  catch { return {}; }
}

export const WH_COLORS = {
  DEPO1: { bg: "bg-blue-500/15", text: "text-blue-300", border: "border-blue-500/40", label: "Depo 1" },
  DEPO2: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40", label: "Depo 2" },
  UNASSIGNED: { bg: "bg-zinc-500/15", text: "text-zinc-300", border: "border-zinc-500/40", label: "Atanmamış" },
};

export function getWHStyle(w) {
  return WH_COLORS[w] || WH_COLORS.UNASSIGNED;
}

export default function WarehouseBadgePicker({ itemType, itemId, currentWarehouse, onChange, size = "sm", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const w = currentWarehouse || "UNASSIGNED";
  const style = getWHStyle(w);

  const change = async (to) => {
    if (to === currentWarehouse) { setOpen(false); return; }
    setBusy(true);
    try {
      await axios.post(`${API}/warehouse-transfer`, {
        item_type: itemType, item_id: itemId, to_warehouse: to === "UNASSIGNED" ? "" : to,
      }, { headers: auth() });
      toast.success(`${getWHStyle(to).label}'ye taşındı`);
      onChange?.(to === "UNASSIGNED" ? null : to);
      // Trigger global summary refresh
      try { window.dispatchEvent(new CustomEvent("warehouse:changed", { detail: { itemType, itemId, to } })); } catch {}
      setOpen(false);
    } catch (e) {
      toast.error("Transfer başarısız");
    } finally { setBusy(false); }
  };

  const sizeCls = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen(v => !v); }}
        disabled={disabled || busy}
        data-testid={`wh-badge-${itemType}-${itemId}`}
        className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border} ${sizeCls} ${disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-105 active:scale-95 transition-transform"}`}
      >
        <Warehouse className="h-3 w-3" />
        {style.label}
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 min-w-[160px] rounded-lg bg-[#1a1410] border border-amber-500/30 shadow-2xl overflow-hidden">
            {["DEPO1", "DEPO2", "UNASSIGNED"].map(opt => {
              const s = getWHStyle(opt);
              const active = opt === w || (opt === "UNASSIGNED" && !currentWarehouse);
              return (
                <button
                  key={opt}
                  onClick={(e) => { e.stopPropagation(); change(opt); }}
                  data-testid={`wh-pick-${opt}-${itemId}`}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm hover:bg-amber-500/10 transition-colors border-b border-amber-500/10 last:border-0 ${active ? "bg-amber-500/5" : ""}`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.bg.replace('/15', '')}`} />
                  <span className={`flex-1 ${s.text}`}>{s.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
