import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, QrCode, Keyboard, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { Html5QrcodeScanner } from "html5-qrcode";

const WarehouseFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [warehouseRequests, setWarehouseRequests] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanner, setScanner] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

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
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      html5QrcodeScanner.render(
        (decodedText) => {
          handleScanSuccess(decodedText);
          html5QrcodeScanner.clear();
          setScannerActive(false);
        },
        (error) => {
          console.log(error);
        }
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
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            data-testid="back-button"
            className="border-border bg-surface hover:bg-surface-highlight"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfa
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            data-testid="theme-toggle"
            className="border-border bg-surface hover:bg-surface-highlight"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <h1 className="text-5xl font-heading font-black text-warning mb-12">
          DEPO PANELİ
        </h1>

        <Tabs defaultValue="alerts" className="space-y-6">
          <TabsList className="bg-surface border-border">
            <TabsTrigger value="alerts" data-testid="alerts-tab" className="data-[state=active]:bg-warning data-[state=active]:text-black">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Uyarılar
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warehouseRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-text-secondary text-lg">Hiç bekleyen talep yok.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {warehouseRequests.map((request) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
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
                              <p className="text-xs">
                                {new Date(request.created_at).toLocaleString("tr-TR")}
                              </p>
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
                    <Button
                      data-testid="start-scanner-button"
                      onClick={startScanner}
                      className="w-full bg-secondary text-white hover:bg-secondary/90 h-20 text-lg"
                    >
                      <QrCode className="mr-2 h-6 w-6" />
                      Kamerayı Başlat
                    </Button>
                  ) : (
                    <div>
                      <div id="qr-reader" className="scanner-border rounded-lg overflow-hidden mb-4"></div>
                      <Button
                        data-testid="stop-scanner-button"
                        onClick={stopScanner}
                        variant="outline"
                        className="w-full border-error text-error hover:bg-error hover:text-white"
                      >
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
                  <Input
                    data-testid="manual-code-input"
                    placeholder="Palet kodu girin..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleManualScan()}
                    className="mb-4 bg-background border-border text-text-primary text-lg h-14"
                  />
                  <Button
                    data-testid="manual-scan-button"
                    onClick={handleManualScan}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg"
                  >
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
                            <td className="p-3 text-text-secondary">
                              {new Date(pallet.scanned_at).toLocaleString("tr-TR")}
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
        </Tabs>
      </div>
    </div>
  );
};

export default WarehouseFlow;
