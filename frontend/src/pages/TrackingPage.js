import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle, Loader2, ArrowLeft, Search } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import axios from "axios";
import { API } from "../App";

const steps = [
  { key: "pending", label: "Sırada Bekliyor", icon: Clock },
  { key: "in_progress", label: "Üretimde", icon: Loader2 },
  { key: "completed", label: "Tamamlandı", icon: CheckCircle },
];

const TrackingPage = ({ theme }) => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState(code || "");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (code) fetchTracking(code);
  }, [code]);

  const fetchTracking = async (c) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/track/${c}`);
      setData(res.data);
    } catch {
      setError("Takip kodu bulunamadı. Lütfen kontrol edip tekrar deneyin.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/track/${trackingCode.trim()}`);
      fetchTracking(trackingCode.trim());
    }
  };

  const getStepIndex = (status) => {
    if (status === "paused") return 1;
    const idx = steps.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  const currentStep = data ? getStepIndex(data.status) : -1;

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-background" : "bg-gray-50"}`}>
      <div className="max-w-lg mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-text-secondary hover:text-text-primary"
          data-testid="tracking-back-btn"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Ana Sayfa
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <Package className="h-12 w-12 mx-auto mb-3 text-blue-500" />
            <h1 className="text-2xl font-heading font-bold text-text-primary">
              Sipariş Takip
            </h1>
            <p className="text-text-secondary mt-1">Takip kodunuzu girerek siparişinizin durumunu öğrenin</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-8">
            <Input
              data-testid="tracking-code-input"
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
              placeholder="Takip kodu (ör: AB12CD34)"
              className="bg-surface border-border text-text-primary text-center text-lg tracking-widest font-mono"
              maxLength={8}
            />
            <Button
              type="submit"
              disabled={loading || !trackingCode.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              data-testid="tracking-search-btn"
            >
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            </div>
          )}

          {error && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-6 text-center">
                <p className="text-red-400" data-testid="tracking-error">{error}</p>
              </CardContent>
            </Card>
          )}

          {data && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-surface border-border" data-testid="tracking-result">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-text-primary mb-1">{data.job_name}</h2>
                  <p className="text-xs text-text-secondary font-mono mb-6">Kod: {data.tracking_code}</p>

                  {/* Progress Steps */}
                  <div className="relative mb-6">
                    {/* Progress Line */}
                    <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />
                    <div
                      className="absolute top-5 left-5 h-0.5 bg-blue-500 transition-all duration-700"
                      style={{ width: `${(currentStep / (steps.length - 1)) * (100 - 10)}%` }}
                    />
                    <div className="flex justify-between relative">
                      {steps.map((step, idx) => {
                        const Icon = step.icon;
                        const done = idx <= currentStep;
                        const active = idx === currentStep;
                        return (
                          <div key={step.key} className="flex flex-col items-center z-10">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                                active
                                  ? "bg-blue-500 text-white ring-4 ring-blue-500/30 scale-110"
                                  : done
                                  ? "bg-blue-500 text-white"
                                  : "bg-surface border-2 border-border text-text-secondary"
                              }`}
                            >
                              <Icon className={`h-5 w-5 ${active && step.key === "in_progress" ? "animate-spin" : ""}`} />
                            </div>
                            <span
                              className={`text-xs mt-2 font-semibold ${
                                active ? "text-blue-400" : done ? "text-text-primary" : "text-text-secondary"
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="text-center py-4">
                    <span
                      className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                        data.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : data.status === "in_progress"
                          ? "bg-blue-500/20 text-blue-400"
                          : data.status === "paused"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                      data-testid="tracking-status-badge"
                    >
                      {data.status_text}
                    </span>
                  </div>

                  {data.delivery_date && (
                    <p className="text-center text-text-secondary text-sm mt-2">
                      Tahmini Teslim: <span className="text-text-primary font-semibold">{data.delivery_date}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default TrackingPage;
