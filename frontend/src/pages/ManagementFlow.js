import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Power, PowerOff, Wrench, Download, Sun, Moon, Edit, Trash2, Play, Droplet, MessageSquare, Send, AlertTriangle, Inbox, Check, Users, Monitor, Smartphone, Tablet, UserPlus, MapPin, Truck, XCircle, Clock, CheckCircle, Pause, LogOut, Bell, FileText, Sparkles, Bot, ChevronUp, X, Link2, Factory, Package, Activity, Layers, ClipboardCheck, TrendingUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { requestNotificationPermission, onMessageListener } from "../firebase";
import { initializePushNotifications, isNativePlatform } from "../pushNotifications";

// Boya renk haritası
const PAINT_COLORS = {
  "Siyah": "#1a1a1a", "Beyaz": "#f5f5f5", "Mavi": "#2196F3", "Lacivert": "#1a237e",
  "Refleks": "#00e5ff", "Kırmızı": "#f44336", "Magenta": "#e91e63", "Rhodam": "#9c27b0",
  "Sarı": "#ffeb3b", "Gold": "#ffc107", "Gümüş": "#9e9e9e", "Pasta": "#bcaaa4"
};
const LOW_STOCK_THRESHOLD = 5;

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

const ManagementFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [managerId, setManagerId] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // 1 günlük oturum kontrolü
  useEffect(() => {
    const savedSession = localStorage.getItem("management_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        const now = new Date().getTime();
        // 24 saat = 86400000 ms
        if (session.expiry > now) {
          setAuthenticated(true);
          setManagerId(session.managerId);
          if (session.token) {
            localStorage.setItem("auth_token", session.token);
          }
        } else {
          localStorage.removeItem("management_session");
        }
      } catch (e) {
        localStorage.removeItem("management_session");
      }
    }
  }, []);
  const [currentShift, setCurrentShift] = useState(null);
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState(null);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState(null);
  const [dailyAnalytics, setDailyAnalytics] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [paints, setPaints] = useState([]);
  const [lowStockPaints, setLowStockPaints] = useState([]);
  const [incomingMessages, setIncomingMessages] = useState([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [visitors, setVisitors] = useState([]);
  const [visitorStats, setVisitorStats] = useState(null);
  
  // Kullanıcı yönetimi state'leri
  const [users, setUsers] = useState([]);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({ username: "", password: "", roles: [], display_name: "", phone: "" });
  const [editingUserRoles, setEditingUserRoles] = useState(null); // { userId, username, roles: [] }
  const [driverLocations, setDriverLocations] = useState([]);
  
  // Dialog states
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [selectedMachineForMaintenance, setSelectedMachineForMaintenance] = useState(null);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [selectedMachineDetail, setSelectedMachineDetail] = useState(null);
  const [isMachineDetailOpen, setIsMachineDetailOpen] = useState(false);
  const [isEditJobOpen, setIsEditJobOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [selectedMachineForMessage, setSelectedMachineForMessage] = useState(null);
  const [messageText, setMessageText] = useState("");
  
  // Analytics states
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dailyWeekOffset, setDailyWeekOffset] = useState(0);
  
  // Vardiya Sonu & Defo state'leri
  const [isShiftEndDialogOpen, setIsShiftEndDialogOpen] = useState(false);
  const [isShiftEndChoiceDialogOpen, setIsShiftEndChoiceDialogOpen] = useState(false);
  const [shiftEndReports, setShiftEndReports] = useState([]);
  
  // Operatör seçimi ile iş başlatma
  const [isStartJobDialogOpen, setIsStartJobDialogOpen] = useState(false);
  const [startJobTarget, setStartJobTarget] = useState(null);
  const [operatorsList, setOperatorsList] = useState([]);
  const [selectedOperatorName, setSelectedOperatorName] = useState("");
  const [customOperatorName, setCustomOperatorName] = useState("");
  const [defectWeeklyAnalytics, setDefectWeeklyAnalytics] = useState(null);
  const [defectMonthlyAnalytics, setDefectMonthlyAnalytics] = useState(null);
  const [defectDailyAnalytics, setDefectDailyAnalytics] = useState(null);
  const [defectWeekOffset, setDefectWeekOffset] = useState(0);
  const [defectYear, setDefectYear] = useState(new Date().getFullYear());
  const [defectMonth, setDefectMonth] = useState(new Date().getMonth() + 1);
  
  // Onay Bekleyen Raporlar
  const [pendingReports, setPendingReports] = useState([]);
  const [shiftStatus, setShiftStatus] = useState(null);
  
  // Audit Loglar
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditLogPage, setAuditLogPage] = useState(0);

  // Tab kontrolü (metrik kartından tıklayınca açılacak tab)
  const [activeTab, setActiveTab] = useState("machines");
  
  // İş Durdurma
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [jobToPause, setJobToPause] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseProducedKoli, setPauseProducedKoli] = useState("");

  // Günlük Detay Drill-Down
  const [isDailyDetailOpen, setIsDailyDetailOpen] = useState(false);
  const [dailyDetailData, setDailyDetailData] = useState(null);
  const [dailyDetailLoading, setDailyDetailLoading] = useState(false);

  // AI Yönetim Asistanı
  const [isMgmtAIOpen, setIsMgmtAIOpen] = useState(false);
  const [mgmtAITab, setMgmtAITab] = useState("overview");
  const [mgmtAIOverview, setMgmtAIOverview] = useState(null);
  const [mgmtAILoading, setMgmtAILoading] = useState(false);
  const [mgmtAIMessages, setMgmtAIMessages] = useState([]);
  const [mgmtAIInput, setMgmtAIInput] = useState("");
  const [mgmtAIChatLoading, setMgmtAIChatLoading] = useState(false);
  const [mgmtAISessionId] = useState(() => `mgmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const mgmtAIChatEndRef = useRef(null);

  const [editFormData, setEditFormData] = useState({
    name: "", koli_count: "", colors: "", operator_name: "", notes: ""
  });

  const fetchData = async (retryCount = 0) => {
    try {
      const [shiftRes, machinesRes, jobsRes, shiftStatusRes] = await Promise.all([
        axios.get(`${API}/shifts/current`, { timeout: 12000 }),
        axios.get(`${API}/machines`, { timeout: 12000 }),
        axios.get(`${API}/jobs`, { timeout: 12000 }),
        axios.get(`${API}/shifts/status`, { timeout: 12000 })
      ]);
      
      setCurrentShift(shiftRes.data);
      // Array kontrolü — corrupt response durumlarında .map crash'ini önle
      if (Array.isArray(machinesRes.data)) {
        const uniqueMachines = machinesRes.data.reduce((acc, machine) => {
          if (!acc.find(m => m.id === machine.id)) acc.push(machine);
          return acc;
        }, []);
        setMachines(uniqueMachines);
      }
      if (Array.isArray(jobsRes.data)) {
        setJobs(jobsRes.data);
      }
      setShiftStatus(shiftStatusRes.data);
    } catch (error) {
      console.error("Primary fetch error:", error);
      if (retryCount < 2) {
        // Exponential backoff: 3s, 6s
        setTimeout(() => fetchData(retryCount + 1), 3000 * (retryCount + 1));
      } else {
        // Sessiz başarısızlık — kullanıcı toast yerine sonraki polling ile dener
        // Agresif toast, kullanıcıyı rahatsız eder; sadece ilk yüklemede göster
        if (jobs.length === 0 && machines.length === 0) {
          toast.error("Sunucu yavaş yanıt veriyor. Tekrar deneniyor...", { duration: 3000 });
        }
      }
    }
  };
  
  const fetchSecondaryData = async () => {
    try {
      // Batch helper: urls listesi için Promise.allSettled, her biri 15s timeout
      const fetchBatch = (urls) =>
        Promise.allSettled(urls.map((url) => axios.get(url, { timeout: 15000 })));

      // Batch 1 — En kritik veriler (hızlı, mobilde bile çabuk döner)
      const b1 = await fetchBatch([
        `${API}/shifts/pending-reports`,
        `${API}/paints/low-stock`,
        `${API}/messages/all/unread-count`,
      ]);
      if (b1[0].status === "fulfilled") setPendingReports(b1[0].value.data);
      if (b1[1].status === "fulfilled") setLowStockPaints(b1[1].value.data.low_stock_paints || []);
      if (b1[2].status === "fulfilled") setUnreadMessagesCount(b1[2].value.data.unread_count);

      // Batch 2 — Analitik (orta ağırlık)
      const b2 = await fetchBatch([
        `${API}/analytics/weekly`,
        `${API}/analytics/monthly?year=${selectedYear}&month=${selectedMonth}`,
        `${API}/analytics/daily-by-week?week_offset=${dailyWeekOffset}`,
      ]);
      if (b2[0].status === "fulfilled") setWeeklyAnalytics(b2[0].value.data);
      if (b2[1].status === "fulfilled") setMonthlyAnalytics(b2[1].value.data);
      if (b2[2].status === "fulfilled") setDailyAnalytics(b2[2].value.data);

      // Batch 3 — Kaynaklar
      const b3 = await fetchBatch([
        `${API}/maintenance-logs`,
        `${API}/paints`,
        `${API}/users`,
      ]);
      if (b3[0].status === "fulfilled") setMaintenanceLogs(b3[0].value.data);
      if (b3[1].status === "fulfilled") setPaints(b3[1].value.data);
      if (b3[2].status === "fulfilled") setUsers(b3[2].value.data);

      // Batch 4 — Defo analitikleri
      const b4 = await fetchBatch([
        `${API}/defects/analytics/weekly`,
        `${API}/defects/analytics/monthly?year=${defectYear}&month=${defectMonth}`,
        `${API}/defects/analytics/daily-by-week?week_offset=${defectWeekOffset}`,
      ]);
      if (b4[0].status === "fulfilled") setDefectWeeklyAnalytics(b4[0].value.data);
      if (b4[1].status === "fulfilled") setDefectMonthlyAnalytics(b4[1].value.data);
      if (b4[2].status === "fulfilled") setDefectDailyAnalytics(b4[2].value.data);

      // Batch 5 — Daha az kritik ikincil veriler (geç yüklenebilir)
      const b5 = await fetchBatch([
        `${API}/messages/all/incoming`,
        `${API}/visitors?limit=50`,
        `${API}/visitors/stats`,
        `${API}/users/drivers/locations`,
        `${API}/audit-logs?limit=100&skip=${auditLogPage * 100}`,
      ]);
      if (b5[0].status === "fulfilled") setIncomingMessages(b5[0].value.data);
      if (b5[1].status === "fulfilled") setVisitors(b5[1].value.data);
      if (b5[2].status === "fulfilled") setVisitorStats(b5[2].value.data);
      if (b5[3].status === "fulfilled") setDriverLocations(b5[3].value.data);
      if (b5[4].status === "fulfilled") {
        setAuditLogs(b5[4].value.data.logs || []);
        setAuditLogTotal(b5[4].value.data.total || 0);
      }
    } catch (error) {
      console.error("Secondary data fetch error:", error);
    }
  };

  const wsRetryCountRef = useRef(0);

  // WebSocket bağlantısı - Yönetici bildirimleri için
  const connectWebSocket = useCallback((mgrId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/manager/${mgrId}`);
    
    ws.onopen = () => {
      console.log("Manager WebSocket connected");
      wsRetryCountRef.current = 0; // reset retry counter
      // Ping gönder (bağlantıyı canlı tut)
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send("ping");
        }
      }, 30000);
      ws.pingInterval = pingInterval;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "job_completed") {
          // Bildirim göster
          toast.success(data.message, {
            duration: 10000,
            icon: "✅",
            style: { whiteSpace: "pre-line" }
          });
          
          // Tarayıcı bildirimi (izin varsa)
          if (Notification.permission === "granted") {
            new Notification("İş Tamamlandı!", {
              body: `${data.job_name} - ${data.machine_name}\nKoli: ${data.completed_koli}`,
              icon: "/logo192.png"
            });
          }
          
          // Verileri yenile
          fetchData();
        }
      } catch (e) {
        // JSON değilse (pong gibi) yoksay
      }
    };
    
    ws.onclose = () => {
      console.log("Manager WebSocket disconnected");
      if (ws.pingInterval) clearInterval(ws.pingInterval);
      // Exponential backoff ile yeniden bağlan (3s, 6s, 12s, 24s, max 60s)
      // 5 başarısız denemeden sonra pes et — veriler zaten polling ile geliyor
      if (authenticated && managerId && wsRetryCountRef.current < 5) {
        const delay = Math.min(3000 * Math.pow(2, wsRetryCountRef.current), 60000);
        wsRetryCountRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => connectWebSocket(mgrId), delay);
      } else if (wsRetryCountRef.current >= 5) {
        console.warn("WebSocket: 5 deneme başarısız — polling moduna geçildi");
      }
    };
    
    ws.onerror = (error) => {
      console.error("Manager WebSocket error:", error);
    };
    
    wsRef.current = ws;
  }, [authenticated, managerId]);

  // FCM Token kaydı ve bildirim izni
  useEffect(() => {
    const setupFCM = async () => {
      if (authenticated) {
        try {
          if (isNativePlatform()) {
            // Android için Capacitor Push Notifications
            await initializePushNotifications(managerId, "manager");
            console.log("Native push notifications initialized for manager");
          } else {
            // Web için Firebase Web SDK
            const token = await requestNotificationPermission();
            if (token) {
              await axios.post(`${API}/notifications/register-token`, {
                token: token,
                user_type: "manager",
                user_id: managerId,
                platform: "web"
              });
              console.log("FCM token registered");
            }
          }
        } catch (error) {
          console.error("FCM setup error:", error);
        }
      }
    };
    
    setupFCM();
  }, [authenticated, managerId]);

  // Foreground mesajları dinle
  useEffect(() => {
    if (authenticated) {
      const unsubscribe = onMessageListener().then((payload) => {
        if (payload) {
          toast.success(payload.notification?.body || "Yeni bildirim", {
            duration: 10000,
            icon: "🔔"
          });
          fetchData();
        }
      });
      
      return () => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [authenticated]);

  // WebSocket bağlantısını yönet
  useEffect(() => {
    if (authenticated && managerId) {
      connectWebSocket(managerId);
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [authenticated, managerId, connectWebSocket]);

  useEffect(() => {
    if (authenticated) {
      fetchData();
      fetchSecondaryData(); // İlk yüklemede ikincil verileri de al
      const primaryInterval = setInterval(fetchData, 30000); // 30 saniyede bir kritik veriler
      const secondaryInterval = setInterval(fetchSecondaryData, 120000); // 2 dakikada bir ikincil veriler
      return () => {
        clearInterval(primaryInterval);
        clearInterval(secondaryInterval);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, selectedYear, selectedMonth, weekOffset, dailyWeekOffset, defectYear, defectMonth, defectWeekOffset, auditLogPage]);

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${API}/management/login`, { password });
      const data = response.data;
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      const newManagerId = `manager_${Date.now()}`;
      setAuthenticated(true);
      setManagerId(newManagerId);
      
      const session = {
        expiry: new Date().getTime() + 24 * 60 * 60 * 1000,
        managerId: newManagerId,
        token: data.token
      };
      localStorage.setItem("management_session", JSON.stringify(session));
      registerManager(newManagerId);
      toast.success("Giriş başarılı!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Yanlış şifre!");
    }
  };
  
  const registerManager = async (mgrId) => {
    try {
      await axios.post(`${API}/managers/register`, { manager_id: mgrId });
    } catch (error) {
      console.error("Manager register error:", error);
    }
  };

  // Logout fonksiyonu
  const handleLogout = () => {
    localStorage.removeItem("management_session");
    setAuthenticated(false);
    setManagerId(null);
    toast.success("Çıkış yapıldı");
  };

  // Kullanıcı yönetimi fonksiyonları
  const handleCreateUser = async () => {
    if (!newUserData.username || !newUserData.password || newUserData.roles.length === 0) {
      toast.error("Kullanıcı adı, şifre ve en az bir rol zorunludur");
      return;
    }
    try {
      await axios.post(`${API}/users`, newUserData);
      toast.success("Kullanıcı oluşturuldu!");
      setIsUserDialogOpen(false);
      setNewUserData({ username: "", password: "", roles: [], display_name: "", phone: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kullanıcı oluşturulamadı");
    }
  };

  const toggleUserRole = (role) => {
    setNewUserData(prev => {
      const has = prev.roles.includes(role);
      return { ...prev, roles: has ? prev.roles.filter(r => r !== role) : [...prev.roles, role] };
    });
  };

  const handleUpdateUserRoles = async (userId, username, newRoles) => {
    if (!newRoles || newRoles.length === 0) {
      toast.error("En az bir rol seçilmelidir");
      return;
    }
    try {
      await axios.patch(`${API}/users/${userId}/roles`, { roles: newRoles });
      toast.success(`${username} rolleri güncellendi`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Roller güncellenemedi");
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) return;
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success("Kullanıcı silindi");
      fetchData();
    } catch (error) {
      toast.error("Kullanıcı silinemedi");
    }
  };

  const getRoleLabel = (role) => {
    const labels = { operator: "Operatör", plan: "Planlama", depo: "Depo", sofor: "Şoför" };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = { operator: "bg-blue-500/20 text-blue-400", plan: "bg-green-500/20 text-green-400", depo: "bg-yellow-500/20 text-yellow-400", sofor: "bg-purple-500/20 text-purple-400" };
    return colors[role] || "bg-gray-500/20 text-gray-400";
  };

  const handleStartShift = async () => {
    try {
      const res = await axios.post(`${API}/shifts/start`);
      const resumed = res.data?.resumed_jobs || 0;
      toast.success(resumed > 0 ? `Vardiya başlatıldı! ${resumed} iş otomatik devam etti.` : "Vardiya başlatıldı!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Vardiya başlatılamadı");
    }
  };

  const openShiftEndDialog = () => {
    // Aktif işleri olan makineler için rapor formu oluştur
    const activeJobs = jobs.filter(j => j.status === "in_progress");
    const reports = machines.map(machine => {
      const activeJob = activeJobs.find(j => j.machine_id === machine.id);
      // remaining_koli varsa hedef olarak onu kullan (devam eden iş)
      const effectiveTarget = activeJob?.remaining_koli > 0 ? activeJob.remaining_koli : (activeJob?.koli_count || 0);
      return {
        machine_id: machine.id,
        machine_name: machine.name,
        job_id: activeJob?.id || null,
        job_name: activeJob?.name || null,
        target_koli: effectiveTarget,
        original_koli: activeJob?.koli_count || 0,
        produced_koli: 0,
        defect_kg: 0
      };
    });
    setShiftEndReports(reports);
    setIsShiftEndDialogOpen(true);
  };

  const handleShiftEndReportChange = (machineId, field, value) => {
    setShiftEndReports(prev => prev.map(r => 
      r.machine_id === machineId ? { ...r, [field]: parseFloat(value) || 0 } : r
    ));
  };

  const handleEndShiftWithReport = async () => {
    try {
      // Sadece veri girilen raporları gönder
      const reportsToSend = shiftEndReports.filter(r => r.produced_koli > 0 || r.defect_kg > 0);
      
      if (reportsToSend.length > 0) {
        await axios.post(`${API}/shifts/end-with-report`, { reports: reportsToSend });
      } else {
        await axios.post(`${API}/shifts/end`);
      }
      
      toast.success("Vardiya bitirildi!");
      setIsShiftEndDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Vardiya bitirilemedi");
    }
  };

  // YENİ: Operatörlere bildirim gönder
  const handleRequestShiftEnd = async () => {
    const activeJobs = jobs.filter(j => j.status === "in_progress");
    if (activeJobs.length === 0) {
      // Aktif iş yok, direkt bitir
      try {
        await axios.post(`${API}/shifts/end`);
        toast.success("Vardiya bitirildi!");
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Vardiya bitirilemedi");
      }
      return;
    }

    try {
      const response = await axios.post(`${API}/shifts/request-end`);
      toast.success(`${response.data.notifications_sent} operatöre bildirim gönderildi!`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Bildirim gönderilemedi");
    }
  };

  // Rapor onaylama
  const handleApproveReport = async (reportId) => {
    try {
      await axios.post(`${API}/shifts/approve-report/${reportId}`);
      toast.success("Rapor onaylandı!");
      fetchData();
    } catch (error) {
      toast.error("Rapor onaylanamadı");
    }
  };

  // Tümünü onayla ve vardiyayı bitir
  const handleApproveAllAndEndShift = async () => {
    try {
      await axios.post(`${API}/shifts/approve-all`);
      toast.success("Tüm raporlar onaylandı ve vardiya bitirildi!");
      fetchData();
    } catch (error) {
      toast.error("İşlem başarısız");
    }
  };

  const handleEndShift = async () => {
    // Aktif iş var mı kontrol et
    const activeJobs = jobs.filter(j => j.status === "in_progress");
    if (activeJobs.length > 0) {
      // Seçenek dialog'unu aç: Operatörlere bildir veya kendim doldur
      // Önce rapor formunu hazırla - tüm makineleri göster, aktif işi olanları işaretle
      const reports = machines.map(m => {
        const activeJob = activeJobs.find(j => j.machine_id === m.id);
        const effectiveTarget = activeJob?.remaining_koli > 0 ? activeJob.remaining_koli : (activeJob?.koli_count || 0);
        return {
          machine_id: m.id,
          machine_name: m.name,
          job_id: activeJob?.id || null,
          job_name: activeJob?.name || null,
          target_koli: effectiveTarget,
          original_koli: activeJob?.koli_count || 0,
          produced_koli: "",
          defect_kg: ""
        };
      });
      setShiftEndReports(reports);
      setIsShiftEndChoiceDialogOpen(true);
    } else {
      try {
        await axios.post(`${API}/shifts/end`);
        toast.success("Vardiya bitirildi!");
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Vardiya bitirilemedi");
      }
    }
  };
  
  // Seçenek: Operatörlere bildir
  const handleChoiceNotifyOperators = async () => {
    setIsShiftEndChoiceDialogOpen(false);
    try {
      await axios.post(`${API}/shifts/notify-end`);
      toast.success("Operatörlere bildirim gönderildi! Raporlarını doldurmalarını bekleyin.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Bildirim gönderilemedi");
    }
  };
  
  // Seçenek: Kendim doldurayım
  const handleChoiceFillMyself = () => {
    setIsShiftEndChoiceDialogOpen(false);
    setIsShiftEndDialogOpen(true);
  };

  // İş Durdurma
  const openPauseDialog = (job) => {
    setJobToPause(job);
    setPauseReason("");
    setPauseProducedKoli("");
    setIsPauseDialogOpen(true);
  };

  const handlePauseJob = async () => {
    if (!jobToPause || !pauseReason) {
      toast.error("Durdurma sebebi gerekli");
      return;
    }
    try {
      await axios.put(`${API}/jobs/${jobToPause.id}/pause`, {
        pause_reason: pauseReason,
        produced_koli: parseInt(pauseProducedKoli) || 0
      });
      toast.success("İş durduruldu!");
      setIsPauseDialogOpen(false);
      setJobToPause(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "İş durdurulamadı");
    }
  };

  const handleResumeJob = async (job) => {
    try {
      await axios.put(`${API}/jobs/${job.id}/resume`, {
        operator_name: job.operator_name
      });
      toast.success("İşe devam edildi!");
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "İşe devam edilemedi");
    }
  };

  const handleToggleMaintenance = async (machine, maintenance) => {
    if (maintenance && !maintenanceReason.trim()) {
      toast.error("Lütfen bakım sebebi girin");
      return;
    }
    try {
      await axios.put(`${API}/machines/${machine.id}/maintenance`, {
        maintenance,
        reason: maintenance ? maintenanceReason : ""
      });
      toast.success(maintenance ? "Makine bakıma alındı" : "Bakım tamamlandı");
      setIsMaintenanceDialogOpen(false);
      setMaintenanceReason("");
      fetchData();
    } catch (error) {
      toast.error("Bakım durumu güncellenemedi");
    }
  };

  const openMaintenanceDialog = (machine) => {
    setSelectedMachineForMaintenance(machine);
    setIsMaintenanceDialogOpen(true);
  };

  const openMachineDetail = (machine) => {
    setSelectedMachineDetail(machine);
    setIsMachineDetailOpen(true);
  };

  const openEditJob = (job) => {
    setJobToEdit(job);
    setEditFormData({
      name: job.name,
      koli_count: job.koli_count.toString(),
      colors: job.colors,
      operator_name: job.operator_name || "",
      notes: job.notes || ""
    });
    setIsEditJobOpen(true);
  };

  const handleUpdateJob = async () => {
    try {
      await axios.put(`${API}/jobs/${jobToEdit.id}`, {
        name: editFormData.name,
        koli_count: parseInt(editFormData.koli_count),
        colors: editFormData.colors,
        operator_name: editFormData.operator_name,
        notes: editFormData.notes,
        updated_by: "Yonetim"
      });
      toast.success("İş güncellendi!");
      setIsEditJobOpen(false);
      fetchData();
    } catch (error) {
      toast.error("İş güncellenemedi");
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Bu işi silmek istediğinizden emin misiniz?")) return;
    try {
      await axios.delete(`${API}/jobs/${jobId}?deleted_by=Yonetim`);
      toast.success("İş silindi!");
      fetchData();
    } catch (error) {
      toast.error("İş silinemedi");
    }
  };

  const handleStartJobFromManagement = async (job) => {
    // Operatör listesini çek ve dialog aç
    try {
      const res = await axios.get(`${API}/operators/list`);
      setOperatorsList(res.data || []);
    } catch {
      setOperatorsList([]);
    }
    setStartJobTarget(job);
    setSelectedOperatorName("");
    setCustomOperatorName("");
    setIsStartJobDialogOpen(true);
  };

  const confirmStartJob = async () => {
    const operatorName = customOperatorName.trim() || selectedOperatorName;
    if (!operatorName) {
      toast.error("Lütfen operatör seçin veya isim girin");
      return;
    }
    const job = startJobTarget;
    setIsStartJobDialogOpen(false);
    
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "in_progress", operator_name: operatorName, started_at: new Date().toISOString() } : j));
    setMachines(prev => prev.map(m => m.id === job.machine_id ? { ...m, status: "working", current_job_id: job.id } : m));
    try {
      await axios.put(`${API}/jobs/${job.id}/start`, { operator_name: operatorName });
      toast.success(`İş başlatıldı! Operatör: ${operatorName}`);
    } catch (error) {
      toast.error("İş başlatılamadı");
      fetchData();
    }
  };

  const handleCompleteJob = async (job) => {
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "completed", completed_at: new Date().toISOString() } : j));
    setMachines(prev => prev.map(m => m.id === job.machine_id ? { ...m, status: "idle", current_job_id: null } : m));
    try {
      await axios.put(`${API}/jobs/${job.id}/complete`, {});
      toast.success("İş tamamlandı!");
    } catch (error) {
      toast.error("İş tamamlanamadı");
      fetchData();
    }
  };

  const handleExportReport = async (period) => {
    try {
      let url_params = `period=${period}`;
      if (period === "weekly") {
        url_params += `&week_offset=${dailyWeekOffset}`;
      }
      const response = await axios.get(`${API}/analytics/export?${url_params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `buse_kagit_rapor_${period}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Rapor indirildi!");
    } catch (error) {
      toast.error("Rapor indirilemedi");
    }
  };

  const openMessageDialog = (machine) => {
    setSelectedMachineForMessage(machine);
    setMessageText("");
    setIsMessageDialogOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error("Mesaj boş olamaz");
      return;
    }
    try {
      await axios.post(`${API}/messages`, {
        machine_id: selectedMachineForMessage.id,
        machine_name: selectedMachineForMessage.name,
        sender_role: "yonetim",
        sender_name: "Yönetim",
        message: messageText
      });
      toast.success("Mesaj gönderildi!");
      setIsMessageDialogOpen(false);
      setMessageText("");
    } catch (error) {
      toast.error("Mesaj gönderilemedi");
    }
  };

  const handleMarkMessageRead = async (messageId) => {
    try {
      await axios.put(`${API}/messages/mark-read/${messageId}`);
      fetchData();
    } catch (error) {
      console.error("Mark read error:", error);
    }
  };

  const prepareChartData = (data, label) => {
    if (!data) return [];
    return Object.entries(data).map(([name, value]) => ({ name, [label]: value }));
  };

  // Günlük Detay Drill-Down
  const handleDailyBarClick = async (data) => {
    if (!data?.full_date) return;
    setDailyDetailLoading(true);
    setIsDailyDetailOpen(true);
    try {
      const res = await axios.get(`${API}/analytics/daily-detail?date=${data.full_date}`);
      setDailyDetailData(res.data);
    } catch {
      toast.error("Günlük detay alınamadı");
      setIsDailyDetailOpen(false);
    } finally {
      setDailyDetailLoading(false);
    }
  };

  const DRILL_COLORS = ["#FFBF00", "#60A5FA", "#34D399", "#F97316", "#A78BFA", "#FB7185", "#38BDF8", "#FBBF24"];

  // AI Yönetim fonksiyonları
  const fetchMgmtAIOverview = async () => {
    setMgmtAILoading(true);
    try {
      const res = await axios.get(`${API}/ai/management-overview`);
      setMgmtAIOverview(res.data);
    } catch {
      toast.error("AI analizi alınamadı");
    } finally {
      setMgmtAILoading(false);
    }
  };

  const sendMgmtAIMessage = async () => {
    if (!mgmtAIInput.trim() || mgmtAIChatLoading) return;
    const userMsg = mgmtAIInput.trim();
    setMgmtAIInput("");
    setMgmtAIMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setMgmtAIChatLoading(true);
    try {
      const res = await axios.post(`${API}/ai/management-chat`, { message: userMsg, session_id: mgmtAISessionId });
      setMgmtAIMessages(prev => [...prev, { role: "assistant", content: res.data.response }]);
    } catch {
      setMgmtAIMessages(prev => [...prev, { role: "assistant", content: "Bir hata olustu, tekrar deneyin." }]);
    } finally {
      setMgmtAIChatLoading(false);
    }
  };

  useEffect(() => {
    mgmtAIChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mgmtAIMessages]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-heading text-center">YÖNETİM GİRİŞİ</CardTitle>
            </CardHeader>
            <CardContent>
              <Input data-testid="management-password-input" type="password" placeholder="Şifre..." value={password}
                onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="mb-4 bg-background border-border text-text-primary text-lg h-14" />
              <Button data-testid="management-login-button" onClick={handleLogin} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg font-heading">
                Giriş Yap
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full mt-4 border-border bg-background hover:bg-surface-highlight">
                <ArrowLeft className="mr-2 h-4 w-4" /> Ana Sayfa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const machineJobs = selectedMachineDetail ? {
    current: jobs.find(j => j.machine_id === selectedMachineDetail.id && j.status === "in_progress"),
    pending: jobs.filter(j => j.machine_id === selectedMachineDetail.id && j.status === "pending"),
    completed: jobs.filter(j => j.machine_id === selectedMachineDetail.id && j.status === "completed")
  } : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Industrial Header */}
      <div className="header-industrial sticky top-0 z-40 px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface/60 hover:bg-surface-highlight h-9">
              <ArrowLeft className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Ana Sayfa</span>
            </Button>
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-black font-black text-sm shadow-gold-glow">B</div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary leading-none">Buse Kağıt</p>
                <h1 className="text-base font-heading font-bold text-text-primary leading-tight">Yönetim Paneli</h1>
              </div>
            </div>
            {currentShift && (
              <div className="hidden md:flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md bg-success/10 border border-success/30">
                <span className="live-dot" />
                <span className="text-xs font-mono font-semibold text-success uppercase tracking-wider">Vardiya Aktif</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentShift ? (
              <Button data-testid="end-shift-button" onClick={handleEndShift} size="sm" className="bg-error/90 text-white hover:bg-error h-9">
                <PowerOff className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Vardiya Bitir</span>
              </Button>
            ) : (
              <Button data-testid="start-shift-button" onClick={handleStartShift} size="sm" className="bg-success text-white hover:bg-success/90 h-9">
                <Power className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Vardiya Başlat</span>
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface/60 hover:bg-surface-highlight h-9 w-9">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button" className="border-error/40 text-error hover:bg-error/10 h-9">
              <LogOut className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Çıkış</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Düşük Stok Uyarısı */}
        {lowStockPaints.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
              <AlertTriangle className="h-5 w-5" /> DÜŞÜK BOYA STOKU ({LOW_STOCK_THRESHOLD}L altı)
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockPaints.map(paint => (
                <span key={paint.id} className="px-3 py-1 bg-red-500/20 rounded-full text-sm text-red-200 border border-red-500/30">
                  {paint.name}: {paint.stock_kg.toFixed(1)} L
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Operasyon Metrik Kartları */}
        <div className="mb-6">
          <div className="section-label">
            <span>Operasyon Özeti</span>
            <span className="text-text-muted font-mono text-[10px] ml-auto">Canlı</span>
          </div>
          {(() => {
            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
            const activeJobsCount = jobs.filter(j => j.status === "in_progress").length;
            const pendingJobsCount = jobs.filter(j => j.status === "pending").length;
            const completedToday = jobs.filter(j => j.status === "completed" && j.completed_at && new Date(j.completed_at) >= todayStart);
            const koliToday = completedToday.reduce((s, j) => s + (j.completed_koli || j.koli_count || 0), 0);
            const workingMachines = machines.filter(m => m.status === "working").length;
            const maintenanceMachines = machines.filter(m => m.maintenance).length;
            const pendingApprovals = pendingReports.length;
            const activeOperators = new Set(jobs.filter(j => j.status === "in_progress").map(j => j.operator_name).filter(Boolean)).size;

            // Dünün üretim trendi (Bugünkü Üretim için)
            let trend = null;
            if (dailyAnalytics?.daily_stats?.length === 7 && dailyWeekOffset === 0) {
              // Bugünün haftalık indexi: 0=Pzt ... 6=Paz
              const jsDay = new Date().getDay(); // 0=Paz ... 6=Cmt
              const todayIdx = jsDay === 0 ? 6 : jsDay - 1;
              const yesterdayIdx = todayIdx - 1;
              if (yesterdayIdx >= 0) {
                const yesterdayKoli = dailyAnalytics.daily_stats[yesterdayIdx]?.total_koli || 0;
                if (yesterdayKoli > 0 || koliToday > 0) {
                  const delta = yesterdayKoli === 0 ? 100 : Math.round(((koliToday - yesterdayKoli) / yesterdayKoli) * 100);
                  trend = { delta, yesterdayKoli };
                }
              }
            }

            const metrics = [
              {
                label: "Bugünkü Üretim",
                value: koliToday,
                unit: "koli",
                sub: `${completedToday.length} iş tamamlandı`,
                icon: TrendingUp,
                accent: "#FFBF00",
                testid: "metric-today-production",
                tab: "analytics",
                trend
              },
              {
                label: "Aktif İş",
                value: activeJobsCount,
                unit: "",
                sub: `${activeOperators} operatör çalışıyor`,
                icon: Activity,
                accent: "#10B981",
                testid: "metric-active-jobs",
                tab: "machines"
              },
              {
                label: "Bekleyen İş",
                value: pendingJobsCount,
                unit: "",
                sub: "Üretim kuyruğunda",
                icon: Package,
                accent: "#3B82F6",
                testid: "metric-pending-jobs",
                tab: "machines"
              },
              {
                label: "Aktif Makine",
                value: workingMachines,
                unit: `/ ${machines.length}`,
                sub: maintenanceMachines > 0 ? `${maintenanceMachines} bakımda` : "Tümü hazır",
                icon: Factory,
                accent: "#A78BFA",
                testid: "metric-active-machines",
                tab: "maintenance"
              },
              {
                label: "Onay Bekleyen",
                value: pendingApprovals,
                unit: "",
                sub: pendingApprovals > 0 ? "İncelemeniz gerekli" : "Her şey yolunda",
                icon: ClipboardCheck,
                accent: pendingApprovals > 0 ? "#F59E0B" : "#71717A",
                testid: "metric-pending-approvals",
                tab: "pending-approval"
              },
              {
                label: "Düşük Stok",
                value: lowStockPaints.length,
                unit: "",
                sub: lowStockPaints.length > 0 ? "Boya sipariş gerekli" : "Stok seviyesi iyi",
                icon: Layers,
                accent: lowStockPaints.length > 0 ? "#EF4444" : "#71717A",
                testid: "metric-low-stock",
                tab: "paints"
              }
            ];

            return (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
                {metrics.map((m, idx) => (
                  <motion.button
                    key={m.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 * idx, ease: "easeOut" }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setActiveTab(m.tab); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="stat-card-industrial text-left cursor-pointer"
                    data-testid={m.testid}
                    style={{ borderLeftColor: m.accent }}
                    aria-label={`${m.label}: ${m.value} ${m.unit}. ${m.sub}. Tıklayarak ${m.tab} sekmesine git.`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-text-secondary leading-tight">
                        {m.label}
                      </span>
                      <m.icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: m.accent, opacity: 0.7 }} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="metric-display text-3xl md:text-4xl num-tabular" style={{ color: m.accent }}>
                        {m.value}
                      </span>
                      {m.unit && <span className="text-xs text-text-secondary font-mono">{m.unit}</span>}
                    </div>
                    {m.trend ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`text-[10px] font-mono font-bold inline-flex items-center gap-0.5 ${
                            m.trend.delta > 0 ? "text-success" : m.trend.delta < 0 ? "text-error" : "text-text-muted"
                          }`}
                          data-testid="metric-trend"
                        >
                          {m.trend.delta > 0 ? "▲" : m.trend.delta < 0 ? "▼" : "·"} {Math.abs(m.trend.delta)}%
                        </span>
                        <span className="text-[10px] text-text-muted truncate">dün ({m.trend.yesterdayKoli})</span>
                      </div>
                    ) : (
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">{m.sub}</p>
                    )}
                  </motion.button>
                ))}
              </div>
            );
          })()}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Mobile: 3-row grid layout, Desktop: horizontal scroll */}
          <div className="block md:hidden">
            <div className="grid grid-cols-3 gap-1">
              <TabsList className="bg-surface border-border col-span-3 grid grid-cols-3 h-auto p-1 gap-1">
                <TabsTrigger value="machines" data-testid="machines-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Makine
                </TabsTrigger>
                <TabsTrigger value="users" data-testid="users-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Kullanıcı
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="analytics-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Analiz
                </TabsTrigger>
                <TabsTrigger value="paints" data-testid="paints-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Boya
                </TabsTrigger>
                <TabsTrigger value="messages" data-testid="messages-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black relative text-xs py-2">
                  Mesaj
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px] badge-bounce">
                      {unreadMessagesCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="visitors" data-testid="visitors-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Ziyaret
                </TabsTrigger>
                <TabsTrigger value="defects" data-testid="defects-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Defo
                </TabsTrigger>
                <TabsTrigger value="maintenance" data-testid="maintenance-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Bakım
                </TabsTrigger>
                <TabsTrigger value="pending-approval" data-testid="pending-approval-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black relative text-xs py-2">
                  Onay
                  {pendingReports.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                      {pendingReports.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="audit-logs" data-testid="audit-logs-tab-mobile" className="data-[state=active]:bg-primary data-[state=active]:text-black text-xs py-2">
                  Loglar
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          {/* Desktop: Horizontal tabs */}
          <div className="hidden md:block overflow-x-auto">
            <TabsList className="bg-surface border-border inline-flex min-w-max">
              <TabsTrigger value="machines" data-testid="machines-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                Makineler
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="users-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                <UserPlus className="h-4 w-4 mr-1" /> Kullanıcılar
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="analytics-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                Analiz
              </TabsTrigger>
              <TabsTrigger value="paints" data-testid="paints-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                <Droplet className="h-4 w-4 mr-1" /> Boyalar
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="messages-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black relative text-sm px-3">
                <Inbox className="h-4 w-4 mr-1" /> Mesajlar
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                    {unreadMessagesCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="visitors" data-testid="visitors-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                <Users className="h-4 w-4 mr-1" /> Ziyaretçiler
              </TabsTrigger>
              <TabsTrigger value="defects" data-testid="defects-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                <XCircle className="h-4 w-4 mr-1" /> Defo
              </TabsTrigger>
              <TabsTrigger value="maintenance" data-testid="maintenance-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                Bakım
              </TabsTrigger>
              <TabsTrigger value="pending-approval" data-testid="pending-approval-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black relative text-sm px-3">
                <Clock className="h-4 w-4 mr-1" /> Onay Bekleyen
                {pendingReports.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                    {pendingReports.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="audit-logs" data-testid="audit-logs-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black text-sm px-3">
                <FileText className="h-4 w-4 mr-1" /> Loglar
              </TabsTrigger>
            </TabsList>
          </div>

          {/* MAKİNELER TAB */}
          <TabsContent value="machines">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {machines.map((machine, index) => {
                const currentJob = jobs.find(j => j.machine_id === machine.id && j.status === "in_progress");
                const upcomingJobs = jobs.filter(j => j.machine_id === machine.id && j.status === "pending");
                return (
                  <Card key={machine.id}
                    className={`bg-surface border-2 cursor-pointer machine-card-hover animate-fade-up stagger-${index + 1} ${
                      machine.maintenance ? "border-warning" : machine.status === "working" ? "border-success machine-working" : "border-border"
                    }`}
                    data-testid={`machine-status-${machine.name}`}
                    onClick={() => openMachineDetail(machine)}
                  >
                    <CardContent className="p-4 md:p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg md:text-xl font-heading font-bold text-text-primary">{machine.name}</h3>
                          <p className={`text-sm font-semibold ${machine.maintenance ? "text-warning" : machine.status === "working" ? "text-success" : "text-text-secondary"}`}>
                            {machine.maintenance ? "BAKIM" : machine.status === "working" ? "ÇALIŞIYOR" : "BOŞTA"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openMessageDialog(machine); }}
                            className="border-blue-500 text-blue-500 hover:bg-blue-500/10" data-testid={`message-${machine.name}`}>
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={(e) => { e.stopPropagation(); machine.maintenance ? handleToggleMaintenance(machine, false) : openMaintenanceDialog(machine); }}
                            data-testid={`maintenance-toggle-${machine.name}`}
                            className={machine.maintenance ? "bg-warning text-black hover:bg-warning/90" : "border-border"}>
                            <Wrench className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {machine.maintenance && (
                        <div className="mb-4 p-3 bg-warning/20 border border-warning rounded-md">
                          <p className="text-sm text-text-primary font-semibold">Bakım Sebebi:</p>
                          <p className="text-sm text-text-secondary">{machine.maintenance_reason}</p>
                        </div>
                      )}
                      {currentJob && (
                        <div className="mb-3 p-3 bg-success/20 border border-success rounded-md">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-text-primary">Aktif İş:</p>
                                {currentJob.format && (
                                  <span className="px-1 py-0.5 bg-secondary/20 text-secondary text-xs font-mono rounded">
                                    {currentJob.format}
                                  </span>
                                )}
                                {currentJob.queued_at && (
                                  <span className={`text-xs font-bold ${getDaysElapsedColor(calculateDaysElapsed(currentJob.queued_at))}`}>
                                    📅 {calculateDaysElapsed(currentJob.queued_at)}g
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-text-secondary">{currentJob.name}</p>
                              <p className="text-xs text-text-secondary">Operatör: {currentJob.operator_name}</p>
                              {currentJob.notes && (
                                <p className="text-xs text-info mt-1">📝 {currentJob.notes}</p>
                              )}
                            </div>
                            {currentJob.image_url && (
                              <img 
                                src={currentJob.image_url} 
                                alt={currentJob.name}
                                className="w-12 h-12 object-cover rounded border border-success cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); window.open(currentJob.image_url, '_blank'); }}
                              />
                            )}
                            <div className="flex flex-col gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`complete-job-${currentJob.id}`}
                                onClick={(e) => { e.stopPropagation(); handleCompleteJob(currentJob); }}
                                className="bg-success text-white hover:bg-success/90 text-xs"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" /> Tamamla
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`edit-job-${currentJob.id}`}
                                onClick={(e) => { e.stopPropagation(); openEditJob(currentJob); }}
                                className="border-blue-500 text-blue-500 hover:bg-blue-500/20 text-xs"
                              >
                                <Edit className="h-3 w-3 mr-1" /> Düzenle
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); openPauseDialog(currentJob); }}
                                className="border-warning text-warning hover:bg-warning/20 text-xs"
                              >
                                <Pause className="h-3 w-3 mr-1" /> Durdur
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Durdurulmuş İşler */}
                      {jobs.filter(j => j.machine_id === machine.id && j.status === "paused").length > 0 && (
                        <div className="mb-3 p-3 bg-warning/20 border border-warning rounded-md">
                          <p className="text-sm font-semibold text-warning mb-2">Durdurulmuş:</p>
                          {jobs.filter(j => j.machine_id === machine.id && j.status === "paused").map(pj => (
                            <div key={pj.id} className="flex justify-between items-center text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-text-secondary">{pj.name}</span>
                                {pj.format && <span className="text-secondary text-xs">({pj.format})</span>}
                                {pj.queued_at && (
                                  <span className={`text-xs ${getDaysElapsedColor(calculateDaysElapsed(pj.queued_at))}`}>
                                    {calculateDaysElapsed(pj.queued_at)}g
                                  </span>
                                )}
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleResumeJob(pj); }}
                                className="text-info hover:bg-info/20 text-xs h-6 px-2"
                                disabled={!!currentJob}
                              >
                                <Play className="h-3 w-3 mr-1" /> Devam
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {upcomingJobs.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-text-primary mb-2">Bekleyen İşler: {upcomingJobs.length}</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {upcomingJobs.slice(0, 5).map(uj => (
                              <div key={uj.id} className="p-2 bg-background/50 rounded border border-border/50">
                                <div className="flex items-center gap-2 text-xs text-text-secondary flex-wrap">
                                  <span className="font-medium text-text-primary">{uj.name}</span>
                                  {uj.format && <span className="text-secondary px-1 bg-secondary/10 rounded">({uj.format})</span>}
                                  <span className="text-text-secondary">📦 {uj.koli_count}</span>
                                  {uj.queued_at && (
                                    <span className={`${getDaysElapsedColor(calculateDaysElapsed(uj.queued_at))}`}>
                                      📅 {calculateDaysElapsed(uj.queued_at)}g
                                    </span>
                                  )}
                                </div>
                                {uj.notes && (
                                  <p className="text-xs text-info mt-1">📝 {uj.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* MESAJLAR TAB */}
          <TabsContent value="messages">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl font-heading flex items-center gap-2">
                  <Inbox className="h-6 w-6 text-blue-500" /> Operatör Mesajları
                  {unreadMessagesCount > 0 && (
                    <span className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                      {unreadMessagesCount} yeni
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incomingMessages.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Henüz operatör mesajı yok.</p>
                ) : (
                  <div className="space-y-3">
                    {incomingMessages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 rounded-lg border ${msg.is_read ? "bg-background border-border" : "bg-blue-500/10 border-blue-500"}`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-heading font-bold text-text-primary">{msg.sender_name}</span>
                              <span className="text-xs px-2 py-0.5 bg-secondary/20 text-secondary rounded-full">{msg.machine_name}</span>
                              {!msg.is_read && (
                                <span className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded-full">Yeni</span>
                              )}
                            </div>
                            <p className="text-text-primary">{msg.message}</p>
                            <p className="text-xs text-text-secondary mt-2">
                              {new Date(msg.created_at).toLocaleString("tr-TR")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {!msg.is_read && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkMessageRead(msg.id)}
                                className="text-green-500 border-green-500 hover:bg-green-500/10"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const machine = machines.find(m => m.id === msg.machine_id);
                                if (machine) openMessageDialog(machine);
                              }}
                              className="text-blue-500 border-blue-500 hover:bg-blue-500/10"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KULLANICILAR TAB */}
          <TabsContent value="users">
            <div className="space-y-6">
              {/* Kullanıcı Ekleme Butonu */}
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-heading">Kullanıcı Yönetimi</h2>
                <Button onClick={() => setIsUserDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-black">
                  <UserPlus className="h-4 w-4 mr-2" /> Yeni Kullanıcı
                </Button>
              </div>

              {/* Kullanıcı Listesi */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Aktif Kullanıcılar ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {users.length === 0 ? (
                    <p className="text-text-secondary text-center py-4">Henüz kullanıcı eklenmemiş</p>
                  ) : (
                    <div className="space-y-3">
                      {users.map(user => {
                        const userRoles = (user.roles && user.roles.length > 0) ? user.roles : (user.role ? [user.role] : []);
                        return (
                        <div key={user.id} className="flex flex-wrap justify-between items-center gap-3 p-3 bg-background rounded-lg border border-border hover:border-primary/30 transition-colors" data-testid={`user-row-${user.username}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getRoleColor(userRoles[0] || user.role)}`}>
                              {userRoles.includes("sofor") ? <Truck className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{user.display_name || user.username}</p>
                              <p className="text-xs text-text-secondary truncate">@{user.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex flex-wrap gap-1">
                              {userRoles.map(r => (
                                <span key={r} className={`px-2 py-0.5 rounded text-[11px] font-semibold ${getRoleColor(r)}`} data-testid={`user-role-badge-${user.username}-${r}`}>
                                  {getRoleLabel(r)}
                                </span>
                              ))}
                              {userRoles.length > 1 && (
                                <span className="badge-gold" title="Çoklu rol" data-testid={`multi-role-indicator-${user.username}`}>
                                  ×{userRoles.length}
                                </span>
                              )}
                            </div>
                            {userRoles.includes("sofor") && user.current_location_lat && (
                              <span className="text-green-500 text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Aktif
                              </span>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2 border-border text-text-secondary hover:text-primary hover:border-primary"
                              onClick={() => setEditingUserRoles({ userId: user.id, username: user.username, roles: [...userRoles] })}
                              data-testid={`edit-user-roles-${user.username}`}
                              title="Rolleri düzenle"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 px-2" onClick={() => handleDeleteUser(user.id, user.username)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );})}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Şoför Konumları */}
              {driverLocations.length > 0 && (
                <Card className="bg-surface border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-green-500" /> Şoför Konumları
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {driverLocations.map(driver => (
                        <div key={driver.id} className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <div>
                            <p className="font-semibold">{driver.display_name || driver.username}</p>
                            <p className="text-xs text-text-secondary">
                              Son güncelleme: {driver.location_updated_at ? new Date(driver.location_updated_at).toLocaleString("tr-TR") : "-"}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(`https://www.google.com/maps?q=${driver.current_location_lat},${driver.current_location_lng}`, "_blank")}
                          >
                            <MapPin className="h-4 w-4 mr-1" /> Haritada Gör
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ANALİZ TAB */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Günlük Analiz - Hafta Seçimli */}
              <Card className="bg-surface border-border">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-4">
                  <CardTitle className="text-xl md:text-2xl font-heading">Günlük Üretim</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleExportReport("weekly")} className="bg-secondary text-white hover:bg-secondary/90" data-testid="weekly-report-btn">
                      <Download className="mr-1 h-4 w-4" /> Haftalik Rapor
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDailyWeekOffset(dailyWeekOffset - 1)}>←</Button>
                    <span className="text-xs md:text-sm font-semibold text-text-primary whitespace-nowrap px-2">
                      {dailyAnalytics?.week_start} - {dailyAnalytics?.week_end}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setDailyWeekOffset(dailyWeekOffset + 1)} disabled={dailyWeekOffset >= 0}>→</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-text-secondary text-xs mb-2">Detay için güne tıklayın</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dailyAnalytics?.daily_stats || []} style={{ cursor: "pointer" }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="day_name" stroke="#A1A1AA" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }}
                        labelStyle={{ color: "#FAFAFA" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-surface border border-border p-3 rounded">
                                <p className="text-text-primary font-semibold">{data.date} ({data.day_name})</p>
                                <p className="text-primary font-bold">Toplam: {data.total_koli} Koli</p>
                                {data.machines && Object.entries(data.machines).map(([machine, koli]) => (
                                  <p key={machine} className="text-text-secondary text-sm">{machine}: {koli}</p>
                                ))}
                                <p className="text-text-secondary text-xs mt-1 italic">Detay için tıklayın</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="total_koli" fill="#FFBF00" name="Toplam Koli" onClick={(data) => handleDailyBarClick(data)} style={{ cursor: "pointer" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Haftalık ve Aylık Analiz */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-surface border-border">
                  <CardHeader className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-2">
                    <CardTitle className="text-lg md:text-xl font-heading">Haftalık</CardTitle>
                    <Button size="sm" onClick={() => handleExportReport("weekly")} className="bg-secondary text-white hover:bg-secondary/90">
                      <Download className="mr-2 h-4 w-4" /> Excel
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={prepareChartData(weeklyAnalytics?.machine_stats, "Koli")}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                        <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} />
                        <Bar dataKey="Koli" fill="#FFBF00" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-surface border-border">
                  <CardHeader className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg md:text-xl font-heading">Aylık</CardTitle>
                      <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                        <SelectTrigger className="w-20 bg-background border-border text-text-primary h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {[2024, 2025, 2026].map(year => (
                            <SelectItem key={year} value={year.toString()} className="text-text-primary">{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                        <SelectTrigger className="w-24 bg-background border-border text-text-primary h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"].map((month, idx) => (
                            <SelectItem key={idx + 1} value={(idx + 1).toString()} className="text-text-primary">{month}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" onClick={() => handleExportReport("monthly")} className="bg-secondary text-white hover:bg-secondary/90">
                      <Download className="mr-2 h-4 w-4" /> Excel
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={prepareChartData(monthlyAnalytics?.machine_stats, "Koli")}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                        <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
                        <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} />
                        <Bar dataKey="Koli" fill="#10B981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* BOYALAR TAB */}
          <TabsContent value="paints">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl font-heading flex items-center gap-2">
                  <Droplet className="h-6 w-6 text-pink-500" /> Boya Stok Durumu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="paints-table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-heading text-text-primary">Renk</th>
                        <th className="text-left p-3 font-heading text-text-primary">Boya</th>
                        <th className="text-right p-3 font-heading text-text-primary">Stok (L)</th>
                        <th className="text-center p-3 font-heading text-text-primary">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paints.map((paint) => {
                        const isLowStock = paint.stock_kg < LOW_STOCK_THRESHOLD;
                        return (
                          <tr key={paint.id} className={`border-b border-border ${isLowStock ? "bg-red-500/10" : ""}`}>
                            <td className="p-3">
                              <div
                                className="w-8 h-8 rounded-full border-2"
                                style={{
                                  backgroundColor: PAINT_COLORS[paint.name] || "#888",
                                  borderColor: paint.name === "Beyaz" ? "#ccc" : (PAINT_COLORS[paint.name] || "#888")
                                }}
                              />
                            </td>
                            <td className="p-3 text-text-primary font-semibold">{paint.name}</td>
                            <td className={`p-3 text-right font-bold ${isLowStock ? "text-red-500" : "text-text-primary"}`}>
                              {paint.stock_kg.toFixed(1)}
                            </td>
                            <td className="p-3 text-center">
                              {isLowStock ? (
                                <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded-full text-xs font-semibold flex items-center justify-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Düşük
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded-full text-xs font-semibold">
                                  Normal
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ZİYARETÇİLER TAB */}
          <TabsContent value="visitors">
            <div className="space-y-6">
              {/* İstatistik Kartları */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-surface border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-text-secondary text-sm">Toplam</p>
                    <p className="text-3xl font-bold text-primary">{visitorStats?.total_visitors || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-surface border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-text-secondary text-sm">Bugün</p>
                    <p className="text-3xl font-bold text-success">{visitorStats?.today || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-surface border-border">
                  <CardContent className="p-4 text-center">
                    <p className="text-text-secondary text-sm">Bu Hafta</p>
                    <p className="text-3xl font-bold text-info">{visitorStats?.this_week || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-surface border-border">
                  <CardContent className="p-4">
                    <p className="text-text-secondary text-sm text-center mb-2">Cihaz Dağılımı</p>
                    <div className="flex justify-center gap-4 text-xs">
                      {visitorStats?.device_distribution && Object.entries(visitorStats.device_distribution).map(([device, count]) => (
                        <div key={device} className="flex items-center gap-1">
                          {device === "Mobil" ? <Smartphone className="h-3 w-3" /> : device === "Tablet" ? <Tablet className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                          <span className="text-text-primary">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Ziyaretçi Listesi */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-heading flex items-center gap-2">
                    <Users className="h-6 w-6 text-blue-500" /> Son Ziyaretçiler
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {visitors.length === 0 ? (
                    <p className="text-text-secondary text-center py-8">Henüz ziyaretçi kaydı yok.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full" data-testid="visitors-table">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-3 font-heading text-text-primary text-sm">IP Adresi</th>
                            <th className="text-left p-3 font-heading text-text-primary text-sm">Cihaz</th>
                            <th className="text-left p-3 font-heading text-text-primary text-sm hidden md:table-cell">Tarayıcı</th>
                            <th className="text-left p-3 font-heading text-text-primary text-sm hidden md:table-cell">İşletim Sistemi</th>
                            <th className="text-left p-3 font-heading text-text-primary text-sm hidden md:table-cell">Sayfa</th>
                            <th className="text-left p-3 font-heading text-text-primary text-sm">Tarih/Saat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitors.map((visitor) => {
                            const date = new Date(visitor.visited_at);
                            const formattedTime = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
                            const formattedDate = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
                            
                            return (
                              <tr key={visitor.id} className="border-b border-border">
                                <td className="p-3 text-text-primary font-mono text-sm">{visitor.ip_address}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {visitor.device_type === "Mobil" ? (
                                      <Smartphone className="h-4 w-4 text-blue-500" />
                                    ) : visitor.device_type === "Tablet" ? (
                                      <Tablet className="h-4 w-4 text-purple-500" />
                                    ) : (
                                      <Monitor className="h-4 w-4 text-green-500" />
                                    )}
                                    <span className="text-text-primary text-sm">{visitor.device_model}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-text-secondary text-sm hidden md:table-cell">{visitor.browser}</td>
                                <td className="p-3 text-text-secondary text-sm hidden md:table-cell">{visitor.os}</td>
                                <td className="p-3 text-text-secondary text-sm hidden md:table-cell">{visitor.page_visited}</td>
                                <td className="p-3">
                                  <div className="flex flex-col">
                                    <span className="text-text-primary font-semibold text-sm">{formattedTime}</span>
                                    <span className="text-text-secondary text-xs">{formattedDate}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* DEFO TAB */}
          <TabsContent value="defects">
            <div className="space-y-6">
              {/* Defo İstatistikleri */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-surface border-border">
                  <CardContent className="p-6 text-center">
                    <p className="text-text-secondary text-sm">Haftalık Toplam Defo</p>
                    <p className="text-4xl font-heading font-bold text-error">{defectWeeklyAnalytics?.total_defects_kg || 0} kg</p>
                  </CardContent>
                </Card>
                <Card className="bg-surface border-border">
                  <CardContent className="p-6 text-center">
                    <p className="text-text-secondary text-sm">En Çok Defo</p>
                    <p className="text-2xl font-heading font-bold text-warning">
                      {defectWeeklyAnalytics?.machine_defects && Object.keys(defectWeeklyAnalytics.machine_defects).length > 0
                        ? Object.entries(defectWeeklyAnalytics.machine_defects).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"
                        : "-"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-surface border-border">
                  <CardContent className="p-6 text-center">
                    <p className="text-text-secondary text-sm">Aylık Toplam Defo</p>
                    <p className="text-4xl font-heading font-bold text-error">{defectMonthlyAnalytics?.total_defects_kg || 0} kg</p>
                  </CardContent>
                </Card>
              </div>

              {/* GÜNLÜK DEFO GRAFİĞİ */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <CardTitle className="text-xl font-heading flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-error" /> Günlük Defo (kg)
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDefectWeekOffset(defectWeekOffset - 1)}>← Önceki Hafta</Button>
                      <Button size="sm" variant="outline" onClick={() => setDefectWeekOffset(0)} disabled={defectWeekOffset === 0}>Bu Hafta</Button>
                      <Button size="sm" variant="outline" onClick={() => setDefectWeekOffset(defectWeekOffset + 1)} disabled={defectWeekOffset >= 0}>Sonraki Hafta →</Button>
                    </div>
                  </div>
                  {defectDailyAnalytics && (
                    <p className="text-text-secondary text-sm">{defectDailyAnalytics.week_start} - {defectDailyAnalytics.week_end}</p>
                  )}
                </CardHeader>
                <CardContent>
                  {defectDailyAnalytics?.daily_stats && defectDailyAnalytics.daily_stats.some(d => d.total_kg > 0) ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={defectDailyAnalytics.daily_stats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                        <XAxis dataKey="day_name" stroke="#A1A1AA" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} unit=" kg" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }}
                          labelStyle={{ color: "#FAFAFA" }}
                          formatter={(value) => [`${value} kg`, "Defo"]}
                        />
                        <Bar dataKey="total_kg" fill="#ef4444" name="Defo (kg)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-text-secondary text-center py-8">Bu hafta defo kaydı yok.</p>
                  )}
                </CardContent>
              </Card>

              {/* HAFTALIK MAKİNE BAZLI DEFO */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-xl font-heading flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-error" /> Haftalık Makine Bazlı Defo (kg)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {defectWeeklyAnalytics?.machine_defects && Object.keys(defectWeeklyAnalytics.machine_defects).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareChartData(defectWeeklyAnalytics?.machine_defects, "Defo")}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" unit=" kg" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #444" }} 
                          formatter={(value) => [`${value} kg`, "Defo"]}
                        />
                        <Bar dataKey="Defo" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-text-secondary text-center py-8">Henüz haftalık defo kaydı yok.</p>
                  )}
                </CardContent>
              </Card>

              {/* AYLIK DEFO */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <CardTitle className="text-xl font-heading flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-error" /> Aylık Defo (kg)
                    </CardTitle>
                    <div className="flex gap-2 items-center">
                      <Select value={defectMonth.toString()} onValueChange={(v) => setDefectMonth(parseInt(v))}>
                        <SelectTrigger className="w-32 bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"].map((m, i) => (
                            <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={defectYear.toString()} onValueChange={(v) => setDefectYear(parseInt(v))}>
                        <SelectTrigger className="w-24 bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {[2024, 2025, 2026].map(y => (
                            <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {defectMonthlyAnalytics?.machine_defects && Object.keys(defectMonthlyAnalytics.machine_defects).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={prepareChartData(defectMonthlyAnalytics?.machine_defects, "Defo")}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="name" stroke="#888" fontSize={12} />
                        <YAxis stroke="#888" unit=" kg" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #444" }} 
                          formatter={(value) => [`${value} kg`, "Defo"]}
                        />
                        <Bar dataKey="Defo" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-text-secondary text-center py-8">Bu ay defo kaydı yok.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* BAKIM TAB */}
          <TabsContent value="maintenance">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl font-heading">Bakım Geçmişi</CardTitle>
              </CardHeader>
              <CardContent>
                {maintenanceLogs.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Henüz bakım kaydı yok.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="maintenance-logs-table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-heading text-text-primary">Makine</th>
                          <th className="text-left p-3 font-heading text-text-primary">Sebep</th>
                          <th className="text-left p-3 font-heading text-text-primary">Başlangıç</th>
                          <th className="text-left p-3 font-heading text-text-primary">Bitiş</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maintenanceLogs.map((log) => (
                          <tr key={log.id} className="border-b border-border">
                            <td className="p-3 text-text-primary font-semibold">{log.machine_name}</td>
                            <td className="p-3 text-text-secondary">{log.reason}</td>
                            <td className="p-3 text-text-secondary">{new Date(log.started_at).toLocaleString("tr-TR")}</td>
                            <td className="p-3 text-text-secondary">{log.ended_at ? new Date(log.ended_at).toLocaleString("tr-TR") : "Devam Ediyor"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ONAY BEKLEYEN TAB */}
          <TabsContent value="pending-approval">
            <Card className="bg-surface border-border">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle className="text-xl md:text-2xl font-heading flex items-center gap-2">
                    <Clock className="h-6 w-6 text-orange-500" /> Onay Bekleyen Raporlar
                  </CardTitle>
                  {pendingReports.length > 0 && (
                    <Button
                      onClick={handleApproveAllAndEndShift}
                      className="bg-success text-white hover:bg-success/90"
                      data-testid="approve-all-reports-btn"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" /> Tümünü Onayla & Vardiyayı Bitir
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pendingReports.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="h-16 w-16 mx-auto text-text-secondary mb-4 opacity-50" />
                    <p className="text-text-secondary text-lg">Onay bekleyen rapor yok.</p>
                    <p className="text-text-secondary text-sm mt-2">Vardiya bitirme bildirimi gönderdiğinizde, operatörlerin raporları burada görünecek.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingReports.map((report) => (
                      <Card key={report.id} className="bg-background border-border" data-testid={`pending-report-${report.id}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${report.is_completed ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                                  {report.is_completed ? 'TAMAMLANDI' : 'KISMİ'}
                                </span>
                                <span className="text-text-secondary text-sm">
                                  {new Date(report.created_at).toLocaleString("tr-TR")}
                                </span>
                              </div>
                              <h4 className="text-lg font-heading font-bold text-text-primary">{report.job_name}</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                <div>
                                  <p className="text-text-secondary text-xs">Operatör</p>
                                  <p className="text-text-primary font-semibold">{report.operator_name || '-'}</p>
                                </div>
                                <div>
                                  <p className="text-text-secondary text-xs">Makine</p>
                                  <p className="text-text-primary font-semibold">{report.machine_name}</p>
                                </div>
                                <div>
                                  <p className="text-text-secondary text-xs">Hedef</p>
                                  <p className="text-text-primary font-semibold">{report.target_koli} koli</p>
                                </div>
                                <div>
                                  <p className="text-text-secondary text-xs">Üretilen</p>
                                  <p className="text-success font-semibold text-lg">{report.produced_koli} koli</p>
                                </div>
                              </div>
                              {report.defect_kg > 0 && (
                                <div className="mt-2 p-2 bg-error/10 border border-error/30 rounded">
                                  <p className="text-error text-sm">
                                    <XCircle className="h-4 w-4 inline mr-1" />
                                    Defo: {report.defect_kg} kg
                                  </p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                              <Button
                                onClick={() => handleApproveReport(report.id)}
                                className="flex-1 md:flex-none bg-success text-white hover:bg-success/90"
                                data-testid={`approve-report-${report.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" /> Onayla
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDIT LOGLAR */}
          <TabsContent value="audit-logs" data-testid="audit-logs-content">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-text-primary flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Kullanici Hareket Loglari
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-text-secondary text-center py-8">Henuz log kaydı yok</p>
                ) : (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-text-secondary">
                            <th className="text-left py-2 px-2">Tarih</th>
                            <th className="text-left py-2 px-2">Kullanici</th>
                            <th className="text-left py-2 px-2">Islem</th>
                            <th className="text-left py-2 px-2">Tur</th>
                            <th className="text-left py-2 px-2">Ad</th>
                            <th className="text-left py-2 px-2">Detay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log) => (
                            <tr key={log.id} className="border-b border-border/50 hover:bg-surface-highlight/50">
                              <td className="py-2 px-2 text-text-secondary text-xs whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString("tr-TR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}
                              </td>
                              <td className="py-2 px-2 text-text-primary font-medium">{log.user}</td>
                              <td className="py-2 px-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  log.action === "create" ? "bg-green-500/20 text-green-400" :
                                  log.action === "update" ? "bg-blue-500/20 text-blue-400" :
                                  log.action === "delete" ? "bg-red-500/20 text-red-400" :
                                  log.action === "start" ? "bg-emerald-500/20 text-emerald-400" :
                                  log.action === "complete" ? "bg-purple-500/20 text-purple-400" :
                                  log.action === "pause" ? "bg-yellow-500/20 text-yellow-400" :
                                  log.action === "resume" ? "bg-cyan-500/20 text-cyan-400" :
                                  "bg-gray-500/20 text-gray-400"
                                }`}>
                                  {log.action === "create" ? "Ekledi" :
                                   log.action === "update" ? "Duzenledi" :
                                   log.action === "delete" ? "Sildi" :
                                   log.action === "start" ? "Baslatti" :
                                   log.action === "complete" ? "Tamamladi" :
                                   log.action === "pause" ? "Durdurdu" :
                                   log.action === "resume" ? "Devam Etti" : log.action}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-text-secondary capitalize">{log.entity_type}</td>
                              <td className="py-2 px-2 text-text-primary">{log.entity_name}</td>
                              <td className="py-2 px-2 text-text-secondary text-xs">{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {auditLogTotal > 100 && (
                      <div className="flex justify-center gap-2 pt-4">
                        <Button size="sm" variant="outline" disabled={auditLogPage === 0}
                          onClick={() => setAuditLogPage(p => Math.max(0, p - 1))}
                          className="border-border text-text-primary">Onceki</Button>
                        <span className="text-text-secondary text-sm py-1">{auditLogPage + 1} / {Math.ceil(auditLogTotal / 100)}</span>
                        <Button size="sm" variant="outline" disabled={(auditLogPage + 1) * 100 >= auditLogTotal}
                          onClick={() => setAuditLogPage(p => p + 1)}
                          className="border-border text-text-primary">Sonraki</Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* AI Yönetim Asistanı - Floating Button & Panel */}
        {authenticated && (
          <>
            {!isMgmtAIOpen && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { setIsMgmtAIOpen(true); if (!mgmtAIOverview) fetchMgmtAIOverview(); }}
                className="fixed bottom-20 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-lg flex items-center justify-center"
                data-testid="mgmt-ai-btn"
              >
                <Bot className="h-6 w-6" />
              </motion.button>
            )}

            <AnimatePresence>
              {isMgmtAIOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 100, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 100, scale: 0.95 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[450px] z-50 bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                  style={{ maxHeight: "75vh" }}
                  data-testid="mgmt-ai-panel"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500/20 to-cyan-600/20 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-emerald-400" />
                      <span className="font-heading font-bold text-text-primary">Yonetim AI</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">GPT-5.2</span>
                    </div>
                    <button onClick={() => setIsMgmtAIOpen(false)} className="p-1 hover:bg-surface-highlight rounded-full transition-colors">
                      <X className="h-5 w-5 text-text-secondary" />
                    </button>
                  </div>

                  {/* Tab Switch */}
                  <div className="flex border-b border-border">
                    <button
                      onClick={() => { setMgmtAITab("overview"); if (!mgmtAIOverview) fetchMgmtAIOverview(); }}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mgmtAITab === "overview" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-text-secondary hover:text-text-primary"}`}
                      data-testid="mgmt-ai-tab-overview"
                    >
                      Fabrika Analizi
                    </button>
                    <button
                      onClick={() => setMgmtAITab("chat")}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mgmtAITab === "chat" ? "text-emerald-400 border-b-2 border-emerald-400" : "text-text-secondary hover:text-text-primary"}`}
                      data-testid="mgmt-ai-tab-chat"
                    >
                      Sohbet
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Fabrika Analizi */}
                    {mgmtAITab === "overview" && (
                      <div className="p-4 space-y-3">
                        {mgmtAILoading ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-400 border-t-transparent" />
                            <p className="text-text-secondary text-sm">Fabrika verilerini analiz ediyor...</p>
                          </div>
                        ) : mgmtAIOverview ? (
                          <>
                            {/* İstatistik Kartları */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-emerald-400">{mgmtAIOverview.stats.working}/{mgmtAIOverview.stats.total_machines}</p>
                                <p className="text-xs text-text-secondary">Calisan</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-primary">{mgmtAIOverview.stats.koli_today}</p>
                                <p className="text-xs text-text-secondary">Bugun Koli</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-blue-400">{mgmtAIOverview.stats.pending_jobs}</p>
                                <p className="text-xs text-text-secondary">Bekleyen</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-green-400">{mgmtAIOverview.stats.completed_7d}</p>
                                <p className="text-xs text-text-secondary">7g Tamamlanan</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-orange-400">{mgmtAIOverview.stats.active_operators}</p>
                                <p className="text-xs text-text-secondary">Operator</p>
                              </div>
                              <div className="bg-background rounded-lg p-2 text-center border border-border">
                                <p className="text-lg font-bold text-red-400">{mgmtAIOverview.stats.defect_kg_7d}</p>
                                <p className="text-xs text-text-secondary">Defo(kg)</p>
                              </div>
                            </div>
                            {/* AI Analizi */}
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3" data-testid="mgmt-ai-overview-content">
                              <p className="text-sm text-text-primary whitespace-pre-line leading-relaxed">{mgmtAIOverview.overview}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={fetchMgmtAIOverview} className="w-full text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" data-testid="mgmt-ai-refresh-btn">
                              <Sparkles className="mr-2 h-4 w-4" /> Yenile
                            </Button>
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <Bot className="h-8 w-8 text-text-secondary mx-auto mb-2" />
                            <p className="text-text-secondary text-sm">Analiz yukleniyor...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sohbet */}
                    {mgmtAITab === "chat" && (
                      <div className="flex flex-col" style={{ minHeight: "280px" }}>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "45vh" }}>
                          {mgmtAIMessages.length === 0 && (
                            <div className="text-center py-6">
                              <Bot className="h-10 w-10 text-text-secondary mx-auto mb-3 opacity-50" />
                              <p className="text-text-secondary text-sm">Fabrika hakkinda soru sorun.</p>
                              <div className="flex flex-wrap justify-center gap-2 mt-3">
                                {["En verimli operator kim?", "Hangi makine bosta?", "Bu hafta kac koli urettik?"].map((q) => (
                                  <button key={q} onClick={() => setMgmtAIInput(q)} className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                                    {q}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {mgmtAIMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                msg.role === "user"
                                  ? "bg-emerald-500 text-white rounded-br-sm"
                                  : "bg-surface-highlight text-text-primary rounded-bl-sm border border-border"
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {mgmtAIChatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-surface-highlight rounded-2xl rounded-bl-sm px-4 py-2 border border-border">
                                <div className="flex gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0s" }} />
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0.15s" }} />
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0.3s" }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={mgmtAIChatEndRef} />
                        </div>
                        <div className="p-3 border-t border-border">
                          <div className="flex gap-2">
                            <Input
                              value={mgmtAIInput}
                              onChange={(e) => setMgmtAIInput(e.target.value)}
                              onKeyPress={(e) => e.key === "Enter" && sendMgmtAIMessage()}
                              placeholder="Sorunuzu yazin..."
                              className="bg-background border-border text-text-primary text-sm"
                              data-testid="mgmt-ai-chat-input"
                            />
                            <Button size="sm" onClick={sendMgmtAIMessage} disabled={!mgmtAIInput.trim() || mgmtAIChatLoading} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3" data-testid="mgmt-ai-chat-send">
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

        {/* GÜNLÜK DETAY DRILL-DOWN DIALOG */}
        <Dialog open={isDailyDetailOpen} onOpenChange={setIsDailyDetailOpen}>
          <DialogContent className="bg-surface border-border max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading flex items-center gap-2" data-testid="daily-detail-title">
                <FileText className="h-6 w-6 text-primary" />
                {dailyDetailData?.date ? new Date(dailyDetailData.date + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Günlük Detay"}
              </DialogTitle>
            </DialogHeader>
            {dailyDetailLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
            ) : dailyDetailData ? (
              <div className="space-y-5" data-testid="daily-detail-content">
                {/* Özet Kartları */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-2xl font-black text-primary">{dailyDetailData.summary.total_koli}</p>
                    <p className="text-xs text-text-secondary">Toplam Koli</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-2xl font-black text-green-400">{dailyDetailData.summary.completed_jobs}</p>
                    <p className="text-xs text-text-secondary">Tamamlanan</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-2xl font-black text-blue-400">{dailyDetailData.summary.started_jobs}</p>
                    <p className="text-xs text-text-secondary">Baslayan</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-2xl font-black text-orange-400">{dailyDetailData.summary.active_operators}</p>
                    <p className="text-xs text-text-secondary">Operator</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-2xl font-black text-yellow-400">{dailyDetailData.summary.partial_koli}</p>
                    <p className="text-xs text-text-secondary">Kismi Uretim</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 border border-border text-center">
                    <p className="text-2xl font-black text-red-400">{dailyDetailData.summary.total_defect_kg}</p>
                    <p className="text-xs text-text-secondary">Defo (kg)</p>
                  </div>
                </div>

                {/* Makine Dağılımı */}
                {dailyDetailData.machine_chart?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-heading text-text-primary mb-2">Makine Bazinda Uretim</h3>
                    <div className="flex flex-col md:flex-row items-center gap-4">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={dailyDetailData.machine_chart} dataKey="koli" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, koli }) => `${name}: ${koli}`} labelLine={false}>
                            {dailyDetailData.machine_chart.map((_, idx) => (
                              <Cell key={idx} fill={DRILL_COLORS[idx % DRILL_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Operatör Performansı */}
                {dailyDetailData.operator_chart?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-heading text-text-primary mb-2">Operator Performansi</h3>
                    <ResponsiveContainer width="100%" height={Math.max(120, dailyDetailData.operator_chart.length * 40)}>
                      <BarChart data={dailyDetailData.operator_chart} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                        <XAxis type="number" stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 11 }} width={55} />
                        <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} formatter={(val, name) => [val, name === "koli" ? "Koli" : "Is"]} />
                        <Bar dataKey="koli" fill="#34D399" name="Koli" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Defo Detayı */}
                {dailyDetailData.summary.total_defect_kg > 0 && Object.keys(dailyDetailData.defect_by_machine).length > 0 && (
                  <div>
                    <h3 className="text-sm font-heading text-text-primary mb-2">Defo Dagilimi (kg)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(dailyDetailData.defect_by_machine).map(([machine, kg]) => (
                        <div key={machine} className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
                          <p className="text-sm font-bold text-red-400">{kg} kg</p>
                          <p className="text-xs text-text-secondary">{machine}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* İş Detayları Tablosu */}
                {dailyDetailData.job_details?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-heading text-text-primary mb-2">Tamamlanan Isler ({dailyDetailData.job_details.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="daily-detail-jobs-table">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left p-2 text-text-secondary font-medium">Is</th>
                            <th className="text-left p-2 text-text-secondary font-medium">Makine</th>
                            <th className="text-left p-2 text-text-secondary font-medium">Operator</th>
                            <th className="text-right p-2 text-text-secondary font-medium">Koli</th>
                            <th className="text-right p-2 text-text-secondary font-medium">Sure</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dailyDetailData.job_details.map((job, idx) => (
                            <tr key={job.id || idx} className="border-b border-border/50 hover:bg-surface-highlight/50">
                              <td className="p-2 text-text-primary">{job.name}</td>
                              <td className="p-2 text-text-secondary">{job.machine_name}</td>
                              <td className="p-2 text-text-secondary">{job.operator_name}</td>
                              <td className="p-2 text-right text-primary font-semibold">{job.koli_count}</td>
                              <td className="p-2 text-right text-text-secondary">
                                {job.duration_min ? `${Math.floor(job.duration_min / 60)}s ${job.duration_min % 60}dk` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Boş gün mesajı */}
                {dailyDetailData.summary.total_koli === 0 && dailyDetailData.summary.completed_jobs === 0 && (
                  <div className="text-center py-8">
                    <p className="text-text-secondary">Bu gun icin uretim verisi bulunamadi.</p>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* BAKIM DIALOG */}
        <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">Bakıma Al - {selectedMachineForMaintenance?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">Bakım Sebebi</Label>
                <Input data-testid="maintenance-reason-input" value={maintenanceReason} onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="Bakım sebebini girin..." className="bg-background border-border text-text-primary" />
              </div>
              <Button data-testid="confirm-maintenance-button" onClick={() => handleToggleMaintenance(selectedMachineForMaintenance, true)}
                className="w-full bg-warning text-black hover:bg-warning/90">Bakıma Al</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* MESAJ DIALOG */}
        <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading flex items-center gap-2">
                <MessageSquare className="h-6 w-6 text-blue-500" />
                Mesaj Gönder - {selectedMachineForMessage?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">Mesajınız</Label>
                <Textarea
                  data-testid="message-input"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Operatöre göndermek istediğiniz mesajı yazın..."
                  className="bg-background border-border text-text-primary min-h-[100px]"
                />
              </div>
              <Button data-testid="send-message-button" onClick={handleSendMessage} className="w-full bg-blue-500 text-white hover:bg-blue-600">
                <Send className="mr-2 h-4 w-4" /> Mesaj Gönder
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* MAKİNE DETAY DIALOG */}
        <Dialog open={isMachineDetailOpen} onOpenChange={setIsMachineDetailOpen}>
          <DialogContent className="bg-surface border-border max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">{selectedMachineDetail?.name} - Detaylar</DialogTitle>
            </DialogHeader>
            {machineJobs && (
              <div className="space-y-6">
                {machineJobs.current && (
                  <div>
                    <h3 className="text-lg font-heading mb-3 text-success">Aktif İş</h3>
                    <Card className="bg-background border-success">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-heading font-bold text-text-primary">{machineJobs.current.name}</h4>
                            <p className="text-sm text-text-secondary">Operatör: {machineJobs.current.operator_name}</p>
                            <p className="text-sm text-text-secondary">Koli: {machineJobs.current.koli_count}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleCompleteJob(machineJobs.current)} className="bg-success text-white">
                              Tamamla
                            </Button>
                            {machineJobs.current.tracking_code && (
                              <Button size="sm" variant="outline"
                                onClick={async () => {
                                  const link = `${window.location.origin}/takip/${machineJobs.current.tracking_code}`;
                                  const shareData = { title: "Sipariş Takip", text: `${machineJobs.current.name} takip linki:`, url: link };
                                  try {
                                    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                                      await navigator.share(shareData);
                                    } else {
                                      await navigator.clipboard.writeText(link);
                                      toast.success("Takip linki kopyalandı!");
                                    }
                                  } catch (err) {
                                    if (err?.name !== "AbortError") {
                                      try { await navigator.clipboard.writeText(link); toast.success("Takip linki kopyalandı!"); } catch { toast.error("Link paylaşılamadı"); }
                                    }
                                  }
                                }}
                                className="text-blue-400 border-blue-400"
                                data-testid={`copy-link-${machineJobs.current.id}`}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => openEditJob(machineJobs.current)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-heading mb-3 text-info">Sıradaki İşler ({machineJobs.pending.length})</h3>
                  {machineJobs.pending.length === 0 ? (
                    <p className="text-text-secondary">Sırada iş yok</p>
                  ) : (
                    <div className="space-y-2">
                      {machineJobs.pending.map(job => (
                        <Card key={job.id} className="bg-background border-border">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-heading font-bold text-text-primary">{job.name}</h4>
                                <p className="text-sm text-text-secondary">Koli: {job.koli_count} | Renkler: {job.colors}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleStartJobFromManagement(job)} className="bg-success text-white">
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openEditJob(job)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDeleteJob(job.id)} className="text-error">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-heading mb-3 text-text-primary">Geçmiş İşler ({machineJobs.completed.length})</h3>
                  {machineJobs.completed.length === 0 ? (
                    <p className="text-text-secondary">Tamamlanmış iş yok</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {machineJobs.completed.slice(0, 10).map(job => (
                        <Card key={job.id} className="bg-background border-border opacity-70">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-heading font-bold text-text-primary">{job.name}</h4>
                                <p className="text-sm text-text-secondary">Koli: {job.completed_koli} / {job.koli_count}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteJob(job.id)} className="text-error hover:bg-error hover:text-white">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* İŞ DÜZENLE DIALOG */}
        <Dialog open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">İş Düzenle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">İş Adı</Label>
                <Input value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="bg-background border-border text-text-primary" />
              </div>
              <div>
                <Label className="text-text-primary">Koli Sayısı</Label>
                <Input type="number" value={editFormData.koli_count} onChange={(e) => setEditFormData({ ...editFormData, koli_count: e.target.value })}
                  className="bg-background border-border text-text-primary" />
              </div>
              <div>
                <Label className="text-text-primary">Renkler</Label>
                <Input value={editFormData.colors} onChange={(e) => setEditFormData({ ...editFormData, colors: e.target.value })}
                  className="bg-background border-border text-text-primary" />
              </div>
              <Button onClick={handleUpdateJob} className="w-full bg-success text-white hover:bg-success/90">Güncelle</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Kullanıcı Ekleme Dialog */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading">Yeni Kullanıcı Ekle</DialogTitle>
              <DialogDescription className="text-text-secondary">
                Sistem için yeni bir kullanıcı oluşturun. Çoklu rol atayarak tek hesapla birden fazla panele erişim verebilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kullanıcı Adı *</Label>
                <Input
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({...newUserData, username: e.target.value})}
                  placeholder="kullanici_adi"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label>Şifre *</Label>
                <Input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({...newUserData, password: e.target.value})}
                  placeholder="Şifre"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  Roller * <span className="text-[10px] text-text-muted font-mono">(çoklu seçim)</span>
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-2" data-testid="user-roles-grid">
                  {[
                    { value: "operator", label: "Operatör", icon: "👷" },
                    { value: "plan", label: "Planlama", icon: "📋" },
                    { value: "depo", label: "Depo", icon: "📦" },
                    { value: "sofor", label: "Şoför", icon: "🚚" },
                  ].map(r => {
                    const active = newUserData.roles.includes(r.value);
                    return (
                      <button
                        type="button"
                        key={r.value}
                        onClick={() => toggleUserRole(r.value)}
                        data-testid={`role-toggle-${r.value}`}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:border-primary/40 text-text-secondary"
                        }`}
                      >
                        <span className="text-lg">{r.icon}</span>
                        <span className="font-semibold text-sm">{r.label}</span>
                        {active && <Check className="h-4 w-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                {newUserData.roles.length > 1 && (
                  <p className="text-xs text-primary/80 mt-2 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Çoklu rol: Kullanıcı her panelden giriş yapabilecek.
                  </p>
                )}
              </div>
              <div>
                <Label>Görünen İsim</Label>
                <Input
                  value={newUserData.display_name}
                  onChange={(e) => setNewUserData({...newUserData, display_name: e.target.value})}
                  placeholder="Ahmet Yılmaz"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({...newUserData, phone: e.target.value})}
                  placeholder="0555 123 4567"
                  className="bg-background border-border"
                />
              </div>
              <Button onClick={handleCreateUser} className="w-full bg-primary hover:bg-primary/90 text-black">
                Kullanıcı Oluştur
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Rol Düzenleme Dialog */}
        <Dialog open={!!editingUserRoles} onOpenChange={(open) => !open && setEditingUserRoles(null)}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading">
                Rolleri Düzenle: {editingUserRoles?.username}
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Kullanıcının erişebileceği panelleri seçin. En az bir rol seçilmelidir.
              </DialogDescription>
            </DialogHeader>
            {editingUserRoles && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2" data-testid="edit-user-roles-grid">
                  {[
                    { value: "operator", label: "Operatör", icon: "👷" },
                    { value: "plan", label: "Planlama", icon: "📋" },
                    { value: "depo", label: "Depo", icon: "📦" },
                    { value: "sofor", label: "Şoför", icon: "🚚" },
                  ].map(r => {
                    const active = editingUserRoles.roles.includes(r.value);
                    return (
                      <button
                        type="button"
                        key={r.value}
                        onClick={() => {
                          setEditingUserRoles(prev => ({
                            ...prev,
                            roles: prev.roles.includes(r.value)
                              ? prev.roles.filter(x => x !== r.value)
                              : [...prev.roles, r.value]
                          }));
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background hover:border-primary/40 text-text-secondary"
                        }`}
                      >
                        <span className="text-lg">{r.icon}</span>
                        <span className="font-semibold text-sm">{r.label}</span>
                        {active && <Check className="h-4 w-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setEditingUserRoles(null)}
                  >
                    İptal
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-black"
                    onClick={async () => {
                      await handleUpdateUserRoles(editingUserRoles.userId, editingUserRoles.username, editingUserRoles.roles);
                      setEditingUserRoles(null);
                    }}
                    data-testid="save-user-roles-btn"
                  >
                    Kaydet
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Vardiya Sonu Seçenek Dialog */}
        <Dialog open={isShiftEndChoiceDialogOpen} onOpenChange={setIsShiftEndChoiceDialogOpen}>
          <DialogContent className="bg-surface border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading flex items-center gap-2">
                <PowerOff className="h-5 w-5 text-error" /> Vardiya Bitirme
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-text-secondary">
                Aktif işler var. Vardiya sonu raporlarını nasıl tamamlamak istersiniz?
              </p>
              
              <div className="space-y-3">
                <Card 
                  className="border-border hover:border-info cursor-pointer transition-colors"
                  onClick={handleChoiceNotifyOperators}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary">Operatörlere Bildir</h4>
                      <p className="text-sm text-text-secondary">Operatörler kendi üretim bilgilerini girsin</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card 
                  className="border-border hover:border-warning cursor-pointer transition-colors"
                  onClick={handleChoiceFillMyself}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                      <Edit className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary">Kendim Doldurayım</h4>
                      <p className="text-sm text-text-secondary">Tüm raporları buradan gir</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => setIsShiftEndChoiceDialogOpen(false)} 
                className="w-full mt-2"
              >
                İptal
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Vardiya Sonu Raporu Dialog */}
        <Dialog open={isShiftEndDialogOpen} onOpenChange={setIsShiftEndDialogOpen}>
          <DialogContent className="bg-surface border-border max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading flex items-center gap-2">
                <PowerOff className="h-6 w-6 text-error" /> Vardiya Sonu Raporu
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-text-secondary text-sm">Her makine için üretilen koli ve defo sayısını girin. Boş bırakılan makineler kaydedilmez.</p>
              
              <div className="space-y-3">
                {shiftEndReports.map((report) => (
                  <Card key={report.machine_id} className={`border ${report.job_name ? "border-success" : "border-border"}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                          <h4 className="font-heading font-bold text-text-primary">{report.machine_name}</h4>
                          {report.job_name && (
                            <p className="text-sm text-success">
                              Aktif iş: {report.job_name} (Hedef: {report.target_koli} koli)
                              {report.original_koli > 0 && report.original_koli !== report.target_koli && (
                                <span className="text-text-secondary ml-1">(Toplam: {report.original_koli})</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <div>
                            <Label className="text-xs text-text-secondary">Üretilen Koli</Label>
                            <Input
                              type="number"
                              min="0"
                              value={report.produced_koli || ""}
                              onChange={(e) => handleShiftEndReportChange(report.machine_id, "produced_koli", e.target.value)}
                              className="w-24 bg-background border-border text-text-primary"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-text-secondary">Defo (kg)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={report.defect_kg || ""}
                              onChange={(e) => handleShiftEndReportChange(report.machine_id, "defect_kg", e.target.value)}
                              className="w-24 bg-background border-border text-text-primary"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsShiftEndDialogOpen(false)} className="flex-1">
                  İptal
                </Button>
                <Button onClick={handleEndShiftWithReport} className="flex-1 bg-error text-white hover:bg-error/90">
                  <PowerOff className="mr-2 h-4 w-4" /> Vardiyayı Bitir
                </Button>
              </div>
            </div>
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
                  <p className="text-text-secondary">Makine: <span className="text-text-primary">{jobToPause.machine_name}</span></p>
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
                    disabled={!pauseReason}
                    className="flex-1 bg-warning text-black hover:bg-warning/90"
                  >
                    Durdur
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Operatör Seçimi ile İş Başlatma Dialog */}
        <Dialog open={isStartJobDialogOpen} onOpenChange={setIsStartJobDialogOpen}>
          <DialogContent className="bg-surface border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-text-primary flex items-center gap-2">
                <Play className="h-5 w-5 text-success" /> İş Başlat
              </DialogTitle>
              <DialogDescription className="text-text-secondary">
                Operatör seçerek işi başlatın
              </DialogDescription>
            </DialogHeader>
            {startJobTarget && (
              <div className="space-y-4 pt-2">
                <div className="bg-background rounded-lg p-3 border border-border">
                  <p className="font-bold text-text-primary">{startJobTarget.name}</p>
                  <p className="text-sm text-text-secondary">Makine: {startJobTarget.machine_name} | Koli: {startJobTarget.koli_count}</p>
                </div>

                <div>
                  <Label className="text-text-primary mb-2 block">Operatör Seç</Label>
                  <Select value={selectedOperatorName} onValueChange={(v) => { setSelectedOperatorName(v); setCustomOperatorName(""); }}>
                    <SelectTrigger data-testid="start-job-operator-select" className="bg-background border-border text-text-primary">
                      <SelectValue placeholder="Operatör seçin..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {operatorsList.map((op) => (
                        <SelectItem key={op.id} value={op.name} className="text-text-primary">
                          {op.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-text-primary mb-2 block">veya İsim Yaz</Label>
                  <Input
                    data-testid="start-job-custom-operator"
                    value={customOperatorName}
                    onChange={(e) => { setCustomOperatorName(e.target.value); setSelectedOperatorName(""); }}
                    placeholder="Yeni operatör ismi..."
                    className="bg-background border-border text-text-primary"
                  />
                </div>

                <Button
                  data-testid="start-job-confirm-btn"
                  onClick={confirmStartJob}
                  disabled={!selectedOperatorName && !customOperatorName.trim()}
                  className="w-full bg-success hover:bg-success/90 text-white"
                >
                  İşi Başlat
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagementFlow;
