import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, ShoppingCart, History, Edit, Trash2, Download, Search, Sun, Moon, Package, TrendingDown, TrendingUp, Factory, X } from "lucide-react";
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

const MarkaStokFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [role, setRole] = useState("depo");

  const [templates, setTemplates] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [summary, setSummary] = useState(null);

  // filtreler
  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterMachine, setFilterMachine] = useState("all");

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ brand: "", machine: "", color: "", quantity: "", notes: "" });
  const [isCustomBrand, setIsCustomBrand] = useState(false);

  // Sell dialog
  const [isSellOpen, setIsSellOpen] = useState(false);
  const [sellTarget, setSellTarget] = useState(null);
  const [sellForm, setSellForm] = useState({ quantity: "", customer_name: "", note: "" });

  // Edit dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ brand: "", machine: "", color: "", quantity: "", notes: "" });

  // Detail drawer (movements for one stock)
  const [detailStock, setDetailStock] = useState(null);
  const [detailMovements, setDetailMovements] = useState([]);

  // 24 saatlik kalıcı oturum
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
          setAuthenticated(true);
          if (s.token) localStorage.setItem("auth_token", s.token);
        } else {
          localStorage.removeItem("marka_stok_session");
        }
      } catch (e) { localStorage.removeItem("marka_stok_session"); }
    }
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Kullanıcı adı ve şifre gerekli");
      return;
    }
    // Önce mevcut rolü dene (depo/planlama/yonetim)
    const tryRoles = ["depo", "planlama", "yonetim"];
    let lastErr = null;
    for (const r of tryRoles) {
      try {
        const res = await axios.post(`${API}/users/login`, { username, password, role: r });
        const u = res.data;
        if (u.token) localStorage.setItem("auth_token", u.token);
        setUserData(u);
        setRole(r);
        localStorage.setItem("marka_stok_session", JSON.stringify({ ...u, role: r, login_time: Date.now() }));
        if (rememberMe) {
          localStorage.setItem("marka_stok_remember", JSON.stringify({ username, password }));
        } else {
          localStorage.removeItem("marka_stok_remember");
        }
        setAuthenticated(true);
        toast.success(`Giriş başarılı (${r})`);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    toast.error(lastErr?.response?.data?.detail || "Giriş başarısız (sadece Depo / Planlama / Yönetim erişebilir)");
  };

  const handleLogout = () => {
    localStorage.removeItem("marka_stok_session");
    setUserData(null);
    setAuthenticated(false);
    setUsername("");
    setPassword("");
    toast.success("Çıkış yapıldı");
  };

  // Data fetch
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
    } catch (e) {
      console.error("MarkaStok fetch error:", e);
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchAll();
      const i = setInterval(fetchAll, 10000);
      return () => clearInterval(i);
    }
  }, [authenticated, fetchAll]);

  // Şu anki form'a göre seçilebilecek makineler
  const selectedBrandTpl = templates.find(t => t.brand === form.brand);
  const machineOptions = selectedBrandTpl?.machines || [];
  const isKnownBrand = !!selectedBrandTpl;

  // Hızlı ekleme (kart üzerinden) — mevcut marka+makine+renk'i pre-fill et
  const openQuickAdd = (s) => {
    const known = templates.find(t => t.brand === s.brand);
    setIsCustomBrand(!known);
    setForm({
      brand: s.brand || "",
      machine: s.machine || "",
      color: s.color || "",
      quantity: "",
      notes: "",
    });
    setIsAddOpen(true);
  };

  // Filtreli stok listesi
  const filteredStocks = useMemo(() => {
    return stocks.filter(s => {
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
    });
  }, [stocks, filterBrand, filterMachine, search]);

  const allBrands = [...new Set(stocks.map(s => s.brand).filter(Boolean))];
  const allMachines = [...new Set(stocks.map(s => s.machine).filter(Boolean))];

  // Add submit
  const submitAdd = async () => {
    if (!form.brand?.trim()) return toast.error("Marka girin / seçin");
    // Custom marka için makine zorunlu değil; bilinen marka için zorunlu
    if (isKnownBrand && !form.machine) return toast.error("Makine seçin");
    const q = parseInt(form.quantity, 10);
    if (!q || q <= 0) return toast.error("Geçerli adet girin");

    try {
      await axios.post(`${API}/brand-stock`, {
        brand: form.brand.trim(),
        machine: form.machine?.trim() || null,
        color: form.color?.trim() || null,
        quantity: q,
        notes: form.notes?.trim() || null,
        user_name: userData?.username || userData?.display_name || "depo",
      });
      toast.success(`+${q} adet eklendi`);
      setIsAddOpen(false);
      setIsCustomBrand(false);
      setForm({ brand: "", machine: "", color: "", quantity: "", notes: "" });
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Eklenemedi");
    }
  };

  const submitSell = async () => {
    if (!sellTarget) return;
    const q = parseInt(sellForm.quantity, 10);
    if (!q || q <= 0) return toast.error("Geçerli adet girin");
    if (q > sellTarget.quantity) return toast.error(`Stok yetersiz (mevcut: ${sellTarget.quantity})`);

    try {
      await axios.post(`${API}/brand-stock/sell`, {
        stock_id: sellTarget.id,
        quantity: q,
        customer_name: sellForm.customer_name?.trim() || null,
        note: sellForm.note?.trim() || null,
        user_name: userData?.username || userData?.display_name || "depo",
      });
      toast.success(`-${q} adet satıldı`);
      setIsSellOpen(false);
      setSellTarget(null);
      setSellForm({ quantity: "", customer_name: "", note: "" });
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Satış kaydedilemedi");
    }
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setEditForm({
      brand: s.brand || "",
      machine: s.machine || "",
      color: s.color || "",
      quantity: String(s.quantity ?? 0),
      notes: s.notes || "",
    });
    setIsEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const q = parseInt(editForm.quantity, 10);
    if (q < 0 || isNaN(q)) return toast.error("Geçerli adet girin");
    try {
      await axios.patch(`${API}/brand-stock/${editTarget.id}`, {
        brand: editForm.brand,
        machine: editForm.machine,
        color: editForm.color?.trim() || null,
        quantity: q,
        notes: editForm.notes?.trim() || null,
        user_name: userData?.username || userData?.display_name || "depo",
      });
      toast.success("Düzeltildi");
      setIsEditOpen(false);
      setEditTarget(null);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Güncellenemedi");
    }
  };

  const submitDelete = async (s) => {
    if (!window.confirm(`"${s.brand} - ${s.machine}${s.color ? ' - ' + s.color : ''}" stoğu kalıcı olarak silinsin mi?`)) return;
    try {
      await axios.delete(`${API}/brand-stock/${s.id}`, {
        data: { user_name: userData?.username || userData?.display_name || "depo" }
      });
      toast.success("Silindi");
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Silinemedi");
    }
  };

  const exportExcel = async () => {
    try {
      const res = await axios.get(`${API}/brand-stock/export`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `marka_stok_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.click();
    } catch (e) {
      toast.error("Excel indirilemedi");
    }
  };

  const openDetail = async (s) => {
    setDetailStock(s);
    try {
      const r = await axios.get(`${API}/brand-stock/movements?stock_id=${s.id}&limit=100`);
      setDetailMovements(arr(r.data));
    } catch (e) {
      setDetailMovements([]);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-heading text-center text-emerald-500 flex items-center justify-center gap-2">
                <Package className="h-7 w-7" />
                MARKA STOK
              </CardTitle>
              <p className="text-text-secondary text-sm text-center mt-1">Bitmiş Ürün Takibi (Depo/Plan/Yönetim)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Kullanıcı Adı</Label>
                <Input data-testid="marka-username-input" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="depo1, emrecan, vs." className="mt-1 bg-background border-border h-12" />
              </div>
              <div>
                <Label>Şifre</Label>
                <Input data-testid="marka-password-input" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                  className="mt-1 bg-background border-border h-12" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="marka-remember-me">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 rounded accent-emerald-500 cursor-pointer" />
                <span className="text-text-secondary text-sm">Hatırla Beni</span>
              </label>
              <Button data-testid="marka-login-button" onClick={handleLogin}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg">
                Giriş Yap
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Ana Sayfa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-btn"><ArrowLeft className="mr-2 h-4 w-4" />Ana Sayfa</Button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-secondary hidden md:inline">{userData?.display_name || userData?.username} · {role}</span>
            <Button variant="outline" size="icon" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <Button variant="outline" onClick={exportExcel} data-testid="marka-export-btn"><Download className="mr-2 h-4 w-4" />Excel</Button>
            <Button variant="outline" onClick={handleLogout} className="text-error border-error/40">Çıkış</Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Package className="h-9 w-9 text-emerald-500" />
          <h1 className="text-4xl md:text-5xl font-heading font-black text-emerald-500">MARKA STOK</h1>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setIsAddOpen(true)} data-testid="marka-add-btn" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Stok Ekle
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {Object.entries(summary.current_stock_by_brand || {}).map(([brand, qty]) => (
              <Card key={brand} className="bg-surface border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-text-secondary">{brand}</p>
                  <p className="text-3xl font-bold text-emerald-500 mt-1">{qty}</p>
                  <p className="text-xs text-text-secondary mt-1">Mevcut Adet</p>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <p className="text-xs text-text-secondary">Son 30 Gün Giriş</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="h-5 w-5" />
                  {summary.rows?.reduce((s, r) => s + (r.in || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-surface border-border">
              <CardContent className="p-4">
                <p className="text-xs text-text-secondary">Son 30 Gün Satış</p>
                <p className="text-2xl font-bold text-amber-400 mt-1 flex items-center gap-1">
                  <TrendingDown className="h-5 w-5" />
                  {summary.rows?.reduce((s, r) => s + (r.out || 0), 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtreler */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <Input data-testid="marka-search" placeholder="Marka, makine, renk, not ara..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background border-border" />
          </div>
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger data-testid="marka-filter-brand" className="bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-surface border-border text-text-primary">
              <SelectItem value="all">Tüm Markalar</SelectItem>
              {allBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMachine} onValueChange={setFilterMachine}>
            <SelectTrigger data-testid="marka-filter-machine" className="bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-surface border-border text-text-primary">
              <SelectItem value="all">Tüm Makineler</SelectItem>
              {allMachines.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="stock" className="space-y-4">
          <TabsList className="bg-surface border-border">
            <TabsTrigger value="stock" data-testid="tab-stock" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Package className="mr-2 h-4 w-4" /> Stok ({filteredStocks.length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <History className="mr-2 h-4 w-4" /> Hareketler ({movements.length})
            </TabsTrigger>
          </TabsList>

          {/* STOK TAB */}
          <TabsContent value="stock">
            {filteredStocks.length === 0 ? (
              <Card className="bg-surface border-border">
                <CardContent className="text-center py-12 text-text-secondary">
                  <Package className="h-12 w-12 mx-auto opacity-30 mb-3" />
                  <p>Henüz stok yok. "Stok Ekle" ile başlayın.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredStocks.map(s => (
                  <Card key={s.id} className="bg-surface border-border hover:border-emerald-500/40 transition-colors" data-testid={`stock-card-${s.id}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="cursor-pointer flex-1 min-w-0" onClick={() => openDetail(s)}>
                          <h3 className="text-lg font-bold text-text-primary truncate">{s.brand}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 text-xs font-semibold rounded">{s.machine}</span>
                            {s.color && <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-xs rounded">{s.color}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-emerald-500" data-testid={`stock-qty-${s.id}`}>{s.quantity}</p>
                          <p className="text-xs text-text-secondary">adet</p>
                        </div>
                      </div>
                      {s.notes && <p className="text-xs text-text-secondary mt-1 italic border-l-2 border-border pl-2">{s.notes}</p>}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <Button size="sm" onClick={() => openQuickAdd(s)} data-testid={`quick-add-${s.id}`} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Plus className="mr-1 h-3.5 w-3.5" /> Ekle
                        </Button>
                        <Button size="sm" onClick={() => { setSellTarget(s); setSellForm({ quantity: "", customer_name: "", note: "" }); setIsSellOpen(true); }}
                          data-testid={`sell-${s.id}`} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                          <ShoppingCart className="mr-1 h-3.5 w-3.5" /> Sat
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)} data-testid={`edit-${s.id}`}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {role === "yonetim" && (
                          <Button size="sm" variant="outline" onClick={() => submitDelete(s)} data-testid={`delete-${s.id}`} className="border-error/40 text-error">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* HAREKETLER TAB */}
          <TabsContent value="history">
            <Card className="bg-surface border-border">
              <CardContent className="p-0">
                {movements.length === 0 ? (
                  <p className="text-text-secondary text-center py-12">Henüz hareket yok.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="movements-table">
                      <thead className="bg-background/50">
                        <tr className="border-b border-border">
                          <th className="text-left p-3">Tarih</th>
                          <th className="text-left p-3">Tip</th>
                          <th className="text-left p-3">Marka</th>
                          <th className="text-left p-3">Makine</th>
                          <th className="text-left p-3">Renk</th>
                          <th className="text-right p-3">Adet</th>
                          <th className="text-left p-3">Müşteri/Not</th>
                          <th className="text-left p-3">Kullanıcı</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map(m => (
                          <tr key={m.id} className="border-b border-border/40 hover:bg-surface-highlight/30">
                            <td className="p-3 text-text-secondary text-xs whitespace-nowrap">{new Date(m.created_at).toLocaleString("tr-TR")}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                m.movement_type === "in" ? "bg-emerald-500/20 text-emerald-400" :
                                m.movement_type === "out" ? "bg-amber-500/20 text-amber-400" :
                                "bg-blue-500/20 text-blue-400"
                              }`}>
                                {m.movement_type === "in" ? "Giriş" : m.movement_type === "out" ? "Satış" : "Düzeltme"}
                              </span>
                            </td>
                            <td className="p-3 font-semibold">{m.brand}</td>
                            <td className="p-3 text-text-secondary">{m.machine}</td>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ADD DIALOG */}
        <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if (!o) setIsCustomBrand(false); }}>
          <DialogContent className="bg-surface border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-emerald-500" /> Stoğa Ekle</DialogTitle>
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
                      onClick={() => { setIsCustomBrand(false); setForm({ ...form, brand: "", machine: "" }); }}
                      data-testid="add-brand-back" title="Geri">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Select value={form.brand} onValueChange={(v) => {
                    if (v === "__custom__") {
                      setIsCustomBrand(true);
                      setForm({ ...form, brand: "", machine: "" });
                    } else {
                      setForm({ ...form, brand: v, machine: "" });
                    }
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
                  <Label>{isCustomBrand ? "Makine (Opsiyonel)" : "Makine *"}</Label>
                  {isCustomBrand ? (
                    <Input data-testid="add-machine-custom" value={form.machine}
                      onChange={(e) => setForm({ ...form, machine: e.target.value })}
                      placeholder="Makine adı (opsiyonel)" className="mt-1 bg-background border-border" />
                  ) : (
                    <Select value={form.machine} onValueChange={(v) => setForm({ ...form, machine: v })}>
                      <SelectTrigger data-testid="add-machine" className="bg-background border-border mt-1"><SelectValue placeholder="Makine seç..." /></SelectTrigger>
                      <SelectContent className="bg-surface border-border text-text-primary">
                        {machineOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <div>
                <Label>Renk (Opsiyonel)</Label>
                <Input data-testid="add-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="Örn: Kırmızı, Mavi, Sarı" className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Adet *</Label>
                <Input data-testid="add-quantity" type="number" min={1} value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label>Not (Opsiyonel)</Label>
                <Input data-testid="add-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Örn: Sipariş #1234, lot numarası..." className="mt-1 bg-background border-border" />
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
                <div className="p-3 bg-background rounded border border-border">
                  <p className="font-bold">{sellTarget.brand}</p>
                  <p className="text-sm text-text-secondary">{sellTarget.machine}{sellTarget.color ? ` · ${sellTarget.color}` : ""}</p>
                  <p className="text-xs text-text-secondary mt-1">Mevcut: <span className="font-bold text-emerald-500">{sellTarget.quantity} adet</span></p>
                </div>
                <div>
                  <Label>Satılacak Adet *</Label>
                  <Input data-testid="sell-quantity" type="number" min={1} max={sellTarget.quantity} value={sellForm.quantity}
                    onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })} className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label>Müşteri</Label>
                  <Input data-testid="sell-customer" value={sellForm.customer_name} onChange={(e) => setSellForm({ ...sellForm, customer_name: e.target.value })}
                    placeholder="Müşteri adı..." className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label>Not</Label>
                  <Input data-testid="sell-note" value={sellForm.note} onChange={(e) => setSellForm({ ...sellForm, note: e.target.value })}
                    placeholder="Fatura no, sevkiyat..." className="mt-1 bg-background border-border" />
                </div>
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
                <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">Yanlış girilen kaydı düzeltirken, miktar değişimi "Düzeltme" olarak log'a yazılır.</p>
                <div>
                  <Label>Marka</Label>
                  <Select value={editForm.brand} onValueChange={(v) => setEditForm({ ...editForm, brand: v })}>
                    <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-surface border-border text-text-primary">
                      {templates.map(t => <SelectItem key={t.brand} value={t.brand}>{t.brand}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Makine</Label>
                  <Select value={editForm.machine} onValueChange={(v) => setEditForm({ ...editForm, machine: v })}>
                    <SelectTrigger className="bg-background border-border mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-surface border-border text-text-primary">
                      {(templates.find(t => t.brand === editForm.brand)?.machines || []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Renk</Label>
                  <Input value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label>Adet</Label>
                  <Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                    data-testid="edit-quantity" className="mt-1 bg-background border-border" />
                </div>
                <div>
                  <Label>Not</Label>
                  <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="mt-1 bg-background border-border" />
                </div>
                <Button onClick={submitEdit} data-testid="edit-submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11">Kaydet</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* DETAIL DRAWER */}
        {detailStock && (
          <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60" onClick={() => setDetailStock(null)}>
            <div className="bg-surface w-full md:max-w-2xl max-h-[80vh] rounded-t-2xl md:rounded-2xl border border-border overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b border-border bg-emerald-500/10">
                <div>
                  <p className="font-bold text-lg">{detailStock.brand}</p>
                  <p className="text-sm text-text-secondary">{detailStock.machine}{detailStock.color ? ` · ${detailStock.color}` : ""} · <span className="text-emerald-500 font-bold">{detailStock.quantity} adet</span></p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDetailStock(null)}><X className="h-5 w-5" /></Button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {detailMovements.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Hareket bulunamadı.</p>
                ) : detailMovements.map(m => (
                  <div key={m.id} className="p-3 bg-background rounded border border-border text-sm flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          m.movement_type === "in" ? "bg-emerald-500/20 text-emerald-400" :
                          m.movement_type === "out" ? "bg-amber-500/20 text-amber-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>
                          {m.movement_type === "in" ? "Giriş" : m.movement_type === "out" ? "Satış" : "Düzeltme"}
                        </span>
                        <span className="font-bold">{m.quantity} adet</span>
                      </div>
                      {(m.customer_name || m.note) && <p className="text-xs text-text-secondary mt-1">{m.customer_name || m.note}</p>}
                      <p className="text-xs text-text-secondary mt-1">{m.user_name} · {new Date(m.created_at).toLocaleString("tr-TR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkaStokFlow;
