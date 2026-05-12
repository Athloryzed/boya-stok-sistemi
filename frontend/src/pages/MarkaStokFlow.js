import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, ShoppingCart, History, Edit, Trash2, Download, Search,
  Sun, Moon, Package, TrendingDown, TrendingUp, Factory, X, Boxes, Tag, Send
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const arr = (v) => (Array.isArray(v) ? v : []);

/* ──────────────────────────────────────────────────────────────
   STAT TILE (modern)
   ────────────────────────────────────────────────────────────── */
const StatTile = ({ label, value, sub, gradient, icon: Icon, testid }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`relative overflow-hidden rounded-2xl p-4 ${gradient} ring-1 ring-white/10 shadow-lg`}
    data-testid={testid}
  >
    <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10 blur-2xl pointer-events-none" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-white/80 font-bold">{label}</p>
        <p className="text-3xl font-black text-white mt-1 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-white/70 mt-1">{sub}</p>}
      </div>
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  </motion.div>
);

/* ──────────────────────────────────────────────────────────────
   MARKA STOK BÖLÜMÜ
   ────────────────────────────────────────────────────────────── */
const BrandSection = ({ userData, role }) => {
  const [templates, setTemplates] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterMachine, setFilterMachine] = useState("all");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ brand: "", machine: "", color: "", quantity: "", notes: "" });
  const [isCustomBrand, setIsCustomBrand] = useState(false);

  const [isSellOpen, setIsSellOpen] = useState(false);
  const [sellTarget, setSellTarget] = useState(null);
  const [sellForm, setSellForm] = useState({ quantity: "", customer_name: "", note: "" });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ brand: "", machine: "", color: "", quantity: "", notes: "" });

  const [detailStock, setDetailStock] = useState(null);
  const [detailMovements, setDetailMovements] = useState([]);

  const fetchAll = useCallback(async () => {
    try {
      const [t, s, m, sm] = await Promise.allSettled([
        axios.get(`${API}/brand-stock/templates`),
        axios.get(`${API}/brand-stock`),
        axios.get(`${API}/brand-stock/movements?limit=200`),
        axios.get(`${API}/brand-stock/summary?days=30`),
      ]);
      if (t.status === "fulfilled") setTemplates(arr(t.value.data?.templates));
      if (s.status === "fulfilled") setStocks(arr(s.value.data));
      if (m.status === "fulfilled") setMovements(arr(m.value.data));
      if (sm.status === "fulfilled") setSummary(sm.value.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchAll();
    const i = setInterval(fetchAll, 10000);
    return () => clearInterval(i);
  }, [fetchAll]);

  const selectedBrandTpl = templates.find(t => t.brand === form.brand);
  const isKnownBrand = !!selectedBrandTpl;

  const openQuickAdd = (s) => {
    const known = templates.find(t => t.brand === s.brand);
    setIsCustomBrand(!known);
    setForm({ brand: s.brand || "", machine: s.machine || "", color: s.color || "", quantity: "", notes: "" });
    setIsAddOpen(true);
  };

  const filteredStocks = useMemo(() => stocks.filter(s => {
    if (filterBrand !== "all" && s.brand !== filterBrand) return false;
    if (filterMachine !== "all" && s.machine !== filterMachine) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.brand || "").toLowerCase().includes(q) ||
        (s.machine || "").toLowerCase().includes(q) ||
        (s.color || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q);
    }
    return true;
  }), [stocks, filterBrand, filterMachine, search]);

  const allBrands = [...new Set(stocks.map(s => s.brand).filter(Boolean))];
  const allMachines = [...new Set(stocks.map(s => s.machine).filter(Boolean))];

  const userTag = userData?.username || userData?.display_name || "depo";

  const submitAdd = async () => {
    if (!form.brand?.trim()) return toast.error("Marka girin / seçin");
    if (isKnownBrand && !form.machine?.trim()) return toast.error("Ölçü girin (örn: 20x40)");
    const q = parseInt(form.quantity, 10);
    if (!q || q <= 0) return toast.error("Geçerli adet girin");
    try {
      await axios.post(`${API}/brand-stock`, {
        brand: form.brand.trim(), machine: form.machine?.trim() || null,
        color: form.color?.trim() || null, quantity: q,
        notes: form.notes?.trim() || null, user_name: userTag,
      });
      toast.success(`+${q} adet eklendi`);
      setIsAddOpen(false); setIsCustomBrand(false);
      setForm({ brand: "", machine: "", color: "", quantity: "", notes: "" });
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Eklenemedi"); }
  };

  const submitSell = async () => {
    if (!sellTarget) return;
    const q = parseInt(sellForm.quantity, 10);
    if (!q || q <= 0) return toast.error("Geçerli adet girin");
    if (q > sellTarget.quantity) return toast.error(`Stok yetersiz (mevcut: ${sellTarget.quantity})`);
    try {
      await axios.post(`${API}/brand-stock/sell`, {
        stock_id: sellTarget.id, quantity: q,
        customer_name: sellForm.customer_name?.trim() || null,
        note: sellForm.note?.trim() || null, user_name: userTag,
      });
      toast.success(`-${q} adet satıldı`);
      setIsSellOpen(false); setSellTarget(null);
      setSellForm({ quantity: "", customer_name: "", note: "" });
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Satış kaydedilemedi"); }
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setEditForm({
      brand: s.brand || "", machine: s.machine || "", color: s.color || "",
      quantity: String(s.quantity ?? 0), notes: s.notes || "",
    });
    setIsEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const q = parseInt(editForm.quantity, 10);
    if (q < 0 || isNaN(q)) return toast.error("Geçerli adet girin");
    try {
      await axios.patch(`${API}/brand-stock/${editTarget.id}`, {
        brand: editForm.brand, machine: editForm.machine?.trim() || null,
        color: editForm.color?.trim() || null, quantity: q,
        notes: editForm.notes?.trim() || null, user_name: userTag,
      });
      toast.success("Düzeltildi");
      setIsEditOpen(false); setEditTarget(null);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Güncellenemedi"); }
  };

  const submitDelete = async (s) => {
    if (!window.confirm(`"${s.brand}${s.machine ? ' - ' + s.machine : ''}${s.color ? ' - ' + s.color : ''}" kaydı kalıcı olarak silinsin mi?\n(${s.quantity} adet)`)) return;
    try {
      await axios.delete(`${API}/brand-stock/${s.id}`, { data: { user_name: userTag } });
      toast.success("Silindi");
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Silinemedi"); }
  };

  const openDetail = async (s) => {
    setDetailStock(s);
    try {
      const r = await axios.get(`${API}/brand-stock/movements?stock_id=${s.id}&limit=100`);
      setDetailMovements(arr(r.data));
    } catch (e) { setDetailMovements([]); }
  };

  const exportExcel = async () => {
    try {
      const res = await axios.get(`${API}/brand-stock/export`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `marka_stok_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.click();
    } catch (e) { toast.error("Excel indirilemedi"); }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-black text-text-primary flex items-center gap-2">
            <Tag className="h-6 w-6 text-emerald-500" /> Marka Stoğu
          </h2>
          <p className="text-text-secondary text-sm">Bitmiş ürün — üretim & satış takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel}><Download className="mr-2 h-4 w-4" />Excel</Button>
          <Button onClick={() => { setIsCustomBrand(false); setForm({ brand: "", machine: "", color: "", quantity: "", notes: "" }); setIsAddOpen(true); }}
            data-testid="marka-add-btn" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30">
            <Plus className="mr-2 h-4 w-4" /> Stok Ekle
          </Button>
        </div>
      </div>

      {/* Stat Tiles */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(summary.current_stock_by_brand || {}).slice(0,2).map(([brand, qty]) => (
            <StatTile key={brand} label={brand} value={qty} sub="adet stokta"
              gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
              icon={Tag} testid={`brand-tile-${brand}`} />
          ))}
          <StatTile label="30 Gün Üretim" value={summary.rows?.reduce((s, r) => s + (r.in || 0), 0) || 0}
            sub="giriş hareketi" gradient="bg-gradient-to-br from-blue-600 to-indigo-700" icon={TrendingUp} />
          <StatTile label="30 Gün Satış" value={summary.rows?.reduce((s, r) => s + (r.out || 0), 0) || 0}
            sub="müşteri çıkışı" gradient="bg-gradient-to-br from-amber-600 to-orange-700" icon={TrendingDown} />
        </div>
      )}

      {/* Filtreler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input data-testid="marka-search" placeholder="Marka, ölçü, renk, not ara..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background border-border h-11" />
        </div>
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger data-testid="marka-filter-brand" className="bg-background border-border h-11"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-surface border-border text-text-primary">
            <SelectItem value="all">Tüm Markalar</SelectItem>
            {allBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMachine} onValueChange={setFilterMachine}>
          <SelectTrigger data-testid="marka-filter-machine" className="bg-background border-border h-11"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-surface border-border text-text-primary">
            <SelectItem value="all">Tüm Ölçüler</SelectItem>
            {allMachines.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stok kartları */}
      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="bg-surface border-border">
          <TabsTrigger value="stock" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <Package className="mr-2 h-4 w-4" /> Stok ({filteredStocks.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <History className="mr-2 h-4 w-4" /> Hareketler ({movements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          {filteredStocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-text-secondary">
              <Tag className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p className="font-semibold">Henüz marka stoğu yok.</p>
              <p className="text-sm mt-1">"Stok Ekle" ile başlayın.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStocks.map(s => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 250 }}
                  className="relative overflow-hidden rounded-2xl bg-surface border border-border hover:border-emerald-500/40 transition-all shadow-md hover:shadow-xl hover:shadow-emerald-500/10"
                  data-testid={`stock-card-${s.id}`}>
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
                  <div className="relative p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="cursor-pointer flex-1 min-w-0" onClick={() => openDetail(s)}>
                        <h3 className="text-lg font-bold text-text-primary truncate">{s.brand}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {s.machine && <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs font-semibold rounded-full">{s.machine}</span>}
                          {s.color && <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded-full">{s.color}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-emerald-500" data-testid={`stock-qty-${s.id}`}>{s.quantity}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">adet</p>
                      </div>
                    </div>
                    {s.notes && <p className="text-xs text-text-secondary italic border-l-2 border-border pl-2 mb-3">{s.notes}</p>}
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button size="sm" onClick={() => openQuickAdd(s)} data-testid={`quick-add-${s.id}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => { setSellTarget(s); setSellForm({ quantity: "", customer_name: "", note: "" }); setIsSellOpen(true); }}
                        data-testid={`sell-${s.id}`} className="bg-amber-600 hover:bg-amber-700 text-white">
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)} data-testid={`edit-${s.id}`}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => submitDelete(s)} data-testid={`delete-${s.id}`}
                      className="w-full mt-1.5 text-error/80 hover:bg-error/10 hover:text-error h-7 text-xs">
                      <Trash2 className="h-3 w-3 mr-1" /> Sil
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {movements.length === 0 ? (
              <p className="text-text-secondary text-center py-12">Henüz hareket yok.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background/50">
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-semibold">Tarih</th>
                      <th className="text-left p-3 font-semibold">Tip</th>
                      <th className="text-left p-3 font-semibold">Marka</th>
                      <th className="text-left p-3 font-semibold">Ölçü</th>
                      <th className="text-left p-3 font-semibold">Renk</th>
                      <th className="text-right p-3 font-semibold">Adet</th>
                      <th className="text-left p-3 font-semibold">Müşteri/Not</th>
                      <th className="text-left p-3 font-semibold">Kullanıcı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id} className="border-b border-border/40 hover:bg-surface-highlight/30">
                        <td className="p-3 text-text-secondary text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString("tr-TR")}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            m.movement_type === "in" ? "bg-emerald-500/20 text-emerald-400" :
                            m.movement_type === "out" ? "bg-amber-500/20 text-amber-400" :
                            "bg-blue-500/20 text-blue-400"}`}>
                            {m.movement_type === "in" ? "Giriş" : m.movement_type === "out" ? "Satış" : "Düzeltme"}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">{m.brand}</td>
                        <td className="p-3 text-text-secondary">{m.machine || "—"}</td>
                        <td className="p-3 text-text-secondary">{m.color || "—"}</td>
                        <td className="p-3 text-right font-bold">{m.quantity}</td>
                        <td className="p-3 text-text-secondary text-xs">{m.customer_name || m.note || "—"}</td>
                        <td className="p-3 text-text-secondary text-xs">{m.user_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ADD DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setIsCustomBrand(false); }}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-500" /> Marka Stoğa Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Marka *</Label>
              {isCustomBrand ? (
                <div className="flex gap-2 mt-1">
                  <Input data-testid="add-brand-custom" value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="Yeni marka adı..." className="bg-background border-border flex-1" autoFocus />
                  <Button type="button" variant="outline" size="icon"
                    onClick={() => { setIsCustomBrand(false); setForm({ ...form, brand: "", machine: "" }); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select value={form.brand} onValueChange={(v) => {
                  if (v === "__custom__") { setIsCustomBrand(true); setForm({ ...form, brand: "", machine: "" }); }
                  else setForm({ ...form, brand: v, machine: "" });
                }}>
                  <SelectTrigger data-testid="add-brand" className="bg-background border-border mt-1"><SelectValue placeholder="Marka seç..." /></SelectTrigger>
                  <SelectContent className="bg-surface border-border text-text-primary">
                    {templates.map(t => <SelectItem key={t.brand} value={t.brand}>{t.brand}</SelectItem>)}
                    <SelectItem value="__custom__" data-testid="add-brand-custom-option">+ Diğer (Yeni Marka)...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {form.brand && (
              <div>
                <Label>{isKnownBrand ? "Ölçü *" : "Ölçü (Opsiyonel)"}</Label>
                <Input data-testid="add-size" value={form.machine}
                  onChange={(e) => setForm({ ...form, machine: e.target.value })}
                  placeholder="Örn: 20x40, 33x33, 40x40..." className="mt-1 bg-background border-border" />
              </div>
            )}
            <div>
              <Label>Renk (Opsiyonel)</Label>
              <Input data-testid="add-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Örn: Kırmızı" className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label>Adet *</Label>
              <Input data-testid="add-quantity" type="number" min={1} value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label>Not (Opsiyonel)</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 bg-background border-border" />
            </div>
            <Button onClick={submitAdd} data-testid="add-submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11">Stoğa Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SELL DIALOG */}
      <Dialog open={isSellOpen} onOpenChange={setIsSellOpen}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-amber-500" /> Satış / Çıkış</DialogTitle>
          </DialogHeader>
          {sellTarget && (
            <div className="space-y-3">
              <div className="p-3 bg-background rounded-xl border border-border">
                <p className="font-bold">{sellTarget.brand}</p>
                <p className="text-sm text-text-secondary">{sellTarget.machine || ""}{sellTarget.color ? ` · ${sellTarget.color}` : ""}</p>
                <p className="text-xs mt-1">Mevcut: <span className="font-bold text-emerald-500">{sellTarget.quantity} adet</span></p>
              </div>
              <div>
                <Label>Satılacak Adet *</Label>
                <Input data-testid="sell-quantity" type="number" min={1} max={sellTarget.quantity} value={sellForm.quantity}
                  onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })} className="mt-1 bg-background border-border" />
              </div>
              <div><Label>Müşteri</Label><Input value={sellForm.customer_name} onChange={(e) => setSellForm({ ...sellForm, customer_name: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Not</Label><Input value={sellForm.note} onChange={(e) => setSellForm({ ...sellForm, note: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <Button onClick={submitSell} data-testid="sell-submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white h-11">Satışı Kaydet</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-blue-500" /> Düzelt</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">Miktar değişimi "Düzeltme" olarak log'a yazılır.</p>
              <div><Label>Marka</Label><Input value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Ölçü</Label><Input value={editForm.machine} onChange={(e) => setEditForm({ ...editForm, machine: e.target.value })} placeholder="Örn: 20x40" className="mt-1 bg-background border-border" /></div>
              <div><Label>Renk</Label><Input value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Adet</Label><Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Not</Label><Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <Button onClick={submitEdit} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">Kaydet</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DETAIL DRAWER */}
      <AnimatePresence>
        {detailStock && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60" onClick={() => setDetailStock(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="bg-surface w-full md:max-w-2xl max-h-[80vh] rounded-t-2xl md:rounded-2xl border border-border overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-border bg-gradient-to-r from-emerald-500/15 to-transparent">
                <div>
                  <p className="font-bold text-lg">{detailStock.brand}</p>
                  <p className="text-sm text-text-secondary">{detailStock.machine || ""}{detailStock.color ? ` · ${detailStock.color}` : ""} · <span className="text-emerald-500 font-bold">{detailStock.quantity} adet</span></p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDetailStock(null)}><X className="h-5 w-5" /></Button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {detailMovements.length === 0 ? <p className="text-text-secondary text-center py-8">Hareket bulunamadı.</p> :
                  detailMovements.map(m => (
                    <div key={m.id} className="p-3 bg-background rounded-xl border border-border text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          m.movement_type === "in" ? "bg-emerald-500/20 text-emerald-400" :
                          m.movement_type === "out" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                          {m.movement_type === "in" ? "Giriş" : m.movement_type === "out" ? "Satış" : "Düzeltme"}
                        </span>
                        <span className="font-bold">{m.quantity} adet</span>
                      </div>
                      {(m.customer_name || m.note) && <p className="text-xs text-text-secondary mt-1">{m.customer_name || m.note}</p>}
                      <p className="text-xs text-text-secondary mt-1">{m.user_name} · {new Date(m.created_at).toLocaleString("tr-TR")}</p>
                    </div>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   KOLİ STOK BÖLÜMÜ
   ────────────────────────────────────────────────────────────── */
const KoliSection = ({ userData }) => {
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);
  const [machines, setMachines] = useState([]);
  const [search, setSearch] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", size: "", quantity: "", supplier: "", notes: "" });

  const [isGiveOpen, setIsGiveOpen] = useState(false);
  const [giveTarget, setGiveTarget] = useState(null);
  const [giveForm, setGiveForm] = useState({ machine_id: "", quantity: "", note: "" });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", size: "", quantity: "", notes: "" });

  const [detailStock, setDetailStock] = useState(null);
  const [detailMovements, setDetailMovements] = useState([]);

  const userTag = userData?.username || userData?.display_name || "depo";

  const fetchAll = useCallback(async () => {
    try {
      const [s, m, sm, mc] = await Promise.allSettled([
        axios.get(`${API}/koli-stock`),
        axios.get(`${API}/koli-stock/movements?limit=200`),
        axios.get(`${API}/koli-stock/summary?days=30`),
        axios.get(`${API}/machines`),
      ]);
      if (s.status === "fulfilled") setStocks(arr(s.value.data));
      if (m.status === "fulfilled") setMovements(arr(m.value.data));
      if (sm.status === "fulfilled") setSummary(sm.value.data);
      if (mc.status === "fulfilled") setMachines(arr(mc.value.data));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchAll();
    const i = setInterval(fetchAll, 10000);
    return () => clearInterval(i);
  }, [fetchAll]);

  const filtered = useMemo(() => stocks.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name || "").toLowerCase().includes(q) ||
      (s.size || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q);
  }), [stocks, search]);

  const submitAdd = async () => {
    if (!form.name?.trim()) return toast.error("Koli adı girin");
    const q = parseInt(form.quantity, 10);
    if (!q || q <= 0) return toast.error("Geçerli adet girin");
    try {
      await axios.post(`${API}/koli-stock`, {
        name: form.name.trim(), size: form.size?.trim() || null,
        quantity: q, notes: form.notes?.trim() || null,
        supplier: form.supplier?.trim() || null, user_name: userTag,
      });
      toast.success(`+${q} koli alındı`);
      setIsAddOpen(false);
      setForm({ name: "", size: "", quantity: "", supplier: "", notes: "" });
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Eklenemedi"); }
  };

  const openQuickAdd = (s) => {
    setForm({ name: s.name || "", size: s.size || "", quantity: "", supplier: "", notes: "" });
    setIsAddOpen(true);
  };

  const submitGive = async () => {
    if (!giveTarget) return;
    const q = parseInt(giveForm.quantity, 10);
    if (!q || q <= 0) return toast.error("Geçerli adet girin");
    if (q > giveTarget.quantity) return toast.error(`Yetersiz (mevcut: ${giveTarget.quantity})`);
    const machine = machines.find(m => m.id === giveForm.machine_id);
    try {
      await axios.post(`${API}/koli-stock/give-to-machine`, {
        stock_id: giveTarget.id, quantity: q,
        machine_id: machine?.id || null, machine_name: machine?.name || null,
        note: giveForm.note?.trim() || null, user_name: userTag,
      });
      toast.success(`-${q} koli ${machine?.name || "makineye"} verildi`);
      setIsGiveOpen(false); setGiveTarget(null);
      setGiveForm({ machine_id: "", quantity: "", note: "" });
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setEditForm({ name: s.name || "", size: s.size || "", quantity: String(s.quantity ?? 0), notes: s.notes || "" });
    setIsEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const q = parseInt(editForm.quantity, 10);
    if (q < 0 || isNaN(q)) return toast.error("Geçerli adet girin");
    try {
      await axios.patch(`${API}/koli-stock/${editTarget.id}`, {
        name: editForm.name, size: editForm.size?.trim() || null,
        quantity: q, notes: editForm.notes?.trim() || null, user_name: userTag,
      });
      toast.success("Düzeltildi");
      setIsEditOpen(false); setEditTarget(null);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const submitDelete = async (s) => {
    if (!window.confirm(`"${s.name}${s.size ? ' - ' + s.size : ''}" koli stoğu silinsin mi?\n(${s.quantity} adet)`)) return;
    try {
      await axios.delete(`${API}/koli-stock/${s.id}`, { data: { user_name: userTag } });
      toast.success("Silindi");
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Hata"); }
  };

  const openDetail = async (s) => {
    setDetailStock(s);
    try {
      const r = await axios.get(`${API}/koli-stock/movements?stock_id=${s.id}&limit=100`);
      setDetailMovements(arr(r.data));
    } catch (e) { setDetailMovements([]); }
  };

  const exportExcel = async () => {
    try {
      const res = await axios.get(`${API}/koli-stock/export`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `koli_stok_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.click();
    } catch (e) { toast.error("Excel indirilemedi"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-black text-text-primary flex items-center gap-2">
            <Boxes className="h-6 w-6 text-sky-500" /> Koli Stoğu
          </h2>
          <p className="text-text-secondary text-sm">Alınan koliler — makinelere dağıtım takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel}><Download className="mr-2 h-4 w-4" />Excel</Button>
          <Button onClick={() => { setForm({ name: "", size: "", quantity: "", supplier: "", notes: "" }); setIsAddOpen(true); }}
            data-testid="koli-add-btn" className="bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-500/30">
            <Plus className="mr-2 h-4 w-4" /> Koli Al
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label="Toplam Stok" value={summary.current_total || 0} sub={`${summary.current_count} farklı tip`}
            gradient="bg-gradient-to-br from-sky-600 to-blue-700" icon={Boxes} />
          <StatTile label="30 Gün Alınan" value={summary.rows?.reduce((s, r) => s + (r.in || 0), 0) || 0} sub="giriş"
            gradient="bg-gradient-to-br from-emerald-600 to-teal-700" icon={TrendingUp} />
          <StatTile label="30 Gün Makinelere" value={summary.rows?.reduce((s, r) => s + (r.out || 0), 0) || 0} sub="çıkış"
            gradient="bg-gradient-to-br from-purple-600 to-fuchsia-700" icon={Send} />
          <StatTile label="Farklı Tip" value={summary.current_count || 0} sub="aktif"
            gradient="bg-gradient-to-br from-rose-600 to-pink-700" icon={Package} />
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
        <Input data-testid="koli-search" placeholder="Koli adı, ölçü, not ara..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background border-border h-11" />
      </div>

      <Tabs defaultValue="stock" className="space-y-4">
        <TabsList className="bg-surface border-border">
          <TabsTrigger value="stock" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            <Boxes className="mr-2 h-4 w-4" /> Stok ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            <History className="mr-2 h-4 w-4" /> Hareketler ({movements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-text-secondary">
              <Boxes className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p className="font-semibold">Henüz koli stoğu yok.</p>
              <p className="text-sm mt-1">"Koli Al" ile başlayın.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(s => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 250 }}
                  className="relative overflow-hidden rounded-2xl bg-surface border border-border hover:border-sky-500/40 transition-all shadow-md hover:shadow-xl hover:shadow-sky-500/10"
                  data-testid={`koli-card-${s.id}`}>
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />
                  <div className="relative p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="cursor-pointer flex-1 min-w-0" onClick={() => openDetail(s)}>
                        <h3 className="text-lg font-bold text-text-primary truncate">{s.name}</h3>
                        {s.size && <span className="inline-block mt-1.5 px-2 py-0.5 bg-sky-500/15 text-sky-400 text-xs font-mono rounded-full">{s.size}</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-sky-500" data-testid={`koli-qty-${s.id}`}>{s.quantity}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">koli</p>
                      </div>
                    </div>
                    {s.notes && <p className="text-xs text-text-secondary italic border-l-2 border-border pl-2 mb-3">{s.notes}</p>}
                    <div className="grid grid-cols-3 gap-1.5">
                      <Button size="sm" onClick={() => openQuickAdd(s)} data-testid={`koli-quick-add-${s.id}`}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={() => { setGiveTarget(s); setGiveForm({ machine_id: "", quantity: "", note: "" }); setIsGiveOpen(true); }}
                        data-testid={`koli-give-${s.id}`} className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)} data-testid={`koli-edit-${s.id}`}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => submitDelete(s)} data-testid={`koli-delete-${s.id}`}
                      className="w-full mt-1.5 text-error/80 hover:bg-error/10 hover:text-error h-7 text-xs">
                      <Trash2 className="h-3 w-3 mr-1" /> Sil
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {movements.length === 0 ? <p className="text-text-secondary text-center py-12">Henüz hareket yok.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background/50">
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-semibold">Tarih</th>
                      <th className="text-left p-3 font-semibold">Tip</th>
                      <th className="text-left p-3 font-semibold">Koli</th>
                      <th className="text-left p-3 font-semibold">Ölçü</th>
                      <th className="text-right p-3 font-semibold">Adet</th>
                      <th className="text-left p-3 font-semibold">Makine / Tedarikçi</th>
                      <th className="text-left p-3 font-semibold">Kullanıcı</th>
                      <th className="text-left p-3 font-semibold">Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(m => (
                      <tr key={m.id} className="border-b border-border/40 hover:bg-surface-highlight/30">
                        <td className="p-3 text-text-secondary text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString("tr-TR")}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            m.movement_type === "in" ? "bg-emerald-500/20 text-emerald-400" :
                            m.movement_type === "out" ? "bg-purple-500/20 text-purple-400" :
                            "bg-blue-500/20 text-blue-400"}`}>
                            {m.movement_type === "in" ? "Giriş" : m.movement_type === "out" ? "Makineye" : "Düzeltme"}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">{m.name}</td>
                        <td className="p-3 text-text-secondary font-mono text-xs">{m.size || "—"}</td>
                        <td className="p-3 text-right font-bold">{m.quantity}</td>
                        <td className="p-3 text-text-secondary text-xs">{m.machine_name || m.supplier || "—"}</td>
                        <td className="p-3 text-text-secondary text-xs">{m.user_name || "—"}</td>
                        <td className="p-3 text-text-secondary text-xs">{m.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* KOLI ADD DIALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-sky-500" /> Koli Al / Stoğa Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Koli Adı *</Label><Input data-testid="koli-add-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Örn: Tip A Koli, Beyaz Koli..." className="mt-1 bg-background border-border" /></div>
            <div><Label>Ölçü (Opsiyonel)</Label><Input data-testid="koli-add-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="Örn: 33x33x20, 40x40x25" className="mt-1 bg-background border-border" /></div>
            <div><Label>Adet *</Label><Input data-testid="koli-add-quantity" type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 bg-background border-border" /></div>
            <div><Label>Tedarikçi (Opsiyonel)</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Karton AŞ vb." className="mt-1 bg-background border-border" /></div>
            <div><Label>Not (Opsiyonel)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 bg-background border-border" /></div>
            <Button onClick={submitAdd} data-testid="koli-add-submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white h-11">Stoğa Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KOLI GIVE DIALOG */}
      <Dialog open={isGiveOpen} onOpenChange={setIsGiveOpen}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-purple-500" /> Makineye Ver</DialogTitle>
          </DialogHeader>
          {giveTarget && (
            <div className="space-y-3">
              <div className="p-3 bg-background rounded-xl border border-border">
                <p className="font-bold">{giveTarget.name}</p>
                {giveTarget.size && <p className="text-sm text-text-secondary font-mono">{giveTarget.size}</p>}
                <p className="text-xs mt-1">Mevcut: <span className="font-bold text-sky-500">{giveTarget.quantity} koli</span></p>
              </div>
              <div>
                <Label>Makine *</Label>
                <Select value={giveForm.machine_id} onValueChange={(v) => setGiveForm({ ...giveForm, machine_id: v })}>
                  <SelectTrigger data-testid="koli-give-machine" className="bg-background border-border mt-1"><SelectValue placeholder="Makine seç..." /></SelectTrigger>
                  <SelectContent className="bg-surface border-border text-text-primary">
                    {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Verilen Adet *</Label><Input data-testid="koli-give-quantity" type="number" min={1} max={giveTarget.quantity} value={giveForm.quantity} onChange={(e) => setGiveForm({ ...giveForm, quantity: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Not</Label><Input value={giveForm.note} onChange={(e) => setGiveForm({ ...giveForm, note: e.target.value })} placeholder="Lot, sevkiyat..." className="mt-1 bg-background border-border" /></div>
              <Button onClick={submitGive} data-testid="koli-give-submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white h-11">Makineye Ver</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* KOLI EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-blue-500" /> Düzelt</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">Miktar değişimi "Düzeltme" olarak log'a yazılır.</p>
              <div><Label>Ad</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Ölçü</Label><Input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Adet</Label><Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <div><Label>Not</Label><Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="mt-1 bg-background border-border" /></div>
              <Button onClick={submitEdit} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">Kaydet</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {detailStock && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60" onClick={() => setDetailStock(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="bg-surface w-full md:max-w-2xl max-h-[80vh] rounded-t-2xl md:rounded-2xl border border-border overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-border bg-gradient-to-r from-sky-500/15 to-transparent">
                <div>
                  <p className="font-bold text-lg">{detailStock.name}</p>
                  <p className="text-sm text-text-secondary">{detailStock.size ? `${detailStock.size} · ` : ""}<span className="text-sky-500 font-bold">{detailStock.quantity} koli</span></p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDetailStock(null)}><X className="h-5 w-5" /></Button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {detailMovements.length === 0 ? <p className="text-text-secondary text-center py-8">Hareket bulunamadı.</p> :
                  detailMovements.map(m => (
                    <div key={m.id} className="p-3 bg-background rounded-xl border border-border text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          m.movement_type === "in" ? "bg-emerald-500/20 text-emerald-400" :
                          m.movement_type === "out" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>
                          {m.movement_type === "in" ? "Giriş" : m.movement_type === "out" ? "Makineye" : "Düzeltme"}
                        </span>
                        <span className="font-bold">{m.quantity} koli</span>
                      </div>
                      {(m.machine_name || m.supplier || m.note) && <p className="text-xs text-text-secondary mt-1">{m.machine_name || m.supplier || m.note}</p>}
                      <p className="text-xs text-text-secondary mt-1">{m.user_name} · {new Date(m.created_at).toLocaleString("tr-TR")}</p>
                    </div>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────
   ANA SAYFA (Combined: Marka + Koli)
   ────────────────────────────────────────────────────────────── */
const MarkaStokFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [role, setRole] = useState("depo");
  const [mainTab, setMainTab] = useState("marka");

  useEffect(() => {
    const remembered = localStorage.getItem("marka_stok_remember");
    if (remembered) {
      try {
        const c = JSON.parse(remembered);
        setUsername(c.username || "");
        setPassword(c.password || "");
        setRememberMe(true);
      } catch (e) { localStorage.removeItem("marka_stok_remember"); }
    }
  }, []);

  useEffect(() => {
    const sess = localStorage.getItem("marka_stok_session");
    if (sess) {
      try {
        const s = JSON.parse(sess);
        const hours = (Date.now() - (s.login_time || 0)) / 3600000;
        if (hours < 24 && s.username) {
          setUserData(s);
          setRole(s.role || "depo");
          setAuthenticated(true);
          if (s.token) localStorage.setItem("auth_token", s.token);
        } else { localStorage.removeItem("marka_stok_session"); }
      } catch (e) { localStorage.removeItem("marka_stok_session"); }
    }
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return toast.error("Kullanıcı adı ve şifre gerekli");
    const tryRoles = ["depo", "planlama", "yonetim"];
    let lastErr = null;
    for (const r of tryRoles) {
      try {
        const res = await axios.post(`${API}/users/login`, { username, password, role: r });
        const u = res.data;
        if (u.token) localStorage.setItem("auth_token", u.token);
        setUserData(u); setRole(r);
        localStorage.setItem("marka_stok_session", JSON.stringify({ ...u, role: r, login_time: Date.now() }));
        if (rememberMe) localStorage.setItem("marka_stok_remember", JSON.stringify({ username, password }));
        else localStorage.removeItem("marka_stok_remember");
        setAuthenticated(true);
        toast.success(`Giriş başarılı (${r})`);
        return;
      } catch (e) { lastErr = e; }
    }
    toast.error(lastErr?.response?.data?.detail || "Giriş başarısız (sadece Depo / Planlama / Yönetim)");
  };

  const handleLogout = () => {
    localStorage.removeItem("marka_stok_session");
    setUserData(null); setAuthenticated(false);
    setUsername(""); setPassword("");
    toast.success("Çıkış yapıldı");
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-heading text-center text-emerald-500 flex items-center justify-center gap-2">
                <div className="flex items-center gap-1">
                  <Tag className="h-6 w-6" />
                  <span className="text-text-secondary">/</span>
                  <Boxes className="h-6 w-6 text-sky-500" />
                </div>
                MARKA / KOLİ STOK
              </CardTitle>
              <p className="text-text-secondary text-sm text-center mt-1">Bitmiş Ürün + Hammadde Koli Takibi</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Kullanıcı Adı</Label><Input data-testid="marka-username-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="depo1, emrecan..." className="mt-1 bg-background border-border h-12" /></div>
              <div><Label>Şifre</Label><Input data-testid="marka-password-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleLogin()} className="mt-1 bg-background border-border h-12" /></div>
              <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="marka-remember-me">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-5 h-5 rounded accent-emerald-500 cursor-pointer" />
                <span className="text-text-secondary text-sm">Hatırla Beni</span>
              </label>
              <Button data-testid="marka-login-button" onClick={handleLogin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg">Giriş Yap</Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full"><ArrowLeft className="mr-2 h-4 w-4" /> Ana Sayfa</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Top Bar */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-btn"><ArrowLeft className="mr-2 h-4 w-4" />Ana Sayfa</Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-secondary hidden md:inline px-2 py-1 rounded-full bg-surface border border-border">{userData?.display_name || userData?.username} · {role}</span>
            <Button variant="outline" size="icon" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="outline" onClick={handleLogout} className="text-error border-error/40">Çıkış</Button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/30"><Tag className="h-5 w-5 text-white" /></div>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center shadow-lg shadow-sky-500/30"><Boxes className="h-5 w-5 text-white" /></div>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-black text-text-primary">
            <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">Marka / Koli Stok</span>
          </h1>
        </div>

        {/* Main Tabs — Marka vs Koli */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-5">
          <TabsList className="bg-surface border border-border p-1 h-auto rounded-2xl w-full md:w-auto md:inline-flex">
            <TabsTrigger value="marka" data-testid="main-tab-marka"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-700 data-[state=active]:text-white px-5 py-2.5 rounded-xl font-bold">
              <Tag className="mr-2 h-4 w-4" /> Marka
            </TabsTrigger>
            <TabsTrigger value="koli" data-testid="main-tab-koli"
              className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-sky-500 data-[state=active]:to-sky-700 data-[state=active]:text-white px-5 py-2.5 rounded-xl font-bold">
              <Boxes className="mr-2 h-4 w-4" /> Koli
            </TabsTrigger>
          </TabsList>

          <TabsContent value="marka">
            <BrandSection userData={userData} role={role} />
          </TabsContent>
          <TabsContent value="koli">
            <KoliSection userData={userData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MarkaStokFlow;
