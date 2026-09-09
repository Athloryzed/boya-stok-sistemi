import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Sun, Moon, LogOut, Brush, Play, CheckCircle2, GripVertical, Pause,
  Clock, User, Factory, StickyNote, Package, RefreshCw, Paintbrush, Search, X,
  Plus, RotateCcw,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import UserMenu from "../components/UserMenu";
import AIAssistant from "../components/AIAssistant";
import HeaderActionsMenu from "../components/HeaderActionsMenu";
import JobThumb from "../components/JobThumb";
import { ExpectedKoliCard } from "../components/ExpectedKoliSummary";
import { useConfirm } from "../components/ConfirmProvider";
import { resumeCentralSession, clearSession } from "../lib/auth";
import { minutesAgo } from "../lib/utils";

const arr = (v) => (Array.isArray(v) ? v : []);

const daysWaiting = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d < 0 ? 0 : d;
};

const WaitingBadge = ({ job }) => {
  const d = daysWaiting(job.created_at);
  if (d === null) return null;
  const tone = d >= 7 ? "bg-error/15 text-error border-error/30"
    : d >= 3 ? "bg-warning/15 text-warning border-warning/30"
    : "bg-surface-highlight/60 text-text-secondary border-border";
  return (
    <span data-testid={`boyaci-waiting-${job.id}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${tone}`}>
      <Clock className="h-3 w-3" /> {d === 0 ? "bugün geldi" : `${d} gündür bekliyor`}
    </span>
  );
};

const JobMeta = ({ job }) => (
  <div className="mt-1.5 space-y-1">
    <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary">
      {job.customer_name && (
        <span className="inline-flex items-center gap-1" data-testid={`boyaci-customer-${job.id}`}>
          <User className="h-3 w-3" /> {job.customer_name}
        </span>
      )}
      {job.machine_name && (
        <span className="inline-flex items-center gap-1">
          <Factory className="h-3 w-3" /> {job.machine_name}
        </span>
      )}
      {job.format && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 text-[11px] font-semibold"
          data-testid={`boyaci-format-${job.id}`}>
          {job.format}
        </span>
      )}
      {job.colors && <span className="inline-flex items-center gap-1"><Paintbrush className="h-3 w-3" /> {job.colors}</span>}
      <WaitingBadge job={job} />
    </div>
    {job.notes && (
      <p className="text-xs text-amber-300/90 flex items-start gap-1" data-testid={`boyaci-note-${job.id}`}>
        <StickyNote className="h-3 w-3 mt-0.5 shrink-0" /> <span>{job.notes}</span>
      </p>
    )}
  </div>
);

const SortableRow = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="relative"
    >
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          data-testid={`boyaci-drag-${id}`}
          className="shrink-0 px-1.5 rounded-lg text-text-secondary hover:text-primary hover:bg-surface-highlight/60 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Sırayı değiştir"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
};

const BoyaciFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [userData, setUserData] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [machines, setMachines] = useState([]);
  const [operators, setOperators] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [startTarget, setStartTarget] = useState(null);
  const [selectedOperator, setSelectedOperator] = useState("");
  const [customOperator, setCustomOperator] = useState("");
  const [previewJob, setPreviewJob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [pauseTarget, setPauseTarget] = useState(null);
  const [pauseReason, setPauseReason] = useState("");
  const [pauseProducedKoli, setPauseProducedKoli] = useState("");

  const [filterMachine, setFilterMachine] = useState("all");
  const [filterFormat, setFilterFormat] = useState("all");
  const [search, setSearch] = useState("");

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  useEffect(() => {
    const central = resumeCentralSession("/boyaci");
    if (central) {
      setUserData(central);
      setAuthenticated(true);
    } else {
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [j, m, o, s] = await Promise.allSettled([
        axios.get(`${API}/jobs`),
        axios.get(`${API}/machines`),
        axios.get(`${API}/users?role=operator`),
        axios.get(`${API}/jobs/expected-summary`),
      ]);
      if (j.status === "fulfilled") setJobs(arr(j.value.data));
      if (m.status === "fulfilled") setMachines(arr(m.value.data));
      if (o.status === "fulfilled") setOperators(arr(o.value.data));
      if (s.status === "fulfilled") setSummary(s.value.data);
    } catch (e) {
      console.error("boyaci fetch:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => clearInterval(i);
  }, [authenticated, fetchData]);

  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === "in_progress" || j.status === "paused"),
    [jobs]
  );
  const pendingJobs = useMemo(
    () => jobs.filter((j) => j.status === "pending").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [jobs]
  );
  const queueJobs = useMemo(
    () => jobs.filter((j) => ["pending", "in_progress", "paused"].includes(j.status)),
    [jobs]
  );

  // Filtre seçenekleri — işlerde ve makinelerde gerçekten var olan değerlerden türetilir
  const machineOptions = useMemo(() => {
    const fromJobs = new Set(jobs.filter((j) => j.status === "pending").map((j) => j.machine_id).filter(Boolean));
    return machines.filter((m) => fromJobs.has(m.id));
  }, [jobs, machines]);

  const formatOptions = useMemo(() => {
    const set = new Set(
      jobs.filter((j) => j.status === "pending" && j.format).map((j) => j.format)
    );
    return [...set].sort();
  }, [jobs]);

  const filteredPending = useMemo(() => pendingJobs.filter((j) => {
    if (filterMachine !== "all" && j.machine_id !== filterMachine) return false;
    if (filterFormat !== "all" && (j.format || "") !== filterFormat) return false;
    if (search) {
      const q = search.toLowerCase();
      return (j.name || "").toLowerCase().includes(q)
        || (j.customer_name || "").toLowerCase().includes(q)
        || (j.colors || "").toLowerCase().includes(q)
        || (j.notes || "").toLowerCase().includes(q);
    }
    return true;
  }), [pendingJobs, filterMachine, filterFormat, search]);

  const filtersActive = filterMachine !== "all" || filterFormat !== "all" || !!search;

  const openPreview = async (job) => {
    setPreviewJob(job);
    if (job.image_url) { setPreviewUrl(job.image_url); return; }
    setPreviewUrl(job.thumb_url || null);
    if (job.has_image) {
      try {
        const res = await axios.get(`${API}/jobs/${job.id}/image`);
        if (res.data?.image_url) setPreviewUrl(res.data.image_url);
      } catch (_) { /* thumb ile devam */ }
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredPending.findIndex((j) => j.id === active.id);
    const newIndex = filteredPending.findIndex((j) => j.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSubset = arrayMove(filteredPending, oldIndex, newIndex);
    // Filtre açıkken bile global sıra bozulmasın: filtrelenen işlerin GLOBAL slotlarına
    // yeni sıralarıyla yerleştirilir, diğer işlerin yeri korunur.
    const slots = pendingJobs
      .map((j, idx) => (filteredPending.some((f) => f.id === j.id) ? idx : -1))
      .filter((idx) => idx !== -1);
    const newGlobal = [...pendingJobs];
    slots.forEach((slotIdx, i) => { newGlobal[slotIdx] = reorderedSubset[i]; });

    const orderMap = new Map(newGlobal.map((j, idx) => [j.id, idx]));
    setJobs((prev) => prev.map((j) => (orderMap.has(j.id) ? { ...j, order: orderMap.get(j.id) } : j)));

    try {
      await axios.put(`${API}/jobs/reorder-batch`, {
        jobs: newGlobal.map((j, idx) => ({ job_id: j.id, order: idx })),
      });
      toast.success("Sıra güncellendi — tüm panellere yansıdı");
    } catch {
      toast.error("Sıralama kaydedilemedi");
      fetchData();
    }
  };

  const openStartDialog = (job) => {
    setStartTarget(job);
    setSelectedOperator("");
    setCustomOperator("");
  };

  const handleStart = async () => {
    const operatorName = (selectedOperator === "__custom__" ? customOperator : selectedOperator).trim();
    if (!operatorName) {
      toast.error("Operatör seçimi zorunlu");
      return;
    }
    const job = startTarget;
    try {
      await axios.put(`${API}/jobs/${job.id}/start`, { operator_name: operatorName });
      setStartTarget(null);
      toast.success(`${job.name} başlatıldı · ${operatorName}`);
      fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İş başlatılamadı");
    }
  };

  const handleComplete = async (job) => {
    const ok = await confirm({
      title: "İşi tamamla?",
      description: `"${job.name}" tamamlandı olarak işaretlenecek.`,
      details: `Makine: ${job.machine_name || "—"} · Hedef: ${job.koli_count || 0} koli · Üretilen: ${job.completed_koli || 0} koli`,
      confirmText: "Tamamla",
      variant: "warning",
    });
    if (!ok) return;
    try {
      await axios.put(`${API}/jobs/${job.id}/complete`, {});
      toast.success("İş tamamlandı");
      fetchData();
    } catch {
      toast.error("İş tamamlanamadı");
      fetchData();
    }
  };

  const openPauseDialog = (job) => {
    setPauseTarget(job);
    setPauseReason("");
    setPauseProducedKoli("");
  };

  const handlePause = async () => {
    if (!pauseTarget || !pauseReason) {
      toast.error("Durdurma sebebi gerekli");
      return;
    }
    try {
      await axios.put(`${API}/jobs/${pauseTarget.id}/pause`, {
        pause_reason: pauseReason,
        produced_koli: parseInt(pauseProducedKoli) || 0,
      });
      toast.success("İş durduruldu");
      setPauseTarget(null);
      fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İş durdurulamadı");
    }
  };

  const handleResume = async (job) => {
    try {
      await axios.put(`${API}/jobs/${job.id}/resume`, { operator_name: job.operator_name });
      toast.success("İşe devam edildi");
      fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İşe devam edilemedi");
    }
  };

  const handleAddProgress = async (job) => {
    try {
      await axios.post(`${API}/jobs/${job.id}/progress`, { amount: 5 });
      fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Ara giriş kaydedilemedi");
    }
  };

  const handleUndoProgress = async (job) => {
    try {
      const res = await axios.delete(`${API}/jobs/${job.id}/progress/last`);
      toast.info(`Son giriş geri alındı (-${res.data?.amount ?? 5})`);
      fetchData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Geri alınacak giriş yok");
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  if (!authenticated) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        {/* Top bar */}
        <div className="flex justify-between items-center gap-2 mb-6 min-w-0">
          <Button variant="outline" size="icon" onClick={() => navigate("/")} data-testid="boyaci-back-btn" className="h-9 w-9 xl:w-auto xl:px-3 shrink-0">
            <ArrowLeft className="h-4 w-4 xl:mr-2" />
            <span className="hidden xl:inline">Ana Sayfa</span>
          </Button>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button variant="outline" size="icon" onClick={fetchData} data-testid="boyaci-refresh-btn" className="h-9 w-9">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <HeaderActionsMenu
              items={[
                { id: "paint", label: "Boya Paneli", icon: Paintbrush, onClick: () => navigate("/paint"), accent: "default" },
                { id: "theme", label: theme === "dark" ? "Aydınlık Tema" : "Karanlık Tema", icon: theme === "dark" ? Sun : Moon, onClick: toggleTheme, accent: "default" },
              ]}
            />
            <AIAssistant panel="boyaci" />
            <UserMenu />
            <Button variant="outline" size="icon" onClick={handleLogout} data-testid="boyaci-logout-btn" className="text-error border-error/40 h-9 w-9 xl:w-auto xl:px-3 shrink-0">
              <LogOut className="h-4 w-4 xl:mr-2" />
              <span className="hidden xl:inline">Çıkış</span>
            </Button>
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="icon-tile-glow w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-amber-700 flex items-center justify-center" style={{ "--glow-rgb": "255,191,0" }}>
            <Brush className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-black">
              <span className="text-gradient-gold">Boyacı Paneli</span>
            </h1>
            <p className="text-text-secondary text-sm">{userData?.display_name || userData?.username} · iş sırası, başlatma ve tamamlama</p>
          </div>
        </div>

        {/* Üretilecek toplam koli */}
        <div className="mb-6" data-testid="boyaci-expected-wrapper">
          <ExpectedKoliCard
            summary={summary}
            jobs={queueJobs}
            variant="large"
            testId="boyaci-expected-koli"
            subtitle="Aktif kuyruktaki tüm işler — makine kırılımı için tıkla"
          />
        </div>

        {/* Makine durumu */}
        <div className="mb-8">
          <p className="section-label mb-3">Makine Durumu</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="boyaci-machines-grid">
            {machines.map((m) => {
              const job = activeJobs.find((j) => j.machine_id === m.id);
              return (
                <Card key={m.id} className="panel-industrial" data-testid={`boyaci-machine-${m.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading font-bold text-text-primary truncate">{m.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        !job ? "bg-surface-highlight/60 text-text-secondary border-border"
                          : job.status === "paused" ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-success/15 text-success border-success/30"
                      }`}>
                        {job ? (job.status === "paused" ? "DURDURULDU" : "ÇALIŞIYOR") : "BOŞTA"}
                      </span>
                    </div>
                    {job ? (
                      <div className="mt-3">
                        <div className="flex gap-3">
                          <JobThumb job={job} onOpen={openPreview} size={56} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-text-primary truncate">{job.name}</p>
                            <JobMeta job={job} />
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-text-secondary mb-1">
                            <span>{(job.completed_koli || 0) + (job.progress_total || 0)} / {job.koli_count || 0} koli</span>
                            <span>{job.operator_name || "—"}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-highlight overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-amber-600"
                              style={{ width: `${Math.min(100, Math.round((((job.completed_koli || 0) + (job.progress_total || 0)) / (job.koli_count || 1)) * 100))}%` }} />
                          </div>
                          <p className="text-[11px] text-text-muted mt-1">
                            {job.progress_last_at ? `Son giriş: ${minutesAgo(job.progress_last_at)} dk önce` : "Henüz giriş yok"}
                          </p>
                        </div>
                        {job.status === "paused" ? (
                          <Button
                            onClick={() => handleResume(job)}
                            data-testid={`boyaci-resume-${job.id}`}
                            className="w-full mt-3 bg-info text-white hover:bg-info/90"
                          >
                            <Play className="mr-2 h-4 w-4" /> Devam Ettir
                          </Button>
                        ) : (
                          <>
                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                onClick={() => handleAddProgress(job)}
                                data-testid={`boyaci-progress-add-${job.id}`}
                                className="flex-1 border-primary/40 text-primary hover:bg-primary/10"
                              >
                                <Plus className="mr-1.5 h-4 w-4" /> 5 Koli
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleUndoProgress(job)}
                                data-testid={`boyaci-progress-undo-${job.id}`}
                                disabled={!job.progress_total}
                                className="border-border text-text-secondary hover:bg-surface-highlight shrink-0"
                                title="Son ara girişi geri al"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button
                                variant="outline"
                                onClick={() => openPauseDialog(job)}
                                data-testid={`boyaci-pause-${job.id}`}
                                className="flex-1 border-warning text-warning hover:bg-warning/20"
                              >
                                <Pause className="mr-2 h-4 w-4" /> Durdur
                              </Button>
                              <Button
                                onClick={() => handleComplete(job)}
                                data-testid={`boyaci-complete-${job.id}`}
                                className="flex-1 bg-success text-white hover:bg-success/90"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> İşi Tamamla
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-text-secondary mt-3">Bu makinede aktif iş yok.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Sıradaki işler */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="section-label">Sıradaki İşler ({filteredPending.length}{filtersActive ? ` / ${pendingJobs.length}` : ""})</p>
            <span className="text-xs text-text-secondary hidden sm:inline">Sürükleyip sırala — tüm panellerde otomatik güncellenir</span>
          </div>

          {/* Filtreler */}
          <div className="mb-4 space-y-2.5" data-testid="boyaci-filters">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-text-muted font-bold mr-1">Makine</span>
              <button
                onClick={() => setFilterMachine("all")}
                data-testid="boyaci-filter-machine-all"
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filterMachine === "all" ? "bg-primary text-black border-primary" : "bg-surface text-text-secondary border-border hover:border-primary/50"
                }`}
              >Hepsi</button>
              {machineOptions.map((m) => {
                const count = pendingJobs.filter((j) => j.machine_id === m.id).length;
                return (
                  <button
                    key={m.id}
                    onClick={() => setFilterMachine(filterMachine === m.id ? "all" : m.id)}
                    data-testid={`boyaci-filter-machine-${m.id}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      filterMachine === m.id ? "bg-primary text-black border-primary" : "bg-surface text-text-secondary border-border hover:border-primary/50"
                    }`}
                  >{m.name} <span className="opacity-60">({count})</span></button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-text-muted font-bold mr-1">Ölçü</span>
              <button
                onClick={() => setFilterFormat("all")}
                data-testid="boyaci-filter-format-all"
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filterFormat === "all" ? "bg-primary text-black border-primary" : "bg-surface text-text-secondary border-border hover:border-primary/50"
                }`}
              >Hepsi</button>
              {formatOptions.map((f) => {
                const count = pendingJobs.filter((j) => (j.format || "") === f
                  && (filterMachine === "all" || j.machine_id === filterMachine)).length;
                return (
                  <button
                    key={f}
                    onClick={() => setFilterFormat(filterFormat === f ? "all" : f)}
                    data-testid={`boyaci-filter-format-${f}`}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      filterFormat === f ? "bg-primary text-black border-primary" : "bg-surface text-text-secondary border-border hover:border-primary/50"
                    }`}
                  >{f} <span className="opacity-60">({count})</span></button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İş adı, müşteri, renk, not ara…"
                  className="pl-9 bg-background border-border h-10"
                  data-testid="boyaci-search-input"
                />
              </div>
              {filtersActive && (
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => { setFilterMachine("all"); setFilterFormat("all"); setSearch(""); }}
                  data-testid="boyaci-filters-clear"
                >
                  <X className="mr-1.5 h-4 w-4" /> Filtreyi Temizle
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-text-secondary text-sm">Yükleniyor…</p>
          ) : filteredPending.length === 0 ? (
            <Card className="panel-industrial" data-testid="boyaci-queue-empty">
              <CardContent className="p-8 text-center text-text-secondary">
                {filtersActive ? "Bu filtreye uyan bekleyen iş yok." : "Sırada bekleyen iş yok."}
              </CardContent>
            </Card>
          ) : (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredPending.map((j) => j.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2.5" data-testid="boyaci-queue-list">
                  {filteredPending.map((job) => (
                    <SortableRow key={job.id} id={job.id}>
                      <Card className="panel-industrial" data-testid={`boyaci-job-${job.id}`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex gap-3">
                            <div className="shrink-0 w-7 h-7 rounded-lg bg-primary/15 text-primary border border-primary/30 flex items-center justify-center text-xs font-bold"
                              title="Genel sıradaki yeri">
                              {pendingJobs.findIndex((p) => p.id === job.id) + 1}
                            </div>
                            <JobThumb job={job} onOpen={openPreview} size={56} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-text-primary truncate">{job.name}</p>
                                <span className="shrink-0 inline-flex items-center gap-1 text-xs text-text-secondary">
                                  <Package className="h-3 w-3" /> {job.koli_count || 0} koli
                                </span>
                              </div>
                              <JobMeta job={job} />
                              <div className="flex gap-2 mt-3">
                                <Button
                                  onClick={() => openStartDialog(job)}
                                  data-testid={`boyaci-start-${job.id}`}
                                  className="bg-primary hover:bg-primary/90 text-black h-9"
                                >
                                  <Play className="mr-2 h-4 w-4" /> Başlat
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleComplete(job)}
                                  data-testid={`boyaci-queue-complete-${job.id}`}
                                  className="h-9 border-success/40 text-success"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Tamamla
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Başlat dialog — operatör zorunlu */}
      <Dialog open={!!startTarget} onOpenChange={(o) => !o && setStartTarget(null)}>
        <DialogContent className="bg-surface border-border max-w-md" data-testid="boyaci-start-dialog">
          <DialogHeader>
            <DialogTitle className="text-text-primary">İşi Başlat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-highlight/50 border border-border">
              <p className="font-semibold text-text-primary">{startTarget?.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {startTarget?.machine_name || "—"} · {startTarget?.koli_count || 0} koli
                {startTarget?.customer_name ? ` · ${startTarget.customer_name}` : ""}
              </p>
            </div>
            <div>
              <Label className="text-text-primary">Operatör * <span className="text-[11px] text-text-muted">(zorunlu)</span></Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger className="mt-1 bg-background border-border h-11" data-testid="boyaci-operator-select">
                  <SelectValue placeholder="Operatör seçin" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((o) => (
                    <SelectItem key={o.id} value={o.display_name || o.username} data-testid={`boyaci-operator-opt-${o.username}`}>
                      {o.display_name || o.username}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__" data-testid="boyaci-operator-opt-custom">Diğer (isim yaz)…</SelectItem>
                </SelectContent>
              </Select>
              {selectedOperator === "__custom__" && (
                <Input
                  className="mt-2 bg-background border-border h-11"
                  placeholder="Operatör adı"
                  value={customOperator}
                  onChange={(e) => setCustomOperator(e.target.value)}
                  data-testid="boyaci-operator-custom-input"
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStartTarget(null)} data-testid="boyaci-start-cancel">
                Vazgeç
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-black"
                onClick={handleStart}
                data-testid="boyaci-start-confirm"
              >
                <Play className="mr-2 h-4 w-4" /> Başlat
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Durdur dialog — sebep zorunlu, koli sayısı opsiyonel */}
      <Dialog open={!!pauseTarget} onOpenChange={(o) => !o && setPauseTarget(null)}>
        <DialogContent className="bg-surface border-border max-w-md" data-testid="boyaci-pause-dialog">
          <DialogHeader>
            <DialogTitle className="text-text-primary flex items-center gap-2">
              <Pause className="h-5 w-5 text-warning" /> İşi Durdur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-highlight/50 border border-border">
              <p className="font-semibold text-text-primary">{pauseTarget?.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {pauseTarget?.machine_name || "—"} · Hedef: {pauseTarget?.koli_count || 0} koli
              </p>
            </div>
            <div>
              <Label className="text-text-primary">Şu ana kadar üretilen koli (opsiyonel)</Label>
              <Input
                type="number"
                value={pauseProducedKoli}
                onChange={(e) => setPauseProducedKoli(e.target.value)}
                placeholder="0"
                className="mt-1 bg-background border-border h-11"
                data-testid="boyaci-pause-produced"
              />
            </div>
            <div>
              <Label className="text-text-primary">Durdurma Sebebi * <span className="text-[11px] text-text-muted">(zorunlu)</span></Label>
              <Input
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Neden durduruluyor?"
                className="mt-1 bg-background border-border h-11"
                data-testid="boyaci-pause-reason"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPauseTarget(null)} data-testid="boyaci-pause-cancel">
                Vazgeç
              </Button>
              <Button
                className="flex-1 bg-warning text-black hover:bg-warning/90"
                onClick={handlePause}
                disabled={!pauseReason}
                data-testid="boyaci-pause-confirm"
              >
                <Pause className="mr-2 h-4 w-4" /> Durdur
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Görsel önizleme */}
      <AnimatePresence>
        {previewJob && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => { setPreviewJob(null); setPreviewUrl(null); }}
            data-testid="boyaci-image-preview"
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 10 }}
              className="max-w-4xl w-full bg-surface border border-border rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-border flex items-center justify-between">
                <p className="font-semibold text-text-primary truncate">{previewJob.name}</p>
                <Button variant="outline" size="sm" onClick={() => { setPreviewJob(null); setPreviewUrl(null); }} data-testid="boyaci-preview-close">
                  Kapat
                </Button>
              </div>
              <div className="p-3 max-h-[75vh] overflow-auto flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt={previewJob.name} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                ) : (
                  <p className="text-text-secondary text-sm py-10">Görsel yükleniyor…</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BoyaciFlow;
