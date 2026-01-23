import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Power, PowerOff, Wrench, Download, Sun, Moon, Edit, Trash2, Play } from "lucide-react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { startOfWeek, endOfWeek, format, subWeeks, addWeeks } from "date-fns";
import { tr } from "date-fns/locale";

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
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [selectedMachineForMaintenance, setSelectedMachineForMaintenance] = useState(null);
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [selectedMachineDetail, setSelectedMachineDetail] = useState(null);
  const [isMachineDetailOpen, setIsMachineDetailOpen] = useState(false);
  const [isEditJobOpen, setIsEditJobOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showMachineStatus, setShowMachineStatus] = useState(false);

  const [editFormData, setEditFormData] = useState({
    name: "",
    koli_count: "",
    colors: "",
    operator_name: "",
    notes: ""
  });

  useEffect(() => {
    if (authenticated) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, selectedYear, selectedMonth, weekOffset]);

  const fetchData = async () => {
    try {
      const [shiftRes, machinesRes, jobsRes, weeklyRes, monthlyRes, dailyRes, logsRes] = await Promise.all([
        axios.get(`${API}/shifts/current`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/analytics/weekly`),
        axios.get(`${API}/analytics/monthly?year=${selectedYear}&month=${selectedMonth}`),
        axios.get(`${API}/analytics/daily`),
        axios.get(`${API}/maintenance-logs`)
      ]);
      setCurrentShift(shiftRes.data);
      
      const uniqueMachines = machinesRes.data.reduce((acc, machine) => {
        if (!acc.find(m => m.id === machine.id)) {
          acc.push(machine);
        }
        return acc;
      }, []);
      setMachines(uniqueMachines);
      
      setJobs(jobsRes.data);
      setWeeklyAnalytics(weeklyRes.data);
      setMonthlyAnalytics(monthlyRes.data);
      setDailyAnalytics(dailyRes.data);
      setMaintenanceLogs(logsRes.data);
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

  const handleStartShift = async () => {
    try {
      await axios.post(`${API}/shifts/start`);
      toast.success("Vardiya başlatıldı!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Vardiya başlatılamadı");
    }
  };

  const handleEndShift = async () => {
    try {
      await axios.post(`${API}/shifts/end`);
      toast.success("Vardiya bitirildi!");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Vardiya bitirilemedi");
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
      await axios.put(`${API}/jobs/${job.id}/start`, {
        operator_name: "Yönetim"
      });
      toast.success("İş başlatıldı!");
      fetchData();
    } catch (error) {
      toast.error("İş başlatılamadı");
    }
  };

  const handleExportReport = async (period) => {
    try {
      const response = await axios.get(`${API}/analytics/export?period=${period}`, {
        responseType: 'blob'
      });
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

  const prepareChartData = (data, label) => {
    if (!data) return [];
    return Object.entries(data).map(([name, value]) => ({
      name,
      [label]: value
    }));
  };

  const getCurrentWeekRange = () => {
    const today = new Date();
    const targetDate = addWeeks(today, weekOffset);
    const start = startOfWeek(targetDate, { weekStartsOn: 1 });
    const end = endOfWeek(targetDate, { weekStartsOn: 1 });
    return {
      start: format(start, "d MMM", { locale: tr }),
      end: format(end, "d MMM", { locale: tr })
    };
  };

  const weekRange = getCurrentWeekRange();

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-heading text-center">YÖNETİM GİRİŞİ</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                data-testid="management-password-input"
                type="password"
                placeholder="Şifre..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="mb-4 bg-background border-border text-text-primary text-lg h-14"
              />
              <Button data-testid="management-login-button" onClick={handleLogin} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg font-heading">
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

  const machineJobs = selectedMachineDetail ? {
    current: jobs.find(j => j.machine_id === selectedMachineDetail.id && j.status === "in_progress"),
    pending: jobs.filter(j => j.machine_id === selectedMachineDetail.id && j.status === "pending"),
    completed: jobs.filter(j => j.machine_id === selectedMachineDetail.id && j.status === "completed")
  } : null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface hover:bg-surface-highlight">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfa
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-heading font-black text-primary">YÖNETİM PANELİ</h1>
          {currentShift ? (
            <Button data-testid="end-shift-button" onClick={handleEndShift} className="bg-error text-white hover:bg-error/90">
              <PowerOff className="mr-2 h-5 w-5" />
              Vardiya Bitir
            </Button>
          ) : (
            <Button data-testid="start-shift-button" onClick={handleStartShift} className="bg-success text-white hover:bg-success/90">
              <Power className="mr-2 h-5 w-5" />
              Vardiya Başlat
            </Button>
          )}
        </div>

        <Tabs defaultValue="machines" className="space-y-6">
          <TabsList className="bg-surface border-border">
            <TabsTrigger value="machines" data-testid="machines-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              Makine Durumu
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              Analiz
            </TabsTrigger>
            <TabsTrigger value="maintenance" data-testid="maintenance-tab" className="data-[state=active]:bg-primary data-[state=active]:text-black">
              Bakım Logları
            </TabsTrigger>
          </TabsList>

          <TabsContent value="machines">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {machines.map((machine) => {
                const currentJob = jobs.find(j => j.machine_id === machine.id && j.status === "in_progress");
                const upcomingJobs = jobs.filter(j => j.machine_id === machine.id && j.status === "pending");

                return (
                  <Card
                    key={machine.id}
                    className={`bg-surface border-2 cursor-pointer machine-card-hover ${
                      machine.maintenance ? "border-warning" : machine.status === "working" ? "border-success" : "border-border"
                    }`}
                    data-testid={`machine-status-${machine.name}`}
                    onClick={() => openMachineDetail(machine)}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-heading font-bold text-text-primary">{machine.name}</h3>
                          <p className={`text-sm font-semibold ${machine.maintenance ? "text-warning" : machine.status === "working" ? "text-success" : "text-text-secondary"}`}>
                            {machine.maintenance ? "BAKIM" : machine.status === "working" ? "ÇALIŞIYOR" : "BOŞTA"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (machine.maintenance) {
                              handleToggleMaintenance(machine, false);
                            } else {
                              openMaintenanceDialog(machine);
                            }
                          }}
                          data-testid={`maintenance-toggle-${machine.name}`}
                          className={machine.maintenance ? "bg-warning text-black hover:bg-warning/90" : "border-border"}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
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
                        <div>
                          <p className="text-sm font-semibold text-text-primary mb-2">Bekleyen İşler: {upcomingJobs.length}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Günlük Analiz */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-xl md:text-2xl font-heading">Günlük Üretim (Son 7 Gün)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyAnalytics?.daily_stats || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                      <XAxis dataKey="date" stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} 
                        labelStyle={{ color: "#FAFAFA" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-surface border border-border p-3 rounded">
                                <p className="text-text-primary font-semibold">{data.date}</p>
                                <p className="text-primary">Toplam: {data.total_koli} Koli</p>
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

              {/* Haftalık Analiz */}
              <Card className="bg-surface border-border">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
                    <CardTitle className="text-xl md:text-2xl font-heading">Haftalık Analiz</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setWeekOffset(weekOffset - 1)}>←</Button>
                      <span className="text-xs md:text-sm font-semibold text-text-primary whitespace-nowrap">{weekRange.start} - {weekRange.end}</span>
                      <Button size="sm" variant="outline" onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0}>→</Button>
                    </div>
                  </div>
                  <Button data-testid="export-weekly-button" onClick={() => handleExportReport("weekly")} className="bg-secondary text-white hover:bg-secondary/90 w-full md:w-auto" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-base md:text-lg font-heading mb-4 text-text-primary">Makine Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={prepareChartData(weeklyAnalytics?.machine_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} labelStyle={{ color: "#FAFAFA" }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Koli" fill="#FFBF00" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-heading mb-4 text-text-primary">Operatör Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={prepareChartData(weeklyAnalytics?.operator_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} labelStyle={{ color: "#FAFAFA" }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Koli" fill="#007AFF" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center md:justify-between gap-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
                    <CardTitle className="text-xl md:text-2xl font-heading">Aylık Analiz</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                        <SelectTrigger className="w-24 md:w-32 bg-background border-border text-text-primary h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {[2024, 2025, 2026].map(year => (
                            <SelectItem key={year} value={year.toString()} className="text-text-primary">{year}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                        <SelectTrigger className="w-28 md:w-32 bg-background border-border text-text-primary h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                          {[
                            "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                            "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
                          ].map((month, idx) => (
                            <SelectItem key={idx + 1} value={(idx + 1).toString()} className="text-text-primary">{month}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button data-testid="export-monthly-button" onClick={() => handleExportReport("monthly")} className="bg-secondary text-white hover:bg-secondary/90 w-full md:w-auto" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Excel
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-base md:text-lg font-heading mb-4 text-text-primary">Makine Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={prepareChartData(monthlyAnalytics?.machine_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} labelStyle={{ color: "#FAFAFA" }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Koli" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-heading mb-4 text-text-primary">Operatör Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={prepareChartData(monthlyAnalytics?.operator_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                          <YAxis stroke="#A1A1AA" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} labelStyle={{ color: "#FAFAFA" }} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Koli" fill="#F59E0B" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="maintenance">
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-2xl font-heading">Bakım Geçmişi</CardTitle>
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
                          <tr key={log.id} className="border-b border-border" data-testid={`maintenance-log-${log.id}`}>
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
        </Tabs>

        <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">Bakıma Al - {selectedMachineForMaintenance?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">Bakım Sebebi</Label>
                <Input
                  data-testid="maintenance-reason-input"
                  value={maintenanceReason}
                  onChange={(e) => setMaintenanceReason(e.target.value)}
                  placeholder="Bakım sebebini girin..."
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button data-testid="confirm-maintenance-button" onClick={() => handleToggleMaintenance(selectedMachineForMaintenance, true)} className="w-full bg-warning text-black hover:bg-warning/90">
                Bakıma Al
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                          <Button size="sm" variant="outline" onClick={() => openEditJob(machineJobs.current)}>
                            <Edit className="h-4 w-4" />
                          </Button>
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
                                <p className="text-sm text-text-secondary">Operatör: {job.operator_name}</p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleDeleteJob(job.id)} 
                                className="text-error hover:bg-error hover:text-white"
                              >
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

        <Dialog open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">İş Düzenle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">İş Adı</Label>
                <Input value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} className="bg-background border-border text-text-primary" />
              </div>
              <div>
                <Label className="text-text-primary">Koli Sayısı</Label>
                <Input type="number" value={editFormData.koli_count} onChange={(e) => setEditFormData({...editFormData, koli_count: e.target.value})} className="bg-background border-border text-text-primary" />
              </div>
              <div>
                <Label className="text-text-primary">Renkler</Label>
                <Input value={editFormData.colors} onChange={(e) => setEditFormData({...editFormData, colors: e.target.value})} className="bg-background border-border text-text-primary" />
              </div>
              <div>
                <Label className="text-text-primary">Operatör Adı</Label>
                <Input value={editFormData.operator_name} onChange={(e) => setEditFormData({...editFormData, operator_name: e.target.value})} className="bg-background border-border text-text-primary" placeholder="İsteğe bağlı" />
              </div>
              <div>
                <Label className="text-text-primary">Not</Label>
                <Input value={editFormData.notes} onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})} className="bg-background border-border text-text-primary" />
              </div>
              <Button onClick={handleUpdateJob} className="w-full bg-success text-white hover:bg-success/90">
                Güncelle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagementFlow;
