import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Power, PowerOff, Wrench, Download, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const ManagementFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [currentShift, setCurrentShift] = useState(null);
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState(null);
  const [monthlyAnalytics, setMonthlyAnalytics] = useState(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [selectedMachineForMaintenance, setSelectedMachineForMaintenance] = useState(null);
  const [maintenanceReason, setMaintenanceReason] = useState("");

  useEffect(() => {
    if (authenticated) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated]);

  const fetchData = async () => {
    try {
      const [shiftRes, machinesRes, jobsRes, weeklyRes, monthlyRes, logsRes] = await Promise.all([
        axios.get(`${API}/shifts/current`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/jobs`),
        axios.get(`${API}/analytics/weekly`),
        axios.get(`${API}/analytics/monthly`),
        axios.get(`${API}/maintenance-logs`)
      ]);
      setCurrentShift(shiftRes.data);
      setMachines(machinesRes.data);
      setJobs(jobsRes.data);
      setWeeklyAnalytics(weeklyRes.data);
      setMonthlyAnalytics(monthlyRes.data);
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

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
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
              <Button
                data-testid="management-login-button"
                onClick={handleLogin}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg font-heading"
              >
                Giriş Yap
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full mt-4 border-border bg-background hover:bg-surface-highlight"
              >
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
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

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-heading font-black text-primary">
            YÖNETİM PANELİ
          </h1>
          {currentShift ? (
            <Button
              data-testid="end-shift-button"
              onClick={handleEndShift}
              className="bg-error text-white hover:bg-error/90"
            >
              <PowerOff className="mr-2 h-5 w-5" />
              Vardiya Bitir
            </Button>
          ) : (
            <Button
              data-testid="start-shift-button"
              onClick={handleStartShift}
              className="bg-success text-white hover:bg-success/90"
            >
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((machine) => {
                const currentJob = jobs.find(j => j.machine_id === machine.id && j.status === "in_progress");
                const upcomingJobs = jobs.filter(j => j.machine_id === machine.id && j.status === "pending");

                return (
                  <Card
                    key={machine.id}
                    className={`bg-surface border-2 ${
                      machine.maintenance
                        ? "border-warning"
                        : machine.status === "working"
                        ? "border-success"
                        : "border-border"
                    }`}
                    data-testid={`machine-status-${machine.name}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-heading font-bold text-text-primary">
                            {machine.name}
                          </h3>
                          <p className={`text-sm font-semibold ${
                            machine.maintenance
                              ? "text-warning"
                              : machine.status === "working"
                              ? "text-success"
                              : "text-text-secondary"
                          }`}>
                            {machine.maintenance ? "BAKIM" : machine.status === "working" ? "ÇALIŞIYOR" : "BOŞTA"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (machine.maintenance) {
                              handleToggleMaintenance(machine, false);
                            } else {
                              openMaintenanceDialog(machine);
                            }
                          }}
                          data-testid={`maintenance-toggle-${machine.name}`}
                          className={`${
                            machine.maintenance
                              ? "bg-warning text-black hover:bg-warning/90"
                              : "border-border"
                          }`}
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
                          <p className="text-sm font-semibold text-text-primary mb-2">
                            Bekleyen İşler: {upcomingJobs.length}
                          </p>
                          <div className="space-y-2">
                            {upcomingJobs.slice(0, 2).map(job => (
                              <div key={job.id} className="p-2 bg-info/20 border border-info rounded text-xs text-text-secondary">
                                {job.name}
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

          <TabsContent value="analytics">
            <div className="space-y-6">
              <Card className="bg-surface border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-2xl font-heading">Haftalık Analiz</CardTitle>
                  <Button
                    data-testid="export-weekly-button"
                    onClick={() => handleExportReport("weekly")}
                    className="bg-secondary text-white hover:bg-secondary/90"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel’e Aktar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-heading mb-4 text-text-primary">Makine Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prepareChartData(weeklyAnalytics?.machine_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" />
                          <YAxis stroke="#A1A1AA" />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A" }}
                            labelStyle={{ color: "#FAFAFA" }}
                          />
                          <Legend />
                          <Bar dataKey="Koli" fill="#FFBF00" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-lg font-heading mb-4 text-text-primary">Operatör Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prepareChartData(weeklyAnalytics?.operator_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" />
                          <YAxis stroke="#A1A1AA" />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A" }}
                            labelStyle={{ color: "#FAFAFA" }}
                          />
                          <Legend />
                          <Bar dataKey="Koli" fill="#007AFF" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-2xl font-heading">Aylık Analiz</CardTitle>
                  <Button
                    data-testid="export-monthly-button"
                    onClick={() => handleExportReport("monthly")}
                    className="bg-secondary text-white hover:bg-secondary/90"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Excel’e Aktar
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-heading mb-4 text-text-primary">Makine Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prepareChartData(monthlyAnalytics?.machine_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" />
                          <YAxis stroke="#A1A1AA" />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A" }}
                            labelStyle={{ color: "#FAFAFA" }}
                          />
                          <Legend />
                          <Bar dataKey="Koli" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h3 className="text-lg font-heading mb-4 text-text-primary">Operatör Bazında Koli</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prepareChartData(monthlyAnalytics?.operator_stats, "Koli")}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                          <XAxis dataKey="name" stroke="#A1A1AA" />
                          <YAxis stroke="#A1A1AA" />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A" }}
                            labelStyle={{ color: "#FAFAFA" }}
                          />
                          <Legend />
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
                            <td className="p-3 text-text-secondary">
                              {new Date(log.started_at).toLocaleString("tr-TR")}
                            </td>
                            <td className="p-3 text-text-secondary">
                              {log.ended_at ? new Date(log.ended_at).toLocaleString("tr-TR") : "Devam Ediyor"}
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

        <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">
                Bakıma Al - {selectedMachineForMaintenance?.name}
              </DialogTitle>
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
              <Button
                data-testid="confirm-maintenance-button"
                onClick={() => handleToggleMaintenance(selectedMachineForMaintenance, true)}
                className="w-full bg-warning text-black hover:bg-warning/90"
              >
                Bakıma Al
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ManagementFlow;
