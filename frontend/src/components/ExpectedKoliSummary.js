import React from "react";
import { Package, Layers, Activity } from "lucide-react";

/**
 * Jobs array'inden beklenen koli özeti hesapla (client-side).
 * Backend endpoint ile aynı mantığı kullanır.
 *   - status in [pending, in_progress, paused]
 *   - remaining = max(0, koli_count - completed_koli)
 *
 * Eğer machineId verilirse sadece o makinedeki işleri sayar.
 */
export const computeExpectedSummary = (jobs, machineId = null) => {
  const active = (jobs || []).filter(
    (j) =>
      ["pending", "in_progress", "paused"].includes(j?.status) &&
      (!machineId || j?.machine_id === machineId)
  );
  let total_target = 0;
  let total_completed = 0;
  let total_remaining = 0;
  const byMachine = {};
  for (const j of active) {
    const target = Number(j.koli_count || 0);
    const completed = Number(j.completed_koli || 0);
    const remaining = Math.max(0, target - completed);
    total_target += target;
    total_completed += Math.min(completed, target);
    total_remaining += remaining;
    const mid = j.machine_id || "";
    const mname = j.machine_name || "—";
    if (!byMachine[mid]) {
      byMachine[mid] = {
        machine_id: mid,
        machine_name: mname,
        remaining_koli: 0,
        target_koli: 0,
        completed_koli: 0,
        jobs_count: 0,
      };
    }
    byMachine[mid].remaining_koli += remaining;
    byMachine[mid].target_koli += target;
    byMachine[mid].completed_koli += Math.min(completed, target);
    byMachine[mid].jobs_count += 1;
  }
  const completion_pct =
    total_target > 0 ? Math.round((total_completed / total_target) * 1000) / 10 : 0;
  const by_machine = Object.values(byMachine)
    .map((m) => ({
      ...m,
      completion_pct:
        m.target_koli > 0
          ? Math.round((m.completed_koli / m.target_koli) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.remaining_koli - a.remaining_koli);
  return {
    total_remaining_koli: total_remaining,
    total_target_koli: total_target,
    total_completed_koli: total_completed,
    total_jobs: active.length,
    completion_pct,
    by_machine,
  };
};

/**
 * Üretilmesi beklenen toplam koli özeti.
 * Backend: GET /api/jobs/expected-summary
 *
 * Props:
 *   summary: { total_remaining_koli, total_target_koli, total_completed_koli,
 *              total_jobs, completion_pct, by_machine }
 *   variant: "compact" | "large" | "dark-tv"
 *   title: opsiyonel başlık (default "Üretilecek Toplam Koli")
 *   subtitle: opsiyonel alt başlık
 */
export const ExpectedKoliSummary = ({
  summary,
  variant = "compact",
  title = "Üretilecek Toplam Koli",
  subtitle,
  testId = "expected-koli-summary",
}) => {
  if (!summary) return null;

  const remaining = Number(summary.total_remaining_koli || 0);
  const target = Number(summary.total_target_koli || 0);
  const completed = Number(summary.total_completed_koli || 0);
  const jobs = Number(summary.total_jobs || 0);
  const pct = Number(summary.completion_pct || 0);
  const formatted = remaining.toLocaleString("tr-TR");

  if (variant === "dark-tv") {
    return (
      <div
        data-testid={testId}
        className="bg-gradient-to-br from-amber-500/10 to-amber-700/5 rounded-xl border border-amber-500/30 p-4"
      >
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-4 w-4 text-amber-400" />
          <span className="text-zinc-400 text-xs uppercase tracking-wider">{title}</span>
        </div>
        <p className="text-3xl md:text-4xl font-black text-amber-400 leading-tight">
          {formatted} <span className="text-base text-zinc-500 font-bold">koli</span>
        </p>
        <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
          <span>{jobs} iş</span>
          <span>%{pct} tamamlandı</span>
        </div>
        <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === "large") {
    return (
      <div
        data-testid={testId}
        className="bg-white border-2 border-amber-400 rounded-2xl p-5 shadow-sm"
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 text-amber-700">
              <Package className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                {title}
              </span>
            </div>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <Activity className="h-5 w-5 text-amber-500 animate-pulse" />
        </div>
        <p className="text-4xl md:text-5xl font-black text-gray-900 leading-none">
          {formatted}
          <span className="text-lg text-gray-500 font-bold ml-2">koli</span>
        </p>
        <div className="flex items-center justify-between text-sm text-gray-600 mt-3">
          <span className="font-medium">{jobs} aktif iş</span>
          <span className="font-bold text-emerald-600">%{pct} tamamlandı</span>
        </div>
        <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {completed.toLocaleString("tr-TR")} / {target.toLocaleString("tr-TR")} koli üretildi
        </p>
      </div>
    );
  }

  // compact (default)
  return (
    <div
      data-testid={testId}
      className="bg-white border border-amber-300 rounded-xl p-3 shadow-sm flex items-center gap-3"
    >
      <div className="bg-amber-50 p-2 rounded-lg">
        <Package className="h-5 w-5 text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
          {title}
        </p>
        <p className="text-xl font-black text-gray-900 leading-tight">
          {formatted}
          <span className="text-xs text-gray-500 font-semibold ml-1">koli</span>
        </p>
        <p className="text-xs text-gray-500">
          {jobs} iş · %{pct} tamamlandı
        </p>
      </div>
    </div>
  );
};

export default ExpectedKoliSummary;
