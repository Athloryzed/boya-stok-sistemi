import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sun, Moon, MapPin, Phone, Package, CheckCircle, XCircle, Navigation, Truck, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const DriverFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [driverData, setDriverData] = useState(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFailDialogOpen, setIsFailDialogOpen] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationWatchId, setLocationWatchId] = useState(null);

  // Konum takibini başlat
  const startLocationTracking = useCallback((driverId) => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          
          // Konumu backend'e gönder
          try {
            await axios.put(`${API}/drivers/${driverId}/location`, {
              lat: latitude,
              lng: longitude
            });
          } catch (error) {
            console.error("Konum güncelleme hatası:", error);
          }
        },
        (error) => {
          console.error("Konum hatası:", error);
          toast.error("Konum alınamadı. Lütfen konum iznini kontrol edin.");
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
      setLocationWatchId(watchId);
    } else {
      toast.error("Tarayıcınız konum özelliğini desteklemiyor.");
    }
  }, []);

  // Konum takibini durdur
  useEffect(() => {
    return () => {
      if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
      }
    };
  }, [locationWatchId]);

  // Oturum kontrolü
  useEffect(() => {
    const savedDriver = localStorage.getItem("driver_session");
    if (savedDriver) {
      const driver = JSON.parse(savedDriver);
      setDriverData(driver);
      setAuthenticated(true);
      startLocationTracking(driver.id);
    }
  }, [startLocationTracking]);

  // Sevkiyatları getir
  useEffect(() => {
    if (authenticated && driverData) {
      fetchShipments();
      const interval = setInterval(fetchShipments, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated, driverData]);

  const fetchShipments = async () => {
    if (!driverData) return;
    try {
      const response = await axios.get(`${API}/shipments?driver_id=${driverData.id}`);
      setShipments(response.data.filter(s => s.status !== "delivered" && s.status !== "failed"));
    } catch (error) {
      console.error("Sevkiyat yükleme hatası:", error);
    }
  };

  const handleLogin = async () => {
    if (!name || !password) {
      toast.error("Lütfen kullanıcı adı ve şifre girin");
      return;
    }
    try {
      const response = await axios.post(`${API}/users/login`, { 
        username: name, 
        password: password,
        role: "sofor"
      });
      const user = response.data;
      setDriverData(user);
      setAuthenticated(true);
      localStorage.setItem("driver_session", JSON.stringify(user));
      startLocationTracking(user.id);
      toast.success("Giriş başarılı!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Giriş başarısız");
    }
  };

  const handleLogout = () => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }
    localStorage.removeItem("driver_session");
    setAuthenticated(false);
    setDriverData(null);
    setShipments([]);
    toast.success("Çıkış yapıldı");
  };

  const handleStartDelivery = async (shipment) => {
    try {
      await axios.put(`${API}/shipments/${shipment.id}/status`, { status: "in_transit" });
      toast.success("Teslimat başlatıldı!");
      fetchShipments();
    } catch (error) {
      toast.error("Hata oluştu");
    }
  };

  const handleDelivered = async (shipment) => {
    try {
      await axios.put(`${API}/shipments/${shipment.id}/status`, { status: "delivered" });
      toast.success("Teslimat tamamlandı!");
      setIsDetailOpen(false);
      fetchShipments();
    } catch (error) {
      toast.error("Hata oluştu");
    }
  };

  const handleFailed = async () => {
    if (!failReason.trim()) {
      toast.error("Lütfen teslim edilememe sebebini girin");
      return;
    }
    try {
      await axios.put(`${API}/shipments/${selectedShipment.id}/status`, {
        status: "failed",
        reason: failReason
      });
      toast.success("Durum güncellendi");
      setIsFailDialogOpen(false);
      setIsDetailOpen(false);
      setFailReason("");
      fetchShipments();
    } catch (error) {
      toast.error("Hata oluştu");
    }
  };

  const openGoogleMaps = (address) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, "_blank");
  };

  const openGoogleMapsDirections = (address) => {
    const encodedAddress = encodeURIComponent(address);
    if (currentLocation) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${encodedAddress}&travelmode=driving`,
        "_blank"
      );
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`, "_blank");
    }
  };

  const openMultipleDestinations = () => {
    // Tüm adresleri sırayla rota olarak aç
    const addresses = shipments
      .filter(s => s.status !== "delivered")
      .map(s => s.delivery_address);
    
    if (addresses.length === 0) {
      toast.error("Teslimat adresi bulunamadı");
      return;
    }

    const waypoints = addresses.slice(0, -1).join("|");
    const destination = encodeURIComponent(addresses[addresses.length - 1]);
    
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    if (waypoints) {
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    if (currentLocation) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${destination}&travelmode=driving`;
      if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
      }
    }
    window.open(url, "_blank");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "preparing": return "text-yellow-500";
      case "in_transit": return "text-blue-500";
      case "delivered": return "text-green-500";
      case "failed": return "text-red-500";
      default: return "text-text-secondary";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "preparing": return "Hazırlanıyor";
      case "in_transit": return "Yolda";
      case "delivered": return "Teslim Edildi";
      case "failed": return "Teslim Edilemedi";
      default: return status;
    }
  };

  // Giriş ekranı
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-surface border-border">
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Truck className="w-8 h-8 text-purple-500" />
              </div>
              <CardTitle className="text-2xl font-heading text-primary">ŞOFÖR GİRİŞİ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Kullanıcı Adı</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Adınız..."
                  className="bg-background border-border"
                  data-testid="driver-name-input"
                />
              </div>
              <div>
                <Label>Şifre</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifre..."
                  className="bg-background border-border"
                  onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                  data-testid="driver-password-input"
                />
              </div>
              <Button
                onClick={handleLogin}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                data-testid="driver-login-btn"
              >
                Giriş Yap
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Ana Sayfa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Ana Sayfa
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">{driverData?.name}</span>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Çıkış
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-3xl font-heading font-bold text-primary mb-2">ŞOFÖR PANELİ</h1>
        
        {/* Konum durumu */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <MapPin className={`w-4 h-4 ${currentLocation ? "text-green-500" : "text-red-500"}`} />
          <span className={currentLocation ? "text-green-500" : "text-red-500"}>
            {currentLocation ? "Konum aktif" : "Konum alınamıyor"}
          </span>
        </div>

        {/* Toplu rota butonu */}
        {shipments.filter(s => s.status !== "delivered").length > 1 && (
          <Button
            onClick={openMultipleDestinations}
            className="mb-4 bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Navigation className="w-4 h-4 mr-2" /> Tüm Teslimatlar İçin Rota Oluştur
          </Button>
        )}

        {/* Sevkiyat listesi */}
        <div className="space-y-4">
          {shipments.length === 0 ? (
            <Card className="bg-surface border-border">
              <CardContent className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-text-secondary" />
                <p className="text-text-secondary">Atanmış sevkiyat bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            shipments.map((shipment) => (
              <Card
                key={shipment.id}
                className={`bg-surface border-2 cursor-pointer transition-all hover:shadow-lg ${
                  shipment.status === "in_transit" ? "border-blue-500" : "border-border"
                }`}
                onClick={() => {
                  setSelectedShipment(shipment);
                  setIsDetailOpen(true);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-text-primary">{shipment.vehicle_plate}</h3>
                      <p className={`text-sm font-medium ${getStatusColor(shipment.status)}`}>
                        {getStatusText(shipment.status)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{shipment.total_koli} Koli</p>
                      <p className="text-xs text-text-secondary">{shipment.pallets?.length || 0} Palet</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-text-secondary mt-0.5" />
                      <span className="text-text-primary">{shipment.delivery_address}</span>
                    </div>
                    {shipment.delivery_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-text-secondary" />
                        <a href={`tel:${shipment.delivery_phone}`} className="text-blue-500">
                          {shipment.delivery_phone}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    {shipment.status === "preparing" && (
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartDelivery(shipment);
                        }}
                      >
                        <Truck className="w-4 h-4 mr-1" /> Yola Çık
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        openGoogleMapsDirections(shipment.delivery_address);
                      }}
                    >
                      <Navigation className="w-4 h-4 mr-1" /> Yol Tarifi
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Yenile butonu */}
        <Button
          variant="outline"
          className="fixed bottom-4 right-4"
          onClick={fetchShipments}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Detay Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-surface border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Sevkiyat Detayı</DialogTitle>
          </DialogHeader>
          {selectedShipment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-text-secondary">Araç</Label>
                  <p className="font-semibold">{selectedShipment.vehicle_plate}</p>
                </div>
                <div>
                  <Label className="text-text-secondary">Durum</Label>
                  <p className={`font-semibold ${getStatusColor(selectedShipment.status)}`}>
                    {getStatusText(selectedShipment.status)}
                  </p>
                </div>
                <div>
                  <Label className="text-text-secondary">Toplam Koli</Label>
                  <p className="font-semibold text-lg">{selectedShipment.total_koli}</p>
                </div>
                <div>
                  <Label className="text-text-secondary">Palet Sayısı</Label>
                  <p className="font-semibold">{selectedShipment.pallets?.length || 0}</p>
                </div>
              </div>

              <div>
                <Label className="text-text-secondary">Teslimat Adresi</Label>
                <p className="font-semibold">{selectedShipment.delivery_address}</p>
              </div>

              {selectedShipment.delivery_phone && (
                <div>
                  <Label className="text-text-secondary">Telefon</Label>
                  <a href={`tel:${selectedShipment.delivery_phone}`} className="font-semibold text-blue-500 block">
                    {selectedShipment.delivery_phone}
                  </a>
                </div>
              )}

              {selectedShipment.delivery_notes && (
                <div>
                  <Label className="text-text-secondary">Notlar</Label>
                  <p className="text-sm">{selectedShipment.delivery_notes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => openGoogleMapsDirections(selectedShipment.delivery_address)}
                >
                  <Navigation className="w-4 h-4 mr-2" /> Yol Tarifi
                </Button>
                {selectedShipment.delivery_phone && (
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => window.open(`tel:${selectedShipment.delivery_phone}`)}
                  >
                    <Phone className="w-4 h-4 mr-2" /> Ara
                  </Button>
                )}
              </div>

              {selectedShipment.status === "in_transit" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => handleDelivered(selectedShipment)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" /> Teslim Edildi
                  </Button>
                  <Button
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    onClick={() => setIsFailDialogOpen(true)}
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Teslim Edilemedi
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Teslim Edilemedi Dialog */}
      <Dialog open={isFailDialogOpen} onOpenChange={setIsFailDialogOpen}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-red-500">Teslim Edilemedi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sebep *</Label>
              <Textarea
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                placeholder="Teslim edilememe sebebini yazın..."
                className="bg-background border-border"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsFailDialogOpen(false)}>
                İptal
              </Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleFailed}>
                Onayla
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DriverFlow;
