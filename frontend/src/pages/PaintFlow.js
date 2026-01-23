import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sun, Moon, Plus, Minus, Send, RotateCcw, History, BarChart3, Package, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// Boya renk haritası (gerçek renklere yakın)
const PAINT_COLORS = {
  "Siyah": "#1a1a1a",
  "Beyaz": "#f5f5f5",
  "Mavi": "#2196F3",
  "Lacivert": "#1a237e",
  "Refleks": "#00e5ff",
  "Kırmızı": "#f44336",
  "Magenta": "#e91e63",
  "Rhodam": "#9c27b0",
  "Sarı": "#ffeb3b",
  "Gold": "#ffc107",
  "Gümüş": "#9e9e9e",
  "Pasta": "#bcaaa4"
};

// Düşük stok eşiği
const LOW_STOCK_THRESHOLD = 5;

const PaintFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [paints, setPaints] = useState([]);
  const [machines, setMachines] = useState([]);
  const [movements, setMovements] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("weekly");
  const [lowStockPaints, setLowStockPaints] = useState([]);
  
  // Dialog states
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isRemoveStockOpen, setIsRemoveStockOpen] = useState(false);
  const [isToMachineOpen, setIsToMachineOpen] = useState(false);
  const [isFromMachineOpen, setIsFromMachineOpen] = useState(false);
  const [selectedPaint, setSelectedPaint] = useState(null);
  
  // Form states
  const [amount, setAmount] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (authenticated) {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated, analyticsPeriod]);

  const fetchData = async () => {
    try {
      await axios.post(`${API}/paints/init`);
      
      const [paintsRes, machinesRes, movementsRes, analyticsRes, lowStockRes] = await Promise.all([
        axios.get(`${API}/paints`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/paints/movements?limit=50`),
        axios.get(`${API}/paints/analytics?period=${analyticsPeriod}`),
        axios.get(`${API}/paints/low-stock`)
      ]);
      
      setPaints(paintsRes.data);
      setMachines(machinesRes.data);
      setMovements(movementsRes.data);
      setAnalytics(analyticsRes.data);
      setLowStockPaints(lowStockRes.data.low_stock_paints || []);
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  };

  const handleLogin = () => {
    if (password === "432122") {
      setAuthenticated(true);
      toast.success("Giriş başarılı!");
    } else {
      toast.error("Yanlış şifre!");
    }
  };

  const handleTransaction = async (movementType) => {
    if (!selectedPaint || !amount || parseFloat(amount) <= 0) {
      toast.error("Lütfen geçerli bir miktar girin");
      return;
    }

    if ((movementType === "to_machine" || movementType === "from_machine") && !selectedMachine) {
      toast.error("Lütfen bir makine seçin");
      return;
    }

    const machine = machines.find(m => m.id === selectedMachine);

    try {
      await axios.post(`${API}/paints/transaction`, {
        paint_id: selectedPaint.id,
        movement_type: movementType,
        amount_kg: parseFloat(amount),
        machine_id: selectedMachine || null,
        machine_name: machine?.name || null,
        note: note
      });

      toast.success("İşlem başarılı!");
      closeAllDialogs();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "İşlem başarısız");
    }
  };

  const closeAllDialogs = () => {
    setIsAddStockOpen(false);
    setIsRemoveStockOpen(false);
    setIsToMachineOpen(false);
    setIsFromMachineOpen(false);
    setSelectedPaint(null);
    setAmount("");
    setSelectedMachine("");
    setNote("");
  };

  const openDialog = (paint, type) => {
    setSelectedPaint(paint);
    setAmount("");
    setSelectedMachine("");
    setNote("");
    
    if (type === "add") setIsAddStockOpen(true);
    else if (type === "remove") setIsRemoveStockOpen(true);
    else if (type === "to_machine") setIsToMachineOpen(true);
    else if (type === "from_machine") setIsFromMachineOpen(true);
  };

  const getMovementTypeLabel = (type) => {
    const labels = {
      "add": "Stok Eklendi",
      "remove": "Stok Çıkarıldı",
      "to_machine": "Makineye Gönderildi",
      "from_machine": "Makineden Alındı"
    };
    return labels[type] || type;
  };

  const getMovementTypeColor = (type) => {
    const colors = {
      "add": "text-green-500",
      "remove": "text-red-500",
      "to_machine": "text-blue-500",
      "from_machine": "text-yellow-500"
    };
    return colors[type] || "text-gray-500";
  };

  const getPaintColor = (paintName) => {
    return PAINT_COLORS[paintName] || "#888888";
  };

  const prepareChartData = (data) => {
    if (!data) return [];
    return Object.entries(data).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2))
    }));
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-heading text-center text-pink-500">BOYA GİRİŞİ</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                data-testid="paint-password-input"
                type="password"
                placeholder="Şifre..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="mb-4 bg-background border-border text-text-primary text-lg h-14"
              />
              <Button data-testid="paint-login-button" onClick={handleLogin} className="w-full bg-pink-500 text-white hover:bg-pink-600 h-14 text-lg font-heading">
                Giriş Yap
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full mt-4 border-border bg-background hover:bg-surface-highlight">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ana Sayfa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface hover:bg-surface-highlight">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfa
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <h1 className="text-4xl md:text-5xl font-heading font-black text-pink-500 mb-4">
          BOYA YÖNETİMİ
        </h1>

        {/* Düşük Stok Uyarısı */}
        {lowStockPaints.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg"
          >
            <div className="flex items-center gap-2 text-red-500 font-bold mb-2">
              <AlertTriangle className="h-5 w-5" />
              DÜŞÜK STOK UYARISI ({LOW_STOCK_THRESHOLD}L altı)
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockPaints.map(paint => (
                <span key={paint.id} className="px-3 py-1 bg-red-500/30 rounded-full text-sm text-red-200">
                  {paint.name}: {paint.stock_kg.toFixed(1)} L
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <Tabs defaultValue="stock" className="space-y-6">
          <TabsList className="bg-surface border-border grid grid-cols-3 w-full md:w-auto">
            <TabsTrigger value="stock" data-testid="stock-tab" className="data-[state=active]:bg-pink-500 data-[state=active]:text-white">
              <Package className="h-4 w-4 mr-2 hidden md:inline" />
              Stok
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="history-tab" className="data-[state=active]:bg-pink-500 data-[state=active]:text-white">
              <History className="h-4 w-4 mr-2 hidden md:inline" />
              Geçmiş
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab" className="data-[state=active]:bg-pink-500 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2 hidden md:inline" />
              Analiz
            </TabsTrigger>
          </TabsList>

          {/* STOK TAB */}
          <TabsContent value="stock">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {paints.map((paint, index) => {
                const isLowStock = paint.stock_kg < LOW_STOCK_THRESHOLD;
                const paintColor = getPaintColor(paint.name);
                
                return (
                  <motion.div
                    key={paint.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className={`bg-surface border-2 transition-all cursor-pointer ${
                        isLowStock ? "border-red-500 animate-pulse" : "border-border hover:border-pink-500"
                      }`}
                      data-testid={`paint-card-${paint.name}`}
                    >
                      <CardContent className="p-4">
                        <div 
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full mb-3 mx-auto border-2"
                          style={{ 
                            backgroundColor: paintColor,
                            borderColor: paint.name === "Beyaz" ? "#ccc" : paintColor,
                            boxShadow: `0 4px 14px ${paintColor}40`
                          }}
                        />
                        <h3 className="text-base md:text-lg font-heading font-bold text-text-primary text-center mb-1">
                          {paint.name}
                        </h3>
                        <p className={`text-xl md:text-2xl font-bold text-center mb-3 ${isLowStock ? "text-red-500" : "text-pink-500"}`}>
                          {paint.stock_kg.toFixed(1)} L
                        </p>
                        
                        {isLowStock && (
                          <div className="flex items-center justify-center gap-1 text-red-500 text-xs mb-2">
                            <AlertTriangle className="h-3 w-3" />
                            Düşük Stok!
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-1">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openDialog(paint, "add")}
                            className="text-green-500 border-green-500/50 hover:bg-green-500/10 h-8"
                            data-testid={`add-stock-${paint.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openDialog(paint, "remove")}
                            className="text-red-500 border-red-500/50 hover:bg-red-500/10 h-8"
                            data-testid={`remove-stock-${paint.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openDialog(paint, "to_machine")}
                            className="text-blue-500 border-blue-500/50 hover:bg-blue-500/10 h-8"
                            data-testid={`to-machine-${paint.name}`}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openDialog(paint, "from_machine")}
                            className="text-yellow-500 border-yellow-500/50 hover:bg-yellow-500/10 h-8"
                            data-testid={`from-machine-${paint.name}`}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* GEÇMİŞ TAB */}
          <TabsContent value="history">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl font-heading">Hareket Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                {movements.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Henüz hareket kaydı yok.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="movements-table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 md:p-3 font-heading text-text-primary text-sm">Boya</th>
                          <th className="text-left p-2 md:p-3 font-heading text-text-primary text-sm">İşlem</th>
                          <th className="text-left p-2 md:p-3 font-heading text-text-primary text-sm">Miktar</th>
                          <th className="text-left p-2 md:p-3 font-heading text-text-primary text-sm hidden md:table-cell">Makine</th>
                          <th className="text-left p-2 md:p-3 font-heading text-text-primary text-sm hidden md:table-cell">Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movements.map((mov) => (
                          <tr key={mov.id} className="border-b border-border" data-testid={`movement-${mov.id}`}>
                            <td className="p-2 md:p-3 text-sm">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-4 h-4 rounded-full border"
                                  style={{ 
                                    backgroundColor: getPaintColor(mov.paint_name),
                                    borderColor: mov.paint_name === "Beyaz" ? "#ccc" : getPaintColor(mov.paint_name)
                                  }}
                                />
                                <span className="text-text-primary font-semibold">{mov.paint_name}</span>
                              </div>
                            </td>
                            <td className={`p-2 md:p-3 text-sm ${getMovementTypeColor(mov.movement_type)}`}>
                              {getMovementTypeLabel(mov.movement_type)}
                            </td>
                            <td className="p-2 md:p-3 text-text-secondary text-sm">{mov.amount_kg} L</td>
                            <td className="p-2 md:p-3 text-text-secondary text-sm hidden md:table-cell">{mov.machine_name || "-"}</td>
                            <td className="p-2 md:p-3 text-text-secondary text-sm hidden md:table-cell">
                              {new Date(mov.created_at).toLocaleString("tr-TR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANALİZ TAB */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Period Selector */}
              <div className="flex gap-2">
                <Button 
                  variant={analyticsPeriod === "weekly" ? "default" : "outline"}
                  onClick={() => setAnalyticsPeriod("weekly")}
                  className={analyticsPeriod === "weekly" ? "bg-pink-500 hover:bg-pink-600" : ""}
                >
                  Haftalık
                </Button>
                <Button 
                  variant={analyticsPeriod === "monthly" ? "default" : "outline"}
                  onClick={() => setAnalyticsPeriod("monthly")}
                  className={analyticsPeriod === "monthly" ? "bg-pink-500 hover:bg-pink-600" : ""}
                >
                  Aylık
                </Button>
              </div>

              {/* Toplam Tüketim */}
              <Card className="bg-surface border-border">
                <CardContent className="p-6">
                  <p className="text-text-secondary text-sm mb-1">
                    {analyticsPeriod === "weekly" ? "Haftalık" : "Aylık"} Toplam Tüketim
                  </p>
                  <p className="text-4xl font-bold text-pink-500">
                    {analytics?.total_consumed?.toFixed(1) || 0} L
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Boya Bazında Tüketim */}
                <Card className="bg-surface border-border">
                  <CardHeader>
                    <CardTitle className="text-lg md:text-xl font-heading">Boya Bazında Tüketim</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prepareChartData(analytics?.paint_consumption)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}L`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {prepareChartData(analytics?.paint_consumption).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getPaintColor(entry.name)} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Makine Bazında Tüketim */}
                <Card className="bg-surface border-border">
                  <CardHeader>
                    <CardTitle className="text-lg md:text-xl font-heading">Makine Bazında Tüketim</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareChartData(analytics?.machine_consumption)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                        <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A" }} />
                        <Bar dataKey="value" fill="#EC4899" name="Tüketim (L)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Günlük Tüketim */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl font-heading">Günlük Tüketim Trendi</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={prepareChartData(analytics?.daily_consumption)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A" }} />
                      <Bar dataKey="value" fill="#EC4899" name="Tüketim (L)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* STOK EKLEME DIALOG */}
        <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-green-500 flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ 
                    backgroundColor: selectedPaint ? getPaintColor(selectedPaint.name) : "#888",
                    borderColor: selectedPaint?.name === "Beyaz" ? "#ccc" : (selectedPaint ? getPaintColor(selectedPaint.name) : "#888")
                  }}
                />
                Stok Ekle - {selectedPaint?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">Miktar (L)</Label>
                <Input
                  data-testid="add-stock-amount"
                  type="number"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Not (Opsiyonel)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tedarikçi, fatura no vb."
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button 
                data-testid="confirm-add-stock"
                onClick={() => handleTransaction("add")} 
                className="w-full bg-green-500 text-white hover:bg-green-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Stok Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* STOK ÇIKARMA DIALOG */}
        <Dialog open={isRemoveStockOpen} onOpenChange={setIsRemoveStockOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-red-500 flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ 
                    backgroundColor: selectedPaint ? getPaintColor(selectedPaint.name) : "#888",
                    borderColor: selectedPaint?.name === "Beyaz" ? "#ccc" : (selectedPaint ? getPaintColor(selectedPaint.name) : "#888")
                  }}
                />
                Stok Çıkar - {selectedPaint?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-text-secondary">Mevcut stok: {selectedPaint?.stock_kg.toFixed(1)} L</p>
              <div>
                <Label className="text-text-primary">Miktar (L)</Label>
                <Input
                  data-testid="remove-stock-amount"
                  type="number"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Not (Opsiyonel)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Sebep, kayıp vb."
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button 
                data-testid="confirm-remove-stock"
                onClick={() => handleTransaction("remove")} 
                className="w-full bg-red-500 text-white hover:bg-red-600"
              >
                <Minus className="mr-2 h-4 w-4" />
                Stok Çıkar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* MAKİNEYE GÖNDER DIALOG */}
        <Dialog open={isToMachineOpen} onOpenChange={setIsToMachineOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-blue-500 flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ 
                    backgroundColor: selectedPaint ? getPaintColor(selectedPaint.name) : "#888",
                    borderColor: selectedPaint?.name === "Beyaz" ? "#ccc" : (selectedPaint ? getPaintColor(selectedPaint.name) : "#888")
                  }}
                />
                Makineye Gönder - {selectedPaint?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-text-secondary">Mevcut stok: {selectedPaint?.stock_kg.toFixed(1)} L</p>
              <div>
                <Label className="text-text-primary">Makine</Label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger data-testid="select-machine-to" className="bg-background border-border text-text-primary">
                    <SelectValue placeholder="Makine seçin..." />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {machines.map(machine => (
                      <SelectItem key={machine.id} value={machine.id} className="text-text-primary">
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-text-primary">Miktar (L)</Label>
                <Input
                  data-testid="to-machine-amount"
                  type="number"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Not (Opsiyonel)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="İş numarası vb."
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button 
                data-testid="confirm-to-machine"
                onClick={() => handleTransaction("to_machine")} 
                className="w-full bg-blue-500 text-white hover:bg-blue-600"
              >
                <Send className="mr-2 h-4 w-4" />
                Makineye Gönder
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* MAKİNEDEN AL DIALOG */}
        <Dialog open={isFromMachineOpen} onOpenChange={setIsFromMachineOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-yellow-500 flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full border"
                  style={{ 
                    backgroundColor: selectedPaint ? getPaintColor(selectedPaint.name) : "#888",
                    borderColor: selectedPaint?.name === "Beyaz" ? "#ccc" : (selectedPaint ? getPaintColor(selectedPaint.name) : "#888")
                  }}
                />
                Makineden Al - {selectedPaint?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">Makine</Label>
                <Select value={selectedMachine} onValueChange={setSelectedMachine}>
                  <SelectTrigger data-testid="select-machine-from" className="bg-background border-border text-text-primary">
                    <SelectValue placeholder="Makine seçin..." />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {machines.map(machine => (
                      <SelectItem key={machine.id} value={machine.id} className="text-text-primary">
                        {machine.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-text-primary">Miktar (L)</Label>
                <Input
                  data-testid="from-machine-amount"
                  type="number"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Not (Opsiyonel)</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="İade sebebi vb."
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button 
                data-testid="confirm-from-machine"
                onClick={() => handleTransaction("from_machine")} 
                className="w-full bg-yellow-500 text-black hover:bg-yellow-600"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Makineden Al
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PaintFlow;
