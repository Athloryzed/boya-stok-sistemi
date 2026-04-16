import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Factory, ClipboardList, HardHat, Warehouse, Paintbrush, Truck, Sun, Moon, Monitor, Layers } from "lucide-react";

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
  { name: "Surucu", path: "/driver", icon: Truck, color: "#FB7185", desc: "Sevkiyat" },
  { name: "Canli Pano", path: "/dashboard", icon: Monitor, color: "#38BDF8", desc: "TV Dashboard" },
];

const Home = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const hour = time.getHours();
  const minutes = time.getMinutes();
  const isNight = hour < 6 || hour >= 20;
  const isDusk = (hour >= 18 && hour < 20) || (hour >= 6 && hour < 8);

  const dayProgress = useMemo(() => {
    const totalMin = hour * 60 + minutes;
    if (totalMin < 360) return 0;
    if (totalMin > 1200) return 1;
    return (totalMin - 360) / 840;
  }, [hour, minutes]);

  const sunX = 10 + dayProgress * 80;
  const sunY = 15 + Math.sin(dayProgress * Math.PI) * -10;

  const skyGradient = isNight
    ? "from-slate-900 via-indigo-950 to-slate-900"
    : isDusk
    ? "from-orange-300 via-pink-300 to-purple-400"
    : "from-sky-300 via-sky-200 to-emerald-100";

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
        <button onClick={toggleTheme}
          className="p-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
          data-testid="theme-toggle">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      {/* Sun / Moon */}
      <motion.div className="absolute z-10" style={{ left: `${sunX}%`, top: `${sunY}%` }}
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

      {/* Stars */}
      {isNight && [...Array(30)].map((_, i) => (
        <motion.div key={`star-${i}`} className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 40}%` }}
          animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }} />
      ))}

      {/* Clouds */}
      {!isNight && [...Array(4)].map((_, i) => (
        <motion.div key={`cloud-${i}`} className="absolute" style={{ top: `${8 + i * 7}%` }}
          animate={{ x: ["-20vw", "120vw"] }} transition={{ duration: 40 + i * 15, repeat: Infinity, ease: "linear", delay: i * 8 }}>
          <div className="flex gap-0">
            <div className={`rounded-full bg-white/60 ${i % 2 === 0 ? "w-20 h-8" : "w-16 h-6"}`} />
            <div className={`rounded-full bg-white/50 -ml-4 mt-1 ${i % 2 === 0 ? "w-14 h-6" : "w-10 h-5"}`} />
            <div className="rounded-full bg-white/40 -ml-3 mt-2 w-10 h-5" />
          </div>
        </motion.div>
      ))}

      {/* Cherry blossom petals */}
      {!isNight && petals.map(p => (
        <motion.div key={`petal-${p.id}`} className="absolute z-20 pointer-events-none"
          style={{ left: `${p.left}%`, top: -20, width: p.size, height: p.size * 0.7 }}
          animate={{ y: ["0vh", "110vh"], x: [0, Math.sin(p.id) * 60], rotate: [p.rotate, p.rotate + 360] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}>
          <svg viewBox="0 0 20 14" fill={p.color}><ellipse cx="10" cy="7" rx="10" ry="7" opacity="0.8" /></svg>
        </motion.div>
      ))}

      {/* Butterflies */}
      {!isNight && butterflies.map(b => (
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

      {/* Dusen balonlar (yumurta yerine) */}
      {fallingBalloons.map(bl => (
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

      {/* Dusen cocuk siluetleri */}
      {fallingChildren.map(ch => (
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
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <svg viewBox="0 0 1440 200" className="w-full" preserveAspectRatio="none">
          <path d="M0,120 C200,80 400,140 600,100 C800,60 1000,130 1200,90 C1300,70 1400,110 1440,100 L1440,200 L0,200 Z"
            fill={isNight ? "#1a3a1a" : "#4ade80"} />
          <path d="M0,150 C300,120 500,160 800,130 C1000,110 1200,155 1440,140 L1440,200 L0,200 Z"
            fill={isNight ? "#0f2a0f" : "#22c55e"} />
          <path d="M0,170 C200,160 600,180 900,165 C1100,155 1300,175 1440,170 L1440,200 L0,200 Z"
            fill={isNight ? "#0a1f0a" : "#16a34a"} />
        </svg>

        {/* Cicekler */}
        {!isNight && [...Array(12)].map((_, i) => (
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

        {/* Cimenlikte oynayan cocuklar (tavsanlar yerine) */}
        {groundChildren.map(c => (
          <motion.div key={`gc-${c.id}`} className="absolute z-20"
            style={{ left: `${c.left}%`, bottom: "30px" }}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: c.delay, ease: "easeInOut" }}>
            <ChildSvg size={22} variant={c.variant} />
          </motion.div>
        ))}

        {/* Bayrak tutan cocuklar (cimenlikte) */}
        {flagChildren.map(fc => (
          <motion.div key={`fc-${fc.id}`} className="absolute z-20"
            style={{ left: `${fc.left}%`, bottom: "25px" }}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: fc.id * 0.8, ease: "easeInOut" }}>
            <ChildWithFlag size={20} variant={fc.variant} />
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-30 flex flex-col items-center justify-center min-h-screen px-4 py-8">

        {/* 23 Nisan Banner */}
        <motion.div className="mb-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, type: "spring", stiffness: 200 }}>
          <motion.div
            className="px-5 py-2.5 rounded-full border backdrop-blur-md"
            style={{
              background: "linear-gradient(135deg, rgba(227,10,23,0.3), rgba(255,255,255,0.15), rgba(227,10,23,0.3))",
              borderColor: "rgba(255,255,255,0.5)",
            }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <span className="text-sm sm:text-base font-bold" style={{
              background: "linear-gradient(90deg, #E30A17, #FBBF24, #E30A17, #FBBF24)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              23 Nisan Ulusal Egemenlik ve Cocuk Bayrami Kutlu Olsun!
            </span>
          </motion.div>
        </motion.div>

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
        </motion.div>

        {/* Module cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 max-w-xl w-full">
          {modules.map((mod, i) => (
            <motion.div key={mod.path}
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: "easeOut" }}
              onClick={() => navigate(mod.path)}
              data-testid={`module-${mod.path.slice(1)}`}
              className="group cursor-pointer">
              <div className={`relative p-5 sm:p-6 rounded-2xl backdrop-blur-md border transition-all duration-300
                ${isNight
                  ? "bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40"
                  : "bg-white/60 border-white/80 hover:bg-white/80 hover:border-white shadow-lg hover:shadow-xl"
                } hover:-translate-y-1 active:scale-95`}>
                <mod.icon className="h-7 w-7 sm:h-8 sm:w-8 mx-auto mb-2" style={{ color: mod.color }} />
                <h3 className={`text-xs sm:text-sm font-bold text-center ${isNight ? "text-white" : "text-gray-800"}`}>{mod.name}</h3>
                <p className={`text-[10px] text-center mt-0.5 ${isNight ? "text-gray-400" : "text-gray-500"}`}>{mod.desc}</p>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ boxShadow: `0 0 30px ${mod.color}30, 0 0 60px ${mod.color}10` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
