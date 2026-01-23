import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, Sun, Moon, Package, MessageSquare, Bell, X, Send } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const OperatorFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [operatorName, setOperatorName] = useState("");
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [requestQuantity, setRequestQuantity] = useState("");
  
  // Mesajlaşma state'leri
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [lastNotificationMessage, setLastNotificationMessage] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    if (selectedMachine) {
      fetchJobs();
      fetchMessages();
      
      // Mesajları her 3 saniyede bir kontrol et
      const interval = setInterval(() => {
        fetchMessages();
        fetchUnreadCount();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [selectedMachine]);

  useEffect(() => {
    // Yeni mesaj geldiğinde bildirim göster
    if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      const newMessage = messages[messages.length - 1];
      if (!newMessage.is_read) {
        setLastNotificationMessage(newMessage);
        setShowNotification(true);
        
        // Ses çal (opsiyonel)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ0HA5/a3byPIQQJltnn2p0lBAuR2uvnnSsFCo3Y6+qjMwYLh9Xt56k5BwuD0u3nrkAIDH/P7eixRQgPesr06rhKChFzy/bsvlALEnbJ+O3CUw0TdMj67MRWDxRyx/vrxFkQFXDH/O3FWxEWbsf97sZdEhdsxv3uxl8TGGrF/e7GYBQZaMX+7sZhFRpnxf/ux2IWG2bE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGbE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGXE/+7HYxccZsT/7sdjFxxlxP/ux2MXHGXE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGXE/+7HYw==');
          audio.volume = 0.3;
          audio.play();
        } catch (e) {}
        
        // 5 saniye sonra bildirimi kapat
        setTimeout(() => setShowNotification(false), 5000);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    // Chat açıkken en alta scroll
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  const fetchMachines = async () => {
    try {
      const response = await axios.get(`${API}/machines`);
      const uniqueMachines = response.data.reduce((acc, machine) => {
        if (!acc.find(m => m.id === machine.id)) acc.push(machine);
        return acc;
      }, []);
      setMachines(uniqueMachines);
    } catch (error) {
      toast.error("Makineler yüklenemedi");
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs?machine_id=${selectedMachine.id}`);
      setJobs(response.data);
    } catch (error) {
      toast.error("İşler yüklenemedi");
    }
  };

  const fetchMessages = async () => {
    if (!selectedMachine) return;
    try {
      const response = await axios.get(`${API}/messages/${selectedMachine.id}`);
      setMessages(response.data);
    } catch (error) {
      console.error("Messages fetch error:", error);
    }
  };

  const fetchUnreadCount = async () => {
    if (!selectedMachine) return;
    try {
      const response = await axios.get(`${API}/messages/${selectedMachine.id}/unread`);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error("Unread count error:", error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!selectedMachine) return;
    try {
      await axios.put(`${API}/messages/${selectedMachine.id}/mark-read`);
      setUnreadCount(0);
      fetchMessages();
    } catch (error) {
      console.error("Mark read error:", error);
    }
  };

  const openChat = () => {
    setIsChatOpen(true);
    markMessagesAsRead();
    setShowNotification(false);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedMachine) return;
    
    setSendingReply(true);
    try {
      await axios.post(`${API}/messages`, {
        machine_id: selectedMachine.id,
        machine_name: selectedMachine.name,
        sender_role: "operator",
        sender_name: operatorName,
        message: replyText
      });
      setReplyText("");
      fetchMessages();
      toast.success("Mesaj gönderildi!");
    } catch (error) {
      toast.error("Mesaj gönderilemedi");
    } finally {
      setSendingReply(false);
    }
  };

  const handleNameSubmit = () => {
    if (!operatorName.trim()) {
      toast.error("Lütfen adınızı girin");
      return;
    }
    setStep(2);
  };

  const handleMachineSelect = (machine) => {
    if (machine.maintenance) {
      toast.error("Bu makine bakımda!");
      return;
    }
    setSelectedMachine(machine);
    setStep(3);
  };

  const handleStartJob = async (job) => {
    setLoading(true);
    try {
      await axios.put(`${API}/jobs/${job.id}/start`, { operator_name: operatorName });
      toast.success("İş başlatıldı!");
      fetchJobs();
    } catch (error) {
      toast.error("İş başlatılamadı");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteJob = async (job) => {
    setLoading(true);
    try {
      await axios.put(`${API}/jobs/${job.id}/complete`);
      toast.success("İş tamamlandı!");
      fetchJobs();
    } catch (error) {
      toast.error("İş tamamlanamadı");
    } finally {
      setLoading(false);
    }
  };

  const getFormatOptions = (machineName) => {
    if (machineName === "24x24" || machineName === "33x33 (Büyük)") return ["all", "1/4", "1/8"];
    else if (machineName === "33x33 ICM") return ["all", "33x33", "33x24"];
    return ["all"];
  };

  const filteredJobs = selectedMachine
    ? jobs.filter(job => (selectedFormat === "all" || job.format === selectedFormat) && job.status === "pending")
    : [];

  const currentJobOnMachine = selectedMachine 
    ? jobs.find(j => j.machine_id === selectedMachine.id && j.status === "in_progress")
    : null;

  const handleWarehouseRequest = async () => {
    if (!requestType || !requestQuantity) {
      toast.error("Lütfen tüm alanları doldurun");
      return;
    }
    try {
      await axios.post(`${API}/warehouse-requests`, {
        operator_name: operatorName,
        machine_name: selectedMachine.name,
        item_type: requestType,
        quantity: parseInt(requestQuantity)
      });
      toast.success("Talep gönderildi!");
      setIsRequestDialogOpen(false);
      setRequestType("");
      setRequestQuantity("");
    } catch (error) {
      toast.error("Talep gönderilemedi");
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : navigate("/")} data-testid="back-button" className="border-border bg-surface hover:bg-surface-highlight">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step > 1 ? "Geri" : "Ana Sayfa"}
          </Button>
          <div className="flex items-center gap-2">
            {/* Mesaj butonu - sadece makine seçildiyse */}
            {selectedMachine && (
              <Button 
                variant="outline" 
                size="icon" 
                onClick={openChat}
                className="border-border bg-surface hover:bg-surface-highlight relative"
                data-testid="chat-button"
              >
                <MessageSquare className="h-5 w-5 text-blue-500" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Bildirim Pop-up */}
        <AnimatePresence>
          {showNotification && lastNotificationMessage && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50"
            >
              <Card className="bg-blue-500 border-blue-600 shadow-2xl">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-white/20 rounded-full p-2">
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">Yeni Mesaj - {lastNotificationMessage.sender_name}</p>
                      <p className="text-white/90 text-sm mt-1 line-clamp-2">{lastNotificationMessage.message}</p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setShowNotification(false)}
                      className="text-white hover:bg-white/20 h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={openChat}
                    className="w-full mt-3 bg-white text-blue-500 hover:bg-white/90"
                  >
                    Mesajları Gör
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sohbet Dialog */}
        <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
          <DialogContent className="bg-surface border-border max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                Mesajlar - {selectedMachine?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col h-[400px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background rounded-lg">
                {messages.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Henüz mesaj yok.</p>
                ) : (
                  messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg max-w-[80%] ${
                        msg.sender_role === "yonetim" 
                          ? "bg-primary/20 border border-primary ml-auto" 
                          : "bg-success/20 border border-success"
                      }`}
                    >
                      <p className="text-xs text-text-secondary mb-1 font-semibold">
                        {msg.sender_name} • {new Date(msg.created_at).toLocaleString("tr-TR")}
                      </p>
                      <p className="text-text-primary text-sm">{msg.message}</p>
                    </motion.div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* STEP 1: İsim Girişi */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <h1 className="text-5xl font-heading font-black text-secondary text-center">OPERATÖR GİRİŞİ</h1>
            <Card className="bg-surface border-border max-w-md mx-auto">
              <CardContent className="p-8">
                <Label className="text-text-primary text-lg">Adınız</Label>
                <Input data-testid="operator-name-input" value={operatorName} onChange={(e) => setOperatorName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
                  placeholder="Adınızı girin..." className="mt-2 bg-background border-border text-text-primary text-lg h-14" />
                <Button data-testid="name-submit-button" onClick={handleNameSubmit} className="w-full mt-6 bg-secondary text-white hover:bg-secondary/90 h-14 text-lg font-heading">
                  Devam Et
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* STEP 2: Makine Seçimi */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="text-center">
              <h1 className="text-4xl font-heading font-black text-secondary">Hoş Geldin, {operatorName}!</h1>
              <p className="text-text-secondary mt-2 text-lg">Makine seç</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {machines.map((machine) => (
                <Card key={machine.id}
                  className={`cursor-pointer transition-all ${machine.maintenance ? "opacity-50 border-warning" : "hover:border-secondary border-border"} bg-surface`}
                  onClick={() => handleMachineSelect(machine)} data-testid={`machine-select-${machine.name}`}>
                  <CardContent className="p-6 text-center">
                    <h3 className="text-lg font-heading font-bold text-text-primary">{machine.name}</h3>
                    <p className={`text-sm mt-2 ${machine.maintenance ? "text-warning" : machine.status === "working" ? "text-success" : "text-text-secondary"}`}>
                      {machine.maintenance ? "BAKIM" : machine.status === "working" ? "ÇALIŞIYOR" : "BOŞTA"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP 3: İş Listesi */}
        {step === 3 && selectedMachine && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-heading font-black text-secondary">{selectedMachine.name}</h1>
                <p className="text-text-secondary">Operatör: {operatorName}</p>
              </div>
              <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-warning text-warning hover:bg-warning/10">
                    <Package className="mr-2 h-4 w-4" /> Malzeme Talep Et
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-surface border-border">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-heading">Malzeme Talebi</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-text-primary">Malzeme Türü</Label>
                      <Select value={requestType} onValueChange={setRequestType}>
                        <SelectTrigger className="bg-background border-border text-text-primary">
                          <SelectValue placeholder="Seçin..." />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          <SelectItem value="Kağıt" className="text-text-primary">Kağıt</SelectItem>
                          <SelectItem value="Boya" className="text-text-primary">Boya</SelectItem>
                          <SelectItem value="Kutu" className="text-text-primary">Kutu</SelectItem>
                          <SelectItem value="Diğer" className="text-text-primary">Diğer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-text-primary">Miktar</Label>
                      <Input type="number" value={requestQuantity} onChange={(e) => setRequestQuantity(e.target.value)}
                        placeholder="Adet..." className="bg-background border-border text-text-primary" />
                    </div>
                    <Button onClick={handleWarehouseRequest} className="w-full bg-warning text-black hover:bg-warning/90">Talep Gönder</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Aktif İş */}
            {currentJobOnMachine && (
              <Card className="bg-success/20 border-success border-2">
                <CardHeader>
                  <CardTitle className="text-success flex items-center gap-2">
                    <Play className="h-5 w-5" /> AKTİF İŞ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-heading font-bold text-text-primary">{currentJobOnMachine.name}</h3>
                      <p className="text-text-secondary">Koli: {currentJobOnMachine.koli_count}</p>
                      <p className="text-text-secondary">Renkler: {currentJobOnMachine.colors}</p>
                      {currentJobOnMachine.format && <p className="text-text-secondary">Format: {currentJobOnMachine.format}</p>}
                    </div>
                    <Button onClick={() => handleCompleteJob(currentJobOnMachine)} disabled={loading} className="bg-success text-white hover:bg-success/90">
                      <CheckCircle className="mr-2 h-4 w-4" /> Tamamla
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Format Filtresi */}
            {getFormatOptions(selectedMachine.name).length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {getFormatOptions(selectedMachine.name).map((format) => (
                  <Button key={format} variant={selectedFormat === format ? "default" : "outline"} onClick={() => setSelectedFormat(format)}
                    className={selectedFormat === format ? "bg-secondary text-white" : ""}>
                    {format === "all" ? "Tümü" : format}
                  </Button>
                ))}
              </div>
            )}

            {/* Bekleyen İşler */}
            <div>
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">Sıradaki İşler ({filteredJobs.length})</h2>
              {filteredJobs.length === 0 ? (
                <Card className="bg-surface border-border">
                  <CardContent className="p-8 text-center">
                    <p className="text-text-secondary">Bekleyen iş yok.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredJobs.map((job) => (
                    <Card key={job.id} className="bg-surface border-border" data-testid={`job-${job.id}`}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-heading font-bold text-text-primary">{job.name}</h3>
                              {job.format && <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono rounded">{job.format}</span>}
                            </div>
                            <p className="text-text-secondary">Koli: {job.koli_count}</p>
                            <p className="text-text-secondary">Renkler: {job.colors}</p>
                            {job.notes && <p className="text-text-secondary text-sm mt-2">Not: {job.notes}</p>}
                          </div>
                          {!currentJobOnMachine && (
                            <Button onClick={() => handleStartJob(job)} disabled={loading} className="bg-secondary text-white hover:bg-secondary/90">
                              <Play className="mr-2 h-4 w-4" /> Başlat
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default OperatorFlow;
