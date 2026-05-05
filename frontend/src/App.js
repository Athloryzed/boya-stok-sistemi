import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import axios from "axios";
import "@/App.css";
import Home from "./pages/Home";
import OperatorFlow from "./pages/OperatorFlow";
import PlanFlow from "./pages/PlanFlow";
import ManagementFlow from "./pages/ManagementFlow";
import WarehouseFlow from "./pages/WarehouseFlow";
import PaintFlow from "./pages/PaintFlow";
import DriverFlow from "./pages/DriverFlow";
import LiveDashboard from "./pages/LiveDashboard";
import TrackingPage from "./pages/TrackingPage";
import BobinFlow from "./pages/BobinFlow";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Global axios timeout - yavaş ağlarda infinite hanging'i önler
// Mobile veya zayıf bağlantılarda 20 saniye sonra fail olsun, retry yapalım
axios.defaults.timeout = 20000;

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
        </BrowserRouter>
        <Toaster position="top-center" richColors duration={2500} closeButton swipeDirections={["right", "left"]} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
