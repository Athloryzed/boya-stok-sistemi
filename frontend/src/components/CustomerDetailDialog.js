/**
 * CustomerDetailDialog — Müşteri detay görünümü + aktif/geçmiş siparişler.
 * Hem Yönetim'de (Müşteriler listesinden) hem Plan'da (iş kartından) açılır.
 *
 * Props:
 *   customerId: string | null  (null = kapalı)
 *   open: bool
 *   onClose: () => void
 *   onEdit?: (customer) => void  (opsiyonel — düzenleme dialog'u açar)
 */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { User, Phone, MapPin, Mail, Calendar, Package, X as XIcon, Edit2, Loader2, ClipboardList, CheckCircle, Tag } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

function statusBadge(s) {
  const map = {
    pending: { label: "Sırada", c: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    in_progress: { label: "Devam Ediyor", c: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
    paused: { label: "Durakladı", c: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
    completed: { label: "Tamamlandı", c: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    cancelled: { label: "İptal", c: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  };
  const v = map[s] || { label: s, c: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" };
  return <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${v.c}`}>{v.label}</span>;
}

export default function CustomerDetailDialog({ customerId, open, onClose, onEdit }) {
  const [customer, setCustomer] = useState(null);
  const [jobs, setJobs] = useState({ active: [], history: [], active_count: 0, history_count: 0, total_jobs: 0 });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("active");

  useEffect(() => {
    if (!open || !customerId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [c, j] = await Promise.all([
          axios.get(`${API}/customers/${customerId}`, { headers: authHeaders() }),
          axios.get(`${API}/customers/${customerId}/jobs`, { headers: authHeaders() }),
        ]);
        if (!cancelled) {
          setCustomer(c.data);
          setJobs(j.data);
        }
      } catch (_) { /* noop */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, customerId]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
      />
      <div className="fixed inset-0 z-[81] flex items-center justify-center p-3 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 24, stiffness: 240 }}
          className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-b from-[#1a1410] to-[#0c0904] ring-1 ring-amber-500/30 pointer-events-auto"
          data-testid="customer-detail-dialog"
          role="dialog"
          aria-modal="true"
        >
          {/* Üst altın çizgi */}
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-amber-500/15 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 ring-1 ring-amber-500/40 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                {loading && !customer ? (
                  <div className="h-5 w-32 bg-amber-500/10 rounded animate-pulse" />
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-heading font-black text-amber-50 truncate" data-testid="customer-detail-name">
                        {customer?.name || "..."}
                      </h3>
                      {customer?.code && (
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {customer.code}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-300/70 mt-0.5">
                      {customer?.total_jobs || 0} sipariş · Son sipariş: {fmtDate(customer?.last_order_at)}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onEdit && customer && (
                <Button variant="outline" size="icon" onClick={() => onEdit(customer)} data-testid="customer-detail-edit"
                  className="h-9 w-9 border-amber-500/30 text-amber-200 hover:bg-amber-500/10">
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={onClose} data-testid="customer-detail-close"
                className="h-9 w-9 border-amber-500/30 text-amber-200 hover:bg-amber-500/10">
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col" style={{ maxHeight: "calc(88vh - 4.5rem)" }}>
            {/* Meta bilgi */}
            <div className="px-4 sm:px-6 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-b border-amber-500/10">
              {customer?.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                  <Phone className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-amber-100 font-mono">{customer.phone}</span>
                </a>
              )}
              {customer?.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 transition-colors">
                  <Mail className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-amber-100 truncate">{customer.email}</span>
                </a>
              )}
              {customer?.address && (
                <div className="sm:col-span-2 flex items-start gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5">
                  <MapPin className="h-3.5 w-3.5 text-amber-300 mt-0.5 shrink-0" />
                  <span className="text-amber-100">{customer.address}</span>
                </div>
              )}
              {customer?.notes && (
                <div className="sm:col-span-2 flex items-start gap-2 px-2 py-1.5 rounded-lg bg-amber-500/5">
                  <Tag className="h-3.5 w-3.5 text-amber-300 mt-0.5 shrink-0" />
                  <span className="text-amber-100/90 italic">{customer.notes}</span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-4 sm:px-6 pt-3 flex gap-1 border-b border-amber-500/10">
              <button
                onClick={() => setTab("active")}
                data-testid="customer-tab-active"
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-t-md transition-colors ${tab === "active" ? "bg-amber-500/15 text-amber-200 border-b-2 border-amber-400" : "text-amber-300/60 hover:text-amber-200"}`}
              >
                <ClipboardList className="inline h-3.5 w-3.5 mr-1.5" />
                Aktif <span className="ml-1 px-1.5 rounded bg-amber-500/20">{jobs.active_count}</span>
              </button>
              <button
                onClick={() => setTab("history")}
                data-testid="customer-tab-history"
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-t-md transition-colors ${tab === "history" ? "bg-amber-500/15 text-amber-200 border-b-2 border-amber-400" : "text-amber-300/60 hover:text-amber-200"}`}
              >
                <CheckCircle className="inline h-3.5 w-3.5 mr-1.5" />
                Geçmiş <span className="ml-1 px-1.5 rounded bg-amber-500/20">{jobs.history_count}</span>
              </button>
            </div>

            {/* İş Listesi */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 space-y-2">
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-amber-500/5 animate-pulse" />)}
                </div>
              ) : (
                <>
                  {(tab === "active" ? jobs.active : jobs.history).length === 0 ? (
                    <div className="py-10 text-center text-sm text-amber-200/60">
                      {tab === "active" ? "Aktif sipariş yok." : "Geçmiş sipariş yok."}
                    </div>
                  ) : (
                    (tab === "active" ? jobs.active : jobs.history).map((job) => (
                      <div key={job.id} data-testid={`customer-job-${job.id}`}
                        className="p-3 rounded-lg bg-amber-500/5 ring-1 ring-amber-500/15 hover:ring-amber-500/30 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-amber-50 truncate">{job.name}</span>
                              {statusBadge(job.status)}
                            </div>
                            <div className="text-[11px] text-amber-300/70 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>📦 {job.completed_koli}/{job.koli_count} koli</span>
                              <span>🏭 {job.machine_name}</span>
                              {job.colors && <span>🎨 {job.colors}</span>}
                              {job.format && <span>📐 {job.format}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] text-amber-300/60 font-mono">
                              {fmtDate(job.completed_at || job.created_at)}
                            </div>
                            {job.koli_count > 0 && (
                              <div className="text-[10px] text-amber-200/60 mt-0.5">
                                %{Math.round((job.completed_koli / job.koli_count) * 100)}
                              </div>
                            )}
                          </div>
                        </div>
                        {job.notes && <p className="text-[11px] italic text-amber-200/60 mt-2">📝 {job.notes}</p>}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
