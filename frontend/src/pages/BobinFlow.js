import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, Plus, Package, History, Download, ShoppingCart, Factory, Layers, LogOut, ScanBarcode, X, Search, ChevronRight, Weight, Hash, Ruler } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const COLOR_OPTIONS = ["Beyaz", "Kraft", "Diger"];

const BobinFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loginError, setLoginError] = useState("");

  const [bobins, setBobins] = useState([]);
  const [machines, setMachines] = useState([]);
  const [movements, setMovements] = useState([]);

  // Dialogs
  const [activeDialog, setActiveDialog] = useState(null); // "add" | "purchase" | "machine" | "sale" | "scanner" | "scan-action"
  const [selectedBobin, setSelectedBobin] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Add form
  const [addForm, setAddForm] = useState({ barcode: "", brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", quantity: "", total_weight_kg: "", supplier: "" });
  const [machineForm, setMachineForm] = useState({ quantity: "1", machine_id: "" });
  const [saleForm, setSaleForm] = useState({ quantity: "1", customer_name: "", note: "" });
  const [purchaseForm, setPurchaseForm] = useState({ quantity: "", weight_kg: "", supplier: "" });

  // Scanner
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [scanMode, setScanMode] = useState("add"); // "add" | "action"

  // ============ SESSION ============
  useEffect(() => {
    const saved = localStorage.getItem("bobin_session");
    if (saved) {
      try {
        const session = JSON.parse(saved);
        const hours = (Date.now() - (session.login_time || 0)) / (1000 * 60 * 60);
        if (hours < 24 && session.username && (session.role === "depo" || session.role === "plan")) {
          setUserData(session);
          setAuthenticated(true);
          if (session.token) localStorage.setItem("auth_token", session.token);
        } else { localStorage.removeItem("bobin_session"); }
      } catch { localStorage.removeItem("bobin_session"); }
    }
  }, []);

  const handleLogin = async () => {
    setLoginError("");
    try {
      const res = await axios.post(`${API}/users/login`, { username, password });
      const data = res.data;
      if (data.role !== "depo" && data.role !== "plan") {
        setLoginError("Bu sayfaya erisim yetkiniz yok. Sadece Depo ve Plan kullanicilari girebilir.");
        return;
      }
      if (data.token) localStorage.setItem("auth_token", data.token);
      const session = { ...data, login_time: Date.now() };
      localStorage.setItem("bobin_session", JSON.stringify(session));
      setUserData(session);
      setAuthenticated(true);
    } catch (err) {
      setLoginError(err.response?.data?.detail || "Giris basarisiz");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("bobin_session");
    localStorage.removeItem("auth_token");
    setAuthenticated(false);
    setUserData(null);
  };

  // ============ DATA ============
  const fetchData = useCallback(async () => {
    try {
      const [b, m, mv] = await Promise.all([
        axios.get(`${API}/bobins`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/bobins/movements?limit=100`),
      ]);
      setBobins(b.data);
      setMachines(m.data);
      setMovements(mv.data);
    } catch (err) { console.error("Fetch:", err); }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [authenticated, fetchData]);

  const userName = userData?.display_name || userData?.username || "";

  // ============ SCANNER ============
  const startScanner = (mode) => {
    setScanMode(mode);
    setActiveDialog("scanner");
  };

  useEffect(() => {
    if (activeDialog !== "scanner") {
      if (html5QrCodeRef.current) {
        try { html5QrCodeRef.current.stop().catch(() => {}); } catch {}
        html5QrCodeRef.current = null;
      }
      return;
    }
    let mounted = true;
    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !scannerRef.current) return;
        const scanner = new Html5Qrcode("bobin-scanner-reader");
        html5QrCodeRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
          (text) => {
            scanner.stop().catch(() => {});
            handleBarcodeScanned(text);
          },
          () => {}
        );
      } catch (e) { console.error("Scanner:", e); toast.error("Kamera erisimi saglanamadi"); setActiveDialog(null); }
    };
    setTimeout(initScanner, 300);
    return () => { mounted = false; };
  }, [activeDialog]);

  const handleBarcodeScanned = async (code) => {
    if (scanMode === "add") {
      // Stok ekleme — barkodu form'a yaz
      setAddForm(p => ({ ...p, barcode: code }));
      setActiveDialog("add");
      toast.success(`Barkod okundu: ${code}`);
      // Mevcut bobin var mi kontrol
      try {
        const res = await axios.get(`${API}/bobins/barcode/${code}`);
        if (res.data) {
          setAddForm(p => ({
            ...p,
            barcode: code,
            brand: res.data.brand || "",
            width_cm: String(res.data.width_cm || ""),
            grammage: String(res.data.grammage || ""),
            color: COLOR_OPTIONS.includes(res.data.color) ? res.data.color : "Diger",
            customColor: COLOR_OPTIONS.includes(res.data.color) ? "" : res.data.color,
          }));
          toast.info("Mevcut bobin bulundu — bilgiler dolduruldu");
        }
      } catch { /* Yeni barkod */ }
    } else {
      // Makineye ver / Sat akışı — barkodla bobin bul
      try {
        const res = await axios.get(`${API}/bobins/barcode/${code}`);
        setSelectedBobin(res.data);
        setActiveDialog("scan-action");
        toast.success(`Bobin bulundu: ${res.data.brand} ${res.data.width_cm}cm`);
      } catch {
        toast.error("Bu barkoda ait bobin bulunamadi");
        setActiveDialog(null);
      }
    }
  };

  // ============ ACTIONS ============
  const handleAddBobin = async () => {
    const color = addForm.color === "Diger" ? addForm.customColor.trim() : addForm.color;
    if (!addForm.brand || !addForm.width_cm || !addForm.grammage || !addForm.quantity || !addForm.total_weight_kg || !color) {
      toast.error("Tum zorunlu alanlari doldurun"); return;
    }
    try {
      const res = await axios.post(`${API}/bobins`, {
        barcode: addForm.barcode, brand: addForm.brand.trim(),
        width_cm: parseFloat(addForm.width_cm), grammage: parseFloat(addForm.grammage),
        color, quantity: parseInt(addForm.quantity),
        total_weight_kg: parseFloat(addForm.total_weight_kg),
        supplier: addForm.supplier, user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null);
      setAddForm({ barcode: "", brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", quantity: "", total_weight_kg: "", supplier: "" });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handlePurchase = async () => {
    if (!purchaseForm.quantity || !purchaseForm.weight_kg) { toast.error("Adet ve agirlik zorunlu"); return; }
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/purchase`, {
        quantity: parseInt(purchaseForm.quantity), weight_kg: parseFloat(purchaseForm.weight_kg),
        supplier: purchaseForm.supplier, user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null); setPurchaseForm({ quantity: "", weight_kg: "", supplier: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handleToMachine = async () => {
    if (!machineForm.machine_id || !machineForm.quantity) { toast.error("Makine ve adet secin"); return; }
    const machine = machines.find(m => m.id === machineForm.machine_id);
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/to-machine`, {
        quantity: parseInt(machineForm.quantity), machine_id: machineForm.machine_id,
        machine_name: machine?.name || "", user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null); setMachineForm({ quantity: "1", machine_id: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handleSale = async () => {
    if (!saleForm.customer_name || !saleForm.quantity) { toast.error("Musteri ve adet zorunlu"); return; }
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/sale`, {
        quantity: parseInt(saleForm.quantity), customer_name: saleForm.customer_name,
        note: saleForm.note, user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null); setSaleForm({ quantity: "1", customer_name: "", note: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/bobins/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url;
      a.download = `bobin_stok_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
      window.URL.revokeObjectURL(url); toast.success("Excel indirildi");
    } catch { toast.error("Excel hatasi"); }
  };

  const filteredBobins = bobins.filter(b => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (b.brand?.toLowerCase().includes(s) || b.barcode?.toLowerCase().includes(s) ||
      String(b.width_cm).includes(s) || String(b.grammage).includes(s) || b.color?.toLowerCase().includes(s));
  });

  const typeLabel = (t) => ({ purchase: "Alis", to_machine: "Makineye", sale: "Satis" }[t] || t);
  const typeBg = (t) => ({ purchase: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", to_machine: "bg-sky-500/10 text-sky-400 border-sky-500/20", sale: "bg-amber-500/10 text-amber-400 border-amber-500/20" }[t] || "bg-zinc-500/10 text-zinc-400");

  const totalQty = bobins.reduce((s, b) => s + (b.quantity || 0), 0);
  const totalWt = bobins.reduce((s, b) => s + (b.total_weight_kg || 0), 0);

  // ============ LOGIN SCREEN ============
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#111827] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
          className="w-full max-w-sm">
          <div className="bg-[#1a1f2e]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <Layers className="h-8 w-8 text-emerald-400" />
              </div>
              <h1 className="text-xl font-semibold text-white tracking-tight">Bobin Yonetimi</h1>
              <p className="text-sm text-zinc-500 mt-1">Depo veya Plan hesabinizla giris yapin</p>
            </div>
            <div className="space-y-3">
              <Input data-testid="bobin-login-username" placeholder="Kullanici adi" value={username}
                onChange={e => { setUsername(e.target.value); setLoginError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-11" />
              <Input data-testid="bobin-login-password" type="password" placeholder="Sifre" value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 h-11" />
              <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="bobin-remember-me">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                <span className="text-sm text-zinc-400">Beni hatirla</span>
              </label>
              {loginError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" data-testid="bobin-login-error">{loginError}</p>}
              <Button data-testid="bobin-login-btn" onClick={handleLogin}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11 font-medium">Giris Yap</Button>
            </div>
          </div>
          <button onClick={() => navigate("/")} className="flex items-center justify-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-400 mt-6 mx-auto transition-colors">
            <ArrowLeft className="h-4 w-4" /> Ana Sayfa
          </button>
        </motion.div>
      </div>
    );
  }

  // ============ MAIN UI ============
  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      {/* Header */}
      <header className="bg-[#111827]/90 backdrop-blur-lg border-b border-white/[0.06] px-4 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-zinc-500 hover:text-white transition-colors" data-testid="bobin-back-btn">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-400" /> Bobin Yonetimi
              </h1>
              <p className="text-xs text-zinc-500">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={handleExport} className="text-zinc-400 hover:text-white" data-testid="bobin-export-btn">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="text-zinc-400 hover:text-white">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-400 hover:text-white" data-testid="bobin-logout-btn">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bobin Cesidi", value: bobins.length, color: "text-white" },
            { label: "Toplam Adet", value: totalQty, color: "text-emerald-400" },
            { label: "Toplam Agirlik", value: `${totalWt.toFixed(0)} kg`, color: "text-sky-400" },
          ].map((s, i) => (
            <div key={i} className="bg-[#1a1f2e]/60 border border-white/[0.06] rounded-xl p-4 text-center">
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setAddForm({ barcode: "", brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", quantity: "", total_weight_kg: "", supplier: "" }); setActiveDialog("add"); }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5" data-testid="bobin-add-btn">
            <Plus className="h-4 w-4" /> Stoga Ekle
          </Button>
          <Button onClick={() => startScanner("add")} variant="outline"
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5" data-testid="bobin-scan-add-btn">
            <ScanBarcode className="h-4 w-4" /> Barkod Okut ve Ekle
          </Button>
          <Button onClick={() => startScanner("action")} variant="outline"
            className="border-sky-500/30 text-sky-400 hover:bg-sky-500/10 gap-1.5" data-testid="bobin-scan-action-btn">
            <ScanBarcode className="h-4 w-4" /> Barkod Okut (Makineye/Sat)
          </Button>
        </div>

        <Tabs defaultValue="stock" className="w-full">
          <TabsList className="bg-[#1a1f2e]/60 border border-white/[0.06] p-1 rounded-xl">
            <TabsTrigger value="stock" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 rounded-lg" data-testid="bobin-tab-stock">
              <Package className="h-4 w-4 mr-1.5" /> Stok ({bobins.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-400 rounded-lg" data-testid="bobin-tab-history">
              <History className="h-4 w-4 mr-1.5" /> Gecmis ({movements.length})
            </TabsTrigger>
          </TabsList>

          {/* STOK */}
          <TabsContent value="stock" className="mt-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input placeholder="Marka, barkod, olcu ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 bg-[#1a1f2e]/60 border-white/[0.06] text-white placeholder:text-zinc-600" data-testid="bobin-search" />
              </div>
            </div>
            <div className="space-y-2">
              {filteredBobins.length === 0 && (
                <div className="text-center py-16 text-zinc-600">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{searchTerm ? "Sonuc bulunamadi" : "Henuz bobin eklenmemis"}</p>
                </div>
              )}
              {filteredBobins.map(b => (
                <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="bg-[#1a1f2e]/60 border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-colors"
                  data-testid={`bobin-card-${b.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{b.brand}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">{b.color}</span>
                        {b.barcode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">{b.barcode}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {b.width_cm} cm</span>
                        <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {b.grammage} gr</span>
                        <span className="flex items-center gap-1 text-emerald-400 font-medium"><Layers className="h-3 w-3" /> {b.quantity} adet</span>
                        <span className="flex items-center gap-1 text-sky-400"><Weight className="h-3 w-3" /> {b.total_weight_kg?.toFixed(1)} kg</span>
                        <span className="text-zinc-600">({b.weight_per_piece_kg?.toFixed(1)} kg/adet)</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10"
                        data-testid={`bobin-purchase-${b.id}`}
                        onClick={() => { setSelectedBobin(b); setPurchaseForm({ quantity: "", weight_kg: "", supplier: "" }); setActiveDialog("purchase"); }}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Ekle
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-sky-400 hover:bg-sky-500/10"
                        data-testid={`bobin-machine-${b.id}`}
                        onClick={() => { setSelectedBobin(b); setMachineForm({ quantity: "1", machine_id: "" }); setActiveDialog("machine"); }}>
                        <Factory className="h-3.5 w-3.5 mr-1" /> Makine
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-amber-400 hover:bg-amber-500/10"
                        data-testid={`bobin-sale-${b.id}`}
                        onClick={() => { setSelectedBobin(b); setSaleForm({ quantity: "1", customer_name: "", note: "" }); setActiveDialog("sale"); }}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Sat
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          {/* GEÇMİŞ */}
          <TabsContent value="history" className="mt-4 space-y-1.5">
            {movements.length === 0 && (
              <div className="text-center py-16 text-zinc-600">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Henuz hareket yok</p>
              </div>
            )}
            {movements.map(m => (
              <div key={m.id} className="bg-[#1a1f2e]/40 border border-white/[0.04] rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeBg(m.movement_type)}`}>
                      {typeLabel(m.movement_type)}
                    </span>
                    <span className="text-sm text-zinc-300 truncate">{m.bobin_label}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-[11px] text-zinc-600">
                    <span>{m.movement_type === "purchase" ? "+" : "-"}{m.quantity} adet / {m.weight_kg?.toFixed(1)}kg</span>
                    {m.machine_name && <span className="text-sky-400/60">Makine: {m.machine_name}</span>}
                    {m.customer_name && <span className="text-amber-400/60">Musteri: {m.customer_name}</span>}
                    <span>Kullanici: {m.user_name || "-"}</span>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-600 whitespace-nowrap ml-3">
                  {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* ========== DIALOGS ========== */}

      {/* SCANNER */}
      <Dialog open={activeDialog === "scanner"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Barkod Okut</DialogTitle>
            <DialogDescription>{scanMode === "add" ? "Stoga eklemek icin barkod okutun" : "Makineye vermek veya satmak icin barkod okutun"}</DialogDescription>
          </DialogHeader>
          <div id="bobin-scanner-reader" ref={scannerRef} className="w-full rounded-lg overflow-hidden" />
        </DialogContent>
      </Dialog>

      {/* SCAN ACTION — Barkod okunduktan sonra: Makineye mi Sat mı? */}
      <Dialog open={activeDialog === "scan-action"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Bobin Bulundu</DialogTitle>
            <DialogDescription>
              {selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr ${selectedBobin.color} — ${selectedBobin.quantity} adet (${selectedBobin.total_weight_kg?.toFixed(1)}kg)`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Button className="bg-sky-500 hover:bg-sky-600 text-white h-14 text-sm gap-2"
              data-testid="scan-to-machine"
              onClick={() => { setMachineForm({ quantity: "1", machine_id: "" }); setActiveDialog("machine"); }}>
              <Factory className="h-5 w-5" /> Makineye Ver
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white h-14 text-sm gap-2"
              data-testid="scan-to-sale"
              onClick={() => { setSaleForm({ quantity: "1", customer_name: "", note: "" }); setActiveDialog("sale"); }}>
              <ShoppingCart className="h-5 w-5" /> Sat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STOGA EKLE */}
      <Dialog open={activeDialog === "add"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-md bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Stoga Bobin Ekle</DialogTitle>
            <DialogDescription>Yeni bobin turu veya mevcut stoga ekleyin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {addForm.barcode && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <ScanBarcode className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-300 font-mono">{addForm.barcode}</span>
              </div>
            )}
            {!addForm.barcode && (
              <div>
                <Label className="text-zinc-400">Barkod (opsiyonel)</Label>
                <Input data-testid="add-bobin-barcode" placeholder="Manuel barkod girisi" value={addForm.barcode}
                  onChange={e => setAddForm(p => ({...p, barcode: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white font-mono" />
              </div>
            )}
            <div>
              <Label className="text-zinc-400">Marka *</Label>
              <Input data-testid="add-bobin-brand" placeholder="Hayat, Eczacibasi..." value={addForm.brand}
                onChange={e => setAddForm(p => ({...p, brand: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-400">Genislik (cm) *</Label>
                <Input data-testid="add-bobin-width" type="number" placeholder="24" value={addForm.width_cm}
                  onChange={e => setAddForm(p => ({...p, width_cm: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white" />
              </div>
              <div>
                <Label className="text-zinc-400">Gramaj (gr) *</Label>
                <Input data-testid="add-bobin-grammage" type="number" placeholder="17" value={addForm.grammage}
                  onChange={e => setAddForm(p => ({...p, grammage: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white" />
              </div>
            </div>
            <div>
              <Label className="text-zinc-400">Renk *</Label>
              <Select value={addForm.color} onValueChange={v => setAddForm(p => ({...p, color: v, customColor: v === "Diger" ? p.customColor : ""}))}>
                <SelectTrigger data-testid="add-bobin-color" className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{COLOR_OPTIONS.map(c => <SelectItem key={c} value={c}>{c === "Diger" ? "Diger..." : c}</SelectItem>)}</SelectContent>
              </Select>
              {addForm.color === "Diger" && (
                <Input data-testid="add-bobin-custom-color" placeholder="Renk girin..." value={addForm.customColor}
                  onChange={e => setAddForm(p => ({...p, customColor: e.target.value}))}
                  className="mt-2 bg-white/[0.04] border-white/[0.08] text-white" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-400">Adet *</Label>
                <Input data-testid="add-bobin-qty" type="number" placeholder="4" value={addForm.quantity}
                  onChange={e => setAddForm(p => ({...p, quantity: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white" />
              </div>
              <div>
                <Label className="text-zinc-400">Toplam Agirlik (kg) *</Label>
                <Input data-testid="add-bobin-weight" type="number" placeholder="500" value={addForm.total_weight_kg}
                  onChange={e => setAddForm(p => ({...p, total_weight_kg: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white" />
              </div>
            </div>
            {addForm.quantity && addForm.total_weight_kg && (
              <p className="text-xs text-zinc-500">Adet basi: {(parseFloat(addForm.total_weight_kg) / parseInt(addForm.quantity || 1)).toFixed(1)} kg</p>
            )}
            <div>
              <Label className="text-zinc-400">Tedarikci</Label>
              <Input data-testid="add-bobin-supplier" placeholder="Tedarikci" value={addForm.supplier}
                onChange={e => setAddForm(p => ({...p, supplier: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <Button data-testid="add-bobin-submit" onClick={handleAddBobin} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">Stoga Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STOK EKLE */}
      <Dialog open={activeDialog === "purchase"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Stok Ekle</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr ${selectedBobin.color}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-zinc-400">Adet *</Label><Input data-testid="purchase-qty" type="number" value={purchaseForm.quantity} onChange={e => setPurchaseForm(p => ({...p, quantity: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
              <div><Label className="text-zinc-400">Agirlik (kg) *</Label><Input data-testid="purchase-weight" type="number" value={purchaseForm.weight_kg} onChange={e => setPurchaseForm(p => ({...p, weight_kg: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            </div>
            <div><Label className="text-zinc-400">Tedarikci</Label><Input data-testid="purchase-supplier" value={purchaseForm.supplier} onChange={e => setPurchaseForm(p => ({...p, supplier: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <Button data-testid="purchase-submit" onClick={handlePurchase} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">Stok Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MAKİNEYE VER */}
      <Dialog open={activeDialog === "machine"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Makineye Ver</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr — Stok: ${selectedBobin.quantity} adet`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-400">Makine *</Label>
              <Select value={machineForm.machine_id} onValueChange={v => setMachineForm(p => ({...p, machine_id: v}))}>
                <SelectTrigger data-testid="machine-select" className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue placeholder="Makine secin" /></SelectTrigger>
                <SelectContent>{machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400">Adet *</Label>
              <Input data-testid="machine-qty" type="number" min="1" max={selectedBobin?.quantity || 1} value={machineForm.quantity}
                onChange={e => setMachineForm(p => ({...p, quantity: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            {selectedBobin && machineForm.quantity && (
              <p className="text-xs text-zinc-500">Cikarilacak agirlik: {(selectedBobin.weight_per_piece_kg * parseInt(machineForm.quantity || 0)).toFixed(1)} kg</p>
            )}
            <Button data-testid="machine-submit" onClick={handleToMachine} className="w-full bg-sky-500 hover:bg-sky-600 text-white h-11">Makineye Ver</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SATIŞ */}
      <Dialog open={activeDialog === "sale"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Musteriye Sat</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm — Stok: ${selectedBobin.quantity} adet`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-zinc-400">Musteri Adi *</Label><Input data-testid="sale-customer" value={saleForm.customer_name} onChange={e => setSaleForm(p => ({...p, customer_name: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div><Label className="text-zinc-400">Adet *</Label><Input data-testid="sale-qty" type="number" min="1" value={saleForm.quantity} onChange={e => setSaleForm(p => ({...p, quantity: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div><Label className="text-zinc-400">Not</Label><Input data-testid="sale-note" value={saleForm.note} onChange={e => setSaleForm(p => ({...p, note: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <Button data-testid="sale-submit" onClick={handleSale} className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11">Sat</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BobinFlow;
