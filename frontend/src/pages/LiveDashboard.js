import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Monitor, Activity, Package, Users, Clock, Wrench, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";
import { API } from "../App";

const LiveDashboard = () => {
  const [data, setData] = useState(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 15000);
    const clockInterval = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(dataInterval); clearInterval(clockInterval); };
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/live`);
      setData(res.data);
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
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
    if (status === "working") return "Calisiyor";
    if (status === "maintenance") return "Bakimda";
    return "Bosta";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 md:p-6 overflow-hidden" data-testid="live-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">BUSE KAGIT</h1>
            <p className="text-zinc-500 text-sm">Canli Uretim Panosu</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl md:text-4xl font-mono font-bold text-amber-400" data-testid="dashboard-clock">
            {clock.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-zinc-500 text-sm">
            {clock.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="dashboard-summary">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111118] rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-green-400" />
            <span className="text-zinc-400 text-xs">Calisan Makine</span>
          </div>
          <p className="text-3xl font-black text-green-400">{data.summary.working}<span className="text-lg text-zinc-500">/{data.summary.total_machines}</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#111118] rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-amber-400" />
            <span className="text-zinc-400 text-xs">Bugun Uretim</span>
          </div>
          <p className="text-3xl font-black text-amber-400">{data.summary.koli_today} <span className="text-lg text-zinc-500">koli</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#111118] rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-400" />
            <span className="text-zinc-400 text-xs">Bekleyen Is</span>
          </div>
          <p className="text-3xl font-black text-blue-400">{data.summary.pending_total}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#111118] rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-purple-400" />
            <span className="text-zinc-400 text-xs">Tamamlanan</span>
          </div>
          <p className="text-3xl font-black text-purple-400">{data.summary.completed_today} <span className="text-lg text-zinc-500">is</span></p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Makine Durumları */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Makine Durumlari</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="dashboard-machines">
            {data.machines.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-xl p-3 border ${m.status === "working" ? "bg-green-500/5 border-green-500/30" : m.status === "maintenance" ? "bg-orange-500/5 border-orange-500/30" : "bg-zinc-800/30 border-zinc-700/50"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white truncate">{m.name}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${statusColor(m.status)} ${m.status === "working" ? "animate-pulse" : ""}`} />
                </div>
                <p className={`text-xs ${m.status === "working" ? "text-green-400" : m.status === "maintenance" ? "text-orange-400" : "text-zinc-500"}`}>
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
                  <p className="text-xs text-zinc-500 mt-1">{m.pending_jobs} is bekliyor</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sağ Panel */}
        <div className="space-y-4">
          {/* Operatör Sıralaması */}
          <div>
            <h2 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Gunun En Iyileri</h2>
            <div className="bg-[#111118] rounded-xl border border-zinc-800 overflow-hidden" data-testid="dashboard-operators">
              {data.operator_ranking.length > 0 ? (
                data.operator_ranking.slice(0, 5).map((op, i) => (
                  <div key={op.name} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-zinc-800" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-zinc-400 text-black" : i === 2 ? "bg-orange-600 text-white" : "bg-zinc-700 text-zinc-300"}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium">{op.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-400">{op.koli} koli</p>
                      <p className="text-xs text-zinc-500">{op.jobs} is</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-center text-zinc-500 text-sm">Bugun henuz tamamlanan is yok</div>
              )}
            </div>
          </div>

          {/* 7 Gün Grafik */}
          {data.daily_koli?.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">Son 7 Gun</h2>
              <div className="bg-[#111118] rounded-xl border border-zinc-800 p-3">
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
      <div className="fixed bottom-4 left-4 flex items-center gap-2 text-zinc-600 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Canli - 15 saniyede bir guncellenir
      </div>
    </div>
  );
};

export default LiveDashboard;
