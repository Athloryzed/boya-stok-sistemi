import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle, Loader2, ArrowLeft, PlayCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import axios from "axios";
import { API } from "../App";

const steps = [
  { key: "pending", label: "Sırada Bekliyor", icon: Clock },
  { key: "in_progress", label: "Üretimde", icon: PlayCircle },
  { key: "completed", label: "Tamamlandı", icon: CheckCircle },
];

const TrackingPage = ({ theme }) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Geçersiz takip linki.");
      setLoading(false);
      return;
    }
    const fetchTracking = async () => {
      try {
        const res = await axios.get(`${API}/takip/${token}`);
        setData(res.data);
      } catch {
        setError("Bu takip linki geçersiz veya süresi dolmuş.");
      } finally {
        setLoading(false);
      }
    };
    fetchTracking();
  }, [token]);

  const getStepIndex = (status) => {
    if (status === "paused") return 1;
    const idx = steps.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  const currentStep = data ? getStepIndex(data.status) : -1;

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-background" : "bg-gray-50"}`}>
      <div className="max-w-lg mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <Package className="h-12 w-12 mx-auto mb-3 text-blue-500" />
            <h1 className="text-2xl font-heading font-bold text-text-primary">
              Sipariş Durumu
            </h1>
          </div>

          {loading && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <p className="text-text-secondary mt-3">Yükleniyor...</p>
            </div>
          )}

          {error && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-8 text-center">
                <p className="text-red-400 text-lg" data-testid="tracking-error">{error}</p>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/")}
                  className="mt-4 text-text-secondary"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" /> Ana Sayfa
                </Button>
              </CardContent>
            </Card>
          )}

          {data && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-surface border-border" data-testid="tracking-result">
                <CardContent className="p-6">
                  <h2 className="text-xl font-bold text-text-primary text-center mb-6">{data.job_name}</h2>

                  {/* Progress Steps */}
                  <div className="relative mb-8">
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
                      className={`inline-block px-5 py-2.5 rounded-full text-sm font-bold ${
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

                  {/* Başlama Tarihi (TR saati) */}
                  {data.started_at_tr && (
                    <p className="text-center text-text-secondary text-sm mt-3" data-testid="tracking-start-date">
                      Başlama: <span className="text-text-primary font-semibold">{data.started_at_tr}</span>
                    </p>
                  )}

                  {data.completed_at && (
                    <p className="text-center text-success text-sm mt-2">
                      Tamamlanma: {new Date(data.completed_at).toLocaleDateString("tr-TR")}
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
