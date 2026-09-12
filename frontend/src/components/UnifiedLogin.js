/**
 * Merkezi giriş kartı — anasayfada ortada gösterilir.
 * Atatürk & Türk Bayrağı görselleriyle uyumlu, glass-morphism + framer-motion.
 */
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import axios from "axios";
import { Eye, EyeOff, LogIn, Tv, KeyRound, User as UserIcon, ShieldCheck, Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import "./UnifiedLogin.css";
import { LOGIN_MOTION } from "../lib/motion";
import { API } from "../App";
import {
  saveSession, clearSession, getRememberedUsername, REMEMBER_USERNAME_KEY,
  ROLE_DEFAULT_ROUTE,
} from "../lib/auth";

const ROLE_LABEL = {
  yonetim: "Yönetim", plan: "Planlama", operator: "Operatör",
  depo: "Depo", sofor: "Sürücü",
};

export default function UnifiedLogin({ onAuthenticated, isNight = true, liteMode = false, onBusyChange }) {
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
  const passwordRef = useRef(null);
  const requestRef = useRef(null);
  const authenticatedRef = useRef(onAuthenticated);
  useEffect(() => { authenticatedRef.current = onAuthenticated; }, [onAuthenticated]);
  const pendingRef = useRef(false);
  const [success, setSuccess] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const reducedMotion = useReducedMotion();
  const quiet = !!reducedMotion || liteMode;
  const busy = loading || !!success || tvLoading;
  const checking = loading || !!success;
  useEffect(() => { onBusyChange?.(checking); }, [checking, onBusyChange]);
  const transition = { duration: quiet ? 0 : LOGIN_MOTION.normal, ease: LOGIN_MOTION.ease };

  useEffect(() => () => requestRef.current?.abort(), []);

  // Keep success visible before Home removes this card. Cancel on unmount,
  // and re-evaluate immediately if motion preferences change during handoff.
  useEffect(() => {
    if (!success) return;
    const finish = () => {
      authenticatedRef.current?.(success);
      navigate(ROLE_DEFAULT_ROUTE[success.role] || "/", { state: { loginDive: !quiet } });
    };
    const timer = setTimeout(() => {
      if (!quiet && !leaving) setLeaving(true);
      else finish();
    }, quiet ? 0 : leaving ? LOGIN_MOTION.dive * 1000 : LOGIN_MOTION.confirm * 1000);
    return () => clearTimeout(timer);
  }, [success, leaving, quiet, navigate]);

  const handleLogin = async (e) => {
    e?.preventDefault?.();
    if (pendingRef.current || tvLoading) return;
    setError("");
    if (!username.trim() || !password) {
      setError("Kullanıcı adı ve şifre gerekli");
      (!username.trim() ? userRef : passwordRef).current?.focus();
      return;
    }
    pendingRef.current = true;
    requestRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/users/login`, {
        username: username.trim(),
        password,
      }, { signal: requestRef.current.signal });
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
      setShowPw(false);
      setSuccess({ ...data, role: primaryRole, roles });
    } catch (err) {
      if (axios.isCancel(err)) return;
      pendingRef.current = false;
      const detail = err?.response?.data?.detail || "Giriş başarısız";
      if (err?.response?.status === 423) {
        setError(`🔒 ${detail}`);
      } else if (err?.response?.status === 422) {
        setError("Lütfen geçerli kullanıcı adı/şifre girin");
      } else {
        setError(typeof detail === "string" ? detail : "Giriş başarısız");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTvLogin = async (e) => {
    e?.preventDefault?.();
    if (!tvPwd || tvLoading || pendingRef.current) return;
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
    <div className="login-precision relative z-50 w-full max-w-md mx-auto" data-checking={checking} data-quiet={quiet} data-night={isNight} data-state={success ? "success" : loading ? "loading" : error ? "error" : "idle"} data-testid="unified-login">
      {leaving && !quiet && (
        <motion.div aria-hidden="true" className="fixed inset-0 pointer-events-none -z-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: LOGIN_MOTION.dive }}
          style={{ background: "rgba(9,9,11,0.22)", backdropFilter: "blur(3px)" }} />
      )}
      <motion.div
        initial={quiet ? false : { opacity: 0, y: 8 }}
        animate={{
          opacity: leaving && !quiet ? 0 : 1,
          y: 0,
          scale: leaving && !quiet ? 1.5 : 1,
          filter: leaving && !quiet ? "blur(5px)" : "blur(0px)",
        }}
        style={{ transformOrigin: "50% 50%", overflow: checking ? "visible" : "hidden" }}
        transition={{ ...transition, duration: quiet ? 0 : leaving ? LOGIN_MOTION.dive : LOGIN_MOTION.slow }}
        className={`relative rounded-2xl backdrop-blur-2xl border overflow-hidden ${
          isNight
            ? "bg-white/10 border-amber-500/30 shadow-gold-glow"
            : "bg-white/80 border-amber-300/60 shadow-2xl shadow-amber-500/20"
        }`}
      >
        {checking && (
          <div className="login-checking absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center" role="status" aria-live="polite" data-testid="login-checking">
            <motion.h1 layoutId={quiet ? undefined : "login-brand"}
              transition={{ duration: quiet ? 0 : 0.5, ease: LOGIN_MOTION.ease }}
              className="font-heading font-black tracking-tight text-5xl sm:text-6xl lg:text-7xl text-amber-600 mb-4"
              style={{ textShadow: "0 2px 20px rgba(255,191,0,0.2)" }}>
              BUSE KÂĞIT
            </motion.h1>
            <motion.div initial={quiet ? false : { opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: quiet ? 0 : 0.2, delay: quiet ? 0 : 0.3 }}
              className="flex flex-col items-center gap-3 text-black">
              <p className="font-mono text-sm font-semibold tracking-wider">
                {success ? "Giriş Onaylandı" : "Kontrol Ediliyor"}
              </p>
              {success ? <Check aria-hidden="true" className="w-5 h-5" /> : <LoaderCircle aria-hidden="true" className={`w-5 h-5 ${quiet ? "" : "animate-spin"}`} />}
            </motion.div>
          </div>
        )}
        {/* Subtle gradient glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" aria-hidden="true" />
        <div className="absolute -inset-px rounded-2xl pointer-events-none opacity-40"
             style={{ background: "radial-gradient(ellipse at top, rgba(251,191,36,0.18), transparent 60%)" }}
             aria-hidden="true" />

        <div className="relative p-7" style={{ visibility: checking ? "hidden" : "visible" }} aria-hidden={checking || undefined}>
          <div className="text-center mb-5">
            <motion.div
              initial={false} animate={{ scale: success && !quiet ? 1.04 : 1 }}
              transition={transition}
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-lg shadow-amber-500/40 mb-3"
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

          <form onSubmit={handleLogin} className="space-y-3" autoComplete="on" noValidate aria-busy={loading} aria-labelledby="login-title">
            <fieldset disabled={busy} className="space-y-3 min-w-0">
              <div className="login-field relative" data-filled={!!username}>
                <label htmlFor="login-username" className="sr-only-aaa">Kullanıcı adı</label>
                <UserIcon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isNight ? "text-amber-300/70" : "text-amber-700/70"}`} aria-hidden="true" />
                <input
                  id="login-username"
                  ref={userRef}
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  placeholder="Kullanıcı adı"
                  data-testid="login-username"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`w-full pl-10 pr-3 py-3 rounded-lg border outline-none ${
                    isNight
                      ? "bg-white/5 border-white/15 text-white placeholder-zinc-400 focus:border-amber-400 focus:bg-white/10 focus:ring-4 focus:ring-amber-400/20"
                      : "bg-white/70 border-zinc-300 text-zinc-900 placeholder-zinc-500 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-400/20"
                  }`}
                />
              </div>

              <div className="login-field relative" data-filled={!!password}>
                <label htmlFor="login-password" className="sr-only-aaa">Şifre</label>
                <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isNight ? "text-amber-300/70" : "text-amber-700/70"}`} aria-hidden="true" />
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Şifre"
                  data-testid="login-password"
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`w-full pl-10 pr-10 py-3 rounded-lg border outline-none ${
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
                  aria-controls="login-password"
                >
                  <motion.span key={String(showPw)} className="block" initial={quiet ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={transition}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </motion.span>
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

            </fieldset>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  initial={quiet ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: quiet ? "auto" : 0 }} transition={transition}
                  id="login-error"
                  data-testid="login-error"
                  className={`overflow-hidden text-sm ${isNight ? "text-rose-300" : "text-rose-700"} bg-rose-500/15 border border-rose-500/40 rounded-md px-3 py-2 font-medium`}
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={busy}
              data-testid="login-submit"
              whileTap={quiet || busy ? undefined : { scale: 0.99 }}
              transition={transition}
              className="btn-premium-gold login-submit w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-busy={loading}
            >
              <motion.span
                key={success ? "success" : loading ? "loading" : "idle"}
                initial={quiet ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }} transition={transition}
                className="inline-flex items-center justify-center gap-2"
              >
                {success ? <Check className="w-4 h-4" aria-hidden="true" /> : loading ? <LoaderCircle className={`w-4 h-4 ${quiet ? "" : "animate-spin"}`} aria-hidden="true" /> : <LogIn className="w-4 h-4" aria-hidden="true" />}
                {success ? "Giriş onaylandı" : loading ? "Giriş yapılıyor…" : "Giriş Yap"}
              </motion.span>
            </motion.button>
            <span role="status" aria-live="polite" className="sr-only">
              {success ? "Giriş onaylandı. Panel açılıyor." : loading ? "Giriş yapılıyor." : ""}
            </span>
          </form>

          {/* Canlı Pano alt geçişi */}
          <fieldset disabled={busy} className="mt-5 pt-5 border-t border-amber-500/10 min-w-0">
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
                initial={quiet ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={transition}
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
          </fieldset>

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
