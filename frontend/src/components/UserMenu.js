/**
 * Sağ üst kullanıcı menüsü — avatar + dropdown.
 *
 * Özellikler:
 *  - Avatar (kullanıcı adının baş harfi + renk)
 *  - Dropdown: Kullanıcı bilgisi, erişilebilir paneller (kısayol), Anasayfa, Çıkış
 *  - Çıkış: clearSession() + /
 *
 * Kullanım: <UserMenu position="top-right" /> (default: top-right, theme-aware)
 */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Home as HomeIcon, ChevronDown, Shield, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  getSession, clearSession, getAccessibleRoutes, ROUTE_ROLES,
} from "../lib/auth";

const ROUTE_META = {
  "/management": { name: "Yönetim", emoji: "📊" },
  "/operator":   { name: "Operatör", emoji: "👷" },
  "/plan":       { name: "Plan", emoji: "📋" },
  "/warehouse":  { name: "Depo", emoji: "📦" },
  "/paint":      { name: "Boya", emoji: "🎨" },
  "/bobin":      { name: "Bobin", emoji: "📜" },
  "/marka-stok": { name: "Marka/Koli", emoji: "🏷️" },
  "/driver":     { name: "Sürücü", emoji: "🚚" },
};

function avatarColor(name) {
  const palette = [
    "from-amber-400 to-amber-600",
    "from-rose-400 to-rose-600",
    "from-emerald-400 to-emerald-600",
    "from-sky-400 to-sky-600",
    "from-violet-400 to-violet-600",
    "from-teal-400 to-teal-600",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

export default function UserMenu({ className = "" }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => getSession());
  const navigate = useNavigate();
  const location = useLocation();
  const ref = useRef(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [open]);

  // Storage değişirse session'ı yenile
  useEffect(() => {
    const refresh = () => setSession(getSession());
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  if (!session) return null;

  const displayName = session.display_name || session.username || "Kullanıcı";
  const roles = (session.roles && session.roles.length ? session.roles : [session.role]).filter(Boolean);
  const initial = displayName.trim()[0]?.toUpperCase() || "?";
  const color = avatarColor(displayName);

  const accessible = getAccessibleRoutes();
  const currentPath = location.pathname;

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setOpen(false);
    toast.info("Çıkış yapıldı");
    navigate("/", { replace: true });
  };

  const loginAt = session.login_at ? new Date(session.login_at) : null;
  // Date.now() render içinde non-pure olduğundan login saat:dakika formatını gösteriyoruz
  const loginTimeStr = loginAt
    ? `${String(loginAt.getHours()).padStart(2, "0")}:${String(loginAt.getMinutes()).padStart(2, "0")}`
    : "";
  const loginDateStr = loginAt
    ? `${String(loginAt.getDate()).padStart(2, "0")}.${String(loginAt.getMonth() + 1).padStart(2, "0")}`
    : "";

  return (
    <div ref={ref} className={`relative z-50 ${className}`} data-testid="user-menu">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="user-menu-trigger"
        className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-surface/80 backdrop-blur-md border border-border hover:bg-surface transition-all hover:scale-105 active:scale-95"
        aria-label="Kullanıcı menüsü"
      >
        <span className={`relative w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
          {initial}
        </span>
        <span className="hidden sm:flex flex-col items-start leading-tight pr-1">
          <span className="text-xs font-semibold text-text-primary">{displayName}</span>
          <span className="text-[9px] font-mono uppercase text-text-secondary tracking-wider">{roles[0]}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-surface border border-border shadow-2xl overflow-hidden"
            data-testid="user-menu-dropdown"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-br from-background to-surface border-b border-border">
              <div className="flex items-center gap-3">
                <span className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                  {initial}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-primary truncate">{displayName}</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    {roles.join(" · ")}
                  </p>
                  {loginAt && (
                    <p className="text-[10px] text-text-secondary mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Giriş: {loginDateStr} · {loginTimeStr}
                    </p>
                  )}
                </div>
              </div>
              {session.remember_me && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-mono uppercase">
                  <Shield className="w-2.5 h-2.5" /> Beni Hatırla aktif
                </div>
              )}
            </div>

            {/* Erişilebilir paneller */}
            {accessible.length > 0 && (
              <div className="py-2">
                <p className="px-4 py-1 text-[9px] font-mono uppercase tracking-widest text-text-secondary">
                  Hızlı Geçiş ({accessible.length} panel)
                </p>
                <div className="grid grid-cols-2 gap-1 px-2">
                  {accessible.map((path) => {
                    const meta = ROUTE_META[path] || { name: path, emoji: "📁" };
                    const isCurrent = currentPath === path;
                    return (
                      <button
                        key={path}
                        onClick={() => { setOpen(false); navigate(path); }}
                        disabled={isCurrent}
                        data-testid={`user-menu-nav-${path.slice(1)}`}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                          isCurrent
                            ? "bg-amber-500/15 text-amber-400 cursor-default"
                            : "text-text-primary hover:bg-background"
                        }`}
                      >
                        <span className="text-base">{meta.emoji}</span>
                        <span className="truncate">{meta.name}</span>
                        {isCurrent && <span className="ml-auto text-[8px] font-mono">●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer aksiyonlar */}
            <div className="border-t border-border py-1">
              {currentPath !== "/" && (
                <button
                  onClick={() => { setOpen(false); navigate("/"); }}
                  data-testid="user-menu-home"
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-text-primary hover:bg-background transition-colors"
                >
                  <HomeIcon className="w-3.5 h-3.5 text-amber-400" />
                  Anasayfa
                </button>
              )}
              <button
                onClick={handleLogout}
                data-testid="user-menu-logout"
                className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Çıkış Yap
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
