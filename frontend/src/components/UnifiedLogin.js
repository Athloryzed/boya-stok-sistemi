/**
 * Merkezi giriş kartı — anasayfada ortada gösterilir.
 * Atatürk & Türk Bayrağı görselleriyle uyumlu, glass-morphism + framer-motion.
 */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Eye, EyeOff, LogIn, Tv, KeyRound, User as UserIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { API } from "../App";
import {
  saveSession, clearSession, getRememberedUsername, REMEMBER_USERNAME_KEY,
  ROLE_DEFAULT_ROUTE,
} from "../lib/auth";

const ROLE_LABEL = {
  yonetim: "Yönetim", plan: "Planlama", operator: "Operatör",
  depo: "Depo", sofor: "Sürücü",
};

export default function UnifiedLogin({ onAuthenticated, isNight = true }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState(() => getRememberedUsername());
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => !!getRememberedUsername());
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tvOpen, setTvOpen] = useState(false);
  const [tvPwd, setTvPwd] = useState("");
  const [tvLoading, setTvLoading] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    // Erişilebilirlik (WCAG AAA): autoFocus kaldırıldı — skip-link ve klavye sıralı erişim için
    // Kullanıcı sayfa açılır açılmaz Tab tuşuyla "İçeriğe atla" linkine erişebilir.
  }, []);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!username.trim() || !password) {
      setError("Kullanıcı adı ve şifre gerekli");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/users/login`, {
        username: username.trim(),
        password,
      });
      const data = res.data || {};
      const roles = data.roles && data.roles.length ? data.roles : [data.role || data.login_role].filter(Boolean);
      const primaryRole = data.login_role || data.role || roles[0];

      saveSession({
        token: data.token,
        refresh_token: data.refresh_token,
        role: primaryRole,
        roles,
        username: data.username || username,
        display_name: data.display_name || username,
        remember_me: remember,
      });
      if (!remember) {
        // Beni Hatırla kapalıysa kullanıcı adını da unutalım
        try { localStorage.removeItem(REMEMBER_USERNAME_KEY); } catch (_) { /* noop */ }
      }
      toast.success(`Hoş geldin, ${data.display_name || username}`);
      onAuthenticated?.({ ...data, role: primaryRole, roles });
      // Default rolün landing sayfasına git
      const dest = ROLE_DEFAULT_ROUTE[primaryRole] || "/";
      navigate(dest);
    } catch (err) {
      const detail = err?.response?.data?.detail || "Giriş başarısız";
      if (err?.response?.status === 423) {
        setError(`🔒 ${detail}`);
      } else if (err?.response?.status === 422) {
        setError("Lütfen geçerli kullanıcı adı/şifre girin");
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTvLogin = async (e) => {
    e?.preventDefault?.();
    if (!tvPwd) return;
    setTvLoading(true);
    try {
      const res = await axios.post(`${API}/dashboard/login`, { password: tvPwd });
      if (res.data?.token) {
        // LiveDashboard sessionStorage'dan okur — bu yüzden sessionStorage'a yazıyoruz
        sessionStorage.setItem("dashboard_token", res.data.token);
        sessionStorage.setItem("dashboard_session", JSON.stringify(res.data));
        navigate("/dashboard");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Canlı Pano şifresi yanlış";
      toast.error(msg);
    } finally {
      setTvLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" data-testid="unified-login">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={`relative rounded-2xl backdrop-blur-2xl border overflow-hidden ${
          isNight
            ? "bg-white/10 border-amber-500/30 login-glow"
            : "bg-white/80 border-amber-300/60 shadow-2xl shadow-amber-500/20"
        }`}
        role="form"
        aria-labelledby="login-title"
      >
        {/* Subtle gradient glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" aria-hidden="true" />
        <div className="absolute -inset-px rounded-2xl pointer-events-none opacity-40"
             style={{ background: "radial-gradient(ellipse at top, rgba(251,191,36,0.18), transparent 60%)" }}
             aria-hidden="true" />

        <div className="relative p-7">
          <div className="text-center mb-5">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 220 }}
              className="float-soft inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-lg shadow-amber-500/40 mb-3"
              aria-hidden="true"
            >
              <ShieldCheck className="w-7 h-7 text-zinc-900" />
            </motion.div>
            <h2 id="login-title" className={`text-2xl font-bold tracking-tight font-heading ${isNight ? "text-white" : "text-zinc-900"}`}>
              Buse Kâğıt
            </h2>
            <p className={`text-xs mt-1 font-mono uppercase tracking-widest ${isNight ? "text-amber-300/90" : "text-amber-700"}`}>
              Üretim Yönetim Sistemi
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3" autoComplete="on" noValidate>
            <div className="relative">
              <label htmlFor="login-username" className="sr-only-aaa">Kullanıcı adı</label>
              <UserIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isNight ? "text-amber-300/70" : "text-amber-700/70"}`} aria-hidden="true" />
              <input
                id="login-username"
                ref={userRef}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adı"
                data-testid="login-username"
                aria-required="true"
                aria-invalid={!!error}
                className={`w-full pl-10 pr-3 py-3 rounded-lg border outline-none transition-all ${
                  isNight
                    ? "bg-white/5 border-white/15 text-white placeholder-zinc-400 focus:border-amber-400 focus:bg-white/10 focus:ring-4 focus:ring-amber-400/20"
                    : "bg-white/70 border-zinc-300 text-zinc-900 placeholder-zinc-500 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-400/20"
                }`}
              />
            </div>

            <div className="relative">
              <label htmlFor="login-password" className="sr-only-aaa">Şifre</label>
              <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isNight ? "text-amber-300/70" : "text-amber-700/70"}`} aria-hidden="true" />
              <input
                id="login-password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                data-testid="login-password"
                aria-required="true"
                aria-invalid={!!error}
                className={`w-full pl-10 pr-10 py-3 rounded-lg border outline-none transition-all ${
                  isNight
                    ? "bg-white/5 border-white/15 text-white placeholder-zinc-400 focus:border-amber-400 focus:bg-white/10 focus:ring-4 focus:ring-amber-400/20"
                    : "bg-white/70 border-zinc-300 text-zinc-900 placeholder-zinc-500 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-400/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                data-testid="login-toggle-password"
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${isNight ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"}`}
                aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
                aria-pressed={showPw}
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <label className={`flex items-center gap-2 cursor-pointer select-none text-sm ${isNight ? "text-zinc-200" : "text-zinc-700"}`}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                data-testid="login-remember"
                className="sr-only peer"
              />
              <span
                className={`relative w-9 h-5 rounded-full transition-colors peer-checked:bg-amber-500 peer-focus:ring-4 peer-focus:ring-amber-400/30 ${
                  isNight ? "bg-white/15" : "bg-zinc-300"
                }`}
                aria-hidden="true"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    remember ? "translate-x-4" : ""
                  }`}
                />
              </span>
              Beni Hatırla
            </label>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  data-testid="login-error"
                  className="text-sm text-rose-300 bg-rose-500/15 border border-rose-500/40 rounded-md px-3 py-2 font-medium"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              whileTap={{ scale: 0.97 }}
              className="btn-premium-gold shine-sweep w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span className="sr-only-aaa">Giriş yapılıyor...</span>
                </>
              ) : (
                <><LogIn className="w-4 h-4" aria-hidden="true" /> Giriş Yap</>
              )}
            </motion.button>
          </form>

          {/* Canlı Pano alt geçişi */}
          <div className="mt-5 pt-5 border-t border-amber-500/10">
            {!tvOpen ? (
              <button
                onClick={() => setTvOpen(true)}
                data-testid="tv-toggle"
                className={`w-full flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider transition-colors ${
                  isNight ? "text-zinc-300 hover:text-amber-300" : "text-zinc-600 hover:text-amber-600"
                }`}
                aria-label="Canlı Pano (TV) girişi formunu aç"
              >
                <Tv className="w-3.5 h-3.5" aria-hidden="true" />
                Canlı Pano (TV) Girişi
              </button>
            ) : (
              <motion.form
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                onSubmit={handleTvLogin}
                className="space-y-2"
                aria-label="Canlı Pano giriş formu"
              >
                <div className="flex gap-2">
                  <label htmlFor="tv-password" className="sr-only-aaa">Canlı Pano şifresi</label>
                  <input
                    id="tv-password"
                    type="password"
                    value={tvPwd}
                    onChange={(e) => setTvPwd(e.target.value)}
                    placeholder="Canlı Pano şifresi"
                    data-testid="tv-password"
                    autoComplete="current-password"
                    className={`flex-1 px-3 py-2 rounded-md border outline-none text-sm focus:ring-4 focus:ring-amber-400/30 ${
                      isNight ? "bg-white/5 border-white/15 text-white focus:border-amber-400" : "bg-white border-zinc-300 focus:border-amber-500"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={tvLoading}
                    data-testid="tv-submit"
                    className="px-4 py-2 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-sm font-semibold disabled:opacity-60"
                    aria-busy={tvLoading}
                  >
                    {tvLoading ? "..." : "TV"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setTvOpen(false); setTvPwd(""); }}
                  className={`text-[10px] ${isNight ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700"}`}
                >
                  İptal
                </button>
              </motion.form>
            )}
          </div>

          <p className={`text-[10px] text-center mt-4 leading-relaxed ${isNight ? "text-zinc-500" : "text-zinc-500"}`}>
            &quot;Beni Hatırla&quot; işaretliyse kullanıcı adınız 7 gün boyunca dolu gelir.<br/>
            Aksi hâlde 24 saat sonra şifrenizi tekrar girmeniz gerekir.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function LogoutButton({ className = "" }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { clearSession(); toast.info("Çıkış yapıldı"); navigate("/"); }}
      data-testid="logout-btn"
      className={`text-xs text-rose-400 hover:text-rose-300 ${className}`}
    >
      Çıkış Yap
    </button>
  );
}

export { ROLE_LABEL };
