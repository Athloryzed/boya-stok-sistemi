import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, Sun, Moon, Package, MessageSquare, Bell, X, Send, GripVertical, Image, BellRing, Pause } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { requestNotificationPermission, showNotification, registerServiceWorker } from "../utils/notifications";
import { requestNotificationPermission as requestFCMPermission, onMessageListener } from "../firebase";

const OperatorFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [operatorName, setOperatorName] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [userData, setUserData] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [requestQuantity, setRequestQuantity] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  
  // Mesajlaşma state'leri
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [lastNotificationMessage, setLastNotificationMessage] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  
  // Sürükle-bırak state'leri
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragOverJob, setDragOverJob] = useState(null);
  
  // Görsel önizleme state'leri
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [selectedJobImage, setSelectedJobImage] = useState(null);

  // Vardiya Sonu state'leri
  const [isShiftEndDialogOpen, setIsShiftEndDialogOpen] = useState(false);
  const [shiftEndData, setShiftEndData] = useState(null);
  const [shiftEndProducedKoli, setShiftEndProducedKoli] = useState("");
  const [shiftEndDefectKg, setShiftEndDefectKg] = useState("");
  const [shiftEndIsCompleted, setShiftEndIsCompleted] = useState(false);
  
  // İş durdurma state'leri
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [jobToPause, setJobToPause] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseProducedKoli, setPauseProducedKoli] = useState("");

  const openImagePreview = (imageUrl) => {
    setSelectedJobImage(imageUrl);
    setIsImagePreviewOpen(true);
  };

  // Bildirim izni state - Safari/iOS uyumluluğu için güvenli kontrol
  const getNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'denied';
  };
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());

  // Service Worker ve bildirim izni - sadece destekleyen tarayıcılarda
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      toast.error("Bu tarayıcı bildirimleri desteklemiyor");
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationPermission('granted');
      toast.success("Bildirimler aktif edildi!");
      showNotification("Buse Kağıt", "Bildirimler başarıyla aktif edildi!");
    } else {
      toast.error("Bildirim izni reddedildi");
    }
  };

  // Oturum kontrolü - localStorage'dan
  useEffect(() => {
    const checkSession = async () => {
      const savedSession = localStorage.getItem("operator_session");
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          setUserData(session);
          setOperatorName(session.display_name || session.username);
          if (session.machine_id) {
            await fetchMachinesData();
            setStep(3);
          } else {
            setStep(2);
          }
          
          // FCM Token kaydı (oturum varsa)
          try {
            const fcmToken = await requestFCMPermission();
            if (fcmToken) {
              await axios.post(`${API}/notifications/register-token`, {
                token: fcmToken,
                user_type: "operator",
                user_id: session.id
              });
            }
          } catch (fcmError) {
            console.error("FCM setup error:", fcmError);
          }
        } catch (e) {
          localStorage.removeItem("operator_session");
        }
      }
      await fetchMachinesData();
      setSessionChecked(true);
    };
    checkSession();
   
  }, []);

  // FCM Foreground mesaj dinleyici
  useEffect(() => {
    if (userData) {
      onMessageListener().then((payload) => {
        if (payload) {
          const data = payload.data || {};
          
          // Vardiya bitişi bildirimi - rapor formunu aç
          if (data.type === "shift_end_report") {
            toast.info("⏰ Vardiya bitti! Lütfen rapor doldurun.", {
              duration: 10000,
              icon: "⏰"
            });
            // Aktif işi al ve rapor formunu aç
            if (currentJob) {
              setShiftEndData({
                job_id: currentJob.id,
                job_name: currentJob.name,
                machine_id: selectedMachine.id,
                machine_name: selectedMachine.name,
                target_koli: currentJob.koli_count
              });
              setShiftEndProducedKoli("");
              setShiftEndDefectKg("");
              setShiftEndIsCompleted(false);
              setIsShiftEndDialogOpen(true);
            }
          } else {
            toast.success(payload.notification?.body || "Yeni bildirim", {
              duration: 8000,
              icon: "🔔"
            });
          }
          
          // Mesajları ve işleri yenile
          if (selectedMachine) {
            fetchMessages();
            fetchJobs();
          }
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, selectedMachine, currentJob]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine]);

  useEffect(() => {
    // Yeni mesaj geldiğinde bildirim göster
    if (messages.length > prevMessagesLengthRef.current && prevMessagesLengthRef.current > 0) {
      const newMessage = messages[messages.length - 1];
      if (!newMessage.is_read) {
        setLastNotificationMessage(newMessage);
        setShowNotificationBanner(true);
        
        // Tarayıcı push bildirimi gönder
        if (notificationPermission === 'granted') {
          showNotification(
            `Yeni Mesaj - ${newMessage.sender_name || 'Yönetim'}`,
            newMessage.message,
            { tag: `message-${newMessage.id}` }
          );
        }
        
        // Ses çal (opsiyonel)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ0HA5/a3byPIQQJltnn2p0lBAuR2uvnnSsFCo3Y6+qjMwYLh9Xt56k5BwuD0u3nrkAIDH/P7eixRQgPesr06rhKChFzy/bsvlALEnbJ+O3CUw0TdMj67MRWDxRyx/vrxFkQFXDH/O3FWxEWbsf97sZdEhdsxv3uxl8TGGrF/e7GYBQZaMX+7sZhFRpnxf/ux2IWG2bE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGbE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGXE/+7HYxccZsT/7sdjFxxlxP/ux2MXHGXE/+7HYxccZcT/7sdjFxxlxP/ux2MXHGXE/+7HYw==');
          audio.volume = 0.3;
          audio.play();
        } catch (e) {
          // Audio playback failed, ignore silently
        }
        
        // 5 saniye sonra bildirimi kapat
        setTimeout(() => setShowNotificationBanner(false), 5000);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, notificationPermission]);

  useEffect(() => {
    // Chat açıkken en alta scroll
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  // WebSocket ile vardiya sonu bildirimi dinle
  useEffect(() => {
    if (!selectedMachine?.id) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API.replace('https://', '').replace('http://', '').replace('/api', '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws/operator/${selectedMachine.id}`;
    
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Vardiya sonu bildirimi
          if (data.type === 'shift_end_request') {
            const notification = data.data;
            // Bu makineye ait bildirim mi kontrol et
            if (notification.machine_id === selectedMachine.id) {
              setShiftEndData(notification);
              setShiftEndProducedKoli("");
              setShiftEndDefectKg("");
              setShiftEndIsCompleted(false);
              setIsShiftEndDialogOpen(true);
              
              // Push bildirimi
              if (notificationPermission === 'granted') {
                showNotification(
                  "⏰ Vardiya Sonu!",
                  notification.message,
                  { tag: 'shift-end' }
                );
              }
              
              toast.warning("Vardiya sonu bildirimi geldi!", { duration: 10000 });
            }
          }
          
          // Yeni mesaj bildirimi
          if (data.type === 'new_message') {
            const msgData = data.data;
            // Bu makineye ait mesaj mı kontrol et
            if (msgData.machine_id === selectedMachine.id) {
              // Mesajları yenile
              fetchMessages();
              
              // Push bildirimi
              if (notificationPermission === 'granted') {
                showNotification(
                  `💬 Yeni Mesaj - ${msgData.sender_name}`,
                  msgData.message,
                  { tag: 'new-message' }
                );
              }
              
              toast.info(`Yeni mesaj: ${msgData.message.substring(0, 50)}...`, { duration: 5000 });
            }
          }
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (e) {
      console.error("WebSocket connection error:", e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, [selectedMachine?.id, notificationPermission]);

  // Vardiya sonu raporu gönder
  const handleSubmitShiftEndReport = async () => {
    if (!shiftEndData) return;
    
    if (!shiftEndIsCompleted && (!shiftEndProducedKoli || parseInt(shiftEndProducedKoli) <= 0)) {
      toast.error("Lütfen üretilen koli sayısını girin");
      return;
    }

    try {
      await axios.post(`${API}/shifts/operator-report`, {
        shift_id: shiftEndData.shift_id,
        operator_id: userData?.id || "",
        operator_name: operatorName,
        machine_id: selectedMachine.id,
        machine_name: selectedMachine.name,
        job_id: shiftEndData.job_id,
        job_name: shiftEndData.job_name,
        target_koli: shiftEndData.target_koli,
        produced_koli: shiftEndIsCompleted ? shiftEndData.target_koli : parseInt(shiftEndProducedKoli),
        defect_kg: parseFloat(shiftEndDefectKg) || 0,
        is_completed: shiftEndIsCompleted
      });

      toast.success("Rapor gönderildi! Yönetim onayı bekleniyor.");
      setIsShiftEndDialogOpen(false);
      setShiftEndData(null);
      fetchJobs();
    } catch (error) {
      toast.error("Rapor gönderilemedi");
    }
  };

  const fetchMachinesData = async () => {
    try {
      const response = await axios.get(`${API}/machines`);
      const uniqueMachines = response.data.reduce((acc, machine) => {
        if (!acc.find(m => m.id === machine.id)) acc.push(machine);
        return acc;
      }, []);
      setMachines(uniqueMachines);
      return uniqueMachines;
    } catch (error) {
      toast.error("Makineler yüklenemedi");
      return [];
    }
  };

  const fetchMachines = async () => {
    return fetchMachinesData();
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
    setShowNotificationBanner(false);
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

  const handleNameSubmit = async () => {
    if (!operatorName.trim() || !operatorPassword.trim()) {
      toast.error("Kullanıcı adı ve şifre gerekli");
      return;
    }
    try {
      const response = await axios.post(`${API}/users/login`, {
        username: operatorName,
        password: operatorPassword,
        role: "operator"
      });
      const user = response.data;
      setUserData(user);
      setOperatorName(user.display_name || user.username);
      localStorage.setItem("operator_session", JSON.stringify(user));
      toast.success("Giriş başarılı!");
      
      // FCM Token kaydı (push bildirimleri için)
      try {
        const fcmToken = await requestFCMPermission();
        if (fcmToken) {
          await axios.post(`${API}/notifications/register-token`, {
            token: fcmToken,
            user_type: "operator",
            user_id: user.id
          });
          console.log("Operator FCM token registered");
        }
      } catch (fcmError) {
        console.error("FCM setup error:", fcmError);
      }
      
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Giriş başarısız");
    }
  };

  const handleMachineSelect = (machine) => {
    if (machine.maintenance) {
      toast.error("Bu makine bakımda!");
      return;
    }
    setSelectedMachine(machine);
    // Makine seçimini kaydet
    if (userData) {
      const updatedSession = { ...userData, machine_id: machine.id, machine_name: machine.name };
      localStorage.setItem("operator_session", JSON.stringify(updatedSession));
    }
    setStep(3);
  };

  const handleLogout = () => {
    localStorage.removeItem("operator_session");
    setUserData(null);
    setSelectedMachine(null);
    setOperatorName("");
    setOperatorPassword("");
    setStep(1);
    toast.success("Çıkış yapıldı");
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

  // İş Durdurma
  const openPauseDialog = (job) => {
    setJobToPause(job);
    setPauseReason("");
    setPauseProducedKoli("");
    setIsPauseDialogOpen(true);
  };

  const handlePauseJob = async () => {
    if (!jobToPause) return;
    
    setLoading(true);
    try {
      await axios.put(`${API}/jobs/${jobToPause.id}/pause`, {
        pause_reason: pauseReason,
        produced_koli: parseInt(pauseProducedKoli) || 0
      });
      toast.success("İş durduruldu!");
      setIsPauseDialogOpen(false);
      setJobToPause(null);
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "İş durdurulamadı");
    } finally {
      setLoading(false);
    }
  };

  // Durdurulan İşe Devam Et
  const handleResumeJob = async (job) => {
    setLoading(true);
    try {
      await axios.put(`${API}/jobs/${job.id}/resume`, {
        operator_name: operatorName
      });
      toast.success("İşe devam edildi!");
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || "İşe devam edilemedi");
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

  // Sürükle-bırak fonksiyonları
  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", job.id);
  };

  const handleDragOver = (e, job) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedJob && job.id !== draggedJob.id) {
      setDragOverJob(job);
    }
  };

  const handleDragLeave = () => {
    setDragOverJob(null);
  };

  const handleDrop = async (e, targetJob) => {
    e.preventDefault();
    if (!draggedJob || draggedJob.id === targetJob.id) {
      setDraggedJob(null);
      setDragOverJob(null);
      return;
    }

    const pendingJobs = jobs.filter(j => j.status === "pending" && j.machine_id === selectedMachine.id);
    const draggedIndex = pendingJobs.findIndex(j => j.id === draggedJob.id);
    const targetIndex = pendingJobs.findIndex(j => j.id === targetJob.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedJob(null);
      setDragOverJob(null);
      return;
    }

    // Yeni sıralama oluştur
    const newOrder = pendingJobs.map((job, index) => {
      if (job.id === draggedJob.id) {
        return { job_id: job.id, order: targetIndex };
      } else if (draggedIndex < targetIndex) {
        // Aşağı taşıma
        if (index > draggedIndex && index <= targetIndex) {
          return { job_id: job.id, order: index - 1 };
        }
      } else {
        // Yukarı taşıma
        if (index >= targetIndex && index < draggedIndex) {
          return { job_id: job.id, order: index + 1 };
        }
      }
      return { job_id: job.id, order: index };
    });

    try {
      await axios.put(`${API}/jobs/reorder-batch`, { jobs: newOrder });
      toast.success("İş sırası güncellendi!");
      fetchJobs();
    } catch (error) {
      toast.error("Sıralama güncellenemedi");
    }

    setDraggedJob(null);
    setDragOverJob(null);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverJob(null);
  };

  // Oturum kontrolü henüz bitmedi
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Yükleniyor...</p>
        </div>
      </div>
    );
  }

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
            {step > 1 && (
              <Button variant="outline" onClick={handleLogout} data-testid="logout-button" className="border-border bg-surface hover:bg-surface-highlight">
                Çıkış Yap
              </Button>
            )}
            {notificationPermission !== 'granted' && typeof window !== 'undefined' && 'Notification' in window && (
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleEnableNotifications} 
                data-testid="enable-notifications"
                className="border-border bg-surface hover:bg-surface-highlight"
                title="Bildirimleri Aktif Et"
              >
                <BellRing className="h-5 w-5 text-warning" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Bildirim Pop-up */}
        <AnimatePresence>
          {showNotificationBanner && lastNotificationMessage && (
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
                      onClick={() => setShowNotificationBanner(false)}
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
                        msg.sender_role === "operator" 
                          ? "bg-secondary/20 border border-secondary ml-auto" 
                          : msg.sender_role === "yonetim"
                          ? "bg-primary/20 border border-primary"
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
              
              {/* Yanıt Yazma Alanı */}
              <div className="mt-3 flex gap-2">
                <Input
                  data-testid="reply-input"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !sendingReply && handleSendReply()}
                  placeholder="Yanıt yazın..."
                  className="bg-background border-border text-text-primary flex-1"
                  disabled={sendingReply}
                />
                <Button 
                  data-testid="send-reply-button"
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="bg-secondary text-white hover:bg-secondary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* STEP 1: Kullanıcı Girişi */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <h1 className="text-5xl font-heading font-black text-secondary text-center">OPERATÖR GİRİŞİ</h1>
            <Card className="bg-surface border-border max-w-md mx-auto">
              <CardContent className="p-8 space-y-4">
                <div>
                  <Label className="text-text-primary text-lg">Kullanıcı Adı</Label>
                  <Input data-testid="operator-username-input" value={operatorName} onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Kullanıcı adınız..." className="mt-2 bg-background border-border text-text-primary text-lg h-14" />
                </div>
                <div>
                  <Label className="text-text-primary text-lg">Şifre</Label>
                  <Input data-testid="operator-password-input" type="password" value={operatorPassword || ""} onChange={(e) => setOperatorPassword(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
                    placeholder="Şifreniz..." className="mt-2 bg-background border-border text-text-primary text-lg h-14" />
                </div>
                <Button data-testid="name-submit-button" onClick={handleNameSubmit} className="w-full mt-6 bg-secondary text-white hover:bg-secondary/90 h-14 text-lg font-heading">
                  Giriş Yap
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
                    <div className="flex gap-2">
                      <Button onClick={() => openPauseDialog(currentJobOnMachine)} disabled={loading} variant="outline" className="border-warning text-warning hover:bg-warning/20">
                        <Pause className="mr-2 h-4 w-4" /> Durdur
                      </Button>
                      <Button onClick={() => handleCompleteJob(currentJobOnMachine)} disabled={loading} className="bg-success text-white hover:bg-success/90">
                        <CheckCircle className="mr-2 h-4 w-4" /> Tamamla
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Durdurulan İşler */}
            {jobs.filter(j => j.machine_id === selectedMachine.id && j.status === "paused").length > 0 && (
              <Card className="bg-warning/10 border-warning border">
                <CardHeader>
                  <CardTitle className="text-warning flex items-center gap-2">
                    <Pause className="h-5 w-5" /> DURDURULMUŞ İŞLER
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {jobs.filter(j => j.machine_id === selectedMachine.id && j.status === "paused").map(job => (
                    <div key={job.id} className="flex justify-between items-center p-3 bg-background rounded-lg border border-border">
                      <div>
                        <p className="font-semibold text-text-primary">{job.name}</p>
                        <p className="text-sm text-text-secondary">Sebep: {job.pause_reason || "-"}</p>
                        {job.produced_before_pause > 0 && (
                          <p className="text-sm text-text-secondary">Üretilen: {job.produced_before_pause} koli</p>
                        )}
                      </div>
                      <Button 
                        onClick={() => handleResumeJob(job)} 
                        disabled={loading || currentJobOnMachine}
                        className="bg-info text-white hover:bg-info/90"
                        size="sm"
                      >
                        <Play className="mr-1 h-3 w-3" /> Devam Et
                      </Button>
                    </div>
                  ))}
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
              <h2 className="text-xl font-heading font-bold text-text-primary mb-4">
                Sıradaki İşler ({filteredJobs.length})
                {filteredJobs.length > 1 && <span className="text-sm font-normal text-text-secondary ml-2">(Sıralamak için sürükleyin)</span>}
              </h2>
              {filteredJobs.length === 0 ? (
                <Card className="bg-surface border-border">
                  <CardContent className="p-8 text-center">
                    <p className="text-text-secondary">Bekleyen iş yok.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredJobs.map((job, index) => (
                    <Card 
                      key={job.id} 
                      className={`bg-surface border-border cursor-grab active:cursor-grabbing transition-all ${
                        dragOverJob?.id === job.id ? "border-secondary border-2 scale-[1.02]" : ""
                      } ${draggedJob?.id === job.id ? "opacity-50" : ""}`}
                      data-testid={`job-${job.id}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      onDragOver={(e) => handleDragOver(e, job)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, job)}
                      onDragEnd={handleDragEnd}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center justify-center pt-1">
                              <GripVertical className="h-5 w-5 text-text-secondary" />
                              <span className="text-xs text-text-secondary mt-1">#{index + 1}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-xl font-heading font-bold text-text-primary">{job.name}</h3>
                                {job.format && <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono rounded">{job.format}</span>}
                                {job.remaining_koli > 0 && job.remaining_koli < job.koli_count && (
                                  <span className="px-2 py-1 bg-warning/20 text-warning text-xs font-bold rounded">DEVAM</span>
                                )}
                                {job.image_url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => { e.stopPropagation(); openImagePreview(job.image_url); }}
                                    className="text-secondary border-secondary/50 h-7 px-2"
                                  >
                                    <Image className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              {job.remaining_koli > 0 && job.remaining_koli < job.koli_count ? (
                                <>
                                  <p className="text-warning font-bold">Kalan Koli: {job.remaining_koli} / {job.koli_count}</p>
                                  <p className="text-text-secondary text-sm">Üretilen: {job.koli_count - job.remaining_koli} koli</p>
                                </>
                              ) : (
                                <p className="text-text-secondary">Koli: {job.koli_count}</p>
                              )}
                              <p className="text-text-secondary">Renkler: {job.colors}</p>
                              {job.notes && <p className="text-text-secondary text-sm mt-2">Not: {job.notes}</p>}
                            </div>
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

        {/* Görsel Önizleme Dialog */}
        <Dialog open={isImagePreviewOpen} onOpenChange={setIsImagePreviewOpen}>
          <DialogContent className="bg-surface border-border max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading flex items-center gap-2">
                <Image className="h-5 w-5" /> İş Görseli
              </DialogTitle>
            </DialogHeader>
            {selectedJobImage && (
              <div className="flex justify-center">
                <img 
                  src={`${API.replace('/api', '')}${selectedJobImage}`} 
                  alt="İş Görseli" 
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Vardiya Sonu Dialog */}
        <Dialog open={isShiftEndDialogOpen} onOpenChange={setIsShiftEndDialogOpen}>
          <DialogContent className="bg-surface border-border max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading text-warning flex items-center gap-2">
                ⏰ Vardiya Sonu
              </DialogTitle>
            </DialogHeader>
            {shiftEndData && (
              <div className="space-y-4">
                <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-text-primary font-bold">{shiftEndData.message}</p>
                </div>
                
                <div className="p-4 bg-surface-highlight rounded-lg space-y-2">
                  <p className="text-text-secondary">Makine: <span className="text-text-primary font-bold">{shiftEndData.machine_name}</span></p>
                  <p className="text-text-secondary">İş: <span className="text-text-primary font-bold">{shiftEndData.job_name}</span></p>
                  <p className="text-text-secondary">Hedef Koli: <span className="text-text-primary font-bold">{shiftEndData.target_koli}</span></p>
                </div>

                {/* İş Tamamlandı mı? */}
                <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-lg cursor-pointer" onClick={() => setShiftEndIsCompleted(!shiftEndIsCompleted)}>
                  <input 
                    type="checkbox" 
                    checked={shiftEndIsCompleted}
                    onChange={(e) => setShiftEndIsCompleted(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-text-primary font-bold">İşi Tamamladım ✅</span>
                </div>

                {!shiftEndIsCompleted && (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-text-primary">Üretilen Koli Sayısı *</Label>
                      <Input
                        type="number"
                        value={shiftEndProducedKoli}
                        onChange={(e) => setShiftEndProducedKoli(e.target.value)}
                        placeholder="Kaç koli ürettiniz?"
                        className="bg-background border-border text-text-primary"
                        data-testid="shift-end-produced-koli"
                      />
                    </div>
                    <div>
                      <Label className="text-text-primary">Defo (kg)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={shiftEndDefectKg}
                        onChange={(e) => setShiftEndDefectKg(e.target.value)}
                        placeholder="Defo miktarı (kg)"
                        className="bg-background border-border text-text-primary"
                        data-testid="shift-end-defect-kg"
                      />
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleSubmitShiftEndReport}
                  className="w-full bg-warning text-black hover:bg-warning/90 font-bold"
                  data-testid="submit-shift-end-report"
                >
                  Raporu Gönder
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* İş Durdurma Dialog */}
        <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-heading flex items-center gap-2">
                <Pause className="h-5 w-5 text-warning" /> İşi Durdur
              </DialogTitle>
            </DialogHeader>
            {jobToPause && (
              <div className="space-y-4">
                <div className="p-4 bg-surface-highlight rounded-lg">
                  <p className="text-text-secondary">İş: <span className="text-text-primary font-bold">{jobToPause.name}</span></p>
                  <p className="text-text-secondary">Hedef: <span className="text-text-primary font-bold">{jobToPause.koli_count} koli</span></p>
                </div>
                
                <div>
                  <Label className="text-text-primary">Şu ana kadar üretilen koli (opsiyonel)</Label>
                  <Input
                    type="number"
                    value={pauseProducedKoli}
                    onChange={(e) => setPauseProducedKoli(e.target.value)}
                    placeholder="0"
                    className="bg-background border-border"
                  />
                </div>
                
                <div>
                  <Label className="text-text-primary">Durdurma Sebebi *</Label>
                  <Input
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    placeholder="Neden durduruluyor?"
                    className="bg-background border-border"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsPauseDialogOpen(false)}
                    className="flex-1"
                  >
                    İptal
                  </Button>
                  <Button 
                    onClick={handlePauseJob}
                    disabled={!pauseReason || loading}
                    className="flex-1 bg-warning text-black hover:bg-warning/90"
                  >
                    Durdur
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default OperatorFlow;
