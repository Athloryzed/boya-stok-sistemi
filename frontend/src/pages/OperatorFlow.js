import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, Sun, Moon, Package, MessageSquare, Bell, X, Send, GripVertical, Image, BellRing, Pause, Sparkles, Bot, ChevronUp, QrCode } from "lucide-react";
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
import { initializePushNotifications, isNativePlatform } from "../pushNotifications";

// Geçen gün sayısını hesapla
const calculateDaysElapsed = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Geçen gün rengini belirle
const getDaysElapsedColor = (days) => {
  if (days === null) return "text-text-secondary";
  if (days <= 2) return "text-green-500";
  if (days <= 5) return "text-yellow-500";
  if (days <= 10) return "text-orange-500";
  return "text-red-500";
};

const OperatorFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [qrStartJobId, setQrStartJobId] = useState(null);
  const [operatorName, setOperatorName] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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

  // AI Asistan state'leri
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [aiTab, setAiTab] = useState("suggestions");
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiSugLoading, setAiSugLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiSessionId] = useState(() => `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const aiChatEndRef = useRef(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const qrScannerRef = useRef(null);

  const openImagePreview = (imageUrl) => {
    setSelectedJobImage(imageUrl);
    setIsImagePreviewOpen(true);
  };

  // QR Scanner
  const openQrScanner = async () => {
    setIsQrScannerOpen(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader-element");
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // QR'da URL var, start parametresini çıkar
            try {
              const url = new URL(decodedText);
              const jobId = url.searchParams.get("start");
              if (jobId) {
                closeQrScanner();
                setQrStartJobId(jobId);
                toast.success("QR kod okundu!");
              }
            } catch {
              // URL değil, direkt job id olabilir
              closeQrScanner();
              setQrStartJobId(decodedText);
              toast.success("QR kod okundu!");
            }
          },
          () => {} // ignore scan errors
        );
      } catch (err) {
        toast.error("Kamera açılamadı: " + (err.message || err));
        setIsQrScannerOpen(false);
      }
    }, 300);
  };

  const closeQrScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop().catch(() => {});
      qrScannerRef.current = null;
    }
    setIsQrScannerOpen(false);
  };

  // AI öneri getir
  const fetchAISuggestions = async () => {
    if (!selectedMachine?.id || !operatorName) return;
    setAiSugLoading(true);
    try {
      const res = await axios.get(`${API}/ai/operator-suggestion?machine_id=${selectedMachine.id}&operator_name=${operatorName}`);
      setAiSuggestions(res.data);
    } catch {
      toast.error("AI önerisi alınamadı");
    } finally {
      setAiSugLoading(false);
    }
  };

  // AI sohbet gönder
  const sendAIMessage = async () => {
    if (!aiInput.trim() || !selectedMachine?.id || aiChatLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setAiChatLoading(true);
    try {
      const res = await axios.post(`${API}/ai/operator-chat`, {
        message: userMsg,
        machine_id: selectedMachine.id,
        operator_name: operatorName,
        session_id: aiSessionId
      });
      setAiMessages(prev => [...prev, { role: "assistant", content: res.data.response }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Bir hata olustu, tekrar deneyin." }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  // AI sohbet scroll
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

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

  // Hatırla Beni - sayfa yüklendiğinde kayıtlı bilgileri doldur
  useEffect(() => {
    // QR koddan gelen iş başlatma parametresini kontrol et
    const startJobId = searchParams.get("start");
    if (startJobId) {
      setQrStartJobId(startJobId);
    }
    
    const remembered = localStorage.getItem("operator_remember");
    if (remembered) {
      try {
        const creds = JSON.parse(remembered);
        setOperatorName(creds.username || "");
        setOperatorPassword(creds.password || "");
        setRememberMe(true);
      } catch (e) {
        localStorage.removeItem("operator_remember");
      }
    }
  }, []);

  // Oturum kontrolü - localStorage'dan
  useEffect(() => {
    const checkSession = async () => {
      const savedSession = localStorage.getItem("operator_session");
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          
          // Oturum süresini kontrol et (24 saat)
          const sessionTime = session.login_time || 0;
          const now = Date.now();
          const hoursPassed = (now - sessionTime) / (1000 * 60 * 60);
          
          if (hoursPassed >= 24) {
            // Oturum süresi dolmuş
            localStorage.removeItem("operator_session");
            await fetchMachinesData();
            setSessionChecked(true);
            return;
          }
          
          setUserData(session);
          setOperatorName(session.display_name || session.username);
          if (session.machine_id) {
            await fetchMachinesData();
            setStep(3);
          } else {
            setStep(2);
          }
          
          // Push Notification kurulumu - Platform bazlı
          try {
            if (isNativePlatform()) {
              // Android için Capacitor Push Notifications
              await initializePushNotifications(session.id, "operator");
              console.log("Native push notifications initialized");
            } else {
              // Web için Firebase Web SDK
              const fcmToken = await requestFCMPermission();
              if (fcmToken) {
                await axios.post(`${API}/notifications/register-token`, {
                  token: fcmToken,
                  user_type: "operator",
                  user_id: session.id,
                  platform: "web"
                });
              }
            }
          } catch (pushError) {
            console.error("Push notification setup error:", pushError);
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
            // Aktif işi bul ve rapor formunu aç
            const activeJob = selectedMachine ? jobs.find(j => j.machine_id === selectedMachine.id && j.status === "in_progress") : null;
            if (activeJob && selectedMachine) {
              setShiftEndData({
                job_id: activeJob.id,
                job_name: activeJob.name,
                machine_id: selectedMachine.id,
                machine_name: selectedMachine.name,
                target_koli: activeJob.koli_count
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
  }, [userData, selectedMachine, jobs]);

  useEffect(() => {
    if (selectedMachine) {
      fetchJobs();
      fetchMessages();
      
      // Mesajları her 15 saniyede bir kontrol et (performans için)
      const interval = setInterval(() => {
        fetchMessages();
        fetchUnreadCount();
      }, 15000);
      
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine]);

  // QR kodla iş başlatma
  useEffect(() => {
    if (!qrStartJobId || !userData || !jobs.length) return;
    const job = jobs.find(j => j.id === qrStartJobId && j.status === "pending");
    if (job && selectedMachine && job.machine_id === selectedMachine.id) {
      handleStartJob(job.id);
      setQrStartJobId(null);
      // URL'den start parametresini temizle
      navigate("/operator", { replace: true });
      toast.success(`QR ile iş başlatıldı: ${job.name}`);
    } else if (job && !selectedMachine) {
      // Makine henüz seçilmemiş - otomatik seç
      const machine = machines.find(m => m.id === job.machine_id);
      if (machine) {
        handleMachineSelect(machine);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrStartJobId, userData, jobs, selectedMachine]);

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
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/operator/${selectedMachine.id}`;
    
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

  const fetchMachinesData = async (retryCount = 0) => {
    try {
      const response = await axios.get(`${API}/machines`);
      const uniqueMachines = response.data.reduce((acc, machine) => {
        if (!acc.find(m => m.id === machine.id)) acc.push(machine);
        return acc;
      }, []);
      setMachines(uniqueMachines);
      return uniqueMachines;
    } catch (error) {
      if (retryCount < 3) {
        await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)));
        return fetchMachinesData(retryCount + 1);
      }
      toast.error("Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.");
      return [];
    }
  };

  const fetchMachines = async () => {
    return fetchMachinesData();
  };

  const fetchJobs = async (retryCount = 0) => {
    if (!selectedMachine) return;
    try {
      const [machineJobsRes, pausedJobsRes] = await Promise.all([
        axios.get(`${API}/jobs?machine_id=${selectedMachine.id}`),
        axios.get(`${API}/jobs/paused`)
      ]);
      
      const machineJobs = machineJobsRes.data;
      const pausedJobs = pausedJobsRes.data.filter(j => j.machine_id === selectedMachine.id);
      
      const allJobs = [...machineJobs];
      pausedJobs.forEach(pj => {
        if (!allJobs.find(j => j.id === pj.id)) {
          allJobs.push(pj);
        }
      });
      
      setJobs(allJobs);
    } catch (error) {
      console.error("Jobs fetch error:", error);
      if (retryCount < 3) {
        setTimeout(() => fetchJobs(retryCount + 1), 2000 * (retryCount + 1));
      } else {
        toast.error("Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin.");
      }
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
      // 24 saatlik oturum için login zamanını kaydet
      const sessionData = {
        ...user,
        login_time: Date.now()
      };
      setUserData(user);
      setOperatorName(user.display_name || user.username);
      localStorage.setItem("operator_session", JSON.stringify(sessionData));
      
      // Hatırla Beni kaydet/temizle
      if (rememberMe) {
        localStorage.setItem("operator_remember", JSON.stringify({ username: operatorName, password: operatorPassword }));
      } else {
        localStorage.removeItem("operator_remember");
      }
      
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
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "in_progress", operator_name: operatorName, started_at: new Date().toISOString() } : j));
    try {
      await axios.put(`${API}/jobs/${job.id}/start`, { operator_name: operatorName });
      toast.success("İş başlatıldı!");
    } catch (error) {
      toast.error("İş başlatılamadı");
      fetchJobs();
    }
  };

  const handleCompleteJob = async (job) => {
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "completed", completed_at: new Date().toISOString() } : j));
    try {
      await axios.put(`${API}/jobs/${job.id}/complete`);
      toast.success("İş tamamlandı!");
    } catch (error) {
      toast.error("İş tamamlanamadı");
      fetchJobs();
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
      // Hem jobs hem de machines'i güncelle
      await fetchJobs();
      await fetchMachinesData();
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
                <label className="flex items-center gap-2 cursor-pointer select-none" data-testid="operator-remember-me">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-5 h-5 rounded border-border accent-secondary cursor-pointer" />
                  <span className="text-text-secondary text-sm">Hatırla Beni</span>
                </label>
                <Button data-testid="name-submit-button" onClick={handleNameSubmit} className="w-full mt-4 bg-secondary text-white hover:bg-secondary/90 h-14 text-lg font-heading">
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
              {machines.map((machine, index) => (
                <Card key={machine.id}
                  className={`cursor-pointer machine-card-hover animate-fade-up stagger-${index + 1} ${machine.maintenance ? "opacity-50 border-warning" : machine.status === "working" ? "border-success machine-working" : "border-border hover:border-secondary"} bg-surface`}
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
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-heading font-bold text-text-primary">{currentJobOnMachine.name}</h3>
                      {currentJobOnMachine.remaining_koli > 0 && currentJobOnMachine.remaining_koli < currentJobOnMachine.koli_count ? (
                        <>
                          <p className="text-warning font-bold">Kalan Koli: {currentJobOnMachine.remaining_koli} / {currentJobOnMachine.koli_count}</p>
                          <p className="text-text-secondary text-sm">Yapılan: {currentJobOnMachine.completed_koli || (currentJobOnMachine.koli_count - currentJobOnMachine.remaining_koli)} koli</p>
                        </>
                      ) : (
                        <p className="text-text-secondary">Koli: {currentJobOnMachine.koli_count}</p>
                      )}
                      <p className="text-text-secondary">Renkler: {currentJobOnMachine.colors}</p>
                      {currentJobOnMachine.format && <p className="text-text-secondary">Format: {currentJobOnMachine.format}</p>}
                    </div>
                    {currentJobOnMachine.image_url && (
                      <div 
                        className="cursor-pointer flex-shrink-0"
                        onClick={() => window.open(currentJobOnMachine.image_url, '_blank')}
                      >
                        <img 
                          src={currentJobOnMachine.image_url} 
                          alt={currentJobOnMachine.name}
                          className="w-24 h-24 object-cover rounded-lg border-2 border-success hover:opacity-80 transition-opacity"
                        />
                        <p className="text-xs text-center text-success mt-1">Görseli Aç</p>
                      </div>
                    )}
                  </div>
                  {currentJobOnMachine.notes && (
                    <div className="mt-3 p-2 bg-info/10 border border-info/30 rounded-lg">
                      <p className="text-sm text-info"><span className="font-semibold">Not:</span> {currentJobOnMachine.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Button onClick={() => openPauseDialog(currentJobOnMachine)} disabled={loading} variant="outline" className="border-warning text-warning hover:bg-warning/20">
                      <Pause className="mr-2 h-4 w-4" /> Durdur
                    </Button>
                    <Button onClick={() => handleCompleteJob(currentJobOnMachine)} disabled={loading} className="bg-success text-white hover:bg-success/90">
                      <CheckCircle className="mr-2 h-4 w-4" /> Tamamla
                    </Button>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-heading font-bold text-text-primary">
                  Sıradaki İşler ({filteredJobs.length})
                  {filteredJobs.length > 1 && <span className="text-sm font-normal text-text-secondary ml-2">(Sıralamak için sürükleyin)</span>}
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openQrScanner}
                  className="text-purple-500 border-purple-500 hover:bg-purple-500/10"
                  data-testid="qr-scanner-btn"
                >
                  <QrCode className="h-4 w-4 mr-1" /> QR Tara
                </Button>
              </div>
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
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="text-xl font-heading font-bold text-text-primary">{job.name}</h3>
                                {job.format && <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono rounded">{job.format}</span>}
                                {job.queued_at && (
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${getDaysElapsedColor(calculateDaysElapsed(job.queued_at))}`}>
                                    📅 {calculateDaysElapsed(job.queued_at)}g
                                  </span>
                                )}
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
                  {shiftEndData.original_koli && shiftEndData.original_koli !== shiftEndData.target_koli && (
                    <p className="text-text-secondary text-sm">Orijinal Toplam: <span className="text-text-primary">{shiftEndData.original_koli}</span></p>
                  )}
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
        {/* AI Asistan - Floating Button & Panel */}
        {step === 3 && selectedMachine && (
          <>
            {/* Floating AI Butonu */}
            {!isAIOpen && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { setIsAIOpen(true); if (!aiSuggestions) fetchAISuggestions(); }}
                className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg flex items-center justify-center"
                data-testid="ai-assistant-btn"
              >
                <Sparkles className="h-6 w-6" />
              </motion.button>
            )}

            {/* AI Panel */}
            <AnimatePresence>
              {isAIOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 100, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 100, scale: 0.95 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[420px] z-50 bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                  style={{ maxHeight: "70vh" }}
                  data-testid="ai-assistant-panel"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500/20 to-purple-600/20 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-blue-400" />
                      <span className="font-heading font-bold text-text-primary">AI Asistan</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">GPT-5.2</span>
                    </div>
                    <button onClick={() => setIsAIOpen(false)} className="p-1 hover:bg-surface-highlight rounded-full transition-colors">
                      <X className="h-5 w-5 text-text-secondary" />
                    </button>
                  </div>

                  {/* Tab Switch */}
                  <div className="flex border-b border-border">
                    <button
                      onClick={() => { setAiTab("suggestions"); if (!aiSuggestions) fetchAISuggestions(); }}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${aiTab === "suggestions" ? "text-blue-400 border-b-2 border-blue-400" : "text-text-secondary hover:text-text-primary"}`}
                      data-testid="ai-tab-suggestions"
                    >
                      Oneriler
                    </button>
                    <button
                      onClick={() => setAiTab("chat")}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${aiTab === "chat" ? "text-blue-400 border-b-2 border-blue-400" : "text-text-secondary hover:text-text-primary"}`}
                      data-testid="ai-tab-chat"
                    >
                      Sohbet
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Oneriler Sekmesi */}
                    {aiTab === "suggestions" && (
                      <div className="p-4 space-y-3">
                        {aiSugLoading ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-400 border-t-transparent" />
                            <p className="text-text-secondary text-sm">AI analiz ediyor...</p>
                          </div>
                        ) : aiSuggestions ? (
                          <>
                            {/* Istatistikler */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-blue-400">{aiSuggestions.stats.pending_jobs}</p>
                                <p className="text-xs text-text-secondary">Bekleyen</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-green-400">{aiSuggestions.stats.avg_koli_per_hour || "-"}</p>
                                <p className="text-xs text-text-secondary">Koli/Saat</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-red-400">{aiSuggestions.stats.defect_kg_7d}</p>
                                <p className="text-xs text-text-secondary">Defo(kg)</p>
                              </div>
                            </div>
                            {/* AI Onerisi */}
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3" data-testid="ai-suggestions-content">
                              <p className="text-sm text-text-primary whitespace-pre-line leading-relaxed">{aiSuggestions.suggestions}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={fetchAISuggestions} className="w-full text-blue-400 border-blue-500/30 hover:bg-blue-500/10" data-testid="ai-refresh-btn">
                              <Sparkles className="mr-2 h-4 w-4" /> Yenile
                            </Button>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <Sparkles className="h-8 w-8 text-text-secondary mx-auto mb-2" />
                            <p className="text-text-secondary text-sm">Oneriler yukleniyor...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sohbet Sekmesi */}
                    {aiTab === "chat" && (
                      <div className="flex flex-col" style={{ minHeight: "250px" }}>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "40vh" }}>
                          {aiMessages.length === 0 && (
                            <div className="text-center py-6">
                              <Bot className="h-10 w-10 text-text-secondary mx-auto mb-3 opacity-50" />
                              <p className="text-text-secondary text-sm">Makine ve islerle ilgili soru sorun.</p>
                              <div className="flex flex-wrap justify-center gap-2 mt-3">
                                {["Bu isi ne kadar surede bitirebilirim?", "Defo orani nasil?", "Siradaki is ne?"].map((q) => (
                                  <button key={q} onClick={() => { setAiInput(q); }} className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                                    {q}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {aiMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                msg.role === "user"
                                  ? "bg-blue-500 text-white rounded-br-sm"
                                  : "bg-surface-highlight text-text-primary rounded-bl-sm border border-border"
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {aiChatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-surface-highlight rounded-2xl rounded-bl-sm px-4 py-2 border border-border">
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0s" }} />
                                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0.15s" }} />
                                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0.3s" }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={aiChatEndRef} />
                        </div>
                        {/* Chat Input */}
                        <div className="p-3 border-t border-border">
                          <div className="flex gap-2">
                            <Input
                              value={aiInput}
                              onChange={(e) => setAiInput(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && sendAIMessage()}
                              placeholder="Sorunuzu yazin..."
                              className="bg-background border-border text-text-primary text-sm"
                              data-testid="ai-chat-input"
                            />
                            <Button size="sm" onClick={sendAIMessage} disabled={!aiInput.trim() || aiChatLoading} className="bg-blue-500 hover:bg-blue-600 text-white px-3" data-testid="ai-chat-send">
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

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

        {/* QR Scanner Dialog */}
        <Dialog open={isQrScannerOpen} onOpenChange={(open) => { if (!open) closeQrScanner(); }}>
          <DialogContent className="bg-surface border-border max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-text-primary flex items-center gap-2">
                <QrCode className="h-5 w-5 text-purple-500" /> QR Kod Tara
              </DialogTitle>
            </DialogHeader>
            <div id="qr-reader-element" className="w-full" data-testid="qr-reader" />
            <p className="text-xs text-text-secondary text-center">Kamerayı iş kartındaki QR koda tutun</p>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default OperatorFlow;
