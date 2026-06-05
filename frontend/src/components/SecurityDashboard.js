/**
 * Güvenlik Panosu — Yönetim için tek bakışta sızma girişimi / kilit / alarm durumu.
 *
 * Backend: GET /api/admin/security/status, GET /api/admin/alarms,
 *          GET /api/admin/lockouts, DELETE /api/admin/lockouts/{acc},
 *          POST /api/admin/alarms/{id}/ack, GET /api/admin/audit/verify
 */
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API } from "../App";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import {
  Shield, ShieldAlert, ShieldCheck, Lock, AlertTriangle,
  RefreshCw, CheckCircle2, XCircle, KeyRound, Eye, Clock
} from "lucide-react";

const SEVERITY_STYLES = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

function StatCard({ icon: Icon, label, value, tone = "default", testId }) {
  const tones = {
    default: "border-border",
    danger: "border-red-500/40 bg-red-500/5",
    warning: "border-amber-500/40 bg-amber-500/5",
    success: "border-emerald-500/40 bg-emerald-500/5",
  };
  return (
    <Card data-testid={testId} className={`p-4 ${tones[tone]} border`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary mb-1">{label}</p>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
        <Icon className={`w-6 h-6 ${tone === "danger" ? "text-red-400" :
          tone === "warning" ? "text-amber-400" :
            tone === "success" ? "text-emerald-400" : "text-primary"}`} />
      </div>
    </Card>
  );
}

export default function SecurityDashboard() {
  const [status, setStatus] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [lockouts, setLockouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAcked, setShowAcked] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [s, a, l] = await Promise.all([
        axios.get(`${API}/admin/security/status`),
        axios.get(`${API}/admin/alarms`, { params: { acknowledged: showAcked ? undefined : false, limit: 50 } }),
        axios.get(`${API}/admin/lockouts`),
      ]);
      setStatus(s.data);
      setAlarms(a.data?.items || []);
      setLockouts(l.data?.items || []);
    } catch (e) {
      if (!silent) toast.error("Güvenlik verileri yüklenemedi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAcked]);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30000); // 30 sn otomatik tazele
    return () => clearInterval(t);
  }, [load]);

  const ackAlarm = async (id) => {
    try {
      await axios.post(`${API}/admin/alarms/${id}/ack`);
      toast.success("Alarm onaylandı");
      load(true);
    } catch {
      toast.error("Alarm onaylanamadı");
    }
  };

  const clearLockout = async (account) => {
    try {
      await axios.delete(`${API}/admin/lockouts/${encodeURIComponent(account)}`);
      toast.success(`Kilit kaldırıldı: ${account}`);
      load(true);
    } catch {
      toast.error("Kilit kaldırılamadı");
    }
  };

  const verifyChain = async () => {
    try {
      const r = await axios.get(`${API}/admin/audit/verify`);
      if (r.data?.valid) {
        toast.success(`Audit zinciri sağlam ✓ (${r.data.scanned} kayıt taranıldı)`);
      } else {
        toast.error(`Audit zinciri BOZUK! ${r.data.broken_at} ID'de ${r.data.reason}`);
      }
      load(true);
    } catch {
      toast.error("Doğrulama başarısız");
    }
  };

  if (loading) {
    return (
      <div data-testid="security-dashboard-loading" className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chainValid = status?.audit_chain?.valid !== false;
  const failedAttempts = status?.failed_login_attempts ?? 0;
  const activeLockouts = status?.active_lockouts ?? 0;
  const unAckAlarms = status?.unacknowledged_alarms ?? 0;

  return (
    <div data-testid="security-dashboard" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shadow-gold-glow">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Güvenlik Panosu</h2>
            <p className="text-xs text-text-secondary font-mono uppercase tracking-wider">
              Canlı izleme · 30 sn otomatik yenileme
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="security-refresh-btn"
            variant="outline"
            size="sm"
            onClick={() => load()}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
          <Button
            data-testid="security-verify-chain-btn"
            variant="outline"
            size="sm"
            onClick={verifyChain}
            className="gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Audit Doğrula
          </Button>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={chainValid ? ShieldCheck : ShieldAlert}
          label="Audit Zinciri"
          value={chainValid ? "SAĞLAM" : "BOZUK"}
          tone={chainValid ? "success" : "danger"}
          testId="stat-audit-chain"
        />
        <StatCard
          icon={AlertTriangle}
          label="Bekleyen Alarm"
          value={unAckAlarms}
          tone={unAckAlarms > 0 ? "warning" : "success"}
          testId="stat-unack-alarms"
        />
        <StatCard
          icon={Lock}
          label="Aktif Kilit"
          value={activeLockouts}
          tone={activeLockouts > 0 ? "danger" : "default"}
          testId="stat-active-lockouts"
        />
        <StatCard
          icon={KeyRound}
          label="Başarısız Giriş (24s)"
          value={failedAttempts}
          tone={failedAttempts > 10 ? "warning" : "default"}
          testId="stat-failed-attempts"
        />
      </div>

      {/* Lockouts */}
      <Card className="p-4 border-border bg-surface">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-text-primary">Aktif Hesap Kilitleri</h3>
            <Badge variant="outline" data-testid="lockouts-count">{lockouts.length}</Badge>
          </div>
        </div>
        {lockouts.length === 0 ? (
          <p data-testid="lockouts-empty" className="text-xs text-text-secondary py-4 text-center">
            <CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-400" />
            Şu an aktif kilit yok.
          </p>
        ) : (
          <div className="space-y-2" data-testid="lockouts-list">
            {lockouts.map((l) => (
              <div key={l.account} data-testid={`lockout-row-${l.account}`}
                   className="flex items-center justify-between p-3 rounded-md bg-background border border-red-500/20">
                <div className="flex items-center gap-3 min-w-0">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-text-primary truncate">{l.account}</p>
                    <p className="text-[10px] text-text-secondary">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Süre sonu: {new Date(l.locked_until).toLocaleString("tr-TR")}
                    </p>
                  </div>
                </div>
                <Button
                  data-testid={`lockout-clear-${l.account}`}
                  variant="outline"
                  size="sm"
                  onClick={() => clearLockout(l.account)}
                >
                  Kilidi Kaldır
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Alarms */}
      <Card className="p-4 border-border bg-surface">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-text-primary">Kritik Aksiyon Alarmları</h3>
            <Badge variant="outline" data-testid="alarms-count">{alarms.length}</Badge>
          </div>
          <Button
            data-testid="alarms-toggle-acked"
            variant="ghost"
            size="sm"
            onClick={() => setShowAcked((v) => !v)}
            className="gap-1 text-xs"
          >
            <Eye className="w-3 h-3" />
            {showAcked ? "Sadece bekleyenleri göster" : "Onaylananları da göster"}
          </Button>
        </div>
        {alarms.length === 0 ? (
          <p data-testid="alarms-empty" className="text-xs text-text-secondary py-4 text-center">
            <CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-400" />
            {showAcked ? "Hiç alarm yok." : "Bekleyen alarm yok."}
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="alarms-list">
            {alarms.map((a) => (
              <div key={a.id} data-testid={`alarm-row-${a.id}`}
                   className={`p-3 rounded-md border ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {a.severity?.toUpperCase()}
                      </Badge>
                      <span className="font-semibold text-sm">{a.action}</span>
                      {a.acknowledged && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          ✓ Onaylı
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs mt-1 opacity-90">
                      <span className="font-mono">{a.actor}</span>
                      {a.entity_type && ` → ${a.entity_type}`}
                      {a.entity_id && ` (${a.entity_id.slice(0, 8)})`}
                    </p>
                    {a.metadata && Object.keys(a.metadata).length > 0 && (
                      <p className="text-[10px] mt-1 font-mono opacity-70 truncate">
                        {Object.entries(a.metadata).map(([k, v]) => `${k}=${v}`).join(" · ")}
                      </p>
                    )}
                    <p className="text-[10px] mt-1 opacity-60">
                      {new Date(a.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  {!a.acknowledged && (
                    <Button
                      data-testid={`alarm-ack-${a.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => ackAlarm(a.id)}
                      className="flex-shrink-0"
                    >
                      Onayla
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
