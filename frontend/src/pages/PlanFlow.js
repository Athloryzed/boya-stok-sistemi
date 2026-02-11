import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Sun, Moon, Search, Copy, Trash2, Edit, MessageSquare, Send, Inbox, Check, Truck, MapPin, Phone, Package, Image, Upload, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";

const PlanFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [allJobs, setAllJobs] = useState([]); // Tüm işler (makine durumları için)
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [jobToClone, setJobToClone] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [isMachineDetailOpen, setIsMachineDetailOpen] = useState(false);
  const [selectedMachineDetail, setSelectedMachineDetail] = useState(null);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [selectedMachineForMessage, setSelectedMachineForMessage] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [incomingMessages, setIncomingMessages] = useState([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [isEditJobOpen, setIsEditJobOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: "", koli_count: "", colors: "", format: "", notes: "", delivery_date: "", delivery_address: "", delivery_phone: ""
  });
  
  // Sevkiyat state'leri
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newDriverData, setNewDriverData] = useState({ name: "", password: "", phone: "" });
  const [shipmentFormData, setShipmentFormData] = useState({
    vehicle_id: "", vehicle_plate: "", driver_id: "", driver_name: "",
    delivery_address: "", delivery_phone: "", delivery_notes: "", total_koli: 0, pallet_ids: []
  });
  const [palletSearch, setPalletSearch] = useState("");
  const [searchedPallets, setSearchedPallets] = useState([]);
  const [selectedShipmentPallets, setSelectedShipmentPallets] = useState([]);
  
  const [formData, setFormData] = useState({
    name: "",
    koli_count: "",
    colors: "",
    machine_id: "",
    format: "",
    notes: "",
    delivery_date: "",
    delivery_address: "",
    delivery_phone: "",
    image_url: ""
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

  // Görsel yükleme state'leri
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [selectedJobImage, setSelectedJobImage] = useState(null);

  // Oturum kontrolü
  useEffect(() => {
    const savedSession = localStorage.getItem("plan_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setUserData(session);
        setAuthenticated(true);
      } catch (e) {
        localStorage.removeItem("plan_session");
      }
    }
  }, []);

  useEffect(() => {
    if (authenticated) {
      fetchMachines();
      fetchJobs();
      fetchAllJobs(); // Makine durumları için tüm işler
      fetchCompletedJobs();
      fetchIncomingMessages();
      fetchVehicles();
      fetchDrivers();
      fetchShipments();
      fetchPallets();
      
      // Mesajları ve işleri periyodik olarak kontrol et
      const interval = setInterval(() => {
        fetchIncomingMessages();
        fetchShipments();
        fetchAllJobs(); // Makine durumlarını güncelle
      }, 10000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  useEffect(() => {
    if (selectedMachine) {
      fetchJobs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMachine]);

  // Sevkiyat veri çekme fonksiyonları
  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`);
      setVehicles(response.data);
    } catch (error) {
      console.error("Araçlar yüklenemedi:", error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await axios.get(`${API}/drivers`);
      setDrivers(response.data);
    } catch (error) {
      console.error("Şoförler yüklenemedi:", error);
    }
  };

  const fetchShipments = async () => {
    try {
      const response = await axios.get(`${API}/shipments`);
      setShipments(response.data);
    } catch (error) {
      console.error("Sevkiyatlar yüklenemedi:", error);
    }
  };

  const fetchPallets = async () => {
    try {
      const response = await axios.get(`${API}/pallets?status=in_warehouse`);
      setPallets(response.data);
    } catch (error) {
      console.error("Paletler yüklenemedi:", error);
    }
  };

  const searchPallets = async (query) => {
    if (!query.trim()) {
      setSearchedPallets([]);
      return;
    }
    try {
      const response = await axios.get(`${API}/pallets/search?q=${encodeURIComponent(query)}`);
      setSearchedPallets(response.data.filter(p => p.status === "in_warehouse"));
    } catch (error) {
      console.error("Palet arama hatası:", error);
    }
  };

  // Görsel yükleme fonksiyonu
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Dosya boyutu 5MB'dan küçük olmalıdır");
      return;
    }
    
    setUploadingImage(true);
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    
    try {
      const response = await axios.post(`${API}/upload/image`, uploadFormData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const imageUrl = response.data.url;
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
      setPreviewImage(imageUrl);
      toast.success("Görsel yüklendi!");
    } catch (error) {
      toast.error("Görsel yüklenemedi");
      console.error("Upload error:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const clearImage = () => {
    setFormData(prev => ({ ...prev, image_url: "" }));
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openImagePreview = (imageUrl) => {
    setSelectedJobImage(imageUrl);
    setIsImagePreviewOpen(true);
  };

  const handleAddVehicle = async () => {
    if (!newVehiclePlate.trim()) {
      toast.error("Plaka giriniz");
      return;
    }
    try {
      await axios.post(`${API}/vehicles`, { plate: newVehiclePlate });
      toast.success("Araç eklendi!");
      setNewVehiclePlate("");
      setIsVehicleDialogOpen(false);
      fetchVehicles();
    } catch (error) {
      toast.error("Araç eklenemedi");
    }
  };

  const handleAddDriver = async () => {
    if (!newDriverData.name || !newDriverData.password) {
      toast.error("İsim ve şifre zorunludur");
      return;
    }
    try {
      await axios.post(`${API}/drivers`, newDriverData);
      toast.success("Şoför eklendi!");
      setNewDriverData({ name: "", password: "", phone: "" });
      setIsDriverDialogOpen(false);
      fetchDrivers();
    } catch (error) {
      toast.error("Şoför eklenemedi");
    }
  };

  const handleCreateShipment = async () => {
    if (!shipmentFormData.vehicle_id || !shipmentFormData.delivery_address) {
      toast.error("Araç ve teslimat adresi zorunludur");
      return;
    }
    try {
      await axios.post(`${API}/shipments`, {
        ...shipmentFormData,
        pallet_ids: selectedShipmentPallets.map(p => p.id),
        total_koli: shipmentFormData.total_koli || selectedShipmentPallets.reduce((sum, p) => sum + p.koli_count, 0),
        created_by: "plan"
      });
      toast.success("Sevkiyat oluşturuldu!");
      setIsShipmentDialogOpen(false);
      setShipmentFormData({
        vehicle_id: "", vehicle_plate: "", driver_id: "", driver_name: "",
        delivery_address: "", delivery_phone: "", delivery_notes: "", total_koli: 0, pallet_ids: []
      });
      setSelectedShipmentPallets([]);
      fetchShipments();
      fetchPallets();
    } catch (error) {
      toast.error("Sevkiyat oluşturulamadı");
    }
  };

  const handleDeleteShipment = async (shipmentId) => {
    if (!window.confirm("Bu sevkiyatı silmek istediğinize emin misiniz?")) return;
    try {
      await axios.delete(`${API}/shipments/${shipmentId}`);
      toast.success("Sevkiyat silindi");
      fetchShipments();
      fetchPallets();
    } catch (error) {
      toast.error("Sevkiyat silinemedi");
    }
  };

  const addPalletToShipment = (pallet) => {
    if (!selectedShipmentPallets.find(p => p.id === pallet.id)) {
      setSelectedShipmentPallets([...selectedShipmentPallets, pallet]);
    }
    setPalletSearch("");
    setSearchedPallets([]);
  };

  const removePalletFromShipment = (palletId) => {
    setSelectedShipmentPallets(selectedShipmentPallets.filter(p => p.id !== palletId));
  };

  const getShipmentStatusColor = (status) => {
    switch (status) {
      case "preparing": return "text-yellow-500 bg-yellow-500/10";
      case "in_transit": return "text-blue-500 bg-blue-500/10";
      case "delivered": return "text-green-500 bg-green-500/10";
      case "failed": return "text-red-500 bg-red-500/10";
      default: return "text-text-secondary";
    }
  };

  const getShipmentStatusText = (status) => {
    switch (status) {
      case "preparing": return "Hazırlanıyor";
      case "in_transit": return "Yolda";
      case "delivered": return "Teslim Edildi";
      case "failed": return "Teslim Edilemedi";
      default: return status;
    }
  };

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

  // Tüm işleri çek (makine durumları için - pending + in_progress)
  const fetchAllJobs = async () => {
    try {
      const response = await axios.get(`${API}/jobs`);
      setAllJobs(response.data.filter(j => j.status === "pending" || j.status === "in_progress"));
    } catch (error) {
      console.error("Tüm işler yüklenemedi");
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

  const fetchIncomingMessages = async () => {
    try {
      const [messagesRes, unreadRes] = await Promise.all([
        axios.get(`${API}/messages/all/incoming`),
        axios.get(`${API}/messages/all/unread-count`)
      ]);
      setIncomingMessages(messagesRes.data);
      setUnreadMessagesCount(unreadRes.data.unread_count);
    } catch (error) {
      console.error("Messages fetch error:", error);
    }
  };

  const handleMarkMessageRead = async (messageId) => {
    try {
      await axios.put(`${API}/messages/mark-read/${messageId}`);
      fetchIncomingMessages();
    } catch (error) {
      console.error("Mark read error:", error);
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

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Kullanıcı adı ve şifre gerekli");
      return;
    }
    try {
      const response = await axios.post(`${API}/users/login`, {
        username: username,
        password: password,
        role: "plan"
      });
      const user = response.data;
      setUserData(user);
      localStorage.setItem("plan_session", JSON.stringify(user));
      setAuthenticated(true);
      toast.success("Giriş başarılı!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Giriş başarısız");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("plan_session");
    setUserData(null);
    setAuthenticated(false);
    setUsername("");
    setPassword("");
    toast.success("Çıkış yapıldı");
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
        sender_role: "plan",
        sender_name: "Plan",
        message: messageText
      });
      toast.success("Mesaj gönderildi!");
      setIsMessageDialogOpen(false);
      setMessageText("");
    } catch (error) {
      toast.error("Mesaj gönderilemedi");
    }
  };

  const openEditJob = (job) => {
    setJobToEdit(job);
    setEditFormData({
      name: job.name,
      koli_count: job.koli_count.toString(),
      colors: job.colors,
      format: job.format || "",
      notes: job.notes || "",
      delivery_date: job.delivery_date || ""
    });
    setIsEditJobOpen(true);
  };

  const handleUpdateJob = async () => {
    if (!editFormData.name || !editFormData.koli_count || !editFormData.colors) {
      toast.error("Lütfen zorunlu alanları doldurun");
      return;
    }
    try {
      await axios.put(`${API}/jobs/${jobToEdit.id}`, {
        name: editFormData.name,
        koli_count: parseInt(editFormData.koli_count),
        colors: editFormData.colors,
        format: editFormData.format || null,
        notes: editFormData.notes,
        delivery_date: editFormData.delivery_date
      });
      toast.success("İş güncellendi!");
      setIsEditJobOpen(false);
      setJobToEdit(null);
      fetchJobs();
      fetchCompletedJobs();
    } catch (error) {
      toast.error("İş güncellenemedi");
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Bu işi silmek istediğinizden emin misiniz?")) return;
    try {
      await axios.delete(`${API}/jobs/${jobId}`);
      toast.success("İş silindi!");
      fetchJobs();
      fetchCompletedJobs();
    } catch (error) {
      toast.error("İş silinemedi");
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
        format: formatOptions.length > 0 ? formData.format : null,
        image_url: formData.image_url || null
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
        delivery_date: "",
        delivery_address: "",
        delivery_phone: "",
        image_url: ""
      });
      setPreviewImage(null);
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
            <CardContent className="space-y-4">
              <div>
                <Label className="text-text-primary">Kullanıcı Adı</Label>
                <Input
                  data-testid="plan-username-input"
                  placeholder="Kullanıcı adı..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 bg-background border-border text-text-primary text-lg h-14"
                />
              </div>
              <div>
                <Label className="text-text-primary">Şifre</Label>
                <Input
                  data-testid="plan-password-input"
                  type="password"
                  placeholder="Şifre..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                  className="mt-1 bg-background border-border text-text-primary text-lg h-14"
                />
              </div>
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
                className="w-full border-border bg-background hover:bg-surface-highlight"
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

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-4xl sm:text-5xl font-heading font-black text-success">
            PLANLAMA PANELİ
          </h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="add-job-button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
              >
                <Plus className="mr-2 h-5 w-5" />
                Yeni İş Ekle
              </Button>
            </DialogTrigger>
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
                
                {/* Görsel Yükleme */}
                <div>
                  <Label className="text-text-primary">İş Görseli (Opsiyonel)</Label>
                  <div className="mt-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      data-testid="job-image-input"
                    />
                    {!previewImage ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="w-full border-dashed border-2 h-24 flex flex-col items-center justify-center gap-2"
                      >
                        {uploadingImage ? (
                          <span className="text-text-secondary">Yükleniyor...</span>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-text-secondary" />
                            <span className="text-text-secondary text-sm">Görsel Yükle</span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="relative">
                        <img 
                          src={`${API.replace('/api', '')}${previewImage}`} 
                          alt="Preview" 
                          className="w-full h-32 object-cover rounded-lg border border-border"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={clearImage}
                          className="absolute top-2 right-2"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
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

        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-heading font-bold text-text-primary mb-4">Makine Durumları</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {machines.map((machine) => {
              const currentJob = allJobs.find(j => j.machine_id === machine.id && j.status === "in_progress");
              const pendingCount = allJobs.filter(j => j.machine_id === machine.id && j.status === "pending").length;
              
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
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm md:text-lg font-heading font-bold text-text-primary mb-1 md:mb-2 truncate flex-1">
                        {machine.name}
                      </h3>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); openMessageDialog(machine); }}
                        className="h-6 w-6 p-0 text-blue-500 hover:bg-blue-500/10"
                        data-testid={`message-${machine.name}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                    {machine.maintenance ? (
                      <p className="text-xs md:text-sm text-warning font-semibold">BAKIM</p>
                    ) : currentJob ? (
                      <div className="space-y-0.5 md:space-y-1">
                        <p className="text-xs md:text-sm text-success font-semibold">ÇALIŞIYOR</p>
                        <p className="text-xs text-text-secondary truncate">{currentJob.name}</p>
                        <p className="text-xs text-text-secondary truncate">Op: {currentJob.operator_name}</p>
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

        <Tabs defaultValue="pending" className="space-y-6">
          {/* Mobile: 2x2 grid, Desktop: horizontal */}
          <div className="block md:hidden">
            <TabsList className="bg-surface border-border w-full grid grid-cols-2 gap-1 h-auto p-1">
              <TabsTrigger value="pending" data-testid="pending-jobs-tab-mobile" className="data-[state=active]:bg-success data-[state=active]:text-white text-xs py-2">
                İşler
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="completed-jobs-tab-mobile" className="data-[state=active]:bg-success data-[state=active]:text-white text-xs py-2">
                Geçmiş
              </TabsTrigger>
              <TabsTrigger value="shipments" data-testid="shipments-tab-mobile" className="data-[state=active]:bg-success data-[state=active]:text-white text-xs py-2">
                <Truck className="h-3 w-3 mr-1" /> Sevkiyat
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="messages-tab-mobile" className="data-[state=active]:bg-success data-[state=active]:text-white text-xs py-2 relative">
                Mesaj
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center text-[10px]">
                    {unreadMessagesCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          {/* Desktop */}
          <div className="hidden md:block">
            <TabsList className="bg-surface border-border w-full grid grid-cols-4">
              <TabsTrigger value="pending" data-testid="pending-jobs-tab" className="data-[state=active]:bg-success data-[state=active]:text-white text-sm md:text-base">
                Sıradaki İşler
              </TabsTrigger>
              <TabsTrigger value="completed" data-testid="completed-jobs-tab" className="data-[state=active]:bg-success data-[state=active]:text-white text-sm md:text-base">
                Geçmiş İşler
              </TabsTrigger>
              <TabsTrigger value="shipments" data-testid="shipments-tab" className="data-[state=active]:bg-success data-[state=active]:text-white text-sm md:text-base">
                <Truck className="h-4 w-4 mr-1" /> Sevkiyat
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="messages-tab" className="data-[state=active]:bg-success data-[state=active]:text-white text-sm md:text-base relative">
                <Inbox className="h-4 w-4 mr-1 hidden md:inline" /> Mesajlar
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadMessagesCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
                <Input
                  data-testid="search-jobs-input"
                  placeholder="İş ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-surface border-border text-text-primary h-12 text-base"
                />
              </div>
            </div>
            <Select value={selectedMachine || "all"} onValueChange={setSelectedMachine}>
              <SelectTrigger data-testid="filter-machine-select" className="w-full bg-surface border-border text-text-primary h-12">
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

          {/* SEVKİYAT TAB */}
          <TabsContent value="shipments">
            <div className="space-y-6">
              {/* Üst butonlar */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setIsShipmentDialogOpen(true)} className="bg-success hover:bg-success/90 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Yeni Sevkiyat
                </Button>
                <Button variant="outline" onClick={() => setIsVehicleDialogOpen(true)}>
                  <Truck className="h-4 w-4 mr-1" /> Araç Ekle
                </Button>
                <Button variant="outline" onClick={() => setIsDriverDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Şoför Ekle
                </Button>
              </div>

              {/* Araç listesi */}
              <Card className="bg-surface border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5" /> Araçlar ({vehicles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {vehicles.map(v => (
                      <span key={v.id} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                        {v.plate}
                      </span>
                    ))}
                    {vehicles.length === 0 && <p className="text-text-secondary text-sm">Henüz araç eklenmemiş</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Şoför listesi */}
              <Card className="bg-surface border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Şoförler ({drivers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {drivers.map(d => (
                      <span key={d.id} className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm">
                        {d.name} {d.phone && `(${d.phone})`}
                      </span>
                    ))}
                    {drivers.length === 0 && <p className="text-text-secondary text-sm">Henüz şoför eklenmemiş</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Sevkiyat listesi */}
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Package className="h-5 w-5" /> Sevkiyatlar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {shipments.length === 0 ? (
                    <p className="text-text-secondary text-center py-4">Henüz sevkiyat oluşturulmamış</p>
                  ) : (
                    <div className="space-y-3">
                      {shipments.map(shipment => (
                        <div key={shipment.id} className="p-4 bg-background rounded-lg border border-border">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-lg">{shipment.vehicle_plate}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${getShipmentStatusColor(shipment.status)}`}>
                                  {getShipmentStatusText(shipment.status)}
                                </span>
                              </div>
                              {shipment.driver_name && (
                                <p className="text-sm text-text-secondary">Şoför: {shipment.driver_name}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-primary">{shipment.total_koli} Koli</p>
                              <p className="text-xs text-text-secondary">{shipment.pallets?.length || 0} Palet</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 mt-2">
                            <MapPin className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-text-primary">{shipment.delivery_address}</p>
                          </div>
                          {shipment.delivery_phone && (
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="h-4 w-4 text-text-secondary" />
                              <p className="text-sm text-blue-400">{shipment.delivery_phone}</p>
                            </div>
                          )}
                          {shipment.status === "failed" && shipment.delivery_status_reason && (
                            <p className="mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded">
                              Sebep: {shipment.delivery_status_reason}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            {shipment.status === "preparing" && (
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteShipment(shipment.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
                              <span className="text-xs px-2 py-0.5 bg-success/20 text-success rounded-full">{msg.machine_name}</span>
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
                            {job.image_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openImagePreview(job.image_url)}
                                className="text-secondary border-secondary/50"
                              >
                                <Image className="h-4 w-4" />
                              </Button>
                            )}
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
                        {/* Düzenle ve Sil Butonları */}
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditJob(job)}
                            className="text-blue-500 border-blue-500 hover:bg-blue-500/10"
                            data-testid={`edit-job-${job.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            <span className="hidden md:inline">Düzenle</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteJob(job.id)}
                            className="text-red-500 border-red-500 hover:bg-red-500/10"
                            data-testid={`delete-job-${job.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            <span className="hidden md:inline">Sil</span>
                          </Button>
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

        {/* İŞ DÜZENLEME DIALOG */}
        <Dialog open={isEditJobOpen} onOpenChange={setIsEditJobOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">İş Düzenle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-text-primary">İş Adı *</Label>
                <Input
                  data-testid="edit-job-name-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Koli Sayısı *</Label>
                <Input
                  data-testid="edit-job-koli-input"
                  type="number"
                  value={editFormData.koli_count}
                  onChange={(e) => setEditFormData({...editFormData, koli_count: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Renkler *</Label>
                <Input
                  data-testid="edit-job-colors-input"
                  value={editFormData.colors}
                  onChange={(e) => setEditFormData({...editFormData, colors: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Format</Label>
                <Input
                  data-testid="edit-job-format-input"
                  value={editFormData.format}
                  onChange={(e) => setEditFormData({...editFormData, format: e.target.value})}
                  placeholder="Opsiyonel"
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Not</Label>
                <Input
                  data-testid="edit-job-notes-input"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <div>
                <Label className="text-text-primary">Tahmini Teslim Tarihi</Label>
                <Input
                  data-testid="edit-job-delivery-input"
                  type="date"
                  value={editFormData.delivery_date}
                  onChange={(e) => setEditFormData({...editFormData, delivery_date: e.target.value})}
                  className="bg-background border-border text-text-primary"
                />
              </div>
              <Button
                data-testid="submit-edit-button"
                onClick={handleUpdateJob}
                className="w-full bg-success text-white hover:bg-success/90"
              >
                Güncelle
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Araç Ekleme Dialog */}
        <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading">Yeni Araç Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Plaka *</Label>
                <Input
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="34 ABC 123"
                  className="bg-background border-border"
                  data-testid="new-vehicle-plate-input"
                />
              </div>
              <Button onClick={handleAddVehicle} className="w-full bg-success hover:bg-success/90 text-white">
                Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Şoför Ekleme Dialog */}
        <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
          <DialogContent className="bg-surface border-border">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading">Yeni Şoför Ekle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>İsim *</Label>
                <Input
                  value={newDriverData.name}
                  onChange={(e) => setNewDriverData({...newDriverData, name: e.target.value})}
                  placeholder="Şoför adı"
                  className="bg-background border-border"
                  data-testid="new-driver-name-input"
                />
              </div>
              <div>
                <Label>Şifre *</Label>
                <Input
                  type="password"
                  value={newDriverData.password}
                  onChange={(e) => setNewDriverData({...newDriverData, password: e.target.value})}
                  placeholder="Giriş şifresi"
                  className="bg-background border-border"
                  data-testid="new-driver-password-input"
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={newDriverData.phone}
                  onChange={(e) => setNewDriverData({...newDriverData, phone: e.target.value})}
                  placeholder="05XX XXX XX XX"
                  className="bg-background border-border"
                />
              </div>
              <Button onClick={handleAddDriver} className="w-full bg-success hover:bg-success/90 text-white">
                Ekle
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sevkiyat Oluşturma Dialog */}
        <Dialog open={isShipmentDialogOpen} onOpenChange={setIsShipmentDialogOpen}>
          <DialogContent className="bg-surface border-border max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-heading">Yeni Sevkiyat Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Araç *</Label>
                  <Select 
                    value={shipmentFormData.vehicle_id} 
                    onValueChange={(value) => {
                      const vehicle = vehicles.find(v => v.id === value);
                      setShipmentFormData({
                        ...shipmentFormData, 
                        vehicle_id: value,
                        vehicle_plate: vehicle?.plate || ""
                      });
                    }}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Araç seçin" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Şoför</Label>
                  <Select 
                    value={shipmentFormData.driver_id} 
                    onValueChange={(value) => {
                      const driver = drivers.find(d => d.id === value);
                      setShipmentFormData({
                        ...shipmentFormData, 
                        driver_id: value,
                        driver_name: driver?.name || ""
                      });
                    }}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Şoför seçin (opsiyonel)" />
                    </SelectTrigger>
                    <SelectContent className="bg-surface border-border">
                      {drivers.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Teslimat Adresi *</Label>
                <Textarea
                  value={shipmentFormData.delivery_address}
                  onChange={(e) => setShipmentFormData({...shipmentFormData, delivery_address: e.target.value})}
                  placeholder="Tam adres..."
                  className="bg-background border-border"
                  data-testid="shipment-address-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telefon</Label>
                  <Input
                    value={shipmentFormData.delivery_phone}
                    onChange={(e) => setShipmentFormData({...shipmentFormData, delivery_phone: e.target.value})}
                    placeholder="05XX XXX XX XX"
                    className="bg-background border-border"
                  />
                </div>
                <div>
                  <Label>Koli Sayısı (manuel)</Label>
                  <Input
                    type="number"
                    value={shipmentFormData.total_koli}
                    onChange={(e) => setShipmentFormData({...shipmentFormData, total_koli: parseInt(e.target.value) || 0})}
                    placeholder="Toplam koli"
                    className="bg-background border-border"
                  />
                </div>
              </div>

              <div>
                <Label>Notlar</Label>
                <Textarea
                  value={shipmentFormData.delivery_notes}
                  onChange={(e) => setShipmentFormData({...shipmentFormData, delivery_notes: e.target.value})}
                  placeholder="Ek notlar..."
                  className="bg-background border-border"
                />
              </div>

              {/* Palet Arama ve Ekleme */}
              <div>
                <Label>Palet Ekle (Opsiyonel)</Label>
                <div className="relative">
                  <Input
                    value={palletSearch}
                    onChange={(e) => {
                      setPalletSearch(e.target.value);
                      searchPallets(e.target.value);
                    }}
                    placeholder="Palet kodu veya iş adı ile ara..."
                    className="bg-background border-border"
                  />
                  {searchedPallets.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {searchedPallets.map(pallet => (
                        <div
                          key={pallet.id}
                          className="p-2 hover:bg-background cursor-pointer border-b border-border last:border-0"
                          onClick={() => addPalletToShipment(pallet)}
                        >
                          <p className="font-semibold">{pallet.code}</p>
                          <p className="text-xs text-text-secondary">{pallet.job_name} - {pallet.koli_count} koli</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Seçilen Paletler */}
              {selectedShipmentPallets.length > 0 && (
                <div>
                  <Label>Seçilen Paletler ({selectedShipmentPallets.length})</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedShipmentPallets.map(pallet => (
                      <div key={pallet.id} className="flex justify-between items-center p-2 bg-background rounded">
                        <span className="text-sm">{pallet.code} - {pallet.koli_count} koli</span>
                        <Button size="sm" variant="ghost" onClick={() => removePalletFromShipment(pallet.id)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    Toplam: {selectedShipmentPallets.reduce((sum, p) => sum + p.koli_count, 0)} koli
                  </p>
                </div>
              )}

              <Button onClick={handleCreateShipment} className="w-full bg-success hover:bg-success/90 text-white">
                Sevkiyat Oluştur
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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

      </div>
    </div>
  );
};

export default PlanFlow;
