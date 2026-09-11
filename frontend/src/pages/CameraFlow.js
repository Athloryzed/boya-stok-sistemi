import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";
import axios from "axios";
import { API } from "../App";
import UserMenu from "../components/UserMenu";
import { resumeCentralSession } from "../lib/auth";

// Kamera çerezi backend'de 5 dakika ömürlü — süresi dolmadan tazelemek için 3 dakikada bir yenile.
const CAMERA_SESSION_REFRESH_MS = 3 * 60 * 1000;

const CameraFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState("loading"); // loading | ready | forbidden | error

  useEffect(() => {
    const central = resumeCentralSession("/kamera");
    if (central) {
      setAuthenticated(true);
    } else {
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCameraSession = useCallback(async () => {
    try {
      await axios.post(`${API}/camera/session`);
      setStatus("ready");
    } catch (err) {
      setStatus(err?.response?.status === 403 ? "forbidden" : "error");
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    startCameraSession();
    const id = setInterval(startCameraSession, CAMERA_SESSION_REFRESH_MS);
    return () => clearInterval(id);
  }, [authenticated, startCameraSession]);

  if (!authenticated) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">
      {/* Industrial Header */}
      <div className="header-industrial sticky top-0 z-40 px-3 sm:px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="outline" size="icon" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface/60 hover:bg-surface-highlight h-9 w-9 xl:w-auto xl:px-3 shrink-0" aria-label="Ana sayfaya dön">
              <ArrowLeft className="h-4 w-4 xl:mr-1.5" aria-hidden="true" />
              <span className="hidden xl:inline">Ana Sayfa</span>
            </Button>
            <div className="h-6 w-px bg-border hidden md:block" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="panel-logo-tile shrink-0" style={{ "--tile-from": "#2DD4BF", "--tile-to": "#0F766E", "--tile-rgb": "45,212,191" }} aria-hidden="true">K</div>
              <div className="hidden sm:block min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-blue-300/80 leading-none">Buse Kâğıt</p>
                <h1 className="text-base sm:text-lg font-heading font-black text-text-primary leading-tight tracking-tight truncate">Kamera</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" aria-label="Tema değiştir">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Kamera oturumu açılıyor...</span>
          </div>
        )}
        {status === "forbidden" && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldAlert className="h-8 w-8 text-error" aria-hidden="true" />
              <p className="text-error font-medium">Bu sayfaya erişim yetkiniz yok</p>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <ShieldAlert className="h-8 w-8 text-warning" aria-hidden="true" />
              <p className="text-warning font-medium">Kamera oturumu başlatılamadı, lütfen tekrar deneyin.</p>
            </div>
          </div>
        )}
        {status === "ready" && (
          <iframe
            title="Kamera"
            src="/kamera/"
            className="absolute inset-0 w-full h-full border-0"
            allow="fullscreen"
          />
        )}
      </div>
    </div>
  );
};

export default CameraFlow;
