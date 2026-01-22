import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const PlanFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    koli_count: "",
    colors: "",
    machine_id: "",
    notes: "",
    delivery_date: ""
  });

  useEffect(() => {
    if (authenticated) {
      fetchMachines();
      fetchJobs();
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
      setMachines(response.data);
    } catch (error) {
      toast.error("Makineler yüklenemedi");
    }
  };

  const fetchJobs = async () => {
    try {
      const params = selectedMachine ? `?machine_id=${selectedMachine}` : "";
      const response = await axios.get(`${API}/jobs${params}`);
      setJobs(response.data);
    } catch (error) {
      toast.error("İşler yüklenemedi");
    }
  };

  const handleLogin = () => {
    if (password === "12341") {
      setAuthenticated(true);
      toast.success("Giriş başarılı!");
    } else {
      toast.error("Yanlış şifre!");
    }
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

    try {
      await axios.post(`${API}/jobs`, {
        ...formData,
        koli_count: parseInt(formData.koli_count),
        machine_name: machine.name
      });
      toast.success("İş eklendi!");
      setIsDialogOpen(false);
      setFormData({
        name: "",
        koli_count: "",
        colors: "",
        machine_id: "",
        notes: "",
        delivery_date: ""
      });
      fetchJobs();
    } catch (error) {
      toast.error("İş eklenemedi");
    }
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
            <DialogContent className="bg-surface border-border max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-heading">Yeni İş Ekle</DialogTitle>
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
                    onValueChange={(value) => setFormData({...formData, machine_id: value})}
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

        <div className="mb-6">
          <Select value={selectedMachine || "all"} onValueChange={setSelectedMachine}>
            <SelectTrigger data-testid="filter-machine-select" className="w-64 bg-surface border-border text-text-primary">
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

        <div className="space-y-4">
          {jobs.length === 0 ? (
            <Card className="bg-surface border-border">
              <CardContent className="p-8 text-center">
                <p className="text-text-secondary text-lg">Henüz iş eklenmemiş.</p>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
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
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            job.status === "completed"
                              ? "bg-success text-white"
                              : job.status === "in_progress"
                              ? "bg-warning text-black"
                              : "bg-info text-white"
                          }`}
                        >
                          {job.status === "completed" ? "Tamamlandı" : job.status === "in_progress" ? "Devam Ediyor" : "Bekliyor"}
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
      </div>
    </div>
  );
};

export default PlanFlow;
