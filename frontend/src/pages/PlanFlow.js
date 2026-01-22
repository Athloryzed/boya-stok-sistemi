import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Sun, Moon, Search, Copy, Trash2, Edit } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const PlanFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [jobToClone, setJobToClone] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [isMachineDetailOpen, setIsMachineDetailOpen] = useState(false);
  const [selectedMachineDetail, setSelectedMachineDetail] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    koli_count: "",
    colors: "",
    machine_id: "",
    format: "",
    notes: "",
    delivery_date: ""
  });

  const [cloneFormData, setCloneFormData] = useState({
    name: "",
    koli_count: "",
    colors: "",
    machine_id: "",
    format: "",
    notes: "",
    delivery_date: ""
  });

  useEffect(() => {
    if (authenticated) {
      fetchMachines();
      fetchJobs();
      fetchCompletedJobs();
    }
  }, [authenticated]);

  useEffect(() => {
    if (selectedMachine) {
      fetchJobs();
    }
  }, [selectedMachine]);

  const fetchMachines = async () => {
    try {
      const response = await axios.get(`${API}/machines`);
      const uniqueMachines = response.data.reduce((acc, machine) => {
        if (!acc.find(m => m.id === machine.id)) {
          acc.push(machine);
        }
        return acc;
      }, []);
      setMachines(uniqueMachines);
    } catch (error) {
      toast.error("Makineler yüklenemedi");
    }
  };

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMachine && selectedMachine !== "all") {
        params.append("machine_id", selectedMachine);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      params.append("status", "pending");
      
      const response = await axios.get(`${API}/jobs?${params.toString()}`);
      setJobs(response.data);
    } catch (error) {
      toast.error("İşler yüklenemedi");
    }
  };

  const fetchCompletedJobs = async () => {
    try {
      const params = new URLSearchParams();
      params.append("status", "completed");
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      
      const response = await axios.get(`${API}/jobs?${params.toString()}`);
      setCompletedJobs(response.data);
    } catch (error) {
      console.error("Completed jobs fetch error:", error);
    }
  };

  useEffect(() => {
    if (authenticated) {
      const timer = setTimeout(() => {
        fetchJobs();
        fetchCompletedJobs();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  const handleLogin = () => {
    if (password === "12341") {
      setAuthenticated(true);
      toast.success("Giriş başarılı!");
    } else {
      toast.error("Yanlış şifre!");
    }
  };

  const getFormatOptions = (machineName) => {
    if (machineName === "24x24" || machineName === "33x33 (Büyük)") {
      return ["1/4", "1/8"];
    } else if (machineName === "33x33 ICM") {
      return ["33x33", "33x24"];
    }
    return [];
  };

  const getFormatFilterOptions = (machineName) => {
    if (machineName === "24x24" || machineName === "33x33 (Büyük)") {
      return ["all", "1/4", "1/8"];
    } else if (machineName === "33x33 ICM") {
      return ["all", "33x33", "33x24"];
    }
    return ["all"];
  };

  const handleAddJob = async () => {
    if (!formData.name || !formData.koli_count || !formData.colors || !formData.machine_id) {
      toast.error("Lütfen zorunlu alanları doldurun");
      return;
    }

    const machine = machines.find(m => m.id === formData.machine_id);
    if (machine.maintenance) {
      toast.error("Seçilen makine bakımda!");
      return;
    }

    const formatOptions = getFormatOptions(machine.name);
    if (formatOptions.length > 0 && !formData.format) {
      toast.error("Lütfen format seçin");
      return;
    }

    try {
      await axios.post(`${API}/jobs`, {
        ...formData,
        koli_count: parseInt(formData.koli_count),
        machine_name: machine.name,
        format: formatOptions.length > 0 ? formData.format : null
      });
      toast.success("İş eklendi!");
      setIsDialogOpen(false);
      setFormData({
        name: "",
        koli_count: "",
        colors: "",
        machine_id: "",
        format: "",
        notes: "",
        delivery_date: ""
      });
      fetchJobs();
    } catch (error) {
      toast.error("İş eklenemedi");
    }
  };

  const openCloneDialog = (job) => {
    setJobToClone(job);
    setCloneFormData({
      name: job.name,
      koli_count: job.koli_count.toString(),
      colors: job.colors,
      machine_id: job.machine_id,
      format: job.format || "",
      notes: job.notes || "",
      delivery_date: job.delivery_date || ""
    });
    setIsCloneDialogOpen(true);
  };

  const handleCloneJob = async () => {
    if (!cloneFormData.name || !cloneFormData.koli_count || !cloneFormData.colors || !cloneFormData.machine_id) {
      toast.error("Lütfen zorunlu alanları doldurun");
      return;
    }

    const machine = machines.find(m => m.id === cloneFormData.machine_id);
    const formatOptions = getFormatOptions(machine.name);

    try {
      await axios.post(`${API}/jobs/${jobToClone.id}/clone`, {
        ...cloneFormData,
        koli_count: parseInt(cloneFormData.koli_count),
        machine_name: machine.name,
        format: formatOptions.length > 0 ? cloneFormData.format : null
      });
      toast.success("İş sıraya eklendi!");
      setIsCloneDialogOpen(false);
      setJobToClone(null);
      fetchJobs();
    } catch (error) {
      toast.error("İş eklenemedi");
    }
  };

  const filteredJobs = jobs.filter(job => 
    selectedFormat === "all" || job.format === selectedFormat
  );

  const filteredCompletedJobs = completedJobs.filter(job =>
    selectedFormat === "all" || job.format === selectedFormat
  );

  const selectedMachineName = selectedMachine && selectedMachine !== "all"
    ? machines.find(m => m.id === selectedMachine)?.name
    : null;

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
              <CardTitle className="text-3xl font-heading text-center">PLAN GİRİŞİ</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                data-testid="plan-password-input"
                type="password"
                placeholder="Şifre..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="mb-4 bg-background border-border text-text-primary text-lg h-14"
              />
              <Button
                data-testid="plan-login-button"
                onClick={handleLogin}
                className="w-full bg-success text-white hover:bg-success/90 h-14 text-lg font-heading"
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
          <h1 className="text-5xl font-heading font-black text-success">
            PLANLAMA PANELİ
          </h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="add-job-button"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-2 h-5 w-5" />
                Yeni İş Ekle
              </Button>
            </DialogTrigger>

        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-heading font-bold text-text-primary mb-4">Makine Durumları</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {machines.map((machine) => {
              const currentJob = jobs.find(j => j.machine_id === machine.id && j.status === "in_progress");
              const pendingCount = jobs.filter(j => j.machine_id === machine.id && j.status === "pending").length;
              
              return (
                <Card
                  key={machine.id}
                  className={`bg-surface border cursor-pointer machine-card-hover ${
                    machine.maintenance
                      ? "border-warning"
                      : currentJob
                      ? "border-success"
                      : "border-border"
                  }`}
                  onClick={() => {
                    setSelectedMachineDetail(machine);
                    setIsMachineDetailOpen(true);
                  }}
                >
                  <CardContent className="p-2 md:p-4">
                    <h3 className="text-sm md:text-lg font-heading font-bold text-text-primary mb-1 md:mb-2 truncate">
                      {machine.name}
                    </h3>
                    {machine.maintenance ? (
                      <p className="text-xs md:text-sm text-warning font-semibold">BAKIM</p>
                    ) : currentJob ? (
                      <div className="space-y-0.5 md:space-y-1">
                        <p className="text-xs md:text-sm text-success font-semibold">ÇALIŞIYOR</p>
                        <p className="text-xs text-text-secondary truncate hidden md:block">{currentJob.name}</p>
                        <p className="text-xs text-text-secondary truncate hidden md:block">Op: {currentJob.operator_name}</p>
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-text-secondary">Boşta</p>
                    )}
                    {pendingCount > 0 && (
                      <p className="text-xs text-info mt-1 md:mt-2">Sıra: {pendingCount}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
            <DialogContent className="bg-surface border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-heading">Yeni İş Ekle</DialogTitle>
                <DialogDescription className="text-text-secondary">
                  Yeni bir iş tanımlamak için aşağıdaki formu doldurun.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-text-primary">İş Adı *</Label>
                  <Input
                    data-testid="job-name-input"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="bg-background border-border text-text-primary"
                  />
                </div>
                <div>
                  <Label className="text-text-primary">Koli Sayısı *</Label>
                  <Input
                    data-testid="job-koli-input"
                    type="number"
                    value={formData.koli_count}
                    onChange={(e) => setFormData({...formData, koli_count: e.target.value})}
                    className="bg-background border-border text-text-primary"
                  />
                </div>
                <div>
                  <Label className="text-text-primary">Renkler *</Label>
                  <Input
                    data-testid="job-colors-input"
                    value={formData.colors}
                    onChange={(e) => setFormData({...formData, colors: e.target.value})}
                    className="bg-background border-border text-text-primary"
                  />
                </div>
                <div>
                  <Label className="text-text-primary">Makine *</Label>
                  <Select
                    value={formData.machine_id}
                    onValueChange={(value) => setFormData({...formData, machine_id: value, format: ""})}
                  >
                    <SelectTrigger data-testid="job-machine-select" className="bg-background border-border text-text-primary">
                      <SelectValue placeholder="Makine seçin..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {machines.map((machine) => (
                        <SelectItem
                          key={machine.id}
                          value={machine.id}
                          disabled={machine.maintenance}
                          className="text-text-primary"
                        >
                          {machine.name} {machine.maintenance && "(BAKIM)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.machine_id && getFormatOptions(machines.find(m => m.id === formData.machine_id)?.name).length > 0 && (
                  <div>
                    <Label className="text-text-primary">Format *</Label>
                    <Select
                      value={formData.format}
                      onValueChange={(value) => setFormData({...formData, format: value})}
                    >
                      <SelectTrigger data-testid="job-format-select" className="bg-background border-border text-text-primary">
                        <SelectValue placeholder="Format seçin..." />
                      </SelectTrigger>
                      <SelectContent className="bg-surface border-border">
                        {getFormatOptions(machines.find(m => m.id === formData.machine_id)?.name).map((format) => (
                          <SelectItem key={format} value={format} className="text-text-primary">
                            {format}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-text-primary">Not</Label>
                  <Input
                    data-testid="job-notes-input"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="bg-background border-border text-text-primary"
                  />
                </div>
                <div>
                  <Label className="text-text-primary">Tahmini Teslim Tarihi</Label>
                  <Input
                    data-testid="job-delivery-input"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                    className="bg-background border-border text-text-primary"
                  />
                </div>
                <Button
                  data-testid="submit-job-button"
                  onClick={handleAddJob}
                  className="w-full bg-success text-white hover:bg-success/90"
                >
                  İş Ekle
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-surface border-border">
            <TabsTrigger value="pending" data-testid="pending-jobs-tab" className="data-[state=active]:bg-success data-[state=active]:text-white">
              Sıradaki İşler
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="completed-jobs-tab" className="data-[state=active]:bg-success data-[state=active]:text-white">
              Geçmiş İşler
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <Input
                  data-testid="search-jobs-input"
                  placeholder="İş ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-surface border-border text-text-primary"
                />
              </div>
            </div>
            <Select value={selectedMachine || "all"} onValueChange={setSelectedMachine}>
              <SelectTrigger data-testid="filter-machine-select" className="w-full md:w-64 bg-surface border-border text-text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="all" className="text-text-primary">Tüm Makineler</SelectItem>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id} className="text-text-primary">
                    {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMachineName && getFormatFilterOptions(selectedMachineName).length > 1 && (
            <div className="flex gap-2">
              {getFormatFilterOptions(selectedMachineName).map((format) => (
                <Button
                  key={format}
                  variant={selectedFormat === format ? "default" : "outline"}
                  onClick={() => setSelectedFormat(format)}
                  data-testid={`format-filter-${format}`}
                  className={selectedFormat === format ? "bg-success text-white" : ""}
                >
                  {format === "all" ? "Tümü" : format}
                </Button>
              ))}
            </div>
          )}

          <TabsContent value="pending">
            <div className="space-y-4">
              {filteredJobs.length === 0 ? (
                <Card className="bg-surface border-border">
                  <CardContent className="p-8 text-center">
                    <p className="text-text-secondary text-lg">Henüz iş eklenmemiş.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="bg-surface border-border"
                    data-testid={`job-card-${job.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-heading font-bold text-text-primary">
                              {job.name}
                            </h3>
                            {job.format && (
                              <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono rounded">
                                {job.format}
                              </span>
                            )}
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                job.status === "in_progress"
                                  ? "bg-warning text-black"
                                  : "bg-info text-white"
                              }`}
                            >
                              {job.status === "in_progress" ? "Devam Ediyor" : "Bekliyor"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-text-secondary">
                            <div>
                              <p className="text-sm font-semibold">Makine</p>
                              <p>{job.machine_name}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Koli</p>
                              <p>{job.koli_count}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Renkler</p>
                              <p>{job.colors}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Teslim</p>
                              <p>{job.delivery_date || "-"}</p>
                            </div>
                          </div>
                          {job.notes && (
                            <p className="mt-3 text-text-secondary">
                              <span className="font-semibold">Not:</span> {job.notes}
                            </p>
                          )}
                          {job.operator_name && (
                            <p className="mt-2 text-text-secondary">
                              <span className="font-semibold">Operatör:</span> {job.operator_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-4">
              {filteredCompletedJobs.length === 0 ? (
                <Card className="bg-surface border-border">
                  <CardContent className="p-8 text-center">
                    <p className="text-text-secondary text-lg">Henüz tamamlanmış iş yok.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredCompletedJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="bg-surface border-border"
                    data-testid={`completed-job-${job.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-heading font-bold text-text-primary">
                              {job.name}
                            </h3>
                            {job.format && (
                              <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono rounded">
                                {job.format}
                              </span>
                            )}
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-success text-white">
                              Tamamlandı
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-text-secondary">
                            <div>
                              <p className="text-sm font-semibold">Makine</p>
                              <p>{job.machine_name}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Koli</p>
                              <p>{job.completed_koli} / {job.koli_count}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Renkler</p>
                              <p>{job.colors}</p>
                            </div>
                            <div>
                              <p className="text-sm font-semibold">Operatör</p>
                              <p>{job.operator_name || "-"}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCloneDialog(job)}
                            data-testid={`clone-job-${job.id}`}
                            className="border-success text-success hover:bg-success hover:text-white"
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Sıraya Ekle
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (window.confirm("Bu işi silmek istediğinizden emin misiniz?")) {
                                try {
                                  await axios.delete(`${API}/jobs/${job.id}`);
                                  toast.success("İş silindi!");
                                  fetchCompletedJobs();
                                } catch (error) {
                                  toast.error("İş silinemedi");
                                }
                              }
                            }}
                            className="border-error text-error hover:bg-error hover:text-white"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isCloneDialogOpen} onOpenChange={setIsCloneDialogOpen}>
          <DialogContent className="bg-surface border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">İşi Sıraya Ekle</DialogTitle>
              <DialogDescription className="text-text-secondary">
                İş bilgilerini düzenleyip sıraya ekleyebilirsiniz.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">İş Adı *</Label>
                <Input
                  data-testid="clone-job-name-input"
                  value={cloneFormData.name}
                  onChange={(e) => setCloneFormData({...cloneFormData, name: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Koli Sayısı *</Label>
                <Input
                  data-testid="clone-job-koli-input"
                  type="number"
                  value={cloneFormData.koli_count}
                  onChange={(e) => setCloneFormData({...cloneFormData, koli_count: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Renkler *</Label>
                <Input
                  data-testid="clone-job-colors-input"
                  value={cloneFormData.colors}
                  onChange={(e) => setCloneFormData({...cloneFormData, colors: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Makine *</Label>
                <Select
                  value={cloneFormData.machine_id}
                  onValueChange={(value) => setCloneFormData({...cloneFormData, machine_id: value, format: ""})}
                >
                  <SelectTrigger data-testid="clone-job-machine-select" className="bg-background border-border text-text-primary">
                    <SelectValue placeholder="Makine seçin..." />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border">
                    {machines.map((machine) => (
                      <SelectItem
                        key={machine.id}
                        value={machine.id}
                        disabled={machine.maintenance}
                        className="text-text-primary"
                      >
                        {machine.name} {machine.maintenance && "(BAKIM)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {cloneFormData.machine_id && getFormatOptions(machines.find(m => m.id === cloneFormData.machine_id)?.name).length > 0 && (
                <div>
                  <Label className="text-text-primary">Format *</Label>
                  <Select
                    value={cloneFormData.format}
                    onValueChange={(value) => setCloneFormData({...cloneFormData, format: value})}
                  >
                    <SelectTrigger data-testid="clone-job-format-select" className="bg-background border-border text-text-primary">
                      <SelectValue placeholder="Format seçin..." />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {getFormatOptions(machines.find(m => m.id === cloneFormData.machine_id)?.name).map((format) => (
                        <SelectItem key={format} value={format} className="text-text-primary">
                          {format}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-text-primary">Not</Label>
                <Input
                  data-testid="clone-job-notes-input"
                  value={cloneFormData.notes}
                  onChange={(e) => setCloneFormData({...cloneFormData, notes: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Tahmini Teslim Tarihi</Label>
                <Input
                  data-testid="clone-job-delivery-input"
                  type="date"
                  value={cloneFormData.delivery_date}
                  onChange={(e) => setCloneFormData({...cloneFormData, delivery_date: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button
                data-testid="submit-clone-button"
                onClick={handleCloneJob}
                className="w-full bg-success text-white hover:bg-success/90"
              >
                Sıraya Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={isMachineDetailOpen} onOpenChange={setIsMachineDetailOpen}>
          <DialogContent className="bg-surface border-border max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">{selectedMachineDetail?.name} - İşler</DialogTitle>
            </DialogHeader>
            {selectedMachineDetail && (
              <div className="space-y-6">
                {(() => {
                  const currentJob = jobs.find(j => j.machine_id === selectedMachineDetail.id && j.status === "in_progress");
                  const pendingJobs = jobs.filter(j => j.machine_id === selectedMachineDetail.id && j.status === "pending");
                  
                  return (
                    <>
                      {currentJob && (
                        <div>
                          <h3 className="text-lg font-heading mb-3 text-success">Aktif İş</h3>
                          <Card className="bg-background border-success">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-heading font-bold text-text-primary">{currentJob.name}</h4>
                                  <p className="text-sm text-text-secondary">Operatör: {currentJob.operator_name}</p>
                                  <p className="text-sm text-text-secondary">Koli: {currentJob.koli_count}</p>
                                  {currentJob.format && <p className="text-sm text-text-secondary">Format: {currentJob.format}</p>}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      <div>
                        <h3 className="text-lg font-heading mb-3 text-info">Sıradaki İşler ({pendingJobs.length})</h3>
                        {pendingJobs.length === 0 ? (
                          <p className="text-text-secondary">Sırada iş yok</p>
                        ) : (
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {pendingJobs.map(job => (
                              <Card key={job.id} className="bg-background border-border">
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-heading font-bold text-text-primary">{job.name}</h4>
                                      <p className="text-sm text-text-secondary">Koli: {job.koli_count} | Renkler: {job.colors}</p>
                                      {job.format && <p className="text-sm text-text-secondary">Format: {job.format}</p>}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default PlanFlow;
