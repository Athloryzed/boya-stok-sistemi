/**
 * HeaderActionsMenu — Mobil cihazlarda panel header'ındaki ikincil aksiyonları
 * tek bir "Daha Fazla" (kebab) menüsünde toplar.
 *
 * Kullanım:
 *   <HeaderActionsMenu items={[
 *     { id: "menu", label: "Menü", icon: UtensilsCrossed, onClick: openMenuDialog, testId: "menu-edit-btn", accent: "amber" },
 *     ...
 *   ]} />
 *
 * Desktop'ta items inline render olur (md:flex). Mobilde tek dropdown.
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";
import { Button } from "./ui/button";

const ACCENT_MAP = {
  amber: "border-amber-500/40 text-amber-400 hover:bg-amber-500/10",
  emerald: "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10",
  cyan: "border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10",
  sky: "border-sky-500/40 text-sky-400 hover:bg-sky-500/10",
  rose: "border-rose-500/40 text-rose-400 hover:bg-rose-500/10",
  violet: "border-violet-500/40 text-violet-400 hover:bg-violet-500/10",
  default: "border-border text-text-secondary hover:bg-surface-highlight",
};

export default function HeaderActionsMenu({ items = [], className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <>
      {/* Desktop (md+): all inline */}
      <div className={`hidden md:flex items-center gap-2 ${className}`}>
        {items.map((it) => {
          if (it.render) return <React.Fragment key={it.id}>{it.render()}</React.Fragment>;
          const Icon = it.icon;
          const tone = ACCENT_MAP[it.accent || "default"];
          return (
            <Button
              key={it.id}
              variant="outline"
              size="sm"
              onClick={it.onClick}
              disabled={it.disabled}
              data-testid={it.testId}
              title={it.title || it.label}
              className={`h-9 gap-1.5 ${tone}`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              <span className="hidden xl:inline text-xs">{it.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Mobile (<md): kebab dropdown */}
      <div className={`md:hidden relative ${className}`} ref={ref}>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          data-testid="header-more-actions-btn"
          aria-label="Daha fazla aksiyon"
          aria-expanded={open}
          className="h-9 w-9 border-border bg-surface/60 hover:bg-surface-highlight"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              role="menu"
              data-testid="header-more-actions-menu"
              className="absolute right-0 top-[calc(100%+6px)] w-60 z-50 rounded-xl border border-amber-500/20 bg-gradient-to-b from-[#1a1410] to-[#0c0904] shadow-2xl shadow-black/40 overflow-hidden"
            >
              <div className="p-1.5 space-y-0.5 max-h-[70vh] overflow-y-auto">
                {items.map((it) => {
                  if (it.render) {
                    return (
                      <div key={it.id} className="px-2 py-1.5 flex items-center gap-2 text-xs text-text-secondary">
                        {it.render()}
                      </div>
                    );
                  }
                  const Icon = it.icon;
                  return (
                    <button
                      key={it.id}
                      onClick={() => { setOpen(false); it.onClick && it.onClick(); }}
                      disabled={it.disabled}
                      data-testid={it.testId ? `${it.testId}-mobile` : undefined}
                      role="menuitem"
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        it.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-amber-500/10 active:bg-amber-500/15"
                      } text-amber-50`}
                    >
                      {Icon ? <Icon className="h-4 w-4 shrink-0 text-amber-300" /> : null}
                      <span className="flex-1">{it.label}</span>
                      {it.badge && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{it.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
