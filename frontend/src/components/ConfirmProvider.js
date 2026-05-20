import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

/**
 * Global onay dialog provider'ı + useConfirm hook.
 *
 * Kullanım:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: "İşi Tamamla",
 *     description: "TEST işini tamamlamak istediğinden emin misin?",
 *     confirmText: "Evet, Tamamla",
 *     cancelText: "Vazgeç",
 *     variant: "default" | "destructive" | "warning",
 *     icon: <Icon /> (opsiyonel),
 *   });
 *   if (!ok) return;
 *   // ...işlemi yap
 */

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Provider yoksa fallback: window.confirm
    return (opts) => Promise.resolve(window.confirm(opts?.description || opts?.title || "Emin misiniz?"));
  }
  return ctx;
};

const VARIANT_META = {
  default: {
    iconBg: "bg-blue-100 dark:bg-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    confirmBg: "bg-blue-500 hover:bg-blue-600 text-white",
    Icon: CheckCircle2,
  },
  warning: {
    iconBg: "bg-amber-100 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    confirmBg: "bg-amber-500 hover:bg-amber-600 text-black",
    Icon: AlertTriangle,
  },
  destructive: {
    iconBg: "bg-red-100 dark:bg-red-500/20",
    iconColor: "text-red-600 dark:text-red-400",
    confirmBg: "bg-red-500 hover:bg-red-600 text-white",
    Icon: AlertTriangle,
  },
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: options.title || "Onay",
        description: options.description || "Bu işlemi onaylıyor musunuz?",
        confirmText: options.confirmText || "Evet, Devam Et",
        cancelText: options.cancelText || "Vazgeç",
        variant: options.variant || "default",
        details: options.details,
        icon: options.icon,
      });
    });
  }, []);

  const handleClose = useCallback((result) => {
    setState(null);
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(result);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          state={state}
          onConfirm={() => handleClose(true)}
          onCancel={() => handleClose(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
};

const ConfirmDialog = ({ state, onConfirm, onCancel }) => {
  const meta = VARIANT_META[state.variant] || VARIANT_META.default;
  const Icon = state.icon ? () => state.icon : meta.Icon;

  // ESC ile iptal
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      data-testid="confirm-dialog"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Sadece backdrop'a doğrudan tıklamada kapat — buton/dialog içine tıklayınca kapanmasın
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-zinc-700 flex flex-col pointer-events-auto"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-start gap-3">
          <div className={`flex-shrink-0 ${meta.iconBg} p-2.5 rounded-full`}>
            <Icon className={`h-5 w-5 ${meta.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="text-lg font-black text-gray-900 dark:text-white leading-tight">
              {state.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-300 mt-1.5 leading-relaxed">
              {state.description}
            </p>
            {state.details && (
              <div className="mt-3 bg-gray-50 dark:bg-zinc-800/60 rounded-lg p-2.5 text-xs text-gray-700 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700">
                {state.details}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
            data-testid="confirm-close-btn"
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0"
            aria-label="Kapat"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Footer / Actions */}
        <div className="px-5 pb-5 pt-2 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(); }}
            data-testid="confirm-cancel-btn"
            className="px-4 py-2.5 rounded-lg font-semibold text-sm border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer select-none"
          >
            {state.cancelText}
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onConfirm(); }}
            data-testid="confirm-ok-btn"
            autoFocus
            className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-colors cursor-pointer select-none ${meta.confirmBg}`}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmProvider;
