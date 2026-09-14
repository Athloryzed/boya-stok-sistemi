import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, KeyRound, Loader2, ArrowLeft, LogOut, Truck, CheckCircle2, Clock, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import {
  isPortalSessionValid, getPortalSession, savePortalSession, clearPortalSession, portalApi,
} from "../lib/portalAuth";

const STATUS_ICON = {
  pending: Clock,
  in_progress: Truck,
  paused: PauseCircle,
  completed: CheckCircle2,
};

const STATUS_BADGE_CLASS = {
  pending: "bg-gray-500/20 text-gray-400",
  in_progress: "bg-blue-500/20 text-blue-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
};

const PortalFlow = ({ theme }) => {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => (isPortalSessionValid() ? getPortalSession() : null));
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState(null);
  const [jobsLoading, setJobsLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await portalApi.get("/portal/jobs");
      setJobs(res.data?.jobs || []);
    } catch (e) {
      if (e.response?.status === 401) {
        setSession(null);
        toast.error("Takip oturumunuzun süresi doldu, lütfen kodunuzu tekrar girin");
      } else {
        toast.error("Siparişler yüklenemedi, lütfen tekrar deneyin");
      }
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) fetchJobs();
  }, [session, fetchJobs]);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    setError("");
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 10) {
      setError("Takip kodu 10 haneli olmalı");
      return;
    }
    setLoading(true);
    try {
      const res = await portalApi.post("/portal/login", { portal_code: normalized });
      const s = savePortalSession(res.data || {});
      setSession(s);
      setCode("");
    } catch (e) {
      if (e.response?.status === 423) {
        setError(e.response?.data?.detail || "Çok fazla deneme yapıldı, lütfen biraz bekleyin");
      } else {
        setError("Geçersiz takip kodu");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearPortalSession();
    setSession(null);
    setJobs(null);
    toast.info("Çıkış yapıldı");
  };

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-background" : "bg-gray-50"}`}>
      <div className="max-w-lg mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="float-soft icon-tile-glow w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/25 to-blue-600/5 border border-blue-500/40 flex items-center justify-center" style={{ "--glow-rgb": "59,130,246" }}>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary tracking-tight">
              Sipariş Takip
            </h1>
            <p className="text-xs text-text-secondary font-mono uppercase tracking-widest mt-1">Buse Kağıt · Müşteri Portalı</p>
          </div>

          {!session && (
            <Card className="panel-industrial" data-testid="portal-login-card">
              <CardContent className="p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label htmlFor="portal-code" className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2">
                      <KeyRound className="h-4 w-4 text-blue-500" /> Takip Kodu
                    </label>
                    <Input
                      id="portal-code"
                      data-testid="portal-code-input"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="Örn: 7K9XPQ3RMN"
                      maxLength={10}
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="text-center text-lg tracking-[0.3em] font-mono uppercase"
                    />
                    <p className="text-xs text-text-secondary mt-2">10 haneli takip kodunuzu girin</p>
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 text-center" data-testid="portal-login-error">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading} data-testid="portal-login-submit">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Siparişlerimi Görüntüle"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate("/")}
                    className="w-full text-text-secondary"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Ana Sayfa
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {session && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-text-secondary">
                  Hoş geldiniz, <span className="text-text-primary font-semibold">{session.customer_name}</span>
                </p>
                <button
                  onClick={handleLogout}
                  data-testid="portal-logout-btn"
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors font-semibold"
                >
                  <LogOut className="w-3 h-3" /> Çıkış
                </button>
              </div>

              {jobsLoading && (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                  <p className="text-text-secondary mt-3">Yükleniyor...</p>
                </div>
              )}

              {!jobsLoading && jobs && jobs.length === 0 && (
                <Card className="panel-industrial">
                  <CardContent className="p-8 text-center text-text-secondary">
                    Görüntülenecek sipariş bulunamadı.
                  </CardContent>
                </Card>
              )}

              {!jobsLoading && jobs && jobs.map((j, idx) => {
                const Icon = STATUS_ICON[j.status] || Clock;
                const badgeClass = STATUS_BADGE_CLASS[j.status] || "bg-gray-500/20 text-gray-400";
                const progress = j.koli_count > 0
                  ? Math.min(100, Math.round(((j.completed_koli + j.progress_total) / j.koli_count) * 100))
                  : 0;
                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="panel-industrial" data-testid={`portal-job-${idx}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-bold text-text-primary">{j.job_name}</h3>
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${badgeClass}`}>
                            <Icon className="h-3.5 w-3.5" /> {j.status_text}
                          </span>
                        </div>

                        {j.koli_count > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs text-text-secondary mb-1">
                              <span>{j.completed_koli + j.progress_total} / {j.koli_count} koli</span>
                              <span>%{progress}</span>
                            </div>
                            <div className="h-2 rounded-full bg-border overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-secondary">
                          {j.delivery_date && (
                            <span>Teslim: <span className="text-text-primary font-semibold">{new Date(j.delivery_date).toLocaleDateString("tr-TR")}</span></span>
                          )}
                          {j.completed_at && (
                            <span>Tamamlanma: <span className="text-success font-semibold">{new Date(j.completed_at).toLocaleDateString("tr-TR")}</span></span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PortalFlow;
