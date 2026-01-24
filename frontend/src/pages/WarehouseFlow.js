import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertTriangle, QrCode, Keyboard, Sun, Moon, Bell, Wifi, WifiOff, Package, Truck, History, Check } from "lucide-react";
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
import { Html5QrcodeScanner } from "html5-qrcode";

const WarehouseFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [warehouseRequests, setWarehouseRequests] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [shipmentLogs, setShipmentLogs] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanner, setScanner] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationData, setNotificationData] = useState(null);
  const [isShipmentLogDialogOpen, setIsShipmentLogDialogOpen] = useState(false);
  const [selectedShipmentForLog, setSelectedShipmentForLog] = useState(null);
  const [shipmentLogForm, setShipmentLogForm] = useState({ delivered_koli: 0, partial: false });
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // WebSocket bağlantısı
  const connectWebSocket = useCallback(() => {
    // WebSocket URL'ini environment variable'dan türet
    const apiUrl = new URL(API);
    const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${apiUrl.host}/ws/warehouse`;
    
    console.log("Connecting to WebSocket:", wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
        toast.success("Gerçek zamanlı bağlantı kuruldu!", { duration: 2000 });
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message:", message);
          
          if (message.type === "new_warehouse_request") {
            // Yeni talep geldi - bildirim göster
            setNotificationData(message.data);
            setShowNotification(true);
            
            // Ses çal
            playNotificationSound();
            
            // Listeyi güncelle
            fetchData();
            
            // 10 saniye sonra bildirimi kapat
            setTimeout(() => setShowNotification(false), 10000);
          }
        } catch (e) {
          console.error("WebSocket message parse error:", e);
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        
        // 3 saniye sonra yeniden bağlan
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect...");
          connectWebSocket();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsConnected(false);
      };
      
      wsRef.current = ws;
      
      // Ping-pong ile bağlantıyı canlı tut
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 30000);
      
      return () => clearInterval(pingInterval);
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setWsConnected(false);
    }
  }, []);

  const playNotificationSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ0HA5/a3byPIQQJltnn2p0lBAuR2uvnnSsFCo3Y6+qjMwYLh9Xt56k5BwuD0u3nrkAIDH/P7eixRQgPesr06rhKChFzy/bsvlALEnbJ+O3CUw0TdMj67MRWDxRyx/vrxFkQFXDH/O3FWxEWbsf97sZdEhdsxv3uxl8TGGrF/e7GYBQZaMX+7sZhFRpnxf/ux2IWG2bE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGbE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGXE/+7HYxccZsT/7sdjFxxlxP/ux2MXHGXE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGXE/+7HYw==');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.log("Audio play failed:", e);
    }
  };

  useEffect(() => {
    fetchData();
    connectWebSocket();
    
    // Fallback: Her 5 saniyede bir kontrol et (WebSocket çalışmazsa)
    const interval = setInterval(fetchData, 5000);
    
    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear();
      }
    };
  }, [scanner]);

  const fetchData = async () => {
    try {
      const [requestsRes, palletsRes] = await Promise.all([
        axios.get(`${API}/warehouse-requests?status=pending`),
        axios.get(`${API}/pallets`)
      ]);
      setWarehouseRequests(requestsRes.data);
      setPallets(palletsRes.data);
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  };

  const handleCompleteRequest = async (requestId) => {
    try {
      await axios.put(`${API}/warehouse-requests/${requestId}/complete`);
      toast.success("Talep tamamlandı!");
      fetchData();
    } catch (error) {
      toast.error("Talep tamamlanamadı");
    }
  };

  const startScanner = () => {
    setScannerActive(true);
    
    setTimeout(() => {
      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        false
      );

      html5QrcodeScanner.render(
        (decodedText) => {
          handleScanSuccess(decodedText);
          html5QrcodeScanner.clear();
          setScannerActive(false);
        },
        (error) => console.log(error)
      );

      setScanner(html5QrcodeScanner);
    }, 100);
  };

  const stopScanner = () => {
    if (scanner) {
      scanner.clear();
      setScanner(null);
    }
    setScannerActive(false);
  };

  const handleScanSuccess = async (code) => {
    try {
      await axios.post(`${API}/pallets`, {
        pallet_code: code,
        job_id: "unknown",
        job_name: "Taranmış Palet",
        operator_name: "Depo"
      });
      toast.success(`Palet tarandı: ${code}`);
      fetchData();
    } catch (error) {
      toast.error("Palet kaydedilemedi");
    }
  };

  const handleManualScan = async () => {
    if (!manualCode.trim()) {
      toast.error("Lütfen kod girin");
      return;
    }
    await handleScanSuccess(manualCode);
    setManualCode("");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Bildirim Pop-up */}
        <AnimatePresence>
          {showNotification && notificationData && (
            <motion.div
              initial={{ opacity: 0, y: -100, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -100, scale: 0.8 }}
              className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
            >
              <Card className="bg-warning border-warning shadow-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-black/20 rounded-full p-3">
                      <Bell className="h-6 w-6 text-black animate-bounce" />
                    </div>
                    <div className="flex-1">
                      <p className="text-black font-bold text-lg">YENİ MALZEME TALEBİ!</p>
                      <p className="text-black/80 font-semibold mt-1">{notificationData.item_type} x {notificationData.quantity}</p>
                      <p className="text-black/70 text-sm">Operatör: {notificationData.operator_name}</p>
                      <p className="text-black/70 text-sm">Makine: {notificationData.machine_name}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowNotification(false)}
                    className="w-full mt-3 bg-black text-warning hover:bg-black/80"
                  >
                    Tamam
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-center mb-8">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface hover:bg-surface-highlight">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfa
          </Button>
          <div className="flex items-center gap-2">
            {/* WebSocket durumu */}
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${wsConnected ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"}`}>
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {wsConnected ? "Canlı" : "Bağlantı Yok"}
            </div>
            <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-12">
          <h1 className="text-5xl font-heading font-black text-warning">DEPO PANELİ</h1>
          {warehouseRequests.length > 0 && (
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="bg-red-500 text-white px-4 py-2 rounded-full font-bold"
            >
              {warehouseRequests.length} Bekleyen Talep
            </motion.div>
          )}
        </div>

        <Tabs defaultValue="alerts" className="space-y-6">
          <TabsList className="bg-surface border-border">
            <TabsTrigger value="alerts" data-testid="alerts-tab" className="data-[state=active]:bg-warning data-[state=active]:text-black">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Uyarılar
              {warehouseRequests.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {warehouseRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="scanner" data-testid="scanner-tab" className="data-[state=active]:bg-warning data-[state=active]:text-black">
              <QrCode className="mr-2 h-4 w-4" />
              Palet Okuma
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-2xl font-heading flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                  Malzeme Talepleri
                  {wsConnected && <span className="text-xs text-green-500 font-normal">(Gerçek Zamanlı)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warehouseRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-text-secondary text-lg">Hiç bekleyen talep yok.</p>
                    <p className="text-text-secondary text-sm mt-2">Yeni talepler anında burada görünecek.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {warehouseRequests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-6 bg-warning/10 border-2 border-warning rounded-lg"
                        data-testid={`warehouse-request-${request.id}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-xl font-heading font-bold text-text-primary mb-2">
                              {request.item_type}
                            </h3>
                            <div className="space-y-1 text-text-secondary">
                              <p><span className="font-semibold">Miktar:</span> {request.quantity}</p>
                              <p><span className="font-semibold">Operatör:</span> {request.operator_name}</p>
                              <p><span className="font-semibold">Makine:</span> {request.machine_name}</p>
                              <p className="text-xs">{new Date(request.created_at).toLocaleString("tr-TR")}</p>
                            </div>
                          </div>
                          <Button
                            data-testid={`complete-request-${request.id}`}
                            onClick={() => handleCompleteRequest(request.id)}
                            className="bg-success text-white hover:bg-success/90"
                          >
                            Tamamla
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scanner">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading flex items-center gap-2">
                    <QrCode className="h-6 w-6" />
                    QR/Barkod Okuma
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!scannerActive ? (
                    <Button data-testid="start-scanner-button" onClick={startScanner} className="w-full bg-secondary text-white hover:bg-secondary/90 h-20 text-lg">
                      <QrCode className="mr-2 h-6 w-6" />
                      Kamerayı Başlat
                    </Button>
                  ) : (
                    <div>
                      <div id="qr-reader" className="scanner-border rounded-lg overflow-hidden mb-4"></div>
                      <Button data-testid="stop-scanner-button" onClick={stopScanner} variant="outline" className="w-full border-error text-error hover:bg-error hover:text-white">
                        İptal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-2xl font-heading flex items-center gap-2">
                    <Keyboard className="h-6 w-6" />
                    Manuel Kod Girişi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Input data-testid="manual-code-input" placeholder="Palet kodu girin..." value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleManualScan()}
                    className="mb-4 bg-background border-border text-text-primary text-lg h-14" />
                  <Button data-testid="manual-scan-button" onClick={handleManualScan} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg">
                    Kaydet
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-surface border-border mt-6">
              <CardHeader>
                <CardTitle className="text-2xl font-heading">Son Taranan Paletler</CardTitle>
              </CardHeader>
              <CardContent>
                {pallets.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Henüz palet taranmamış.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="pallets-table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-heading text-text-primary">Palet Kodu</th>
                          <th className="text-left p-3 font-heading text-text-primary">İş</th>
                          <th className="text-left p-3 font-heading text-text-primary">Operatör</th>
                          <th className="text-left p-3 font-heading text-text-primary">Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pallets.slice(0, 10).map((pallet) => (
                          <tr key={pallet.id} className="border-b border-border" data-testid={`pallet-${pallet.id}`}>
                            <td className="p-3 text-text-primary font-mono font-bold">{pallet.pallet_code}</td>
                            <td className="p-3 text-text-secondary">{pallet.job_name}</td>
                            <td className="p-3 text-text-secondary">{pallet.operator_name}</td>
                            <td className="p-3 text-text-secondary">{new Date(pallet.scanned_at).toLocaleString("tr-TR")}</td>
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
      </div>
    </div>
  );
};

export default WarehouseFlow;
