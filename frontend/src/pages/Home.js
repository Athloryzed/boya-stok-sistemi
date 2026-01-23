import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Users, ClipboardList, Package, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";

const Home = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [timeOfDay, setTimeOfDay] = useState("day");

  const modules = [
    {
      title: "Yönetim",
      icon: Settings,
      path: "/management",
      color: "#FFBF00",
      testId: "management-module"
    },
    {
      title: "Operatör",
      icon: Users,
      path: "/operator",
      color: "#007AFF",
      testId: "operator-module"
    },
    {
      title: "Plan",
      icon: ClipboardList,
      path: "/plan",
      color: "#10B981",
      testId: "plan-module"
    },
    {
      title: "Depo",
      icon: Package,
      path: "/warehouse",
      color: "#F59E0B",
      testId: "warehouse-module"
    },
    {
      title: "Boya",
      icon: Package,
      path: "/paint",
      color: "#EC4899",
      testId: "paint-module"
    }
  ];

  // İstanbul için gün doğumu ve batımı hesaplama
  const calculateSunTimes = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const hour = now.getHours();

    // İstanbul için yaklaşık gün doğumu ve batımı saatleri (aylara göre)
    const sunriseTimes = {
      1: 7.5, 2: 7.2, 3: 6.5, 4: 6.0, 5: 5.5, 6: 5.3,
      7: 5.5, 8: 6.0, 9: 6.5, 10: 7.0, 11: 7.3, 12: 7.5
    };
    
    const sunsetTimes = {
      1: 17.5, 2: 18.0, 3: 18.5, 4: 19.5, 5: 20.0, 6: 20.5,
      7: 20.5, 8: 20.0, 9: 19.0, 10: 18.0, 11: 17.3, 12: 17.0
    };

    const sunrise = sunriseTimes[month];
    const sunset = sunsetTimes[month];

    if (hour >= 5 && hour < sunrise) {
      return "dawn"; // Şafak
    } else if (hour >= sunrise && hour < 12) {
      return "morning"; // Sabah
    } else if (hour >= 12 && hour < 15) {
      return "noon"; // Öğle
    } else if (hour >= 15 && hour < sunset - 1) {
      return "afternoon"; // İkindi
    } else if (hour >= sunset - 1 && hour < sunset + 0.5) {
      return "sunset"; // Gün batımı
    } else {
      return "night"; // Gece
    }
  };

  useEffect(() => {
    const updateTimeOfDay = () => {
      setTimeOfDay(calculateSunTimes());
    };

    updateTimeOfDay();
    const interval = setInterval(updateTimeOfDay, 60000); // Her dakika kontrol et

    return () => clearInterval(interval);
  }, []);

  const getBackgroundGradient = () => {
    const gradients = {
      dawn: "linear-gradient(to bottom, #1e3a8a 0%, #f59e0b 50%, #fb923c 100%)", // Lacivert -> Turuncu
      morning: "linear-gradient(to bottom, #0ea5e9 0%, #38bdf8 50%, #7dd3fc 100%)", // Açık mavi
      noon: "linear-gradient(to bottom, #0284c7 0%, #0ea5e9 100%)", // Parlak gök mavisi
      afternoon: "linear-gradient(to bottom, #0ea5e9 0%, #fb923c 50%, #fbbf24 100%)", // Mavi -> Turuncu
      sunset: "linear-gradient(to bottom, #dc2626 0%, #f97316 30%, #fbbf24 60%, #1e3a8a 100%)", // Kırmızı -> Turuncu -> Sarı -> Lacivert
      night: "linear-gradient(to bottom, #0f172a 0%, #1e293b 50%, #334155 100%)" // Koyu gece
    };

    return gradients[timeOfDay] || gradients.day;
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dinamik Arkaplan */}
      <div 
        className="absolute inset-0 transition-all duration-[3000ms] ease-in-out"
        style={{ background: getBackgroundGradient() }}
      />

      {/* Türk Bayrağı - Dalgalanan Animasyon */}
      <div className="absolute top-8 right-8 w-32 h-20 overflow-hidden rounded-md shadow-2xl" style={{ opacity: 0.3 }}>
        <svg
          viewBox="0 0 1200 800"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <defs>
            <clipPath id="flag-wave">
              <path d="M0,0 Q150,20 300,0 T600,0 T900,0 T1200,0 L1200,800 Q1050,780 900,800 T600,800 T300,800 T0,800 Z">
                <animate
                  attributeName="d"
                  dur="3s"
                  repeatCount="indefinite"
                  values="
                    M0,0 Q150,20 300,0 T600,0 T900,0 T1200,0 L1200,800 Q1050,780 900,800 T600,800 T300,800 T0,800 Z;
                    M0,0 Q150,-20 300,0 T600,0 T900,0 T1200,0 L1200,800 Q1050,820 900,800 T600,800 T300,800 T0,800 Z;
                    M0,0 Q150,20 300,0 T600,0 T900,0 T1200,0 L1200,800 Q1050,780 900,800 T600,800 T300,800 T0,800 Z
                  "
                />
              </path>
            </clipPath>
          </defs>
          
          <g clipPath="url(#flag-wave)">
            {/* Kırmızı Zemin */}
            <rect width="1200" height="800" fill="#E30A17"/>
            
            {/* Beyaz Ay */}
            <circle cx="425" cy="400" r="200" fill="#FFFFFF"/>
            <circle cx="475" cy="400" r="160" fill="#E30A17"/>
            
            {/* Beyaz Yıldız */}
            <path
              d="M 700 280 L 735 370 L 830 370 L 755 425 L 785 515 L 700 460 L 615 515 L 645 425 L 570 370 L 665 370 Z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      </div>

      {/* Atatürk Arması - Sol Üst Köşe */}
      <motion.div 
        className="absolute top-8 left-8 w-28 h-28 rounded-full overflow-hidden shadow-2xl border-4 border-white/40"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.9, scale: 1 }}
        transition={{ duration: 1 }}
        whileHover={{ opacity: 1, scale: 1.05 }}
        style={{
          boxShadow: "0 0 30px rgba(255,255,255,0.3), 0 4px 20px rgba(0,0,0,0.4)"
        }}
      >
        <img
          src="https://customer-assets.emergentagent.com/job_flexo-factory/artifacts/hxwzn26z_10107451113522.jpg"
          alt="Atatürk"
          className="w-full h-full object-cover"
          style={{
            filter: "grayscale(100%) contrast(1.1) brightness(1.05)"
          }}
        />
      </motion.div>

      {/* Parlayan Yıldızlar (Sadece Gece) */}
      {timeOfDay === "night" && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0.2, 1, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 2 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      )}

      {/* Güneş (Gündüz) veya Ay (Gece) */}
      {timeOfDay !== "night" && (
        <motion.div
          className="absolute"
          style={{
            width: timeOfDay === "sunset" || timeOfDay === "dawn" ? "120px" : "80px",
            height: timeOfDay === "sunset" || timeOfDay === "dawn" ? "120px" : "80px",
            background: timeOfDay === "sunset" || timeOfDay === "dawn" 
              ? "radial-gradient(circle, #fbbf24 0%, #f97316 50%, #dc2626 100%)"
              : "radial-gradient(circle, #fef08a 0%, #fbbf24 100%)",
            borderRadius: "50%",
            top: timeOfDay === "morning" || timeOfDay === "dawn" ? "10%" : 
                timeOfDay === "noon" ? "5%" : 
                timeOfDay === "afternoon" ? "15%" : "25%",
            right: timeOfDay === "morning" || timeOfDay === "dawn" ? "10%" :
                  timeOfDay === "noon" ? "50%" :
                  timeOfDay === "afternoon" ? "70%" : "85%",
            boxShadow: `0 0 60px ${timeOfDay === "sunset" || timeOfDay === "dawn" ? "#f97316" : "#fbbf24"}`,
          }}
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
        />
      )}

      {timeOfDay === "night" && (
        <motion.div
          className="absolute"
          style={{
            width: "80px",
            height: "80px",
            background: "radial-gradient(circle, #fef9c3 0%, #fef08a 100%)",
            borderRadius: "50%",
            top: "15%",
            right: "20%",
            boxShadow: "0 0 40px #fef08a",
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
          }}
        />
      )}

      {/* İçerik */}
      <div className="relative z-10">
        <div className="absolute top-6 right-6">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            data-testid="theme-toggle"
            className="border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur-sm"
          >
            {theme === "dark" ? <Sun className="h-5 w-5 text-white" /> : <Moon className="h-5 w-5 text-white" />}
          </Button>
        </div>

        <div className="container mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 
              className="text-6xl md:text-7xl font-heading font-black mb-4 tracking-tight"
              style={{
                textShadow: "0 4px 20px rgba(0,0,0,0.3), 0 0 40px rgba(255,191,0,0.5)",
                color: "#FFBF00"
              }}
            >
              BUSE KAĞIT
            </h1>
            <p className="text-xl font-body text-white drop-shadow-lg">
              Üretim Yönetim Sistemi
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <button
                    onClick={() => navigate(module.path)}
                    data-testid={module.testId}
                    className="w-full h-64 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-8 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:bg-white/20 hover:border-white/40 hover:shadow-2xl group"
                  >
                    <div 
                      className="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{ 
                        backgroundColor: `${module.color}20`,
                        boxShadow: `0 0 30px ${module.color}40`
                      }}
                    >
                      <Icon className="w-12 h-12" style={{ color: module.color }} />
                    </div>
                    <h2 className="text-3xl font-heading font-bold text-white drop-shadow-lg">
                      {module.title}
                    </h2>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
