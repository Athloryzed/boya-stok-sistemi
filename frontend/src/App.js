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
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.className = newTheme;
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
    <div className={`App ${theme}`}>
      <BrowserRouter>
        <VisitorTracker />
        <Routes>
          <Route path="/" element={<Home theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/operator" element={<OperatorFlow theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/plan" element={<PlanFlow theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/management" element={<ManagementFlow theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/warehouse" element={<WarehouseFlow theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/paint" element={<PaintFlow theme={theme} toggleTheme={toggleTheme} />} />
          <Route path="/driver" element={<DriverFlow theme={theme} toggleTheme={toggleTheme} />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
