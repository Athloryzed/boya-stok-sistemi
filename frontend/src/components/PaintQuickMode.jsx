import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, AlertTriangle, Send, RotateCcw, Settings2, ScanBarcode } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { API } from "../App";
import { minutesAgo } from "../lib/utils";
import NumericKeypad from "./NumericKeypad";

function agoText(iso) {
  const mins = minutesAgo(iso);
  if (mins == null) return "";
  if (mins < 60) return `${mins} dk önce`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} sa ${m} dk önce` : `${h} sa önce`;
}

/**
 * PaintFlow Hızlı Mod — yonetim/boyaci için ana görünüm.
 * VERME: boya seç → makine seç → miktar → onayla (3 adım)
 * GERİ ALMA: aktif kayıt seç → miktar → onayla (2 adım)
 * Fark hesabı (used_amount) backend'den gelir, burada hesaplanmaz.
 */
export default function PaintQuickMode({
  paints,
  machines,
  movements,
  activePaintsOnMachines,
  paintColors,
  lowStockThreshold,
  onGiveToMachine,
  onReturnFromMachine,
  onSwitchToDetailed,
}) {
  const [quickTab, setQuickTab] = useState("give"); // "give" | "return"

  const [giveStep, setGiveStep] = useState(1);
  const [givePaint, setGivePaint] = useState(null);
  const [giveMachine, setGiveMachine] = useState(null);
  const [giveAmount, setGiveAmount] = useState("");
  const [giveSubmitting, setGiveSubmitting] = useState(false);

  const [returnStep, setReturnStep] = useState(1);
  const [returnActive, setReturnActive] = useState(null);
  const [returnAmount, setReturnAmount] = useState("");
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Barkod okuma (opsiyonel kısayol — VERME akışının 1. adımında)
  const [scannerOpen, setScannerOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Son kullanılanlar üstte — movements'tan client-side, yeni endpoint yok.
  const orderedPaints = useMemo(() => {
    const lastUsedAt = {};
    for (const m of movements) {
      if (m.movement_type === "to_machine" && !lastUsedAt[m.paint_id]) {
        lastUsedAt[m.paint_id] = m.created_at;
      }
    }
    return [...paints].sort((a, b) => {
      const ta = lastUsedAt[a.id];
      const tb = lastUsedAt[b.id];
      if (ta && tb) return tb.localeCompare(ta);
      if (ta) return -1;
      if (tb) return 1;
      return 0;
    });
  }, [paints, movements]);

  const switchTab = (tab) => {
    setQuickTab(tab);
  };

  const resetGive = () => {
    setGivePaint(null);
    setGiveMachine(null);
    setGiveAmount("");
    setGiveStep(1);
  };

  const submitGive = async () => {
    const amt = parseFloat(giveAmount);
    if (!amt || amt <= 0) {
      toast.error("Geçerli bir miktar girin");
      return;
    }
    setGiveSubmitting(true);
    try {
      await onGiveToMachine(givePaint, giveMachine, amt);
      toast.success(`${givePaint.name} → ${giveMachine.name}: ${amt} kg verildi`);
      resetGive();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İşlem başarısız");
    } finally {
      setGiveSubmitting(false);
    }
  };

  // ============ BARKOD OKUMA ============
  useEffect(() => {
    if (!scannerOpen) {
      if (html5QrCodeRef.current) {
        try { html5QrCodeRef.current.stop().catch(() => {}); } catch {}
        html5QrCodeRef.current = null;
      }
      return;
    }
    let mounted = true;
    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted || !scannerRef.current) return;
        const scanner = new Html5Qrcode("paint-scanner-reader");
        html5QrCodeRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
          (text) => {
            scanner.stop().catch(() => {});
            handleBarcodeScanned(text);
          },
          () => {}
        );
      } catch (e) {
        console.error("Scanner:", e);
        toast.error("Kamera erişimi sağlanamadı veya cihaz desteklemiyor");
        setScannerOpen(false);
      }
    };
    setTimeout(initScanner, 300);
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  const handleBarcodeScanned = async (code) => {
    setScannerOpen(false);
    try {
      const res = await axios.get(`${API}/paints/barcode/${code}`);
      const found = paints.find((p) => p.id === res.data.id) || res.data;
      setGivePaint(found);
      setGiveStep(2);
      toast.success(`Barkod okundu: ${found.name}`);
    } catch (e) {
      if (e?.response?.status === 404) {
        setUnknownBarcode(code);
      } else {
        toast.error(e?.response?.data?.detail || "Barkod sorgulanamadı");
      }
    }
  };

  const linkBarcodeToPaint = async (paint) => {
    try {
      await axios.post(`${API}/paints/${paint.id}/barcode`, { code: unknownBarcode });
      toast.success(`Barkod ${paint.name} boyasına bağlandı`);
      setUnknownBarcode(null);
      setGivePaint(paint);
      setGiveStep(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Barkod bağlanamadı");
    }
  };

  const resetReturn = () => {
    setReturnActive(null);
    setReturnAmount("");
    setReturnStep(1);
  };

  const submitReturn = async () => {
    if (returnAmount === "" || isNaN(parseFloat(returnAmount)) || parseFloat(returnAmount) < 0) {
      toast.error("Geçerli bir miktar girin");
      return;
    }
    setReturnSubmitting(true);
    try {
      const result = await onReturnFromMachine(returnActive, parseFloat(returnAmount));
      toast.success(`Geri alındı — Kullanılan: ${result?.used_amount ?? "?"} kg`);
      resetReturn();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "İşlem başarısız");
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <div data-testid="paint-quick-mode">
      {/* Üst kontrol: Ver/Geri Al geçişi + Detaylı Görünüm */}
      <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => switchTab("give")}
            data-testid="quickmode-tab-give"
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              quickTab === "give" ? "bg-primary text-black" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Send className="h-4 w-4 inline mr-1.5 -mt-0.5" /> Ver
          </button>
          <button
            type="button"
            onClick={() => switchTab("return")}
            data-testid="quickmode-tab-return"
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              quickTab === "return" ? "bg-warning text-black" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <RotateCcw className="h-4 w-4 inline mr-1.5 -mt-0.5" /> Geri Al
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onSwitchToDetailed}
          data-testid="quickmode-switch-detailed"
          className="border-border text-text-secondary hover:bg-surface-highlight"
        >
          <Settings2 className="h-4 w-4 mr-1.5" /> Detaylı Görünüm
        </Button>
      </div>

      {quickTab === "give" && (
        <div data-testid="quickmode-give">
          {giveStep > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setGiveStep((s) => Math.max(1, s - 1))}
                data-testid="give-back"
                className="border-border h-9 w-9 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-text-primary truncate">
                {givePaint?.name}
                {giveMachine ? ` → ${giveMachine.name}` : ""}
              </span>
            </div>
          )}

          {giveStep === 1 && (
            <div data-testid="give-step-paint">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScannerOpen(true)}
                data-testid="quick-barcode-scan-btn"
                className="mb-3 border-border text-text-secondary hover:bg-surface-highlight"
              >
                <ScanBarcode className="h-4 w-4 mr-1.5" /> Barkod Okut
              </Button>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {orderedPaints.map((p) => {
                const low = p.stock_kg < lowStockThreshold;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setGivePaint(p);
                      setGiveStep(2);
                    }}
                    data-testid={`quick-paint-${p.name}`}
                    className="rounded-2xl border-2 border-border hover:border-primary bg-surface p-3 flex flex-col items-center gap-2 min-h-[128px] transition-colors"
                  >
                    <div
                      className="w-14 h-14 rounded-full border-2 border-border"
                      style={{ backgroundColor: paintColors[p.name] || "#888888" }}
                    />
                    <span className="text-sm font-bold text-text-primary text-center leading-tight">{p.name}</span>
                    <span className={`text-xs font-semibold inline-flex items-center gap-1 ${low ? "text-error" : "text-text-secondary"}`}>
                      {low && <AlertTriangle className="h-3 w-3" />}
                      {p.stock_kg.toFixed(1)} kg
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          )}

          {giveStep === 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="give-step-machine">
              {machines.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setGiveMachine(m);
                    setGiveStep(3);
                  }}
                  data-testid={`quick-machine-${m.name}`}
                  className="rounded-2xl border-2 border-border hover:border-primary bg-surface p-4 min-h-[64px] font-bold text-text-primary transition-colors"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {giveStep === 3 && (
            <div className="max-w-xs mx-auto" data-testid="give-step-amount">
              <p className="text-center text-4xl font-black text-text-primary mb-5">{giveAmount || "0"} kg</p>
              <NumericKeypad value={giveAmount} onChange={setGiveAmount} />
              <Button
                onClick={submitGive}
                disabled={giveSubmitting || !giveAmount}
                data-testid="give-confirm"
                className="w-full mt-4 h-14 text-lg bg-primary text-black hover:bg-primary/90"
              >
                Onayla
              </Button>
            </div>
          )}
        </div>
      )}

      {quickTab === "return" && (
        <div data-testid="quickmode-return">
          {returnStep > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setReturnStep((s) => Math.max(1, s - 1))}
                data-testid="return-back"
                className="border-border h-9 w-9 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold text-text-primary truncate">
                {returnActive?.paint_name} → {returnActive?.machine_name}
                <span className="text-text-secondary font-normal"> · Verilen: {returnActive?.given_amount_kg} kg</span>
              </span>
            </div>
          )}

          {returnStep === 1 && (
            <div className="space-y-2.5" data-testid="return-step-list">
              {activePaintsOnMachines.length === 0 && (
                <p className="text-text-secondary text-sm py-8 text-center">Makinede aktif boya yok.</p>
              )}
              {activePaintsOnMachines.map((ap) => (
                <button
                  key={ap.id}
                  type="button"
                  onClick={() => {
                    setReturnActive(ap);
                    setReturnStep(2);
                  }}
                  data-testid={`quick-active-${ap.id}`}
                  className="w-full flex items-center gap-3 rounded-xl border-2 border-border hover:border-warning bg-surface p-3 text-left transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-full border-2 border-border shrink-0"
                    style={{ backgroundColor: paintColors[ap.paint_name] || "#888888" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-text-primary truncate">{ap.paint_name}</p>
                    <p className="text-xs text-text-secondary truncate">{ap.machine_name} · {ap.given_amount_kg} kg verildi</p>
                  </div>
                  <span className="text-xs text-text-muted shrink-0">{agoText(ap.created_at)}</span>
                </button>
              ))}
            </div>
          )}

          {returnStep === 2 && (
            <div className="max-w-xs mx-auto" data-testid="return-step-amount">
              <p className="text-center text-4xl font-black text-text-primary mb-5">{returnAmount || "0"} kg</p>
              <NumericKeypad value={returnAmount} onChange={setReturnAmount} />
              <Button
                onClick={submitReturn}
                disabled={returnSubmitting || returnAmount === ""}
                data-testid="return-confirm"
                className="w-full mt-4 h-14 text-lg bg-warning text-black hover:bg-warning/90"
              >
                Onayla
              </Button>
            </div>
          )}
        </div>
      )}

      {/* BARKOD SCANNER */}
      <Dialog open={scannerOpen} onOpenChange={(open) => setScannerOpen(open)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Barkod Okut</DialogTitle>
            <DialogDescription>Boyayı seçmek için barkodu okutun</DialogDescription>
          </DialogHeader>
          <div id="paint-scanner-reader" ref={scannerRef} className="w-full rounded-lg overflow-hidden" />
        </DialogContent>
      </Dialog>

      {/* BİLİNMEYEN BARKOD → BOYA EŞLE */}
      <Dialog open={!!unknownBarcode} onOpenChange={(open) => !open && setUnknownBarcode(null)}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-text-primary">Bu barkod tanınmıyor</DialogTitle>
            <DialogDescription>Hangi boyaya bağlansın?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {orderedPaints.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => linkBarcodeToPaint(p)}
                data-testid={`link-barcode-${p.name}`}
                className="rounded-xl border-2 border-border hover:border-primary bg-surface p-2 flex flex-col items-center gap-1.5 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-full border-2 border-border"
                  style={{ backgroundColor: paintColors[p.name] || "#888888" }}
                />
                <span className="text-xs font-bold text-text-primary text-center leading-tight">{p.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
