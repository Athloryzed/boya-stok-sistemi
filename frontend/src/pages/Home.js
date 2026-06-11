import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { Factory, ClipboardList, HardHat, Warehouse, Paintbrush, Truck, Sun, Moon, Monitor, Layers, UtensilsCrossed, Package, Gauge, LogOut, ArrowRight, Cloud, CloudSun, CloudFog, CloudRain, CloudSnow, CloudLightning } from "lucide-react";
import { API } from "../App";
import UnifiedLogin from "../components/UnifiedLogin";
import { getSession, isSessionValid, clearSession, canAccessRoute } from "../lib/auth";
import { toast } from "sonner";

// Dalgalanan Türk Bayrağı bileşeni
const WavingFlag = () => (
  <div className="relative w-16 h-11 sm:w-20 sm:h-14" data-testid="turkish-flag">
    <svg viewBox="0 0 360 240" className="w-full h-full" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}>
      <defs>
        <linearGradient id="flagWave" x1="0%" y1="0%" x2="100%" y2="0%">
          <animate attributeName="x1" values="0%;5%;0%" dur="3s" repeatCount="indefinite" />
          <animate attributeName="x2" values="100%;95%;100%" dur="3s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <rect width="360" height="240" fill="#E30A17" rx="4">
        <animate attributeName="rx" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </rect>
      <circle cx="152" cy="120" r="60" fill="white" />
      <circle cx="168" cy="120" r="48" fill="#E30A17" />
      <polygon points="228,120 213,130 218,148 203,136 188,148 193,130 178,120 196,120 203,102 210,120" fill="white" />
    </svg>
    <div className="absolute inset-0 pointer-events-none" style={{
      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 30%, transparent 50%, rgba(0,0,0,0.06) 70%, transparent 100%)",
      animation: "flagWave 2.5s ease-in-out infinite"
    }} />
  </div>
);

// Cocuk SVG - minimal, sevimli silüet
const ChildSvg = ({ color = "#E30A17", size = 28, variant = 0 }) => {
  const hairColors = ["#4A3728", "#2C1810", "#8B6914", "#1a1a1a"];
  const shirtColors = [color, "#E30A17", "#2563EB", "#FBBF24", "#10B981"];
  const hair = hairColors[variant % hairColors.length];
  const shirt = shirtColors[variant % shirtColors.length];
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 28 45">
      {/* Sac */}
      <ellipse cx="14" cy="10" rx="8" ry="8" fill={hair} />
      {/* Yuz */}
      <circle cx="14" cy="12" r="6.5" fill="#FDDCB5" />
      {/* Gozler */}
      <circle cx="11.5" cy="11" r="1.2" fill="#333" />
      <circle cx="16.5" cy="11" r="1.2" fill="#333" />
      <circle cx="12" cy="10.6" r="0.4" fill="white" />
      <circle cx="17" cy="10.6" r="0.4" fill="white" />
      {/* Gulus */}
      <path d="M11,14.5 Q14,17 17,14.5" stroke="#D4756B" strokeWidth="0.8" fill="none" />
      {/* Yanaklar */}
      <circle cx="9.5" cy="13.5" r="1.5" fill="#FFB7B7" opacity="0.5" />
      <circle cx="18.5" cy="13.5" r="1.5" fill="#FFB7B7" opacity="0.5" />
      {/* Govde - tisort */}
      <path d="M7,20 Q7,18 14,18 Q21,18 21,20 L22,33 Q14,35 6,33 Z" fill={shirt} />
      {/* Kollar */}
      <path d="M7,20 L3,28" stroke={shirt} strokeWidth="3" strokeLinecap="round" />
      <path d="M21,20 L25,28" stroke={shirt} strokeWidth="3" strokeLinecap="round" />
      {/* Eller */}
      <circle cx="3" cy="28.5" r="2" fill="#FDDCB5" />
      <circle cx="25" cy="28.5" r="2" fill="#FDDCB5" />
      {/* Bacaklar */}
      <rect x="9" y="33" width="3.5" height="8" rx="1.5" fill="#4A5568" />
      <rect x="15.5" y="33" width="3.5" height="8" rx="1.5" fill="#4A5568" />
      {/* Ayakkabilar */}
      <ellipse cx="10.5" cy="42" rx="3" ry="1.5" fill="#333" />
      <ellipse cx="17.5" cy="42" rx="3" ry="1.5" fill="#333" />
    </svg>
  );
};

// Bayrak tutan cocuk
const ChildWithFlag = ({ size = 32, variant = 0 }) => (
  <svg width={size} height={size * 1.6} viewBox="0 0 36 55">
    {/* Bayrak sopasi */}
    <line x1="26" y1="2" x2="26" y2="28" stroke="#8B6914" strokeWidth="1.2" />
    {/* Mini bayrak */}
    <rect x="26" y="2" width="10" height="7" fill="#E30A17" rx="0.5">
      <animate attributeName="width" values="10;9.5;10" dur="1.5s" repeatCount="indefinite" />
    </rect>
    <circle cx="30" cy="5" r="1.8" fill="white" />
    <circle cx="30.7" cy="5" r="1.3" fill="#E30A17" />
    {/* Cocuk govdesi */}
    <g transform="translate(2, 8)">
      <ellipse cx="14" cy="10" rx="7" ry="7" fill={["#4A3728", "#2C1810", "#8B6914"][variant % 3]} />
      <circle cx="14" cy="12" r="5.5" fill="#FDDCB5" />
      <circle cx="12" cy="11" r="1" fill="#333" />
      <circle cx="16" cy="11" r="1" fill="#333" />
      <path d="M11.5,14 Q14,16 16.5,14" stroke="#D4756B" strokeWidth="0.7" fill="none" />
      <circle cx="10" cy="13" r="1.2" fill="#FFB7B7" opacity="0.4" />
      <circle cx="18" cy="13" r="1.2" fill="#FFB7B7" opacity="0.4" />
      <path d="M8,19 Q8,17 14,17 Q20,17 20,19 L21,30 Q14,32 7,30 Z" fill={["#E30A17", "#2563EB", "#FBBF24", "#10B981"][variant % 4]} />
      <path d="M8,19 L5,25" stroke={["#E30A17", "#2563EB", "#FBBF24", "#10B981"][variant % 4]} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20,19 L23,14" stroke={["#E30A17", "#2563EB", "#FBBF24", "#10B981"][variant % 4]} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="5" cy="25.5" r="1.8" fill="#FDDCB5" />
      <circle cx="23.5" cy="13.5" r="1.8" fill="#FDDCB5" />
      <rect x="10" y="30" width="3" height="7" rx="1.2" fill="#4A5568" />
      <rect x="15" y="30" width="3" height="7" rx="1.2" fill="#4A5568" />
      <ellipse cx="11.5" cy="38" rx="2.5" ry="1.3" fill="#333" />
      <ellipse cx="16.5" cy="38" rx="2.5" ry="1.3" fill="#333" />
    </g>
  </svg>
);

// Balon SVG
const Balloon = ({ color, size = 20 }) => (
  <svg width={size} height={size * 1.8} viewBox="0 0 20 36">
    <ellipse cx="10" cy="12" rx="8" ry="10" fill={color} />
    <ellipse cx="8" cy="9" rx="2.5" ry="3" fill="white" opacity="0.3" />
    <polygon points="10,22 8,24 12,24" fill={color} />
    <path d="M10,24 Q8,28 10,32 Q12,28 10,24" stroke="#999" strokeWidth="0.5" fill="none" />
  </svg>
);

const modules = [
  { name: "Yonetim Paneli", path: "/management", icon: Factory, color: "#FFBF00", desc: "Fabrika yonetimi" },
  { name: "Plan", path: "/plan", icon: ClipboardList, color: "#60A5FA", desc: "Is planlama" },
  { name: "Operator", path: "/operator", icon: HardHat, color: "#34D399", desc: "Uretim takibi" },
  { name: "Depo", path: "/warehouse", icon: Warehouse, color: "#F97316", desc: "Stok yonetimi" },
  { name: "Boya", path: "/paint", icon: Paintbrush, color: "#A78BFA", desc: "Boya takibi" },
  { name: "Bobin", path: "/bobin", icon: Layers, color: "#10B981", desc: "Bobin takibi" },
  { name: "Marka/Koli Stok", path: "/marka-stok", icon: Package, color: "#22C55E", desc: "Stok takibi" },
  { name: "Surucu", path: "/driver", icon: Truck, color: "#FB7185", desc: "Sevkiyat" },
  { name: "Canli Pano", path: "/dashboard", icon: Monitor, color: "#38BDF8", desc: "TV Dashboard" },
];

// WMO hava kodu → sahne kategorisi
const weatherCategory = (code) => {
  if (code === null || code === undefined) return "clear";
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "thunder";
  return "clear";
};
const WEATHER_LABEL_TR = {
  clear: "Açık", partly: "Parçalı Bulutlu", cloudy: "Kapalı", fog: "Sisli",
  rain: "Yağmurlu", snow: "Karlı", thunder: "Gök Gürültülü",
};
const WEATHER_ICON = {
  clear: Sun, partly: CloudSun, cloudy: Cloud, fog: CloudFog,
  rain: CloudRain, snow: CloudSnow, thunder: CloudLightning,
};

const Home = ({ theme, toggleTheme, liteMode, toggleLiteMode }) => {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [yonetimSheetOpen, setYonetimSheetOpen] = useState(false);
  const [session, setSession] = useState(() => (isSessionValid() ? getSession() : null));
  const isYonetimUser = !!(session && (session.role === "yonetim" || (session.roles || []).includes("yonetim")));
  const [todayMenu, setTodayMenu] = useState(null);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    axios.get(`${API}/menu/today`)
      .then(res => setTodayMenu(res.data))
      .catch(() => setTodayMenu(null));
    // İstanbul hava durumu — 30 dakikada bir yenile (backend 30 dk önbellekli)
    const fetchWeather = () =>
      axios.get(`${API}/weather/istanbul`)
        .then(res => setWeather(res.data))
        .catch(() => {});
    fetchWeather();
    const w = setInterval(fetchWeather, 30 * 60000);
    const reloadSession = () => setSession(isSessionValid() ? getSession() : null);
    window.addEventListener("storage", reloadSession);
    return () => { clearInterval(t); clearInterval(w); window.removeEventListener("storage", reloadSession); };
  }, []);

  const handleLogout = () => {
    clearSession();
    setSession(null);
    toast.info("Çıkış yapıldı");
  };

  const handleModuleClick = (path) => {
    if (!canAccessRoute(path)) {
      toast.error("Bu panele erişim yetkiniz yok");
      return;
    }
    navigate(path);
  };

  const hour = time.getHours();
  const minutes = time.getMinutes();
  const isNight = hour < 6 || hour >= 20;
  const isDusk = (hour >= 18 && hour < 20) || (hour >= 6 && hour < 8);

  // Hava durumu türevleri (?hava=rain|snow|thunder|fog|cloudy|partly|clear ile önizleme yapılabilir)
  const forcedWcat = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("hava") : null;
  const wcat = forcedWcat && WEATHER_LABEL_TR[forcedWcat] ? forcedWcat : weatherCategory(weather?.weather_code);
  const windy = (weather?.wind_speed_kmh || 0) >= 30;
  const hideSun = wcat === "rain" || wcat === "thunder" || wcat === "fog";
  const groundFills = wcat === "snow"
    ? (isNight ? ["#39414f", "#2c3340", "#212733"] : ["#F1F5F9", "#E2E8F0", "#CBD5E1"])
    : (isNight ? ["#1a3a1a", "#0f2a0f", "#0a1f0a"] : ["#4ade80", "#22c55e", "#16a34a"]);

  // 23 Nisan teması: yalnızca Nisan ayı boyunca (1-30 Nisan) aktif.
  // Mayıs sonrası balon yağmuru, çocuk siluetleri, bayraklı çocuklar gizlenir.
  const isAprilTheme = time.getMonth() === 3; // 0=Ocak, 3=Nisan

  const dayProgress = useMemo(() => {
    const totalMin = hour * 60 + minutes;
    if (totalMin < 360) return 0;
    if (totalMin > 1200) return 1;
    return (totalMin - 360) / 840;
  }, [hour, minutes]);

  const sunX = 10 + dayProgress * 80;
  const sunY = 15 + Math.sin(dayProgress * Math.PI) * -10;

  // Gökyüzü: hava durumu + saat kombinasyonu
  const skyGradient = (() => {
    if (wcat === "thunder") return isNight ? "from-slate-950 via-slate-900 to-indigo-950" : "from-slate-800 via-slate-600 to-slate-500";
    if (wcat === "rain") return isNight ? "from-slate-900 via-slate-800 to-slate-700" : "from-slate-600 via-slate-400 to-slate-300";
    if (wcat === "snow") return isNight ? "from-slate-900 via-indigo-900 to-slate-700" : "from-slate-400 via-blue-100 to-white";
    if (wcat === "fog") return isNight ? "from-gray-900 via-gray-800 to-gray-700" : "from-gray-400 via-gray-300 to-gray-200";
    if (wcat === "cloudy") return isNight ? "from-slate-900 via-slate-800 to-slate-800" : "from-sky-400 via-gray-200 to-gray-100";
    return isNight
      ? "from-slate-900 via-indigo-950 to-slate-900"
      : isDusk
      ? "from-orange-300 via-pink-300 to-purple-400"
      : "from-sky-300 via-sky-200 to-emerald-100";
  })();

  // Petals
  const petals = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 8,
      duration: 6 + Math.random() * 6, size: 8 + Math.random() * 12,
      rotate: Math.random() * 360,
      color: ["#FFB7C5", "#FFC0CB", "#FFD1DC", "#FADADD", "#F8C8DC", "#fff"][Math.floor(Math.random() * 6)]
    })), []);

  // Butterflies
  const butterflies = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i, startX: 10 + Math.random() * 80, startY: 30 + Math.random() * 30,
      delay: Math.random() * 5,
      color: ["#FFBF00", "#60A5FA", "#F97316", "#A78BFA", "#34D399"][i]
    })), []);

  // Yağmur damlaları
  const rainDrops = useMemo(() =>
    Array.from({ length: 38 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 1.4,
      duration: 0.9 + Math.random() * 0.6, len: 14 + Math.random() * 12,
    })), []);

  // Kar taneleri
  const snowFlakes = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 10,
      duration: 9 + Math.random() * 7, size: 4 + Math.random() * 5,
    })), []);

  // Dusen balonlar (yumurtalar yerine)
  const fallingBalloons = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i, left: 5 + Math.random() * 90,
      delay: Math.random() * 10, duration: 8 + Math.random() * 6,
      size: 16 + Math.random() * 10,
      color: ["#E30A17", "#FBBF24", "#2563EB", "#10B981", "#E30A17", "#F472B6", "#60D5FA"][i % 7],
    })), []);

  // Dusen cocuk siluetleri (bazi balonlarla karisik)
  const fallingChildren = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i, left: 8 + Math.random() * 84,
      delay: Math.random() * 12, duration: 10 + Math.random() * 6,
      size: 14 + Math.random() * 8, variant: i,
    })), []);

  // Cimenlikte oynayan cocuklar (tavsanlar yerine)
  const groundChildren = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i, left: 12 + i * 22 + Math.random() * 8, delay: i * 1.2, variant: i,
    })), []);

  // Cimenlikte bayrak tutan cocuklar (yumurtalar yerine)
  const flagChildren = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i, left: 6 + i * 18 + Math.random() * 6, variant: i,
    })), []);

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-700 bg-gradient-to-b ${skyGradient}`}>
      {/* Sol üst: Atatürk */}
      <motion.div
        className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        data-testid="ataturk-image"
      >
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-white/50 shadow-lg backdrop-blur-sm bg-white/20">
          <img src="/ataturk.jpg" alt="Ataturk" className="w-full h-full object-cover" />
        </div>
      </motion.div>

      {/* Sağ üst: Bayrak + Tema */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center gap-2">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
          <WavingFlag />
        </motion.div>
        <button onClick={toggleLiteMode}
          className={`p-2 rounded-full backdrop-blur-sm border text-white transition-all ${liteMode ? "bg-emerald-500/40 border-emerald-300" : "bg-white/20 border-white/30 hover:bg-white/30"}`}
          data-testid="lite-toggle"
          title={liteMode ? "Hafif Mod açık — kapatmak için bas" : "Hafif Mod (animasyonsuz, hızlı)"}>
          <Gauge className="h-5 w-5" />
        </button>
        <button onClick={toggleTheme}
          className="p-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
          data-testid="theme-toggle">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {/* Sun / Moon — yağmur/fırtına/sis varken gizli, kapalı havada soluk */}
      {!hideSun && (
      <motion.div className="absolute z-10 pointer-events-none" style={{ left: `${sunX}%`, top: `${sunY}%`, opacity: wcat === "cloudy" ? 0.4 : 1 }}
        animate={{ left: `${sunX}%`, top: `${sunY}%` }} transition={{ duration: 2, ease: "easeInOut" }}>
        {isNight ? (
          <div className="w-16 h-16 rounded-full bg-gray-200 shadow-[0_0_40px_rgba(255,255,255,0.3)] relative">
            <div className="absolute top-2 left-3 w-4 h-4 rounded-full bg-gray-300/60" />
            <div className="absolute top-6 left-8 w-2 h-2 rounded-full bg-gray-300/40" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-yellow-300 shadow-[0_0_60px_rgba(255,200,0,0.5),0_0_120px_rgba(255,200,0,0.2)]">
            {[...Array(8)].map((_, i) => (
              <motion.div key={i} className="absolute w-1 h-6 bg-yellow-300/40 rounded-full"
                style={{ left: "50%", top: "50%", transformOrigin: "center -20px", transform: `translate(-50%, -50%) rotate(${i * 45}deg)` }}
                animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }} />
            ))}
          </div>
        )}
      </motion.div>
      )}

      {/* Stars — sadece açık/az bulutlu gecelerde */}
      {isNight && (wcat === "clear" || wcat === "partly") && [...Array(30)].map((_, i) => (
        <motion.div key={`star-${i}`} className="absolute w-1 h-1 bg-white rounded-full pointer-events-none"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 40}%` }}
          animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }} />
      ))}

      {/* Clouds — hava durumuna göre yoğunluk, renk ve hız */}
      {(() => {
        if (wcat === "fog") return null;
        const showClouds = !isNight || wcat === "rain" || wcat === "thunder" || wcat === "cloudy";
        if (!showClouds) return null;
        const count = wcat === "cloudy" ? 7 : (wcat === "rain" || wcat === "thunder" || wcat === "snow") ? 6 : 4;
        const dark = wcat === "rain" || wcat === "thunder";
        const c1 = dark ? "bg-slate-500/70" : "bg-white/60";
        const c2 = dark ? "bg-slate-600/60" : "bg-white/50";
        const c3 = dark ? "bg-slate-700/50" : "bg-white/40";
        return [...Array(count)].map((_, i) => (
          <motion.div key={`cloud-${i}`} className="absolute pointer-events-none" style={{ top: `${6 + i * 6}%` }}
            animate={{ x: ["-20vw", "120vw"] }}
            transition={{ duration: (40 + i * 12) / (windy ? 2 : 1), repeat: Infinity, ease: "linear", delay: i * (windy ? 3 : 7) }}>
            <div className="flex gap-0">
              <div className={`rounded-full ${c1} ${i % 2 === 0 ? "w-20 h-8" : "w-16 h-6"}`} />
              <div className={`rounded-full ${c2} -ml-4 mt-1 ${i % 2 === 0 ? "w-14 h-6" : "w-10 h-5"}`} />
              <div className={`rounded-full ${c3} -ml-3 mt-2 w-10 h-5`} />
            </div>
          </motion.div>
        ));
      })()}

      {/* YAĞMUR — İstanbul'da yağmur/fırtına varsa */}
      {(wcat === "rain" || wcat === "thunder") && !liteMode && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" data-testid="weather-rain">
          {rainDrops.map(d => (
            <span key={`rd-${d.id}`} className="rain-drop"
              style={{ left: `${d.left}%`, height: d.len, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s`, "--rain-drift": windy ? "70px" : "22px" }} />
          ))}
        </div>
      )}

      {/* KAR */}
      {wcat === "snow" && !liteMode && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" data-testid="weather-snow">
          {snowFlakes.map(f => (
            <span key={`sf-${f.id}`} className="snow-flake"
              style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDelay: `${f.delay}s`, animationDuration: `${f.duration}s` }} />
          ))}
        </div>
      )}

      {/* ŞİMŞEK */}
      {wcat === "thunder" && !liteMode && (
        <>
          <div className="lightning-flash absolute inset-0 z-30 pointer-events-none" data-testid="weather-thunder" />
          <svg className="lightning-bolt absolute z-20 pointer-events-none" style={{ left: "28%", top: "8%" }} width="46" height="90" viewBox="0 0 46 90">
            <path d="M28 0 L8 44 L20 44 L12 90 L40 36 L26 36 Z" fill="#FFE08A" opacity="0.9" />
          </svg>
        </>
      )}

      {/* SİS */}
      {wcat === "fog" && !liteMode && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" data-testid="weather-fog">
          {[0, 1, 2].map(i => (
            <div key={`fb-${i}`} className="fog-band"
              style={{ top: `${26 + i * 22}%`, animationDuration: `${36 + i * 14}s`, animationDelay: `${i * -12}s`, opacity: 0.34 - i * 0.06 }} />
          ))}
        </div>
      )}

      {/* Cherry blossom petals — sadece sakin havada */}
      {!isNight && (wcat === "clear" || wcat === "partly") && petals.map(p => (
        <motion.div key={`petal-${p.id}`} className="absolute z-20 pointer-events-none"
          style={{ left: `${p.left}%`, top: -20, width: p.size, height: p.size * 0.7 }}
          animate={{ y: ["0vh", "110vh"], x: [0, Math.sin(p.id) * 60], rotate: [p.rotate, p.rotate + 360] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}>
          <svg viewBox="0 0 20 14" fill={p.color}><ellipse cx="10" cy="7" rx="10" ry="7" opacity="0.8" /></svg>
        </motion.div>
      ))}

      {/* Butterflies — sadece sakin havada */}
      {!isNight && (wcat === "clear" || wcat === "partly") && butterflies.map(b => (
        <motion.div key={`bf-${b.id}`} className="absolute z-20 pointer-events-none"
          style={{ left: `${b.startX}%`, top: `${b.startY}%` }}
          animate={{ x: [0, 80, -40, 60, 0], y: [0, -30, 20, -50, 0] }}
          transition={{ duration: 12, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}>
          <motion.svg width="20" height="16" viewBox="0 0 20 16" animate={{ scaleX: [1, 0.3, 1] }} transition={{ duration: 0.4, repeat: Infinity }}>
            <ellipse cx="6" cy="6" rx="5" ry="6" fill={b.color} opacity="0.7" />
            <ellipse cx="14" cy="6" rx="5" ry="6" fill={b.color} opacity="0.7" />
            <ellipse cx="6" cy="11" rx="3" ry="4" fill={b.color} opacity="0.5" />
            <ellipse cx="14" cy="11" rx="3" ry="4" fill={b.color} opacity="0.5" />
            <rect x="9.5" y="2" width="1" height="12" rx="0.5" fill="#333" />
          </motion.svg>
        </motion.div>
      ))}

      {/* Dusen balonlar (yumurta yerine) — yalnızca Nisan */}
      {isAprilTheme && !liteMode && fallingBalloons.map(bl => (
        <motion.div key={`fbl-${bl.id}`} className="absolute z-20 pointer-events-none"
          style={{ left: `${bl.left}%`, top: -40 }}
          animate={{
            y: ["0vh", "110vh"],
            x: [0, Math.sin(bl.id * 0.9) * 30],
            rotate: [-10, 10, -10],
          }}
          transition={{ duration: bl.duration, repeat: Infinity, delay: bl.delay, ease: "linear" }}>
          <Balloon color={bl.color} size={bl.size} />
        </motion.div>
      ))}

      {/* Dusen cocuk siluetleri — yalnızca Nisan */}
      {isAprilTheme && !liteMode && fallingChildren.map(ch => (
        <motion.div key={`fch-${ch.id}`} className="absolute z-20 pointer-events-none"
          style={{ left: `${ch.left}%`, top: -60 }}
          animate={{
            y: ["0vh", "108vh"],
            x: [0, Math.sin(ch.id * 1.2) * 50],
            rotate: [0, ch.id % 2 === 0 ? 15 : -15, 0],
          }}
          transition={{ duration: ch.duration, repeat: Infinity, delay: ch.delay, ease: "linear" }}>
          <ChildSvg size={ch.size} variant={ch.variant} />
        </motion.div>
      ))}

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <svg viewBox="0 0 1440 200" className="w-full" preserveAspectRatio="none">
          <path d="M0,120 C200,80 400,140 600,100 C800,60 1000,130 1200,90 C1300,70 1400,110 1440,100 L1440,200 L0,200 Z"
            fill={groundFills[0]} />
          <path d="M0,150 C300,120 500,160 800,130 C1000,110 1200,155 1440,140 L1440,200 L0,200 Z"
            fill={groundFills[1]} />
          <path d="M0,170 C200,160 600,180 900,165 C1100,155 1300,175 1440,170 L1440,200 L0,200 Z"
            fill={groundFills[2]} />
        </svg>

        {/* Cicekler — karda gizli */}
        {!isNight && wcat !== "snow" && [...Array(12)].map((_, i) => (
          <motion.div key={`flower-${i}`} className="absolute"
            style={{ left: `${5 + i * 8}%`, bottom: `${20 + Math.sin(i) * 15}px` }}
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}>
            <svg width="14" height="14" viewBox="0 0 14 14">
              {[0, 72, 144, 216, 288].map((angle, j) => (
                <ellipse key={j} cx="7" cy="3" rx="2.5" ry="3"
                  fill={["#FFB7C5", "#FFD700", "#FF6B6B", "#DDA0DD", "#87CEEB"][j]}
                  transform={`rotate(${angle}, 7, 7)`} opacity="0.9" />
              ))}
              <circle cx="7" cy="7" r="2" fill="#FFD700" />
            </svg>
          </motion.div>
        ))}

        {/* Cimenlikte oynayan cocuklar — yalnızca Nisan */}
        {isAprilTheme && groundChildren.map(c => (
          <motion.div key={`gc-${c.id}`} className="absolute z-20 pointer-events-none"
            style={{ left: `${c.left}%`, bottom: "30px" }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: c.delay, ease: "easeInOut" }}>
            <ChildSvg size={22} variant={c.variant} />
          </motion.div>
        ))}

        {/* Bayrak tutan cocuklar (cimenlikte) — yalnızca Nisan */}
        {isAprilTheme && flagChildren.map(fc => (
          <motion.div key={`fc-${fc.id}`} className="absolute z-20 pointer-events-none"
            style={{ left: `${fc.left}%`, bottom: "25px" }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: fc.id * 0.8, ease: "easeInOut" }}>
            <ChildWithFlag size={20} variant={fc.variant} />
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-30 flex flex-col items-center justify-center min-h-screen px-4 pt-24 sm:pt-28 pb-8">

        {/* Title */}
        <motion.div className="text-center mb-10"
          initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}>
          <h1 className={`text-4xl sm:text-5xl font-black tracking-tight mb-2 ${isNight ? "text-white" : "text-gray-800"}`}
            style={{ fontFamily: "'Barlow Condensed', sans-serif", textShadow: isNight ? "0 2px 20px rgba(255,255,255,0.2)" : "0 2px 10px rgba(0,0,0,0.1)" }}>
            BUSE KAGIT
          </h1>
          <p className={`text-sm sm:text-base font-medium ${isNight ? "text-gray-300" : "text-gray-600"}`}>
            Uretim Yonetim Sistemi
          </p>
          <p className={`text-xs mt-1 ${isNight ? "text-gray-400" : "text-gray-500"}`}>
            {time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          {/* İstanbul canlı hava durumu rozeti */}
          {weather && weather.temperature_c !== null && weather.temperature_c !== undefined && (() => {
            const WIcon = WEATHER_ICON[wcat] || Sun;
            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                data-testid="weather-chip"
                className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold ${
                  isNight ? "bg-white/10 border-white/20 text-white" : "bg-white/60 border-white/80 text-gray-700"
                }`}
              >
                <WIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>{Math.round(weather.temperature_c)}°C</span>
                <span className="opacity-60">·</span>
                <span>{WEATHER_LABEL_TR[wcat]}</span>
                <span className="opacity-60">·</span>
                <span className="opacity-80">İstanbul</span>
                {windy && <span className="ml-1 text-[10px] opacity-70">💨 {Math.round(weather.wind_speed_kmh)} km/s</span>}
              </motion.div>
            );
          })()}
        </motion.div>

        {/* Bugünün Yemek Menüsü — tüm çalışanlara açık */}
        {todayMenu && todayMenu.exists && Array.isArray(todayMenu.items) && todayMenu.items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5, type: "spring", stiffness: 120 }}
            className="w-full max-w-xl mb-6"
            data-testid="home-today-menu"
          >
            <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-orange-600/30 ring-1 ring-white/20">
              {/* Strong solid gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500" />
              {/* Decorative blobs for depth */}
              <div className="absolute -top-20 -right-10 w-56 h-56 rounded-full bg-yellow-300/35 blur-3xl" />
              <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-rose-700/35 blur-3xl" />
              {/* Subtle grain overlay */}
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")" }} />

              <div className="relative px-5 py-5 sm:px-7 sm:py-6 text-white">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: [0, -10, 10, -5, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/95 flex items-center justify-center shadow-xl shadow-black/20"
                    >
                      <UtensilsCrossed className="h-6 w-6 sm:h-7 sm:w-7 text-orange-600" />
                    </motion.div>
                    <div className="leading-tight">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-white text-orange-700 text-[10px] font-black tracking-widest uppercase shadow">Bugün</span>
                      <h3 className="text-xl sm:text-2xl font-heading font-black text-white mt-1 drop-shadow-md">Yemek Menüsü</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl sm:text-5xl font-black text-white leading-none drop-shadow-md">
                      {new Date(todayMenu.date).toLocaleDateString("tr-TR", { day: "2-digit" })}
                    </p>
                    <p className="text-[11px] sm:text-xs text-white/95 font-bold uppercase tracking-wider mt-1">
                      {new Date(todayMenu.date).toLocaleDateString("tr-TR", { weekday: "long", month: "short" })}
                    </p>
                  </div>
                </div>

                {/* Items as chips */}
                <div className="flex flex-wrap gap-2">
                  {todayMenu.items.map((it, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.85, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.4 + idx * 0.06, type: "spring", stiffness: 180 }}
                      className="group flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-white/95 backdrop-blur-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                    >
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-inner">
                        {idx + 1}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-zinc-800">{it}</span>
                    </motion.div>
                  ))}
                </div>

                {todayMenu.notes && (
                  <div className="mt-4 pt-3 border-t border-white/30 flex items-start gap-2">
                    <span className="text-lg leading-tight">💬</span>
                    <p className="text-xs sm:text-sm text-white/95 italic leading-relaxed font-medium">{todayMenu.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}


        {/* Module cards - Sadece erişebileceği paneller görünür */}
        {(() => {
          // Auth durumuna göre modülleri filtrele
          const visibleModules = session
            ? modules.filter((m) => m.path === "/dashboard" || canAccessRoute(m.path))
            : [];
          if (!session) return null;
          const featured = new Set(["/management", "/dashboard"]);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl w-full">
              {visibleModules.map((mod, i) => {
                const isFeatured = featured.has(mod.path);
                return (
                  <motion.div key={mod.path}
                    initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => handleModuleClick(mod.path)}
                    data-testid={`module-${mod.path.slice(1)}`}
                    className={`group cursor-pointer ${isFeatured ? "col-span-2" : ""}`}>
                    <div className={`bento-card relative h-full rounded-2xl backdrop-blur-xl border p-4 sm:p-5 ${isFeatured ? "flex items-center" : ""}
                      ${isNight
                        ? "bg-white/[0.08] border-white/15 hover:bg-white/[0.14] hover:border-white/30"
                        : "bg-white/60 border-white/80 hover:bg-white/85 hover:border-white shadow-lg hover:shadow-xl"
                      }`}>
                      <span className="bento-topline" />
                      {isFeatured ? (
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                            style={{ background: `linear-gradient(135deg, ${mod.color}33, ${mod.color}0F)`, border: `1px solid ${mod.color}55`, boxShadow: `0 4px 16px ${mod.color}22` }}>
                            <mod.icon className="h-6 w-6" style={{ color: mod.color }} />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <h3 className={`text-sm sm:text-base font-bold leading-tight ${isNight ? "text-white" : "text-gray-800"}`}>{mod.name}</h3>
                            <p className={`text-[10px] sm:text-xs mt-0.5 ${isNight ? "text-gray-400" : "text-gray-500"}`}>{mod.desc}</p>
                          </div>
                          <ArrowRight className={`bento-arrow h-4 w-4 shrink-0 ${isNight ? "text-white/70" : "text-gray-600"}`} />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center mb-2 transition-transform duration-300 group-hover:scale-110"
                            style={{ background: `linear-gradient(135deg, ${mod.color}33, ${mod.color}0F)`, border: `1px solid ${mod.color}55`, boxShadow: `0 4px 16px ${mod.color}22` }}>
                            <mod.icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: mod.color }} />
                          </div>
                          <h3 className={`text-xs sm:text-sm font-bold text-center ${isNight ? "text-white" : "text-gray-800"}`}>{mod.name}</h3>
                          <p className={`text-[10px] text-center mt-0.5 ${isNight ? "text-gray-400" : "text-gray-500"}`}>{mod.desc}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{ boxShadow: `0 0 30px ${mod.color}30, 0 0 60px ${mod.color}10, inset 0 0 0 1px ${mod.color}25` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          );
        })()}

        {/* Giriş kartı — auth yoksa göster */}
        {!session && (
          <UnifiedLogin isNight={isNight} onAuthenticated={(u) => setSession(getSession())} />
        )}

        {/* Hoşgeldin + Çıkış (auth varsa) */}
        {session && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            data-testid="welcome-bar"
            className={`mt-2 flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md border ${
              isNight ? "bg-white/10 border-white/20 text-white" : "bg-white/70 border-white/80 text-zinc-800"
            }`}
          >
            <span className="text-xs">
              <span className="opacity-70">Giriş:</span>{" "}
              <span className="font-semibold">{session.display_name || session.username}</span>{" "}
              <span className="text-amber-400/90 font-mono text-[10px]">
                ({(session.roles || [session.role]).join(", ")})
              </span>
            </span>
            <button
              onClick={handleLogout}
              data-testid="home-logout-btn"
              className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-3 h-3" /> Çıkış
            </button>
          </motion.div>
        )}
      </div>

      {/* YONETIM HIZLI PANEL */}
      {isYonetimUser && (
        <>
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 250 }}
            onClick={() => setYonetimSheetOpen(true)}
            data-testid="yonetim-quick-fab"
            className="fixed bottom-5 right-5 z-50 h-14 px-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-xl shadow-amber-500/30 flex items-center gap-2 text-zinc-900 font-semibold text-sm hover:scale-105 active:scale-95 transition-transform"
            aria-label="Yonetim Hizli Panel Gecisi"
          >
            <span className="text-lg">👑</span>
            <span className="hidden sm:inline">Hızlı Panel</span>
            <span className="sm:hidden">Panel</span>
          </motion.button>

          {yonetimSheetOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => setYonetimSheetOpen(false)}
                className="fixed inset-0 bg-black/70 z-50" />
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }}
                transition={{ type: "spring", damping: 26, stiffness: 260 }}
                className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1f2e] border-t border-white/[0.08] rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
                data-testid="yonetim-quick-sheet"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <span>👑</span> Yönetim Hızlı Panel
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">İstediğiniz panele tek dokunuşla geçin</p>
                  </div>
                  <button onClick={() => setYonetimSheetOpen(false)} className="text-zinc-500 hover:text-white text-2xl leading-none">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { path: "/management", label: "Yönetim", icon: "📊", color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300" },
                    { path: "/plan", label: "Planlama", icon: "📋", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300" },
                    { path: "/operator", label: "Operatör", icon: "👷", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300" },
                    { path: "/warehouse", label: "Depo", icon: "📦", color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300" },
                    { path: "/bobin", label: "Bobin", icon: "📜", color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-300" },
                    { path: "/marka-stok", label: "Marka/Koli", icon: "🏷️", color: "from-green-500/20 to-green-600/10 border-green-500/30 text-green-300" },
                    { path: "/dashboard", label: "Canlı TV", icon: "📺", color: "from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-300" },
                  ].map(p => (
                    <button
                      key={p.path}
                      onClick={() => { setYonetimSheetOpen(false); navigate(p.path); }}
                      data-testid={`yonetim-quick-${p.path.slice(1)}`}
                      className={`bg-gradient-to-br ${p.color} border rounded-xl p-4 flex flex-col items-center gap-1.5 hover:scale-[1.02] active:scale-95 transition-transform`}
                    >
                      <span className="text-2xl">{p.icon}</span>
                      <span className="text-sm font-medium">{p.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 mt-4 text-center leading-relaxed">
                  Yonetim rolune sahip oldugunuz icin tum panellere erisebilirsiniz.<br/>
                  Ilk girisinizde sifrenizle giris yapmaniz istenebilir; sonrasinda 24 saat boyunca otomatik kalir.
                </p>
              </motion.div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
