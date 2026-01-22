import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, CheckCircle, Sun, Moon, Package } from "lucide-react";
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

  useEffect(() => {
    fetchMachines();
  }, []);

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
      const response = await axios.get(`${API}/jobs?machine_id=${selectedMachine.id}&status=pending`);
      setJobs(response.data);
    } catch (error) {
      toast.error("İşler yüklenemedi");
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
      await axios.put(`${API}/jobs/${job.id}/start`, {
        operator_name: operatorName
      });
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
    if (machineName === "24x24" || machineName === "33x33 (Büyük)") {
      return ["all", "1/4", "1/8"];
    } else if (machineName === "33x33 ICM") {
      return ["all", "33x33", "33x24"];
    }
    return ["all"];
  };

  const filteredJobs = selectedMachine
    ? jobs.filter(job => selectedFormat === "all" || job.format === selectedFormat)
    : [];

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
      <div className="max-w-6xl mx-auto">
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

        <h1 className="text-5xl font-heading font-black text-primary mb-12">
          OPERATÖR PANELİ
        </h1>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto"
          >
            <Card className="bg-surface border-border">
              <CardHeader>
                <CardTitle className="text-2xl font-heading">Adınızı Girin</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  data-testid="operator-name-input"
                  placeholder="Operatör adı..."
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
                  className="mb-4 bg-background border-border text-text-primary text-lg h-14"
                />
                <Button
                  data-testid="submit-name-button"
                  onClick={handleNameSubmit}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-14 text-lg font-heading"
                >
                  Devam Et
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-2xl font-heading mb-6 text-text-primary">Makine Seçin</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {machines.map((machine) => (
                <button
                  key={machine.id}
                  data-testid={`machine-${machine.name}`}
                  onClick={() => handleMachineSelect(machine)}
                  disabled={machine.maintenance}
                  className={`p-6 rounded-xl border-2 transition-all btn-scale ${
                    machine.maintenance
                      ? "bg-surface border-warning opacity-50 cursor-not-allowed maintenance-stripes"
                      : "bg-surface border-border machine-card-hover"
                  }`}
                >
                  <div className="text-center">
                    <h3 className="text-xl font-heading font-bold text-text-primary mb-2">
                      {machine.name}
                    </h3>
                    {machine.maintenance && (
                      <p className="text-sm text-warning font-bold">BAKIM</p>
                    )}
                    {!machine.maintenance && (
                      <p className="text-sm text-text-secondary">
                        {machine.status === "idle" ? "Boşta" : "Çalışıyor"}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-heading text-text-primary">
                {selectedMachine?.name} - İşler
              </h2>
              <div className="flex gap-2">
                <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      data-testid="warehouse-request-button"
                      className="bg-warning text-black hover:bg-warning/90"
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Depodan İstek
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-surface border-border">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-heading">Depodan Malzeme Talebi</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-text-primary">Malzeme Türü *</Label>
                        <Select value={requestType} onValueChange={setRequestType}>
                          <SelectTrigger data-testid="request-type-select" className="bg-background border-border text-text-primary">
                            <SelectValue placeholder="Seçin..." />
                          </SelectTrigger>
                          <SelectContent className="bg-surface border-border">
                            <SelectItem value="Bobin" className="text-text-primary">Bobin</SelectItem>
                            <SelectItem value="Koli" className="text-text-primary">Koli</SelectItem>
                            <SelectItem value="Diğer" className="text-text-primary">Diğer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-text-primary">Miktar *</Label>
                        <Input
                          data-testid="request-quantity-input"
                          type="number"
                          value={requestQuantity}
                          onChange={(e) => setRequestQuantity(e.target.value)}
                          className="bg-background border-border text-text-primary"
                        />
                      </div>
                      <Button
                        data-testid="submit-request-button"
                        onClick={handleWarehouseRequest}
                        className="w-full bg-warning text-black hover:bg-warning/90"
                      >
                        Talep Gönder
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  data-testid="change-machine-button"
                  className="border-border bg-surface hover:bg-surface-highlight"
                >
                  Makine Değiştir
                </Button>
              </div>
            </div>

            {getFormatOptions(selectedMachine?.name).length > 1 && (
              <div className="flex gap-2 mb-6">
                {getFormatOptions(selectedMachine?.name).map((format) => (
                  <Button
                    key={format}
                    variant={selectedFormat === format ? "default" : "outline"}
                    onClick={() => setSelectedFormat(format)}
                    data-testid={`format-filter-${format}`}
                    className={selectedFormat === format ? "bg-primary text-black" : ""}
                  >
                    {format === "all" ? "Tümü" : format}
                  </Button>
                ))}
              </div>
            )}

            {filteredJobs.length === 0 ? (
              <Card className="bg-surface border-border">
                <CardContent className="p-8 text-center">
                  <p className="text-text-secondary text-lg">Bu makine için bekleyen iş yok.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredJobs.map((job) => (
                  <Card key={job.id} className="bg-surface border-border" data-testid={`job-${job.id}`}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-heading font-bold text-text-primary">
                              {job.name}
                            </h3>
                            {job.format && (
                              <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-mono rounded">
                                {job.format}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 text-text-secondary">
                            <p><span className="font-semibold">Koli:</span> {job.koli_count}</p>
                            <p><span className="font-semibold">Renkler:</span> {job.colors}</p>
                            {job.notes && <p><span className="font-semibold">Not:</span> {job.notes}</p>}
                            {job.delivery_date && (
                              <p><span className="font-semibold">Teslim:</span> {job.delivery_date}</p>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          {job.status === "pending" && (
                            <Button
                              data-testid={`start-job-${job.id}`}
                              onClick={() => handleStartJob(job)}
                              disabled={loading}
                              className="bg-success text-white hover:bg-success/90"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Başlat
                            </Button>
                          )}
                          {job.status === "in_progress" && job.operator_name === operatorName && (
                            <Button
                              data-testid={`complete-job-${job.id}`}
                              onClick={() => handleCompleteJob(job)}
                              disabled={loading}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Tamamla
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default OperatorFlow;
