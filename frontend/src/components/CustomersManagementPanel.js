/**
 * CustomersManagementPanel — Yönetim'de "Müşteriler" tab'ı.
 * Liste + arama + ekleme + düzenleme + detay açma.
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { User, Search, Plus, Edit2, Archive, Phone, Mail, MapPin, Package, Loader2, Tag } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";
import CustomerDetailDialog from "./CustomerDetailDialog";
import CustomerEditDialog from "./CustomerEditDialog";

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

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
  } catch { return "-"; }
}

export default function CustomersManagementPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(null); // customer obj veya null
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/customers`, {
        params: { q: q || undefined, include_archived: includeArchived },
        headers: authHeaders(),
      });
      setItems(res.data || []);
    } catch (e) {
      toast.error("Müşteri listesi alınamadı");
    } finally {
      setLoading(false);
    }
  }, [q, includeArchived]);

  useEffect(() => {
    const t = setTimeout(fetchList, 200);
    return () => clearTimeout(t);
  }, [fetchList]);

  const handleArchive = async (c) => {
    if (!window.confirm(`"${c.name}" müşterisini arşivlemek istiyor musun? (Siparişleri kalır, listeden gizlenir)`)) return;
    try {
      await axios.delete(`${API}/customers/${c.id}`, { headers: authHeaders() });
      toast.success("Müşteri arşivlendi");
      fetchList();
    } catch (e) {
      toast.error("Arşivlenemedi");
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="bg-surface border-border">
        <CardContent className="p-4 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="İsim, telefon, kod ile ara..."
              data-testid="customer-search-input"
              className="pl-9 bg-background border-border"
            />
          </div>
          <label className="text-xs text-text-secondary flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface-highlight cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-amber-500"
            />
            Arşivli
          </label>
          <Button
            onClick={() => setCreating(true)}
            data-testid="customer-add-btn"
            className="bg-amber-500 hover:bg-amber-600 text-[#1a1410] font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Yeni Müşteri
          </Button>
        </CardContent>
      </Card>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Yükleniyor...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-text-secondary">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Henüz müşteri yok. Yeni müşteri ekleyerek başlayın.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="customers-grid">
          {items.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              data-testid={`customer-card-${c.id}`}
              onClick={() => setDetailId(c.id)}
              className={`group cursor-pointer rounded-xl p-4 ring-1 transition-all hover:-translate-y-0.5 ${c.archived ? "bg-zinc-500/5 ring-zinc-500/20 opacity-70" : "bg-amber-500/5 ring-amber-500/20 hover:ring-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10"}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 ring-1 ring-amber-500/40 flex items-center justify-center shrink-0 text-amber-300 font-black text-sm">
                    {c.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-text-primary truncate">{c.name}</div>
                    <div className="text-[10px] font-mono text-amber-300/70">{c.code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                    data-testid={`customer-edit-${c.id}`}
                    className="p-1.5 rounded hover:bg-amber-500/15 text-amber-300"
                    title="Düzenle"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  {!c.archived && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchive(c); }}
                      data-testid={`customer-archive-${c.id}`}
                      className="p-1.5 rounded hover:bg-rose-500/15 text-rose-400"
                      title="Arşivle"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-text-secondary">
                {c.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0" /> <span className="font-mono">{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.address && (
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 mt-0.5" /> <span className="line-clamp-1">{c.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-amber-500/15 flex items-center justify-between text-[10px] text-amber-300/80">
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3 w-3" /> {c.total_jobs || 0} sipariş
                </span>
                <span className="font-mono">Son: {fmtDate(c.last_order_at)}</span>
              </div>
              {c.archived && (
                <div className="mt-2 text-[10px] text-zinc-400 italic flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Arşivli
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <CustomerDetailDialog
        customerId={detailId}
        open={!!detailId}
        onClose={() => setDetailId(null)}
        onEdit={(c) => { setDetailId(null); setEditing(c); }}
      />

      <CustomerEditDialog
        open={creating || !!editing}
        customer={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={() => { fetchList(); setEditing(null); setCreating(false); }}
      />
    </div>
  );
}
