import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../App";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const labels = {
  awaiting_view: "Müşterinin görüntülemesi bekleniyor",
  pending: "Müşteri yanıtı bekleniyor",
  approved: "Müşteri onayladı",
  changes_requested: "Düzeltme istendi — üretime devam etmeyin",
  expired: "Yanıt süresi doldu — numuneye göre üretime devam edilebilir",
};
const date = (value) => value ? new Date(value).toLocaleString("tr-TR") : "—";
export const remainingSeconds = (deadline, serverNow) => deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - serverNow) / 1000)) : null;

function SamplePhoto({ base, revision, onViewed }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, objectUrl;
    setUrl(null); setError(false);
    axios.get(`${base}/${revision}/image`, { responseType: "blob", timeout: 20000 }).then(({ data }) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(data); setUrl(objectUrl);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [base, revision, retry]);
  return <div className="my-4 rounded-xl border border-border bg-background overflow-hidden">
    {url ? <img src={url} alt="Onayınıza sunulan üretim numunesi" className="w-full max-h-[60vh] object-contain" onLoad={onViewed} /> :
      <div className="p-6 text-sm text-text-secondary">{error ? <>Fotoğraf yüklenemedi. <Button variant="outline" onClick={() => setRetry(x => x + 1)}>Tekrar dene</Button></> : "Fotoğraf yükleniyor…"}</div>}
  </div>;
}

export default function SampleApproval({ jobId, token }) {
  const customer = Boolean(token);
  const base = customer ? `${API}/takip/${encodeURIComponent(token)}/sample` : `${API}/jobs/${jobId}/sample`;
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [strict, setStrict] = useState(false);
  const [name, setName] = useState("");
  const [reply, setReply] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [historyRevision, setHistoryRevision] = useState(null);
  const [loadedRevision, setLoadedRevision] = useState(null);
  const offset = useRef(0);
  const requestVersion = useRef(0);
  const invalidate = useCallback(() => { ++requestVersion.current; }, []);
  const viewInFlight = useRef(false);
  const fileInput = useRef(null);
  const accept = useCallback((data) => {
    offset.current = Date.parse(data.server_time) - Date.now();
    setPayload(data); setClock(Date.now());
  }, []);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const { data } = await axios.get(base, { timeout: 10000 });
      if (version === requestVersion.current) { accept(data); setError(""); }
    } catch { if (version === requestVersion.current) setError("Güncel duruma ulaşılamıyor. Bağlantıyı kontrol edip tekrar deneyin."); }
  }, [base, accept]);
  useEffect(() => {
    setPayload(null); setLoadedRevision(null); setFile(null); setNote(""); setReply(""); setHistoryRevision(null);
    refresh();
    const poll = setInterval(refresh, 5000);
    const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => { invalidate(); clearInterval(poll); clearInterval(tick); };
  }, [refresh, invalidate]);
  const sample = payload?.sample;
  const revision = sample?.revision;
  useEffect(() => { setReply(""); setLoadedRevision(null); }, [revision]);
  const markViewed = useCallback(async () => {
    if (!customer || !revision || loadedRevision !== revision || sample?.status !== "awaiting_view" || document.visibilityState !== "visible" || viewInFlight.current) return;
    viewInFlight.current = true;
    ++requestVersion.current;
    try { await axios.post(`${base}/${revision}/view`, {}, { timeout: 10000 }); await refresh(); }
    catch { setError("Görüntüleme kaydedilemedi. Tekrar deneyin."); }
    finally { viewInFlight.current = false; }
  }, [base, customer, loadedRevision, revision, sample?.status, refresh]);
  useEffect(() => {
    markViewed();
    document.addEventListener("visibilitychange", markViewed);
    return () => document.removeEventListener("visibilitychange", markViewed);
  }, [markViewed, payload?.server_time]);
  const seconds = remainingSeconds(sample?.deadline, clock + offset.current);
  const decide = async (decision) => {
    setBusy(true); setError(""); ++requestVersion.current;
    try { await axios.post(`${base}/${revision}/decision`, { decision, name, note: reply }, { timeout: 15000 }); await refresh(); }
    catch (e) { await refresh(); setError(e.response?.data?.detail || "Yanıt kaydedilemedi. Güncel durumu kontrol edip tekrar deneyin."); }
    finally { setBusy(false); }
  };
  const publish = async (event) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(""); ++requestVersion.current;
    const form = new FormData();
    form.append("file", file); form.append("note", note); form.append("strict", String(strict)); form.append("expected_revision", revision || "");
    try {
      await axios.post(base, form, { timeout: 30000 });
      setFile(null); setNote(""); if (fileInput.current) fileInput.current.value = "";
      await refresh();
    } catch (e) { await refresh(); setError(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Numune paylaşılamadı. Fotoğrafı ve bağlantınızı kontrol edin."); }
    finally { setBusy(false); }
  };
  if (customer && payload && !sample && !error) return null;
  return <section className="panel-industrial rounded-xl border border-border p-4 sm:p-6 mt-5 text-text-primary" aria-label="Numune onayı">
    <div className="flex justify-between gap-3 items-center"><h3 className="font-heading font-bold text-lg">Numune Onayı</h3><span className="font-mono text-xs text-text-secondary">{sample ? `V${(sample.history?.length || 0) + 1}` : "İLK NUMUNE"}</span></div>
    {error && <div role="alert" className="my-3 text-sm text-red-400">{error} <Button type="button" variant="outline" onClick={refresh}>Tekrar dene</Button></div>}
    {!payload && !error && <p className="text-text-secondary py-3">Numune bilgileri yükleniyor…</p>}
    {sample && <>
      <p role="status" className={`mt-3 rounded-lg border p-3 text-sm font-semibold ${sample.status === "changes_requested" ? "border-red-500 text-red-400 bg-red-500/10" : sample.status === "approved" ? "border-success text-success" : "border-primary/40 text-text-primary bg-primary/10"}`}>{labels[sample.status]}</p>
      <SamplePhoto key={revision} base={base} revision={revision} onViewed={() => setLoadedRevision(revision)} />
      {sample.note && <p className="text-sm whitespace-pre-wrap break-words mb-3">{sample.note}</p>}
      <p className="text-xs text-text-secondary">Paylaşım: {date(sample.created_at)} · Görüntüleme: {date(sample.viewed_at)}</p>
      <p className="text-sm mt-3">{sample.strict ? "Bu iş için açık müşteri onayı zorunludur. Yanıt gelmeden üretime devam edilmez." : "Fotoğraf ilk görüntülendiğinde 10 dakikalık yanıt süresi başlar. Bu sürede onay veya düzeltme talebi gelmezse üretime gösterilen numuneye göre devam edilebilir. Sürenin dolması müşteri onayı olarak kaydedilmez."}</p>
      {sample.status === "pending" && seconds !== null && <p className="text-2xl font-mono tabular-nums mt-3" aria-label="Kalan yanıt süresi">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} <span className="text-xs text-text-secondary">{seconds ? "kaldı" : "— güncel durum kontrol ediliyor"}</span></p>}
      {customer && sample.status === "pending" && <div className="space-y-3 mt-4">
        <label className="block text-sm">Adınız / soyadınız<Input autoComplete="name" value={name} maxLength={100} onChange={e => setName(e.target.value)} className="mt-1" /></label>
        <label className="block text-sm">Açıklama (düzeltme için zorunlu)<textarea value={reply} maxLength={1000} onChange={e => setReply(e.target.value)} className="w-full mt-1 rounded-md border border-border bg-background p-3" rows={3} /></label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decide("approved")} disabled={busy || Boolean(error) || name.trim().length < 2 || seconds === 0 || loadedRevision !== revision} className="bg-primary text-black">{busy ? "Kaydediliyor…" : "Onaylıyorum"}</Button>
          <Button onClick={() => decide("changes_requested")} disabled={busy || Boolean(error) || name.trim().length < 2 || !reply.trim() || seconds === 0 || loadedRevision !== revision} variant="outline">Düzeltme istiyorum</Button>
        </div>
      </div>}
      {sample.respondent && <p className="mt-3 text-sm whitespace-pre-wrap break-words">Yanıtlayan: {sample.respondent} · {date(sample.resolved_at)}<br />{sample.response_note}</p>}
      <details className="mt-4 text-sm"><summary className="cursor-pointer text-text-secondary">İşlem geçmişi ve önceki numuneler</summary>
        {[...(sample.history || []), sample].map((version, i) => <div key={version.revision} className="mt-3 pt-3 border-t border-border">
          <p className="font-semibold">Numune {i + 1} · {labels[version.status]}</p>
          {(version.events || []).map((e, index) => <p key={index} className="text-xs text-text-secondary mt-1 break-words">{date(e.at)} — {labels[e.status]} {e.name ? `· ${e.name}` : ""}{e.note ? ` · ${e.note}` : ""}</p>)}
          {version.revision !== revision && <><Button variant="ghost" type="button" onClick={() => setHistoryRevision(historyRevision === version.revision ? null : version.revision)}>Fotoğrafı {historyRevision === version.revision ? "gizle" : "gör"}</Button>{historyRevision === version.revision && <><SamplePhoto base={base} revision={version.revision} /><p>{version.note}</p></>}</>}
        </div>)}
      </details>
    </>}
    {!customer && <form onSubmit={publish} className="mt-5 pt-4 border-t border-border space-y-3">
      <p className="text-sm text-text-secondary">{sample ? "Yeni numune önceki yanıtın yerine geçer; müşteri yeni görseli açınca yeni süre başlar." : "İlk üretim fotoğrafını ekleyin. Paylaştıktan sonra sipariş takip linkini müşteriye iletin."}</p>
      <label className="block text-sm">Numune fotoğrafı (en fazla 8 MB)<Input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => { const f = e.target.files?.[0]; if (f?.size > 8 * 1024 * 1024) { setError("Fotoğraf en fazla 8 MB olabilir"); e.target.value = ""; setFile(null); } else { setFile(f || null); setError(""); } }} className="mt-1" /></label>
      <label className="block text-sm">Müşteriye not<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} rows={2} className="w-full mt-1 rounded-md border border-border bg-background p-3" /></label>
      <label className="flex gap-2 text-sm items-start"><input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} className="mt-1" /> Açık onay zorunlu — süre dolsa bile devam izni verme</label>
      <Button type="submit" disabled={busy || !file || !payload || Boolean(error)} className="bg-primary text-black">{busy ? "Paylaşılıyor…" : sample ? "Yeni numuneyi onaya sun" : "Numuneyi onaya sun"}</Button>
      <p className="text-xs text-text-secondary">Bildirim: Takip linkini müşteriye paylaşın. Otomatik SMS/WhatsApp gönderilmez. Bu kayıt makineyi otomatik çalıştırmaz veya durdurmaz.</p>
    </form>}
  </section>;
}
