import React, { useState } from "react";
import { Package, Layers, Activity, ChevronRight, Factory, X } from "lucide-react";

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
 * Makine bazlı kırılım pop-up (Dialog).
 * Yönetim ve Plan panellerinde kullanılır.
 */
export const ExpectedKoliBreakdownDialog = ({ open, onClose, summary, testId = "expected-koli-breakdown" }) => {
  if (!open || !summary) return null;
  const rows = summary.by_machine || [];
  const total = Number(summary.total_remaining_koli || 0);
  const target = Number(summary.total_target_koli || 0);
  const completed = Number(summary.total_completed_koli || 0);
  const pct = Number(summary.completion_pct || 0);

  return (
    <div
      data-testid={testId}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-amber-200 dark:border-amber-500/30 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 px-5 py-4 border-b border-amber-200 dark:border-amber-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-amber-400/20 p-2 rounded-lg">
              <Factory className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Makine Bazlı Üretim Yükü
              </h2>
              <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
                Toplam <span className="font-bold text-amber-700 dark:text-amber-400">{total.toLocaleString("tr-TR")} koli</span> üretilmeyi bekliyor · {rows.length} makine
              </p>
            </div>
          </div>
          <button
            data-testid="breakdown-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-500/20 transition-colors"
            aria-label="Kapat"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-zinc-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-zinc-400">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Şu anda aktif iş bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((m, i) => {
                const mPct = Number(m.completion_pct || 0);
                const shareOfTotal = total > 0 ? Math.round((m.remaining_koli / total) * 100) : 0;
                return (
                  <div
                    key={m.machine_id || i}
                    data-testid={`breakdown-row-${m.machine_name}`}
                    className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-gray-200 dark:border-zinc-700 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white truncate">
                          {m.machine_name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-zinc-500 flex-shrink-0">
                          · {m.jobs_count} iş
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-gray-900 dark:text-white leading-none">
                          {Number(m.remaining_koli).toLocaleString("tr-TR")}
                          <span className="text-xs text-gray-500 font-semibold ml-1">koli</span>
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-0.5">
                          %{shareOfTotal} toplam yükün
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                          style={{ width: `${Math.min(100, mPct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0 w-12 text-right">
                        %{mPct}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                      {Number(m.completed_koli).toLocaleString("tr-TR")} / {Number(m.target_koli).toLocaleString("tr-TR")} koli üretildi
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-zinc-900/80 px-5 py-3 border-t border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-zinc-400">
              Genel İlerleme: <span className="font-bold text-emerald-600 dark:text-emerald-400">%{pct}</span>
            </span>
            <span className="text-gray-500 dark:text-zinc-500">
              {completed.toLocaleString("tr-TR")} / {target.toLocaleString("tr-TR")} koli
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Üretilmesi beklenen toplam koli özeti.
 * Backend: GET /api/jobs/expected-summary
 *
 * Props:
 *   summary: { total_remaining_koli, total_target_koli, total_completed_koli,
 *              total_jobs, completion_pct, by_machine }
 *   variant: "compact" | "large" | "dark-tv"
 *   title, subtitle, testId
 *   onClick: opsiyonel — verilirse kart tıklanabilir olur ve görsel cue eklenir.
 */
export const ExpectedKoliSummary = ({
  summary,
  variant = "compact",
  title = "Üretilecek Toplam Koli",
  subtitle,
  testId = "expected-koli-summary",
  onClick,
}) => {
  if (!summary) return null;

  const remaining = Number(summary.total_remaining_koli || 0);
  const target = Number(summary.total_target_koli || 0);
  const completed = Number(summary.total_completed_koli || 0);
  const jobs = Number(summary.total_jobs || 0);
  const pct = Number(summary.completion_pct || 0);
  const formatted = remaining.toLocaleString("tr-TR");
  const clickable = typeof onClick === "function";
  const interactiveProps = clickable
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e);
          }
        },
      }
    : {};

  if (variant === "dark-tv") {
    return (
      <div
        data-testid={testId}
        {...interactiveProps}
        className={`bg-gradient-to-br from-amber-500/10 to-amber-700/5 rounded-xl border border-amber-500/30 p-4 ${clickable ? "cursor-pointer hover:border-amber-400/60 transition-colors" : ""}`}
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
        {...interactiveProps}
        className={`bg-white border-2 border-amber-400 rounded-2xl p-5 shadow-sm ${clickable ? "cursor-pointer hover:shadow-md hover:border-amber-500 hover:bg-amber-50/30 transition-all group" : ""}`}
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
          {clickable ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-md group-hover:bg-amber-200 transition-colors">
              <span>Makine Detayı</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          ) : (
            <Activity className="h-5 w-5 text-amber-500 animate-pulse" />
          )}
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
      {...interactiveProps}
      className={`bg-white border border-amber-300 rounded-xl p-3 shadow-sm flex items-center gap-3 ${clickable ? "cursor-pointer hover:bg-amber-50 hover:border-amber-400 transition-colors" : ""}`}
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
      {clickable && (
        <ChevronRight className="h-4 w-4 text-amber-500 flex-shrink-0" />
      )}
    </div>
  );
};

/**
 * Tıklanınca pop-up açan tam çözüm (state'i kendi içinde tutar).
 * Yönetim ve Plan panellerinde direkt bunu kullanabilirsin.
 */
export const ExpectedKoliCard = ({ summary, variant, title, subtitle, testId }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ExpectedKoliSummary
        summary={summary}
        variant={variant}
        title={title}
        subtitle={subtitle}
        testId={testId}
        onClick={() => setOpen(true)}
      />
      <ExpectedKoliBreakdownDialog
        open={open}
        onClose={() => setOpen(false)}
        summary={summary}
        testId={`${testId}-dialog`}
      />
    </>
  );
};

export default ExpectedKoliSummary;
