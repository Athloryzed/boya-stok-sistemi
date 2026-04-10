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
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Firebase Service Worker kaydı
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Firebase SW registered:', registration.scope);
    })
    .catch((error) => {
      console.log('Firebase SW registration failed:', error);
    });
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
            <Route path="/dashboard" element={<LiveDashboard />} />
            <Route path="/track" element={<TrackingPage theme={theme} />} />
            <Route path="/track/:code" element={<TrackingPage theme={theme} />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors duration={2500} closeButton swipeDirections={["right", "left"]} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
