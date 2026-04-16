import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, Plus, Package, Send, History, Download, ShoppingCart, Factory, Weight, Layers, LogOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const PAPER_COLORS = ["Beyaz", "Kraft", "Renkli", "Pembe", "Mavi", "Sarı", "Yeşil"];

const BobinFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);

  const [bobins, setBobins] = useState([]);
  const [machines, setMachines] = useState([]);
  const [movements, setMovements] = useState([]);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMachineOpen, setIsMachineOpen] = useState(false);
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [selectedBobin, setSelectedBobin] = useState(null);

  // Forms
  const [addForm, setAddForm] = useState({ brand: "", width_cm: "", grammage: "", color: "Beyaz", quantity: "", total_weight_kg: "", supplier: "" });
  const [machineForm, setMachineForm] = useState({ quantity: "1", machine_id: "" });
  const [saleForm, setSaleForm] = useState({ quantity: "1", customer_name: "", note: "" });
  const [purchaseForm, setPurchaseForm] = useState({ quantity: "", weight_kg: "", supplier: "" });

  // Session
  useEffect(() => {
    const saved = localStorage.getItem("bobin_session");
    if (saved) {
      try {
        const session = JSON.parse(saved);
        const hours = (Date.now() - (session.login_time || 0)) / (1000 * 60 * 60);
        if (hours < 24 && session.username) {
          setUserData(session);
          setAuthenticated(true);
          if (session.token) localStorage.setItem("auth_token", session.token);
        } else {
          localStorage.removeItem("bobin_session");
        }
      } catch { localStorage.removeItem("bobin_session"); }
    }
  }, []);

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API}/users/login`, { username, password, role: "depo" });
      const data = res.data;
      if (data.token) localStorage.setItem("auth_token", data.token);
      const session = { ...data, login_time: Date.now() };
      localStorage.setItem("bobin_session", JSON.stringify(session));
      setUserData(session);
      setAuthenticated(true);
      toast.success(`Hosgeldin, ${data.display_name || data.username}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Giris basarisiz");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("bobin_session");
    localStorage.removeItem("auth_token");
    setAuthenticated(false);
    setUserData(null);
  };

  const fetchData = useCallback(async () => {
    try {
      const [bobinRes, machineRes, movRes] = await Promise.all([
        axios.get(`${API}/bobins`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/bobins/movements?limit=100`),
      ]);
      setBobins(bobinRes.data);
      setMachines(machineRes.data);
      setMovements(movRes.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [authenticated, fetchData]);

  // Yeni bobin türü ekle
  const handleAddBobin = async () => {
    if (!addForm.brand || !addForm.width_cm || !addForm.grammage || !addForm.quantity || !addForm.total_weight_kg) {
      toast.error("Marka, genislik, gramaj, adet ve agirlik zorunludur");
      return;
    }
    try {
      const res = await axios.post(`${API}/bobins`, {
        ...addForm,
        width_cm: parseFloat(addForm.width_cm),
        grammage: parseFloat(addForm.grammage),
        quantity: parseInt(addForm.quantity),
        total_weight_kg: parseFloat(addForm.total_weight_kg),
        user_name: userData?.display_name || userData?.username || ""
      });
      toast.success(res.data.message);
      setIsAddOpen(false);
      setAddForm({ brand: "", width_cm: "", grammage: "", color: "Beyaz", quantity: "", total_weight_kg: "", supplier: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Hata olustu");
    }
  };

  // Mevcut bobine stok ekle
  const handlePurchase = async () => {
    if (!purchaseForm.quantity || !purchaseForm.weight_kg) {
      toast.error("Adet ve agirlik zorunludur");
      return;
    }
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/purchase`, {
        quantity: parseInt(purchaseForm.quantity),
        weight_kg: parseFloat(purchaseForm.weight_kg),
        supplier: purchaseForm.supplier,
        user_name: userData?.display_name || userData?.username || ""
      });
      toast.success(res.data.message);
      setIsPurchaseOpen(false);
      setPurchaseForm({ quantity: "", weight_kg: "", supplier: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Hata olustu");
    }
  };

  // Makineye ver
  const handleToMachine = async () => {
    if (!machineForm.machine_id || !machineForm.quantity) {
      toast.error("Makine ve adet secin");
      return;
    }
    const machine = machines.find(m => m.id === machineForm.machine_id);
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/to-machine`, {
        quantity: parseInt(machineForm.quantity),
        machine_id: machineForm.machine_id,
        machine_name: machine?.name || "",
        user_name: userData?.display_name || userData?.username || ""
      });
      toast.success(res.data.message);
      setIsMachineOpen(false);
      setMachineForm({ quantity: "1", machine_id: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Hata olustu");
    }
  };

  // Müşteriye sat
  const handleSale = async () => {
    if (!saleForm.customer_name || !saleForm.quantity) {
      toast.error("Musteri adi ve adet zorunludur");
      return;
    }
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/sale`, {
        quantity: parseInt(saleForm.quantity),
        customer_name: saleForm.customer_name,
        note: saleForm.note,
        user_name: userData?.display_name || userData?.username || ""
      });
      toast.success(res.data.message);
      setIsSaleOpen(false);
      setSaleForm({ quantity: "1", customer_name: "", note: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Hata olustu");
    }
  };

  // Excel
  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/bobins/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `bobin_stok_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel dosyasi indirildi");
    } catch (err) {
      toast.error("Excel indirme hatasi");
    }
  };

  const typeLabel = (t) => ({ purchase: "Satin Alma", to_machine: "Makineye", sale: "Satis", adjustment: "Duzeltme" }[t] || t);
  const typeColor = (t) => ({ purchase: "text-green-500", to_machine: "text-blue-400", sale: "text-amber-400", adjustment: "text-zinc-400" }[t] || "");

  const totalQuantity = bobins.reduce((s, b) => s + (b.quantity || 0), 0);
  const totalWeight = bobins.reduce((s, b) => s + (b.total_weight_kg || 0), 0);

  // LOGIN
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-bg-secondary border border-border-primary rounded-2xl p-8 w-full max-w-sm shadow-xl"
        >
          <div className="text-center mb-6">
            <Layers className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
            <h1 className="text-2xl font-heading text-text-primary">Bobin Yonetimi</h1>
            <p className="text-text-secondary text-sm mt-1">Depo kullanici bilgileri ile giris yapin</p>
          </div>
          <div className="space-y-3">
            <Input data-testid="bobin-login-username" placeholder="Kullanici adi" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <Input data-testid="bobin-login-password" type="password" placeholder="Sifre" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <Button data-testid="bobin-login-btn" onClick={handleLogin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base">Giris</Button>
          </div>
          <Button variant="ghost" className="w-full mt-4 text-text-secondary" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Ana Sayfa
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-border-primary px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="bobin-back-btn">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-heading text-text-primary flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-500" /> Bobin Yonetimi
            </h1>
            <p className="text-xs text-text-secondary">{userData?.display_name || userData?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="bobin-export-btn">
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="bobin-logout-btn">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Özet kartlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-bg-secondary border-border-primary">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-text-secondary">Bobin Turu</p>
              <p className="text-2xl font-bold text-text-primary" data-testid="bobin-type-count">{bobins.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-bg-secondary border-border-primary">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-text-secondary">Toplam Adet</p>
              <p className="text-2xl font-bold text-emerald-500" data-testid="bobin-total-qty">{totalQuantity}</p>
            </CardContent>
          </Card>
          <Card className="bg-bg-secondary border-border-primary">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-text-secondary">Toplam Agirlik</p>
              <p className="text-2xl font-bold text-blue-400" data-testid="bobin-total-weight">{totalWeight.toFixed(1)} kg</p>
            </CardContent>
          </Card>
          <Card className="bg-bg-secondary border-border-primary">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-text-secondary">Son Hareket</p>
              <p className="text-2xl font-bold text-amber-400">{movements.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Yeni Bobin Ekle butonu */}
        <Button onClick={() => setIsAddOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="bobin-add-btn">
          <Plus className="h-4 w-4 mr-1" /> Yeni Bobin Ekle
        </Button>

        <Tabs defaultValue="stock" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="stock" data-testid="bobin-tab-stock">Stok</TabsTrigger>
            <TabsTrigger value="history" data-testid="bobin-tab-history">Hareket Gecmisi</TabsTrigger>
          </TabsList>

          {/* STOK TAB */}
          <TabsContent value="stock">
            <div className="space-y-3">
              {bobins.length === 0 && (
                <Card className="bg-bg-secondary border-border-primary">
                  <CardContent className="p-8 text-center text-text-secondary">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Henuz bobin eklenmemis</p>
                  </CardContent>
                </Card>
              )}
              {bobins.map(b => (
                <Card key={b.id} className="bg-bg-secondary border-border-primary" data-testid={`bobin-card-${b.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-text-primary text-base">
                          {b.brand} {b.width_cm}cm {b.grammage}gr
                          <span className="ml-2 text-sm font-normal text-text-secondary">{b.color}</span>
                        </h3>
                        <div className="flex gap-4 mt-1 text-sm text-text-secondary">
                          <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> {b.quantity} adet</span>
                          <span className="flex items-center gap-1"><Weight className="h-3.5 w-3.5" /> {b.total_weight_kg?.toFixed(1)} kg</span>
                          <span className="text-xs">({b.weight_per_piece_kg?.toFixed(1)} kg/adet)</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <Button size="sm" variant="outline" data-testid={`bobin-purchase-${b.id}`}
                          onClick={() => { setSelectedBobin(b); setIsPurchaseOpen(true); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Stok Ekle
                        </Button>
                        <Button size="sm" variant="outline" className="text-blue-400 border-blue-400/30" data-testid={`bobin-machine-${b.id}`}
                          onClick={() => { setSelectedBobin(b); setIsMachineOpen(true); }}>
                          <Factory className="h-3.5 w-3.5 mr-1" /> Makineye
                        </Button>
                        <Button size="sm" variant="outline" className="text-amber-400 border-amber-400/30" data-testid={`bobin-sale-${b.id}`}
                          onClick={() => { setSelectedBobin(b); setIsSaleOpen(true); }}>
                          <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Sat
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* HAREKET GEÇMİŞİ TAB */}
          <TabsContent value="history">
            <div className="space-y-2">
              {movements.length === 0 && (
                <Card className="bg-bg-secondary border-border-primary">
                  <CardContent className="p-8 text-center text-text-secondary">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Henuz hareket yok</p>
                  </CardContent>
                </Card>
              )}
              {movements.map(m => (
                <Card key={m.id} className="bg-bg-secondary border-border-primary">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${typeColor(m.movement_type)}`}>
                            {typeLabel(m.movement_type)}
                          </span>
                          <span className="text-sm text-text-primary">{m.bobin_label}</span>
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5 flex gap-3">
                          <span>{m.movement_type === "purchase" ? "+" : "-"}{m.quantity} adet ({m.weight_kg?.toFixed(1)}kg)</span>
                          {m.machine_name && <span>Makine: {m.machine_name}</span>}
                          {m.customer_name && <span>Musteri: {m.customer_name}</span>}
                          <span>Kullanici: {m.user_name || "-"}</span>
                        </div>
                      </div>
                      <div className="text-xs text-text-secondary whitespace-nowrap">
                        {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* YENİ BOBİN EKLE DİALOG */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Bobin Ekle</DialogTitle>
            <DialogDescription>Yeni bobin turu ve ilk stok miktarini girin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Marka *</Label><Input data-testid="add-bobin-brand" placeholder="Hayat, Eczacibasi..." value={addForm.brand} onChange={e => setAddForm(p => ({...p, brand: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Genislik (cm) *</Label><Input data-testid="add-bobin-width" type="number" placeholder="24, 30, 33..." value={addForm.width_cm} onChange={e => setAddForm(p => ({...p, width_cm: e.target.value}))} /></div>
              <div><Label>Gramaj (gr) *</Label><Input data-testid="add-bobin-grammage" type="number" placeholder="17, 20, 28..." value={addForm.grammage} onChange={e => setAddForm(p => ({...p, grammage: e.target.value}))} /></div>
            </div>
            <div>
              <Label>Kagit Rengi</Label>
              <Select value={addForm.color} onValueChange={v => setAddForm(p => ({...p, color: v}))}>
                <SelectTrigger data-testid="add-bobin-color"><SelectValue /></SelectTrigger>
                <SelectContent>{PAPER_COLORS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Adet *</Label><Input data-testid="add-bobin-qty" type="number" placeholder="4" value={addForm.quantity} onChange={e => setAddForm(p => ({...p, quantity: e.target.value}))} /></div>
              <div><Label>Toplam Agirlik (kg) *</Label><Input data-testid="add-bobin-weight" type="number" placeholder="500" value={addForm.total_weight_kg} onChange={e => setAddForm(p => ({...p, total_weight_kg: e.target.value}))} /></div>
            </div>
            <div><Label>Tedarikci</Label><Input data-testid="add-bobin-supplier" placeholder="Tedarikci adi" value={addForm.supplier} onChange={e => setAddForm(p => ({...p, supplier: e.target.value}))} /></div>
            <Button data-testid="add-bobin-submit" onClick={handleAddBobin} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STOK EKLE DİALOG */}
      <Dialog open={isPurchaseOpen} onOpenChange={setIsPurchaseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Stok Ekle</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr ${selectedBobin.color}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Adet *</Label><Input data-testid="purchase-qty" type="number" value={purchaseForm.quantity} onChange={e => setPurchaseForm(p => ({...p, quantity: e.target.value}))} /></div>
              <div><Label>Agirlik (kg) *</Label><Input data-testid="purchase-weight" type="number" value={purchaseForm.weight_kg} onChange={e => setPurchaseForm(p => ({...p, weight_kg: e.target.value}))} /></div>
            </div>
            <div><Label>Tedarikci</Label><Input data-testid="purchase-supplier" value={purchaseForm.supplier} onChange={e => setPurchaseForm(p => ({...p, supplier: e.target.value}))} /></div>
            <Button data-testid="purchase-submit" onClick={handlePurchase} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Stok Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MAKİNEYE VER DİALOG */}
      <Dialog open={isMachineOpen} onOpenChange={setIsMachineOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Makineye Ver</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm — Stok: ${selectedBobin.quantity} adet`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Makine *</Label>
              <Select value={machineForm.machine_id} onValueChange={v => setMachineForm(p => ({...p, machine_id: v}))}>
                <SelectTrigger data-testid="machine-select"><SelectValue placeholder="Makine secin" /></SelectTrigger>
                <SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Adet *</Label><Input data-testid="machine-qty" type="number" min="1" max={selectedBobin?.quantity || 1} value={machineForm.quantity} onChange={e => setMachineForm(p => ({...p, quantity: e.target.value}))} /></div>
            {selectedBobin && machineForm.quantity && (
              <p className="text-sm text-text-secondary">
                Tahmini agirlik: {(selectedBobin.weight_per_piece_kg * parseInt(machineForm.quantity || 0)).toFixed(1)} kg
              </p>
            )}
            <Button data-testid="machine-submit" onClick={handleToMachine} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Makineye Ver</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MÜŞTERİYE SAT DİALOG */}
      <Dialog open={isSaleOpen} onOpenChange={setIsSaleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Musteriye Sat</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm — Stok: ${selectedBobin.quantity} adet`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Musteri Adi *</Label><Input data-testid="sale-customer" value={saleForm.customer_name} onChange={e => setSaleForm(p => ({...p, customer_name: e.target.value}))} /></div>
            <div><Label>Adet *</Label><Input data-testid="sale-qty" type="number" min="1" max={selectedBobin?.quantity || 1} value={saleForm.quantity} onChange={e => setSaleForm(p => ({...p, quantity: e.target.value}))} /></div>
            <div><Label>Not</Label><Input data-testid="sale-note" value={saleForm.note} onChange={e => setSaleForm(p => ({...p, note: e.target.value}))} /></div>
            <Button data-testid="sale-submit" onClick={handleSale} className="w-full bg-amber-600 hover:bg-amber-700 text-white">Sat</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BobinFlow;
