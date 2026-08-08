/**
 * Uyarı tekilleştirme — aynı olay birden fazla kanaldan (WebSocket, FCM foreground,
 * chat fan-out, çoklu kanal mesajı) veya birden fazla açık sekmeden/panelden
 * gelse bile kullanıcıya SADECE 1 kez uyarı gösterir.
 * localStorage kullanılarak sekmeler arası (cross-tab) dedup yapılır.
 */
const _alerted = new Map(); // key -> timestamp (in-memory fallback)
const DEFAULT_TTL_MS = 90 * 1000;
const LS_KEY = "bk_alert_dedup";

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch { /* sessiz */ }
}

export function shouldAlertOnce(key, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return true;
  const now = Date.now();
  for (const [k, t] of _alerted) {
    if (now - t > ttlMs) _alerted.delete(k);
  }
  if (_alerted.has(key)) return false;

  // Sekmeler arası kontrol — aynı olay başka panelde/tab'da gösterildiyse tekrar gösterme
  const store = loadStore();
  let changed = false;
  for (const k of Object.keys(store)) {
    if (now - store[k] > ttlMs) {
      delete store[k];
      changed = true;
    }
  }
  if (store[key]) {
    if (changed) saveStore(store);
    _alerted.set(key, now);
    return false;
  }
  store[key] = now;
  saveStore(store);
  _alerted.set(key, now);
  return true;
}

export function alertKeyForMessage(msg) {
  const meta = msg?.event_meta || {};
  if (meta.event_key) return meta.event_key;
  if (msg?.event_type && (meta.job_id || meta.machine_id)) {
    return `${msg.event_type}-${meta.job_id || meta.machine_id}`;
  }
  return `msg-${msg?.id}`;
}
