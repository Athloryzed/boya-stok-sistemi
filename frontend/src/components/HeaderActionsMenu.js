/**
 * HeaderActionsMenu — panel header'ındaki ikincil aksiyonları HER genişlikte
 * tek bir "Daha Fazla" (kebab) menüsünde toplar.
 *
 * Kullanım:
 *   <HeaderActionsMenu items={[
 *     { id: "menu", label: "Menü", icon: UtensilsCrossed, onClick: openMenuDialog, testId: "menu-edit-btn", accent: "amber" },
 *     ...
 *   ]} />
 *
 * Önceden geniş ekranlarda items inline (ayrı buton olarak) render ediliyordu,
 * ama header satırı max-w-7xl (1280px) ile sabitlendiği için içerik alanı
 * viewport büyüse de asla genişlemiyor — inline mod hiçbir monitör
 * genişliğinde 10 öğeyi çakışmadan sığdıramıyordu (2600px'te bile test edilip
 * doğrulandı). Bu yüzden inline mod tamamen kaldırıldı, her zaman kebab.
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";
import { Button } from "./ui/button";

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
      {/* Kebab dropdown — tüm genişliklerde */}
      <div className={`relative ${className}`} ref={ref}>
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
