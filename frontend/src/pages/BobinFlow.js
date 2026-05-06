import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, Plus, Package, History, Download, ShoppingCart, Factory, Layers, LogOut, ScanBarcode, Search, Weight, Hash, Ruler, Pencil, Archive, Calendar, ChevronRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const COLOR_OPTIONS = ["Beyaz", "Kraft", "Diger"];
const LAYER_OPTIONS = [
  { value: "1", label: "TEK" },
  { value: "2", label: "CIFT" },
  { value: "other", label: "Diger..." },
];

// Bobin Takip Sistemine eklenmiş harici hedefler (gerçek üretim makineleri değil,
// fakat bobin transferinde sıkça kullanılan harici grup/makineler).
const EXTRA_DESTINATIONS = [
  { id: "ext-27-makine", name: "27 Makine" },
  { id: "ext-sies-33-makine", name: "SİES 33 Makine" },
  { id: "ext-deniz-grubu", name: "Deniz Grubu" },
];

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
  const [activeDialog, setActiveDialog] = useState(null); // "add" | "purchase" | "machine" | "sale" | "scanner" | "scan-action" | "edit"
  const [selectedBobin, setSelectedBobin] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLayers, setFilterLayers] = useState("all"); // all | 1 | 2 | 3plus
  const [filterColor, setFilterColor] = useState("all"); // all | Beyaz | Kraft | other
  const [filterWidth, setFilterWidth] = useState("all"); // all | <width_cm number>

  // Forms (kg odaklı; adet artık sorulmuyor)
  const [addForm, setAddForm] = useState({ barcode: "", brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", layers: "1", customLayers: "", total_weight_kg: "", supplier: "" });
  const [machineForm, setMachineForm] = useState({ weight_kg: "", machine_id: "" });
  const [saleForm, setSaleForm] = useState({ weight_kg: "", customer_name: "", note: "" });
  const [purchaseForm, setPurchaseForm] = useState({ weight_kg: "", supplier: "" });
  const [editForm, setEditForm] = useState({ brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", layers: "1", customLayers: "", total_weight_kg: "", barcode: "", supplier: "" });

  // Scanner
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const [scanMode, setScanMode] = useState("add"); // "add" | "action"

  // Archive (aylık arşiv)
  const [archiveMonths, setArchiveMonths] = useState([]);
  const [archiveMonth, setArchiveMonth] = useState("");

  // Detail Drawer
  const [drawerBobin, setDrawerBobin] = useState(null);
  const [drawerMovements, setDrawerMovements] = useState([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // ============ SESSION ============
  useEffect(() => {
    const saved = localStorage.getItem("bobin_session");
    if (saved) {
      try {
        const session = JSON.parse(saved);
        const hours = (Date.now() - (session.login_time || 0)) / (1000 * 60 * 60);
        const sessionRoles = (session.roles && session.roles.length > 0) ? session.roles : (session.role ? [session.role] : []);
        const hasAccess = sessionRoles.includes("depo") || sessionRoles.includes("plan");
        if (hours < 24 && session.username && hasAccess) {
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
      const userRoles = (data.roles && data.roles.length > 0) ? data.roles : (data.role ? [data.role] : []);
      const hasAccess = userRoles.includes("depo") || userRoles.includes("plan");
      if (!hasAccess) {
        setLoginError("Bu sayfaya erisim yetkiniz yok. Bu modul Depo veya Planlama rolu gerektirir.");
        return;
      }
      if (data.token) localStorage.setItem("auth_token", data.token);
      const session = { ...data, roles: userRoles, login_time: Date.now() };
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
      const results = await Promise.allSettled([
        axios.get(`${API}/bobins`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/bobins/movements?limit=100`),
      ]);
      const safe = (r) => r.status === "fulfilled" && Array.isArray(r.value.data) ? r.value.data : null;
      const b = safe(results[0]); if (b) setBobins(b);
      const m = safe(results[1]); if (m) setMachines(m);
      const mv = safe(results[2]); if (mv) setMovements(mv);
    } catch (err) { console.error("Fetch:", err); }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [authenticated, fetchData]);

  const userName = userData?.display_name || userData?.username || "";

  // Tüm makine seçenekleri: gerçek üretim makineleri + harici hedefler
  const allMachineOptions = [
    ...machines.map(m => ({ id: m.id, name: m.name })),
    ...EXTRA_DESTINATIONS,
  ];

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
      setAddForm(p => ({ ...p, barcode: code }));
      setActiveDialog("add");
      toast.success(`Barkod okundu: ${code}`);
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
            layers: (res.data.layers === 1 || res.data.layers === 2) ? String(res.data.layers) : "other",
            customLayers: (res.data.layers && res.data.layers > 2) ? String(res.data.layers) : "",
          }));
          toast.info("Mevcut bobin bulundu — bilgiler dolduruldu");
        }
      } catch { /* yeni barkod */ }
    } else {
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
    if (!addForm.brand || !addForm.width_cm || !addForm.grammage || !addForm.total_weight_kg || !color) {
      toast.error("Marka, genislik, gramaj, renk ve toplam agirlik zorunludur"); return;
    }
    let layers = 1;
    if (addForm.layers === "other") {
      layers = parseInt(addForm.customLayers || "0");
      if (!layers || layers < 1) { toast.error("Kat sayisi gecerli olmali"); return; }
    } else {
      layers = parseInt(addForm.layers || "1");
    }
    try {
      const res = await axios.post(`${API}/bobins`, {
        barcode: addForm.barcode, brand: addForm.brand.trim(),
        width_cm: parseFloat(addForm.width_cm), grammage: parseFloat(addForm.grammage),
        color, layers, total_weight_kg: parseFloat(addForm.total_weight_kg),
        supplier: addForm.supplier, user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null);
      setAddForm({ barcode: "", brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", layers: "1", customLayers: "", total_weight_kg: "", supplier: "" });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handlePurchase = async () => {
    if (!purchaseForm.weight_kg) { toast.error("Agirlik (kg) zorunlu"); return; }
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/purchase`, {
        weight_kg: parseFloat(purchaseForm.weight_kg),
        supplier: purchaseForm.supplier, user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null); setPurchaseForm({ weight_kg: "", supplier: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handleToMachine = async () => {
    if (!machineForm.machine_id || !machineForm.weight_kg) { toast.error("Makine ve agirlik (kg) secin"); return; }
    const machine = allMachineOptions.find(m => m.id === machineForm.machine_id);
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/to-machine`, {
        weight_kg: parseFloat(machineForm.weight_kg),
        machine_id: machineForm.machine_id,
        machine_name: machine?.name || "", user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null); setMachineForm({ weight_kg: "", machine_id: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handleSale = async () => {
    if (!saleForm.customer_name || !saleForm.weight_kg) { toast.error("Musteri ve agirlik (kg) zorunlu"); return; }
    try {
      const res = await axios.post(`${API}/bobins/${selectedBobin.id}/sale`, {
        weight_kg: parseFloat(saleForm.weight_kg),
        customer_name: saleForm.customer_name,
        note: saleForm.note, user_name: userName
      });
      toast.success(res.data.message);
      setActiveDialog(null); setSaleForm({ weight_kg: "", customer_name: "", note: "" }); fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const openEditDialog = (b) => {
    setSelectedBobin(b);
    const lyr = b.layers || 1;
    setEditForm({
      brand: b.brand || "",
      width_cm: String(b.width_cm || ""),
      grammage: String(b.grammage || ""),
      color: COLOR_OPTIONS.includes(b.color) ? b.color : "Diger",
      customColor: COLOR_OPTIONS.includes(b.color) ? "" : (b.color || ""),
      layers: (lyr === 1 || lyr === 2) ? String(lyr) : "other",
      customLayers: lyr > 2 ? String(lyr) : "",
      total_weight_kg: String(b.total_weight_kg ?? ""),
      barcode: b.barcode || "",
      supplier: b.supplier || "",
    });
    setActiveDialog("edit");
  };

  const handleEditSubmit = async () => {
    const color = editForm.color === "Diger" ? editForm.customColor.trim() : editForm.color;
    if (!editForm.brand || !editForm.width_cm || !editForm.grammage || !color) {
      toast.error("Marka, genislik, gramaj ve renk zorunludur"); return;
    }
    let layers = 1;
    if (editForm.layers === "other") {
      layers = parseInt(editForm.customLayers || "0");
      if (!layers || layers < 1) { toast.error("Kat sayisi gecerli olmali"); return; }
    } else {
      layers = parseInt(editForm.layers || "1");
    }
    try {
      const res = await axios.patch(`${API}/bobins/${selectedBobin.id}`, {
        brand: editForm.brand.trim(),
        width_cm: parseFloat(editForm.width_cm),
        grammage: parseFloat(editForm.grammage),
        color,
        layers,
        total_weight_kg: editForm.total_weight_kg !== "" ? parseFloat(editForm.total_weight_kg) : undefined,
        barcode: editForm.barcode,
        supplier: editForm.supplier,
        user_name: userName,
      });
      toast.success(res.data.message || "Guncellendi");
      setActiveDialog(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || "Hata"); }
  };

  const handleExport = async (month = null) => {
    try {
      const url = month ? `${API}/bobins/export?month=${month}` : `${API}/bobins/export`;
      const res = await axios.get(url, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = blobUrl;
      a.download = month
        ? `bobin_arsiv_${month}.xlsx`
        : `bobin_stok_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      toast.success(month ? `${month} arşivi indirildi` : "Excel indirildi");
    } catch { toast.error("Excel hatasi"); }
  };

  const openArchive = async () => {
    setActiveDialog("archive");
    setArchiveMonth("");
    try {
      const res = await axios.get(`${API}/bobins/archive/months`);
      const months = Array.isArray(res.data) ? res.data : [];
      // Şu anki ay yoksa en başa ekle
      const cm = new Date().toISOString().slice(0, 7);
      if (!months.includes(cm)) months.unshift(cm);
      setArchiveMonths(months);
    } catch { setArchiveMonths([]); }
  };

  const openDrawer = async (b) => {
    setDrawerBobin(b);
    setDrawerLoading(true);
    setDrawerMovements([]);
    try {
      const res = await axios.get(`${API}/bobins/movements?bobin_id=${b.id}&limit=50`);
      setDrawerMovements(Array.isArray(res.data) ? res.data : []);
    } catch { /* sessiz */ }
    setDrawerLoading(false);
  };
  const closeDrawer = () => { setDrawerBobin(null); setDrawerMovements([]); };

  const monthLabel = (ym) => {
    const TR = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
                "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];
    if (!ym || !ym.includes("-")) return ym;
    const [y, m] = ym.split("-");
    const idx = parseInt(m) - 1;
    return `${TR[idx] || m} ${y}`;
  };

  const filteredBobins = bobins.filter(b => {
    // Kat filtre
    const lyr = b.layers || 1;
    if (filterLayers === "1" && lyr !== 1) return false;
    if (filterLayers === "2" && lyr !== 2) return false;
    if (filterLayers === "3plus" && lyr < 3) return false;
    // Renk filtre
    if (filterColor === "Beyaz" && b.color !== "Beyaz") return false;
    if (filterColor === "Kraft" && b.color !== "Kraft") return false;
    if (filterColor === "other" && (b.color === "Beyaz" || b.color === "Kraft")) return false;
    // Genislik filtre
    if (filterWidth !== "all" && Number(b.width_cm) !== Number(filterWidth)) return false;
    // Search
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (b.brand?.toLowerCase().includes(s) || b.barcode?.toLowerCase().includes(s) ||
      String(b.width_cm).includes(s) || String(b.grammage).includes(s) || b.color?.toLowerCase().includes(s));
  });

  // Dinamik genislik listesi (kucukten buyuge)
  const availableWidths = Array.from(new Set(bobins.map(b => Number(b.width_cm)).filter(w => w > 0))).sort((a, b) => a - b);

  const typeLabel = (t) => ({ purchase: "Alis", to_machine: "Makineye", sale: "Satis" }[t] || t);
  const typeBg = (t) => ({ purchase: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", to_machine: "bg-sky-500/10 text-sky-400 border-sky-500/20", sale: "bg-amber-500/10 text-amber-400 border-amber-500/20" }[t] || "bg-zinc-500/10 text-zinc-400");

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
            <Button variant="ghost" size="sm" onClick={openArchive} className="text-zinc-400 hover:text-white" data-testid="bobin-archive-btn" title="Aylık Arşiv">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleExport()} className="text-zinc-400 hover:text-white" data-testid="bobin-export-btn">
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
        {/* Stats — kg odakli */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#1a1f2e]/60 border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Bobin Cesidi</p>
            <p className="text-2xl font-bold mt-1 text-white">{bobins.length}</p>
          </div>
          <div className="bg-[#1a1f2e]/60 border border-white/[0.06] rounded-xl p-4 text-center">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Toplam Agirlik</p>
            <p className="text-2xl font-bold mt-1 text-sky-400">{totalWt.toFixed(0)} kg</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setAddForm({ barcode: "", brand: "", width_cm: "", grammage: "", color: "Beyaz", customColor: "", layers: "1", customLayers: "", total_weight_kg: "", supplier: "" }); setActiveDialog("add"); }}
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
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input placeholder="Marka, barkod, olcu ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 bg-[#1a1f2e]/60 border-white/[0.06] text-white placeholder:text-zinc-600" data-testid="bobin-search" />
              </div>
            </div>
            {/* Filtre Chip'leri */}
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600 mr-1">Kat:</span>
                {[
                  { v: "all", label: "Hepsi" },
                  { v: "1", label: "TEK" },
                  { v: "2", label: "CIFT" },
                  { v: "3plus", label: "3+ KAT" },
                ].map(o => (
                  <button key={o.v} onClick={() => setFilterLayers(o.v)} data-testid={`filter-layers-${o.v}`}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      filterLayers === o.v
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                    }`}>{o.label}</button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-zinc-600 mr-1">Renk:</span>
                {[
                  { v: "all", label: "Hepsi" },
                  { v: "Beyaz", label: "Beyaz" },
                  { v: "Kraft", label: "Kraft" },
                  { v: "other", label: "Diger" },
                ].map(o => (
                  <button key={o.v} onClick={() => setFilterColor(o.v)} data-testid={`filter-color-${o.v}`}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      filterColor === o.v
                        ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                        : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                    }`}>{o.label}</button>
                ))}
              </div>
              {availableWidths.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-600 mr-1">Genislik:</span>
                  <button onClick={() => setFilterWidth("all")} data-testid="filter-width-all"
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      filterWidth === "all"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                    }`}>Hepsi</button>
                  {availableWidths.map(w => (
                    <button key={w} onClick={() => setFilterWidth(String(w))} data-testid={`filter-width-${w}`}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                        Number(filterWidth) === w
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-300"
                      }`}>{Number.isInteger(w) ? w : w.toFixed(1)} cm</button>
                  ))}
                </div>
              )}
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <button onClick={() => openDrawer(b)} type="button"
                      data-testid={`bobin-detail-${b.id}`}
                      className="min-w-0 flex-1 text-left -mx-1 px-1 py-1 rounded-md hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{b.brand}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">{b.color}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          {b.layers === 1 || !b.layers ? "TEK" : b.layers === 2 ? "CIFT" : `${b.layers} KAT`}
                        </span>
                        {b.barcode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">{b.barcode}</span>}
                        <ChevronRight className="h-3 w-3 text-zinc-600 ml-auto sm:hidden" />
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-1 mt-2 text-xs text-zinc-500 flex-wrap">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap"><Ruler className="h-3 w-3" /> {b.width_cm} cm</span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap"><Hash className="h-3 w-3" /> {b.grammage} gr</span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-sky-400 font-medium"><Weight className="h-3 w-3" /> {b.total_weight_kg?.toFixed(1)} kg</span>
                      </div>
                    </button>
                    <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-shrink-0 sm:flex-wrap sm:justify-end border-t border-white/[0.04] pt-3 sm:border-t-0 sm:pt-0">
                      <Button size="sm" variant="ghost" className="h-9 px-2 text-xs text-emerald-400 hover:bg-emerald-500/10 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1"
                        data-testid={`bobin-purchase-${b.id}`}
                        onClick={() => { setSelectedBobin(b); setPurchaseForm({ weight_kg: "", supplier: "" }); setActiveDialog("purchase"); }}>
                        <Plus className="h-3.5 w-3.5" /> <span>Ekle</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 px-2 text-xs text-sky-400 hover:bg-sky-500/10 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1"
                        data-testid={`bobin-machine-${b.id}`}
                        onClick={() => { setSelectedBobin(b); setMachineForm({ weight_kg: "", machine_id: "" }); setActiveDialog("machine"); }}>
                        <Factory className="h-3.5 w-3.5" /> <span>Makine</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 px-2 text-xs text-amber-400 hover:bg-amber-500/10 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1"
                        data-testid={`bobin-sale-${b.id}`}
                        onClick={() => { setSelectedBobin(b); setSaleForm({ weight_kg: "", customer_name: "", note: "" }); setActiveDialog("sale"); }}>
                        <ShoppingCart className="h-3.5 w-3.5" /> <span>Sat</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 px-2 text-xs text-zinc-400 hover:bg-zinc-500/10 flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1"
                        data-testid={`bobin-edit-${b.id}`}
                        onClick={() => openEditDialog(b)}>
                        <Pencil className="h-3.5 w-3.5" /> <span>Duzenle</span>
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
                  <div className="flex gap-3 mt-1 text-[11px] text-zinc-600 flex-wrap">
                    <span>{m.movement_type === "purchase" ? "+" : "-"}{m.weight_kg?.toFixed(1)} kg</span>
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
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Barkod Okut</DialogTitle>
            <DialogDescription>{scanMode === "add" ? "Stoga eklemek icin barkod okutun" : "Makineye vermek veya satmak icin barkod okutun"}</DialogDescription>
          </DialogHeader>
          <div id="bobin-scanner-reader" ref={scannerRef} className="w-full rounded-lg overflow-hidden" />
        </DialogContent>
      </Dialog>

      {/* SCAN ACTION */}
      <Dialog open={activeDialog === "scan-action"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Bobin Bulundu</DialogTitle>
            <DialogDescription>
              {selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr ${selectedBobin.color} — ${selectedBobin.total_weight_kg?.toFixed(1)} kg stokta`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Button className="bg-sky-500 hover:bg-sky-600 text-white h-14 text-sm gap-2"
              data-testid="scan-to-machine"
              onClick={() => { setMachineForm({ weight_kg: "", machine_id: "" }); setActiveDialog("machine"); }}>
              <Factory className="h-5 w-5" /> Makineye Ver
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white h-14 text-sm gap-2"
              data-testid="scan-to-sale"
              onClick={() => { setSaleForm({ weight_kg: "", customer_name: "", note: "" }); setActiveDialog("sale"); }}>
              <ShoppingCart className="h-5 w-5" /> Sat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STOGA EKLE */}
      <Dialog open={activeDialog === "add"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Stoga Bobin Ekle</DialogTitle>
            <DialogDescription>Yeni bobin turu veya mevcut stoga ekleyin (kg bazli)</DialogDescription>
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
                <SelectContent className="max-h-[50vh] bg-[#1a1f2e] border-white/[0.08] text-white">{COLOR_OPTIONS.map(c => <SelectItem key={c} value={c}>{c === "Diger" ? "Diger..." : c}</SelectItem>)}</SelectContent>
              </Select>
              {addForm.color === "Diger" && (
                <Input data-testid="add-bobin-custom-color" placeholder="Renk girin..." value={addForm.customColor}
                  onChange={e => setAddForm(p => ({...p, customColor: e.target.value}))}
                  className="mt-2 bg-white/[0.04] border-white/[0.08] text-white" />
              )}
            </div>
            <div>
              <Label className="text-zinc-400">Kat *</Label>
              <Select value={addForm.layers} onValueChange={v => setAddForm(p => ({...p, layers: v, customLayers: v === "other" ? p.customLayers : ""}))}>
                <SelectTrigger data-testid="add-bobin-layers" className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[50vh] bg-[#1a1f2e] border-white/[0.08] text-white">
                  {LAYER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {addForm.layers === "other" && (
                <Input data-testid="add-bobin-custom-layers" type="number" min="3" placeholder="Kat sayisi (3, 4, ...)"
                  value={addForm.customLayers}
                  onChange={e => setAddForm(p => ({...p, customLayers: e.target.value}))}
                  className="mt-2 bg-white/[0.04] border-white/[0.08] text-white" />
              )}
            </div>
            <div>
              <Label className="text-zinc-400">Toplam Agirlik (kg) *</Label>
              <Input data-testid="add-bobin-weight" type="number" step="0.01" placeholder="500" value={addForm.total_weight_kg}
                onChange={e => setAddForm(p => ({...p, total_weight_kg: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
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
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Stok Ekle</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr ${selectedBobin.color}`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-400">Agirlik (kg) *</Label>
              <Input data-testid="purchase-weight" type="number" step="0.01" value={purchaseForm.weight_kg}
                onChange={e => setPurchaseForm(p => ({...p, weight_kg: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <div>
              <Label className="text-zinc-400">Tedarikci</Label>
              <Input data-testid="purchase-supplier" value={purchaseForm.supplier}
                onChange={e => setPurchaseForm(p => ({...p, supplier: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <Button data-testid="purchase-submit" onClick={handlePurchase} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white h-11">Stok Ekle</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MAKİNEYE VER */}
      <Dialog open={activeDialog === "machine"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Makineye Ver</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm ${selectedBobin.grammage}gr — Stok: ${selectedBobin.total_weight_kg?.toFixed(1)} kg`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-400">Makine *</Label>
              <Select value={machineForm.machine_id} onValueChange={v => setMachineForm(p => ({...p, machine_id: v}))}>
                <SelectTrigger data-testid="machine-select" className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue placeholder="Makine secin" /></SelectTrigger>
                <SelectContent className="max-h-[50vh] bg-[#1a1f2e] border-white/[0.08] text-white">
                  {machines.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  {EXTRA_DESTINATIONS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-zinc-400">Agirlik (kg) *</Label>
              <Input data-testid="machine-weight" type="number" step="0.01" min="0.01"
                max={selectedBobin?.total_weight_kg || 0}
                value={machineForm.weight_kg}
                onChange={e => setMachineForm(p => ({...p, weight_kg: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <Button data-testid="machine-submit" onClick={handleToMachine} className="w-full bg-sky-500 hover:bg-sky-600 text-white h-11">Makineye Ver</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SATIŞ */}
      <Dialog open={activeDialog === "sale"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Musteriye Sat</DialogTitle>
            <DialogDescription>{selectedBobin && `${selectedBobin.brand} ${selectedBobin.width_cm}cm — Stok: ${selectedBobin.total_weight_kg?.toFixed(1)} kg`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-zinc-400">Musteri Adi *</Label><Input data-testid="sale-customer" value={saleForm.customer_name} onChange={e => setSaleForm(p => ({...p, customer_name: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div><Label className="text-zinc-400">Agirlik (kg) *</Label><Input data-testid="sale-weight" type="number" step="0.01" min="0.01" max={selectedBobin?.total_weight_kg || 0} value={saleForm.weight_kg} onChange={e => setSaleForm(p => ({...p, weight_kg: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div><Label className="text-zinc-400">Not</Label><Input data-testid="sale-note" value={saleForm.note} onChange={e => setSaleForm(p => ({...p, note: e.target.value}))} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <Button data-testid="sale-submit" onClick={handleSale} className="w-full bg-amber-500 hover:bg-amber-600 text-white h-11">Sat</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DUZENLE */}
      <Dialog open={activeDialog === "edit"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white">Bobin Bilgilerini Duzenle</DialogTitle>
            <DialogDescription>Yanlis girilmis alanlari guncelleyin</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-400">Barkod</Label>
              <Input data-testid="edit-bobin-barcode" placeholder="Barkod" value={editForm.barcode}
                onChange={e => setEditForm(p => ({...p, barcode: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white font-mono" />
            </div>
            <div>
              <Label className="text-zinc-400">Marka *</Label>
              <Input data-testid="edit-bobin-brand" value={editForm.brand}
                onChange={e => setEditForm(p => ({...p, brand: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-zinc-400">Genislik (cm) *</Label>
                <Input data-testid="edit-bobin-width" type="number" value={editForm.width_cm}
                  onChange={e => setEditForm(p => ({...p, width_cm: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white" />
              </div>
              <div>
                <Label className="text-zinc-400">Gramaj (gr) *</Label>
                <Input data-testid="edit-bobin-grammage" type="number" value={editForm.grammage}
                  onChange={e => setEditForm(p => ({...p, grammage: e.target.value}))}
                  className="bg-white/[0.04] border-white/[0.08] text-white" />
              </div>
            </div>
            <div>
              <Label className="text-zinc-400">Renk *</Label>
              <Select value={editForm.color} onValueChange={v => setEditForm(p => ({...p, color: v, customColor: v === "Diger" ? p.customColor : ""}))}>
                <SelectTrigger data-testid="edit-bobin-color" className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[50vh] bg-[#1a1f2e] border-white/[0.08] text-white">{COLOR_OPTIONS.map(c => <SelectItem key={c} value={c}>{c === "Diger" ? "Diger..." : c}</SelectItem>)}</SelectContent>
              </Select>
              {editForm.color === "Diger" && (
                <Input data-testid="edit-bobin-custom-color" placeholder="Renk girin..." value={editForm.customColor}
                  onChange={e => setEditForm(p => ({...p, customColor: e.target.value}))}
                  className="mt-2 bg-white/[0.04] border-white/[0.08] text-white" />
              )}
            </div>
            <div>
              <Label className="text-zinc-400">Kat *</Label>
              <Select value={editForm.layers} onValueChange={v => setEditForm(p => ({...p, layers: v, customLayers: v === "other" ? p.customLayers : ""}))}>
                <SelectTrigger data-testid="edit-bobin-layers" className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[50vh] bg-[#1a1f2e] border-white/[0.08] text-white">
                  {LAYER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {editForm.layers === "other" && (
                <Input data-testid="edit-bobin-custom-layers" type="number" min="3" placeholder="Kat sayisi"
                  value={editForm.customLayers}
                  onChange={e => setEditForm(p => ({...p, customLayers: e.target.value}))}
                  className="mt-2 bg-white/[0.04] border-white/[0.08] text-white" />
              )}
            </div>
            <div>
              <Label className="text-zinc-400">Toplam Agirlik (kg)</Label>
              <Input data-testid="edit-bobin-weight" type="number" step="0.01" placeholder="Yanlissa duzeltin" value={editForm.total_weight_kg}
                onChange={e => setEditForm(p => ({...p, total_weight_kg: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
              <p className="text-[10px] text-zinc-600 mt-1">Bu deger toplam stoku dogrudan degistirir; dikkatli kullanin.</p>
            </div>
            <div>
              <Label className="text-zinc-400">Tedarikci</Label>
              <Input data-testid="edit-bobin-supplier" value={editForm.supplier}
                onChange={e => setEditForm(p => ({...p, supplier: e.target.value}))}
                className="bg-white/[0.04] border-white/[0.08] text-white" />
            </div>
            <Button data-testid="edit-bobin-submit" onClick={handleEditSubmit} className="w-full bg-zinc-200 hover:bg-white text-zinc-900 h-11 font-medium">Kaydet</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ARŞİV DIALOG */}
      <Dialog open={activeDialog === "archive"} onOpenChange={() => setActiveDialog(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-[#1a1f2e] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Archive className="h-4 w-4 text-emerald-400" /> Aylik Arsiv
            </DialogTitle>
            <DialogDescription>
              Gecmis aylarin kapsamli Excel raporu (ay basi/sonu stok, hareketler, makine dagilimi, musteri satislari).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-zinc-400">Ay Sec</Label>
              <Select value={archiveMonth} onValueChange={setArchiveMonth}>
                <SelectTrigger data-testid="archive-month-select" className="bg-white/[0.04] border-white/[0.08] text-white">
                  <SelectValue placeholder="Bir ay secin..." />
                </SelectTrigger>
                <SelectContent className="max-h-[50vh] bg-[#1a1f2e] border-white/[0.08] text-white">
                  {archiveMonths.length === 0 && <div className="px-3 py-2 text-xs text-zinc-500">Henuz arsiv kaydi yok</div>}
                  {archiveMonths.map(m => (
                    <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              data-testid="archive-download-btn"
              disabled={!archiveMonth}
              onClick={async () => { await handleExport(archiveMonth); setActiveDialog(null); }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white h-11 gap-2">
              <Download className="h-4 w-4" /> {archiveMonth ? `${monthLabel(archiveMonth)} Arsivini Indir` : "Once ay secin"}
            </Button>
            <div className="text-[10px] text-zinc-600 space-y-0.5 leading-relaxed pt-2 border-t border-white/[0.04]">
              <p>Excel icerigi:</p>
              <p>• Sayfa 1 — <span className="text-zinc-400">Ozet</span> (ay basi/sonu stok, net degisim, hareket sayisi)</p>
              <p>• Sayfa 2 — <span className="text-zinc-400">Hareketler</span> (kronolojik tum islemler)</p>
              <p>• Sayfa 3 — <span className="text-zinc-400">Makine Dagilimi</span> (her makinede kac kg)</p>
              <p>• Sayfa 4 — <span className="text-zinc-400">Musteri Satislari</span> (her musteriye kac kg)</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DETAY DRAWER (bobin kartına tıklayınca) */}
      <AnimatePresence>
        {drawerBobin && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={closeDrawer}
              data-testid="bobin-drawer-overlay"
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1f2e] border-t border-white/[0.08] rounded-t-2xl max-h-[85vh] overflow-y-auto"
              data-testid="bobin-drawer"
            >
              <div className="sticky top-0 bg-[#1a1f2e] border-b border-white/[0.06] px-5 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-white truncate">{drawerBobin.brand}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">{drawerBobin.color}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      {drawerBobin.layers === 1 || !drawerBobin.layers ? "TEK" : drawerBobin.layers === 2 ? "CIFT" : `${drawerBobin.layers} KAT`}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {drawerBobin.width_cm}cm · {drawerBobin.grammage}gr · <span className="text-sky-400">{drawerBobin.total_weight_kg?.toFixed(1)} kg stokta</span>
                  </p>
                  {drawerBobin.barcode && <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{drawerBobin.barcode}</p>}
                </div>
                <button onClick={closeDrawer} className="text-zinc-500 hover:text-white text-2xl leading-none -mt-1" data-testid="bobin-drawer-close">×</button>
              </div>
              <div className="px-5 py-3 mx-auto w-12 -mt-2">
                <div className="h-1 bg-white/[0.08] rounded-full" />
              </div>
              <div className="px-5 pb-6">
                <h4 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2 mt-2">Son Hareketler</h4>
                {drawerLoading && <p className="text-xs text-zinc-500 py-3">Yukleniyor...</p>}
                {!drawerLoading && drawerMovements.length === 0 && (
                  <p className="text-xs text-zinc-600 py-6 text-center">Bu bobine ait hareket kaydi yok.</p>
                )}
                <div className="space-y-1.5">
                  {drawerMovements.map(m => (
                    <div key={m.id} className="bg-[#0f1422]/60 border border-white/[0.04] rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeBg(m.movement_type)}`}>
                          {typeLabel(m.movement_type)}
                        </span>
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                          {m.created_at ? new Date(m.created_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-[11px]">
                        <span className={m.movement_type === "purchase" ? "text-emerald-400 font-medium" : "text-zinc-300 font-medium"}>
                          {m.movement_type === "purchase" ? "+" : "-"}{m.weight_kg?.toFixed(1)} kg
                        </span>
                        {m.machine_name && <span className="text-sky-400/80">→ {m.machine_name}</span>}
                        {m.customer_name && <span className="text-amber-400/80">→ {m.customer_name}</span>}
                        <span className="text-zinc-600 ml-auto">{m.user_name || "-"}</span>
                      </div>
                      {m.note && <p className="text-[10px] text-zinc-600 mt-1 italic">{m.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BobinFlow;
