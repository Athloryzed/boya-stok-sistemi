/**
 * Uyarı tekilleştirme — aynı olay birden fazla kanaldan (WebSocket, FCM foreground,
 * chat fan-out, çoklu kanal mesajı) gelse bile kullanıcıya SADECE 1 kez uyarı gösterir.
 */
const _alerted = new Map(); // key -> timestamp
const DEFAULT_TTL_MS = 90 * 1000;

export function shouldAlertOnce(key, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return true;
  const now = Date.now();
  for (const [k, t] of _alerted) {
    if (now - t > ttlMs) _alerted.delete(k);
  }
  if (_alerted.has(key)) return false;
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
