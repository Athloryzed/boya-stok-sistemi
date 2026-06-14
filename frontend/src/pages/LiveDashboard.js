import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Monitor, Activity, Package, Users, Clock, Wrench, ChevronUp, Lock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import ExpectedKoliSummary from "../components/ExpectedKoliSummary";

const _isCanonical = typeof window !== "undefined" &&
  /^(www\.|yeni\.)?bksistem\.space$/.test(window.location.hostname);
const BACKEND_URL = _isCanonical ? window.location.origin : process.env.REACT_APP_BACKEND_URL;
const DASHBOARD_API = `${BACKEND_URL}/api`;

const LiveDashboard = () => {
  const [data, setData] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Oturum kontrolü - token varsa geçerli mi kontrol et
    const savedToken = sessionStorage.getItem("dashboard_token");
    if (savedToken) {
      localStorage.setItem("auth_token", savedToken);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
    const dataInterval = setInterval(fetchData, 15000);
    const clockInterval = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
  }, [authenticated]);

  const fetchData = async () => {
    try {
      const token = sessionStorage.getItem("dashboard_token");
      const res = await axios.get(`${DASHBOARD_API}/dashboard/live`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
      if (e.response?.status === 401) {
        sessionStorage.removeItem("dashboard_token");
        setAuthenticated(false);
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${DASHBOARD_API}/dashboard/login`, { password });
      if (res.data.token) {
        sessionStorage.setItem("dashboard_token", res.data.token);
        localStorage.setItem("auth_token", res.data.token);
        setAuthenticated(true);
        setError("");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Yanlış şifre");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen tv-bg flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-industrial login-glow rounded-2xl p-8 w-80"
        >
          <div className="text-center mb-6">
            <div className="icon-tile-glow w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/5 border border-amber-500/40 flex items-center justify-center mx-auto mb-3">
              <Lock className="h-7 w-7 text-amber-400" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white tracking-tight">Canlı Pano</h1>
            <p className="text-zinc-400 text-sm mt-1">Şifre gerekli</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              data-testid="dashboard-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Şifre"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-center mb-3 focus:outline-none focus:border-amber-400"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm text-center mb-3" data-testid="dashboard-error">{error}</p>}
            <button
              data-testid="dashboard-login-btn"
              type="submit"
              className="shine-sweep w-full py-3 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-bold rounded-lg transition-all shadow-lg shadow-amber-500/25"
            >
              Giriş
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen tv-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const statusColor = (status) => {
    if (status === "working") return "bg-green-500";
    if (status === "maintenance") return "bg-orange-500";
    return "bg-zinc-600";
  };

  const statusText = (status) => {
    if (status === "working") return "Çalışıyor";
    if (status === "maintenance") return "Bakımda";
    return "Boşta";
  };

  return (
    <div className="min-h-screen tv-bg text-white p-4 md:p-6 overflow-hidden" data-testid="live-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="icon-tile-glow w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-400/25 to-amber-600/5 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Monitor className="h-6 w-6 text-amber-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-heading font-black tracking-tight title-gradient-premium">BUSE KÂĞIT</h1>
            <p className="text-zinc-400 text-sm flex items-center font-medium"><span className="live-dot" aria-hidden="true" />Canlı Üretim Panosu</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl md:text-5xl font-mono font-bold text-amber-400 num-tabular drop-shadow-[0_0_18px_rgba(255,191,0,0.3)]" data-testid="dashboard-clock" aria-live="off">
            {clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-zinc-400 text-sm font-medium">
            {clock.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Beklenen Üretim Özeti */}
      {data.summary?.expected_summary && (
        <div className="mb-4">
          <ExpectedKoliSummary
            summary={data.summary.expected_summary}
            variant="dark-tv"
            title="Üretilecek Toplam Koli"
            testId="dashboard-expected-koli"
          />
        </div>
      )}


      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="dashboard-summary">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="tv-stat p-4" style={{ "--accent-rgb": "34,197,94" }}>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-green-400" aria-hidden="true" />
            <span className="text-zinc-400 text-xs tracking-wider font-semibold">ÇALIŞAN MAKİNE</span>
          </div>
          <p className="text-4xl md:text-5xl metric-display text-green-400">{data.summary.working}<span className="text-xl text-zinc-500">/{data.summary.total_machines}</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="tv-stat p-4" style={{ "--accent-rgb": "255,191,0" }}>
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span className="text-zinc-400 text-xs tracking-wider font-semibold">BUGÜN ÜRETİM</span>
          </div>
          <p className="text-4xl md:text-5xl metric-display text-amber-400">{data.summary.koli_today} <span className="text-xl text-zinc-500">koli</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="tv-stat p-4" style={{ "--accent-rgb": "96,165,250" }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-400" aria-hidden="true" />
            <span className="text-zinc-400 text-xs tracking-wider font-semibold">BEKLEYEN İŞ</span>
          </div>
          <p className="text-4xl md:text-5xl metric-display text-blue-400">{data.summary.pending_total}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="tv-stat p-4" style={{ "--accent-rgb": "192,132,252" }}>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-purple-400" aria-hidden="true" />
            <span className="text-zinc-400 text-xs tracking-wider font-semibold">TAMAMLANAN</span>
          </div>
          <p className="text-4xl md:text-5xl metric-display text-purple-400">{data.summary.completed_today} <span className="text-xl text-zinc-500">iş</span></p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Makine Durumları */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-bold text-zinc-300 mb-3 tracking-wider">MAKİNE DURUMLARI</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="dashboard-machines">
            {data.machines.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl p-3 border transition-all ${m.status === "working" ? "machine-working bg-green-500/5 border-green-500/30" : m.status === "maintenance" ? "bg-orange-500/5 border-orange-500/30" : "bg-zinc-800/30 border-zinc-700/50"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white truncate">{m.name}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColor(m.status)} ${m.status === "working" ? "animate-pulse" : ""}`} aria-hidden="true" />
                </div>
                <p className={`text-xs font-semibold ${m.status === "working" ? "text-green-400" : m.status === "maintenance" ? "text-orange-400" : "text-zinc-500"}`}>
                  {statusText(m.status)}
                </p>
                {m.active_job && (
                  <div className="mt-2 pt-2 border-t border-zinc-700/50">
                    <p className="text-xs text-amber-400 font-semibold truncate">{m.active_job.name}</p>
                    <p className="text-xs text-zinc-400">{m.active_job.koli_count} koli</p>
                    {m.active_job.operator_name && (
                      <p className="text-xs text-zinc-500">Op: {m.active_job.operator_name}</p>
                    )}
                  </div>
                )}
                {!m.active_job && m.pending_jobs > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">{m.pending_jobs} iş bekliyor</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sağ Panel */}
        <div className="space-y-4">
          {/* Operatör Sıralaması */}
          <div>
            <h2 className="text-sm font-bold text-zinc-300 mb-3 tracking-wider">GÜNÜN EN İYİLERİ</h2>
            <div className="panel-industrial rounded-xl overflow-hidden" data-testid="dashboard-operators">
              {data.operator_ranking.length > 0 ? (
                data.operator_ranking.slice(0, 5).map((op, i) => (
                  <div key={op.name} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-zinc-800" : ""} ${i === 0 ? "bg-amber-500/[0.06]" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-gradient-to-br from-amber-300 to-amber-500 text-black shadow-[0_0_12px_rgba(255,191,0,0.4)]" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-orange-600 text-white" : "bg-zinc-700 text-zinc-300"}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">{op.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-400">{op.koli} koli</p>
                      <p className="text-xs text-zinc-500">{op.jobs} iş</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-zinc-500 text-sm">Bugün henüz tamamlanan iş yok</div>
              )}
            </div>
          </div>

          {/* 7 Gün Grafik */}
          {data.daily_koli?.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-zinc-300 mb-3 tracking-wider">SON 7 GÜN</h2>
              <div className="panel-industrial rounded-xl p-3">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.daily_koli}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis dataKey="date" stroke="#71717A" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis stroke="#71717A" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", fontSize: 12 }} />
                    <Bar dataKey="koli" fill="#FFBF00" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Auto-refresh göstergesi */}
      <div className="fixed bottom-4 left-4 flex items-center gap-2 text-zinc-500 text-xs font-medium" aria-live="polite">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
        Canlı — 15 saniyede bir güncellenir
      </div>
    </div>
  );
};

export default LiveDashboard;
