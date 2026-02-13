import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Power, PowerOff, Wrench, Download, Sun, Moon, Edit, Trash2, Play, Droplet, MessageSquare, Send, AlertTriangle, Inbox, Check, Users, Monitor, Smartphone, Tablet, UserPlus, MapPin, Truck, XCircle, Clock, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Boya renk haritası
const PAINT_COLORS = {
  "Siyah": "#1a1a1a", "Beyaz": "#f5f5f5", "Mavi": "#2196F3", "Lacivert": "#1a237e",
  "Refleks": "#00e5ff", "Kırmızı": "#f44336", "Magenta": "#e91e63", "Rhodam": "#9c27b0",
  "Sarı": "#ffeb3b", "Gold": "#ffc107", "Gümüş": "#9e9e9e", "Pasta": "#bcaaa4"
};
const LOW_STOCK_THRESHOLD = 5;
const MANAGEMENT_PASSWORD = "buse11993";

const ManagementFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
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
  const [newUserData, setNewUserData] = useState({ username: "", password: "", role: "", display_name: "", phone: "" });
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
  const [defectWeeklyAnalytics, setDefectWeeklyAnalytics] = useState(null);
  const [defectMonthlyAnalytics, setDefectMonthlyAnalytics] = useState(null);
  const [defectDailyAnalytics, setDefectDailyAnalytics] = useState(null);
  const [defectWeekOffset, setDefectWeekOffset] = useState(0);
  const [defectYear, setDefectYear] = useState(new Date().getFullYear());
  const [defectMonth, setDefectMonth] = useState(new Date().getMonth() + 1);
  
  // Onay Bekleyen Raporlar
  const [pendingReports, setPendingReports] = useState([]);
  const [shiftStatus, setShiftStatus] = useState(null);
  
  // İş Durdurma
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [jobToPause, setJobToPause] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseProducedKoli, setPauseProducedKoli] = useState("");

  const [editFormData, setEditFormData] = useState({
    name: "", koli_count: "", colors: "", operator_name: "", notes: ""
  });

  const fetchData = async () => {
    try {
      const [shiftRes, machinesRes, jobsRes, weeklyRes, monthlyRes, dailyRes, logsRes, paintsRes, lowStockRes, messagesRes, unreadRes, visitorsRes, visitorStatsRes, usersRes, driversRes, defectWeeklyRes, defectMonthlyRes, defectDailyRes, pendingRes, shiftStatusRes] = await Promise.all([
        axios.get(`${API}/shifts/current`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/analytics/weekly`),
        axios.get(`${API}/analytics/monthly?year=${selectedYear}&month=${selectedMonth}`),
        axios.get(`${API}/analytics/daily-by-week?week_offset=${dailyWeekOffset}`),
        axios.get(`${API}/maintenance-logs`),
        axios.get(`${API}/paints`),
        axios.get(`${API}/paints/low-stock`),
        axios.get(`${API}/messages/all/incoming`),
        axios.get(`${API}/messages/all/unread-count`),
        axios.get(`${API}/visitors?limit=50`),
        axios.get(`${API}/visitors/stats`),
        axios.get(`${API}/users`),
        axios.get(`${API}/users/drivers/locations`),
        axios.get(`${API}/defects/analytics/weekly`),
        axios.get(`${API}/defects/analytics/monthly?year=${defectYear}&month=${defectMonth}`),
        axios.get(`${API}/defects/analytics/daily-by-week?week_offset=${defectWeekOffset}`),
        axios.get(`${API}/shifts/pending-reports`),
        axios.get(`${API}/shifts/status`)
      ]);
      setCurrentShift(shiftRes.data);
      const uniqueMachines = machinesRes.data.reduce((acc, machine) => {
        if (!acc.find(m => m.id === machine.id)) acc.push(machine);
        return acc;
      }, []);
      setMachines(uniqueMachines);
      setJobs(jobsRes.data);
      setWeeklyAnalytics(weeklyRes.data);
      setMonthlyAnalytics(monthlyRes.data);
      setDailyAnalytics(dailyRes.data);
      setMaintenanceLogs(logsRes.data);
      setPaints(paintsRes.data);
      setLowStockPaints(lowStockRes.data.low_stock_paints || []);
      setIncomingMessages(messagesRes.data);
      setUnreadMessagesCount(unreadRes.data.unread_count);
      setVisitors(visitorsRes.data);
      setVisitorStats(visitorStatsRes.data);
      setUsers(usersRes.data);
      setDriverLocations(driversRes.data);
      setDefectWeeklyAnalytics(defectWeeklyRes.data);
      setDefectMonthlyAnalytics(defectMonthlyRes.data);
      setDefectDailyAnalytics(defectDailyRes.data);
      setPendingReports(pendingRes.data);
      setShiftStatus(shiftStatusRes.data);
    } catch (error) {
      console.error("Data fetch error:", error);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, selectedYear, selectedMonth, weekOffset, dailyWeekOffset, defectYear, defectMonth, defectWeekOffset]);

  const handleLogin = () => {
    if (password === MANAGEMENT_PASSWORD) {
      setAuthenticated(true);
      toast.success("Giriş başarılı!");
    } else {
      toast.error("Yanlış şifre!");
    }
  };

  // Kullanıcı yönetimi fonksiyonları
  const handleCreateUser = async () => {
    if (!newUserData.username || !newUserData.password || !newUserData.role) {
      toast.error("Kullanıcı adı, şifre ve rol zorunludur");
      return;
    }
    try {
      await axios.post(`${API}/users`, newUserData);
      toast.success("Kullanıcı oluşturuldu!");
      setIsUserDialogOpen(false);
      setNewUserData({ username: "", password: "", role: "", display_name: "", phone: "" });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kullanıcı oluşturulamadı");
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
      await axios.post(`${API}/shifts/start`);
      toast.success("Vardiya başlatıldı!");
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
      return {
        machine_id: machine.id,
        machine_name: machine.name,
        job_id: activeJob?.id || null,
        job_name: activeJob?.name || null,
        target_koli: activeJob?.koli_count || 0,
        produced_koli: activeJob?.completed_koli || 0,
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
      // Önce rapor formunu hazırla
      const reports = machines.map(m => {
        const activeJob = activeJobs.find(j => j.machine_id === m.id);
        return {
          machine_id: m.id,
          machine_name: m.name,
          job_id: activeJob?.id || null,
          job_name: activeJob?.name || null,
          target_koli: activeJob?.koli_count || 0,
          produced_koli: "",
          defect_kg: ""
        };
      }).filter(r => r.job_id); // Sadece aktif işi olan makineler
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
  const handleChoiceNotifyOperators = () => {
    setIsShiftEndChoiceDialogOpen(false);
    handleRequestShiftEnd();
  };
  
  // Seçenek: Kendim doldurayım
  const handleChoiceFillMyself = () => {
    setIsShiftEndChoiceDialogOpen(false);
    setIsShiftEndDialogOpen(true);
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
        notes: editFormData.notes
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
      await axios.delete(`${API}/jobs/${jobId}`);
      toast.success("İş silindi!");
      fetchData();
    } catch (error) {
      toast.error("İş silinemedi");
    }
  };

  const handleStartJobFromManagement = async (job) => {
    try {
      await axios.put(`${API}/jobs/${job.id}/start`, { operator_name: "Yönetim" });
      toast.success("İş başlatıldı!");
      fetchData();
    } catch (error) {
      toast.error("İş başlatılamadı");
    }
  };

  const handleCompleteJob = async (job) => {
    try {
      await axios.put(`${API}/jobs/${job.id}/complete`, {});
      toast.success("İş tamamlandı!");
      fetchData();
    } catch (error) {
      toast.error("İş tamamlanamadı");
    }
  };

  const handleExportReport = async (period) => {
    try {
      const response = await axios.get(`${API}/analytics/export?period=${period}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `uretim_raporu_${period}.xlsx`);
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
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface hover:bg-surface-highlight">
            <ArrowLeft className="mr-2 h-4 w-4" /> Ana Sayfa
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-4xl md:text-5xl font-heading font-black text-primary">YÖNETİM PANELİ</h1>
          {currentShift ? (
            <Button data-testid="end-shift-button" onClick={handleEndShift} className="bg-error text-white hover:bg-error/90">
              <PowerOff className="mr-2 h-5 w-5" /> Vardiya Bitir
            </Button>
          ) : (
            <Button data-testid="start-shift-button" onClick={handleStartShift} className="bg-success text-white hover:bg-success/90">
              <Power className="mr-2 h-5 w-5" /> Vardiya Başlat
            </Button>
          )}
        </div>

        {/* Düşük Stok Uyarısı */}
        {lowStockPaints.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            <div className="flex items-center gap-2 text-red-500 font-bold mb-2">
              <AlertTriangle className="h-5 w-5" /> DÜŞÜK BOYA STOKU ({LOW_STOCK_THRESHOLD}L altı)
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

        <Tabs defaultValue="machines" className="space-y-6">
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
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
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
            </TabsList>
          </div>

          {/* MAKİNELER TAB */}
          <TabsContent value="machines">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {machines.map((machine) => {
                const currentJob = jobs.find(j => j.machine_id === machine.id && j.status === "in_progress");
                const upcomingJobs = jobs.filter(j => j.machine_id === machine.id && j.status === "pending");
                return (
                  <Card key={machine.id}
                    className={`bg-surface border-2 cursor-pointer transition-all hover:shadow-lg ${
                      machine.maintenance ? "border-warning" : machine.status === "working" ? "border-success" : "border-border"
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
                          <p className="text-sm font-semibold text-text-primary">Aktif İş:</p>
                          <p className="text-sm text-text-secondary">{currentJob.name}</p>
                          <p className="text-xs text-text-secondary">Operatör: {currentJob.operator_name}</p>
                        </div>
                      )}
                      {upcomingJobs.length > 0 && (
                        <p className="text-sm font-semibold text-text-primary">Bekleyen İşler: {upcomingJobs.length}</p>
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
                      {users.map(user => (
                        <div key={user.id} className="flex justify-between items-center p-3 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getRoleColor(user.role)}`}>
                              {user.role === "sofor" ? <Truck className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="font-semibold">{user.display_name || user.username}</p>
                              <p className="text-xs text-text-secondary">@{user.username}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${getRoleColor(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </span>
                            {user.role === "sofor" && user.current_location_lat && (
                              <span className="text-green-500 text-xs flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Aktif
                              </span>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteUser(user.id, user.username)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
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
                    <Button size="sm" variant="outline" onClick={() => setDailyWeekOffset(dailyWeekOffset - 1)}>←</Button>
                    <span className="text-xs md:text-sm font-semibold text-text-primary whitespace-nowrap px-2">
                      {dailyAnalytics?.week_start} - {dailyAnalytics?.week_end}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setDailyWeekOffset(dailyWeekOffset + 1)} disabled={dailyWeekOffset >= 0}>→</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dailyAnalytics?.daily_stats || []}>
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
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="total_koli" fill="#FFBF00" name="Toplam Koli" />
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
                      <BarChart data={prepareChartData(defectWeeklyAnalytics.machine_defects, "Defo")}>
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
                      <BarChart data={prepareChartData(defectMonthlyAnalytics.machine_defects, "Defo")}>
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
        </Tabs>

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
                <Label>Rol *</Label>
                <Select value={newUserData.role} onValueChange={(value) => setNewUserData({...newUserData, role: value})}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Rol seçin" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    <SelectItem value="operator">Operatör</SelectItem>
                    <SelectItem value="plan">Planlama</SelectItem>
                    <SelectItem value="depo">Depo</SelectItem>
                    <SelectItem value="sofor">Şoför</SelectItem>
                  </SelectContent>
                </Select>
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
                            <p className="text-sm text-success">Aktif iş: {report.job_name} (Hedef: {report.target_koli} koli)</p>
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
      </div>
    </div>
  );
};

export default ManagementFlow;
