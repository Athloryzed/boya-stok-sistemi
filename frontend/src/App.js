import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import axios from "axios";
import "@/App.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";

// ResizeObserver loop uyarısını bastır.
// Bu, Radix Select / Dialog gibi bileşenlerin layout sırasında
// browser'in verdigi "benign" (zararsız) bir uyari olup uygulamayi etkilemez.
// React-error-overlay ve console'da gozukmesini engelleyelim.
if (typeof window !== "undefined") {
  const RO_MSG = "ResizeObserver loop";
  // Browser-level error events
  window.addEventListener("error", (e) => {
    if (e?.message && typeof e.message === "string" && e.message.includes(RO_MSG)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message || "";
    if (typeof msg === "string" && msg.includes(RO_MSG)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
  // Console.error filtrele (CRA dev overlay bu mesajı buradan da yakalar)
  const _origConsoleError = console.error;
  console.error = (...args) => {
    const first = args[0];
    if (typeof first === "string" && first.includes(RO_MSG)) return;
    _origConsoleError.apply(console, args);
  };
}

// Code-splitting: Her panel ayrı chunk olarak yükleniyor → ilk yükleme küçük (Home + Auth UI),
// kullanıcı belirli paneli açtığında o chunk indirilir. Mobil 3G/4G performansı için kritik.
// Home eager (giriş sayfası ilk açıldığı için, blank screen olmasın)
import Home from "./pages/Home";
const OperatorFlow = lazy(() => import("./pages/OperatorFlow"));
const PlanFlow = lazy(() => import("./pages/PlanFlow"));
const ManagementFlow = lazy(() => import("./pages/ManagementFlow"));
const WarehouseFlow = lazy(() => import("./pages/WarehouseFlow"));
const PaintFlow = lazy(() => import("./pages/PaintFlow"));
const DriverFlow = lazy(() => import("./pages/DriverFlow"));
const LiveDashboard = lazy(() => import("./pages/LiveDashboard"));
const TrackingPage = lazy(() => import("./pages/TrackingPage"));
const BobinFlow = lazy(() => import("./pages/BobinFlow"));

// Suspense fallback — chunk indirilirken gösterilen yükleyici (industrial tema)
const RouteLoading = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-md bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center text-black font-black text-xl shadow-gold-glow animate-pulse">
        B
      </div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary">
        Buse Kağıt
      </p>
      <div className="mt-3 w-32 h-0.5 mx-auto bg-border overflow-hidden rounded-full">
        <div className="h-full bg-primary animate-loading-bar" style={{
          animation: "loading-bar 1.2s ease-in-out infinite"
        }} />
      </div>
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .animate-loading-bar { width: 25%; }
      `}</style>
    </div>
  </div>
);

// Backend URL belirleme:
// - Eğer alt domain'den geliniyorsa (app.*, panel.*, portal.*) Worker proxy aktif demektir
//   → same-origin kullan (Worker arkadan bksistem.space'e proxy yapar)
// - Aksi durumda .env'deki REACT_APP_BACKEND_URL kullanılır
const isProxiedSubdomain = typeof window !== "undefined" &&
  /^(app|panel|portal)\./.test(window.location.hostname);
const BACKEND_URL = isProxiedSubdomain
  ? window.location.origin
  : process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Mobile/slow network detection — adaptive timeout
// Mobil veride RTT 200-800ms olabiliyor, 17+ paralel istekte cumulative gecikme yaşanır.
// Bu yüzden mobil cihazlarda timeout'u 2x'e çıkarıyoruz.
function detectSlowNetwork() {
  if (typeof navigator === "undefined") return false;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const isSlowConn = conn && (
    conn.effectiveType === "slow-2g" ||
    conn.effectiveType === "2g" ||
    conn.effectiveType === "3g" ||
    conn.saveData === true
  );
  return isMobile || isSlowConn;
}

export const IS_SLOW_NETWORK = detectSlowNetwork();

// Global axios timeout - yavaş ağlarda infinite hanging'i önler
// Mobil/yavaş ağlarda 35s, masaüstü hızlı ağda 20s
axios.defaults.timeout = IS_SLOW_NETWORK ? 35000 : 20000;

// Axios interceptor - JWT token'ı her isteğe ekle
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 hatası alınca token temizle
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url?.includes("/login")) {
      localStorage.removeItem("auth_token");
    }
    return Promise.reject(error);
  }
);

// Firebase Service Worker kaydı - iOS Safari / ağ problemlerinde bloke etmemesi için
// Arka planda sessizce kaydet, hataları sessizce yok say
if ('serviceWorker' in navigator) {
  // index.html içinde zaten /service-worker.js kaydediliyor.
  // Firebase SW'yi sadece Notification API destekliyorsa ve iOS Safari değilse kaydet.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const supportsPush = "PushManager" in window;
  if (!isIOS && supportsPush) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .catch(() => { /* sessiz */ });
    });
  }
}

// Ziyaretçi takip bileşeni
function VisitorTracker() {
  const location = useLocation();
  
  useEffect(() => {
    const logVisit = async () => {
      try {
        await axios.post(`${API}/visitors/log`, {
          user_agent: navigator.userAgent,
          page_visited: location.pathname
        });
      } catch (error) {
        console.log("Visitor log error:", error);
      }
    };
    
    logVisit();
  }, [location.pathname]);
  
  return null;
}

function App() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    // Enable smooth transition
    document.documentElement.classList.add('theme-transitioning');
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.className = newTheme + ' theme-transitioning';
    // Remove transition class after animation
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 350);
  };

  useEffect(() => {
    const initMachines = async () => {
      try {
        await axios.post(`${API}/machines/init`);
      } catch (error) {
        console.error("Machine initialization error:", error);
      }
    };
    initMachines();
  }, []);

  return (
    <ErrorBoundary>
      <div className={`App ${theme}`}>
        <BrowserRouter>
          <VisitorTracker />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
              <Route path="/operator" element={<ErrorBoundary><OperatorFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/plan" element={<ErrorBoundary><PlanFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/management" element={<ErrorBoundary><ManagementFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/warehouse" element={<ErrorBoundary><WarehouseFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/paint" element={<ErrorBoundary><PaintFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/driver" element={<ErrorBoundary><DriverFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/bobin" element={<ErrorBoundary><BobinFlow theme={theme} toggleTheme={toggleTheme} /></ErrorBoundary>} />
              <Route path="/dashboard" element={<LiveDashboard />} />
              <Route path="/takip/:token" element={<TrackingPage theme={theme} />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-center" richColors duration={2500} closeButton swipeDirections={["right", "left"]} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
