import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Factory, ClipboardList, HardHat, Warehouse, Paintbrush, Truck, Sun, Moon } from "lucide-react";

const modules = [
  { name: "Yonetim Paneli", path: "/management", icon: Factory, color: "#FFBF00", desc: "Fabrika yonetimi" },
  { name: "Plan", path: "/plan", icon: ClipboardList, color: "#60A5FA", desc: "Is planlama" },
  { name: "Operator", path: "/operator", icon: HardHat, color: "#34D399", desc: "Uretim takibi" },
  { name: "Depo", path: "/warehouse", icon: Warehouse, color: "#F97316", desc: "Stok yonetimi" },
  { name: "Boya", path: "/paint", icon: Paintbrush, color: "#A78BFA", desc: "Boya takibi" },
  { name: "Surucu", path: "/driver", icon: Truck, color: "#FB7185", desc: "Sevkiyat" },
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

  // Sun/Moon position based on time (6AM=left, 12PM=center, 6PM=right)
  const dayProgress = useMemo(() => {
    const totalMin = hour * 60 + minutes;
    if (totalMin < 360) return 0;      // Before 6AM
    if (totalMin > 1200) return 1;     // After 8PM
    return (totalMin - 360) / 840;      // 6AM to 8PM range
  }, [hour, minutes]);

  const sunX = 10 + dayProgress * 80;  // 10% to 90%
  const sunY = 15 + Math.sin(dayProgress * Math.PI) * -10; // Arc

  // Sky gradient based on time
  const skyGradient = isNight
    ? "from-slate-900 via-indigo-950 to-slate-900"
    : isDusk
    ? "from-orange-300 via-pink-300 to-purple-400"
    : "from-sky-300 via-sky-200 to-emerald-100";

  // Petals for spring
  const petals = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 6,
      size: 8 + Math.random() * 12,
      rotate: Math.random() * 360,
      color: ["#FFB7C5", "#FFC0CB", "#FFD1DC", "#FADADD", "#F8C8DC", "#fff"][Math.floor(Math.random() * 6)]
    })), []);

  // Butterflies
  const butterflies = useMemo(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      startX: 10 + Math.random() * 80,
      startY: 30 + Math.random() * 30,
      delay: Math.random() * 5,
      color: ["#FFBF00", "#60A5FA", "#F97316", "#A78BFA", "#34D399"][i]
    })), []);

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-700 bg-gradient-to-b ${skyGradient}`}>
      {/* Theme toggle */}
      <button onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-all"
        data-testid="theme-toggle">
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {/* Sun / Moon */}
      <motion.div
        className="absolute z-10"
        style={{ left: `${sunX}%`, top: `${sunY}%` }}
        animate={{ left: `${sunX}%`, top: `${sunY}%` }}
        transition={{ duration: 2, ease: "easeInOut" }}
      >
        {isNight ? (
          <div className="w-16 h-16 rounded-full bg-gray-200 shadow-[0_0_40px_rgba(255,255,255,0.3)] relative">
            <div className="absolute top-2 left-3 w-4 h-4 rounded-full bg-gray-300/60" />
            <div className="absolute top-6 left-8 w-2 h-2 rounded-full bg-gray-300/40" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-yellow-300 shadow-[0_0_60px_rgba(255,200,0,0.5),0_0_120px_rgba(255,200,0,0.2)]">
            {/* Sun rays */}
            {[...Array(8)].map((_, i) => (
              <motion.div key={i}
                className="absolute w-1 h-6 bg-yellow-300/40 rounded-full"
                style={{
                  left: "50%", top: "50%",
                  transformOrigin: "center -20px",
                  transform: `translate(-50%, -50%) rotate(${i * 45}deg)`
                }}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Stars (night only) */}
      {isNight && [...Array(30)].map((_, i) => (
        <motion.div key={`star-${i}`}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 40}%` }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 3 }}
        />
      ))}

      {/* Clouds */}
      {!isNight && [...Array(4)].map((_, i) => (
        <motion.div key={`cloud-${i}`}
          className="absolute"
          style={{ top: `${8 + i * 7}%` }}
          animate={{ x: ["-20vw", "120vw"] }}
          transition={{ duration: 40 + i * 15, repeat: Infinity, ease: "linear", delay: i * 8 }}
        >
          <div className="flex gap-0">
            <div className={`rounded-full bg-white/60 ${i % 2 === 0 ? "w-20 h-8" : "w-16 h-6"}`} />
            <div className={`rounded-full bg-white/50 -ml-4 mt-1 ${i % 2 === 0 ? "w-14 h-6" : "w-10 h-5"}`} />
            <div className="rounded-full bg-white/40 -ml-3 mt-2 w-10 h-5" />
          </div>
        </motion.div>
      ))}

      {/* Cherry blossom petals falling */}
      {!isNight && petals.map(p => (
        <motion.div key={`petal-${p.id}`}
          className="absolute z-20 pointer-events-none"
          style={{ left: `${p.left}%`, top: -20, width: p.size, height: p.size * 0.7 }}
          animate={{
            y: ["0vh", "110vh"],
            x: [0, Math.sin(p.id) * 60],
            rotate: [p.rotate, p.rotate + 360]
          }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "linear" }}
        >
          <svg viewBox="0 0 20 14" fill={p.color}>
            <ellipse cx="10" cy="7" rx="10" ry="7" opacity="0.8" />
          </svg>
        </motion.div>
      ))}

      {/* Butterflies */}
      {!isNight && butterflies.map(b => (
        <motion.div key={`bf-${b.id}`}
          className="absolute z-20 pointer-events-none"
          style={{ left: `${b.startX}%`, top: `${b.startY}%` }}
          animate={{
            x: [0, 80, -40, 60, 0],
            y: [0, -30, 20, -50, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}
        >
          <motion.svg width="20" height="16" viewBox="0 0 20 16"
            animate={{ scaleX: [1, 0.3, 1] }}
            transition={{ duration: 0.4, repeat: Infinity }}
          >
            <ellipse cx="6" cy="6" rx="5" ry="6" fill={b.color} opacity="0.7" />
            <ellipse cx="14" cy="6" rx="5" ry="6" fill={b.color} opacity="0.7" />
            <ellipse cx="6" cy="11" rx="3" ry="4" fill={b.color} opacity="0.5" />
            <ellipse cx="14" cy="11" rx="3" ry="4" fill={b.color} opacity="0.5" />
            <rect x="9.5" y="2" width="1" height="12" rx="0.5" fill="#333" />
          </motion.svg>
        </motion.div>
      ))}

      {/* Ground - green grass with flowers */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Grass hills */}
        <svg viewBox="0 0 1440 200" className="w-full" preserveAspectRatio="none">
          <path d="M0,120 C200,80 400,140 600,100 C800,60 1000,130 1200,90 C1300,70 1400,110 1440,100 L1440,200 L0,200 Z"
            fill={isNight ? "#1a3a1a" : "#4ade80"} />
          <path d="M0,150 C300,120 500,160 800,130 C1000,110 1200,155 1440,140 L1440,200 L0,200 Z"
            fill={isNight ? "#0f2a0f" : "#22c55e"} />
          <path d="M0,170 C200,160 600,180 900,165 C1100,155 1300,175 1440,170 L1440,200 L0,200 Z"
            fill={isNight ? "#0a1f0a" : "#16a34a"} />
        </svg>

        {/* Small flowers on the grass */}
        {!isNight && [...Array(12)].map((_, i) => (
          <motion.div key={`flower-${i}`}
            className="absolute"
            style={{ left: `${5 + i * 8}%`, bottom: `${20 + Math.sin(i) * 15}px` }}
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.3 }}
          >
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
      </div>

      {/* Main content */}
      <div className="relative z-30 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        {/* Title */}
        <motion.div className="text-center mb-10"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: "easeOut" }}
              onClick={() => navigate(mod.path)}
              data-testid={`module-${mod.path.slice(1)}`}
              className="group cursor-pointer"
            >
              <div className={`relative p-5 sm:p-6 rounded-2xl backdrop-blur-md border transition-all duration-300
                ${isNight
                  ? "bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/40"
                  : "bg-white/60 border-white/80 hover:bg-white/80 hover:border-white shadow-lg hover:shadow-xl"
                }
                hover:-translate-y-1 active:scale-95`}
              >
                <mod.icon className="h-7 w-7 sm:h-8 sm:w-8 mx-auto mb-2" style={{ color: mod.color }} />
                <h3 className={`text-xs sm:text-sm font-bold text-center ${isNight ? "text-white" : "text-gray-800"}`}>
                  {mod.name}
                </h3>
                <p className={`text-[10px] text-center mt-0.5 ${isNight ? "text-gray-400" : "text-gray-500"}`}>
                  {mod.desc}
                </p>
                {/* Glow effect */}
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
