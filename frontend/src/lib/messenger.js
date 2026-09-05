/**
 * Messenger API & WebSocket istemcisi.
 * - REST endpoints: /api/chat/*
 * - WebSocket: /api/ws/chat?token=...
 * - Web Push: VAPID subscription
 */
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api/chat`;

// Token sağlayıcısı — auth.js'ten gelir, dinamik okur (refresh sonrası taze token)
function getToken() {
  try {
    // Tercih: app_session (auth.js'in standart anahtarı)
    const raw = localStorage.getItem("app_session") || localStorage.getItem("auth_session") || localStorage.getItem("session");
    if (raw) {
      const s = JSON.parse(raw);
      return s.token || s.access_token || null;
    }
  } catch (_) {}
  return localStorage.getItem("auth_token") || localStorage.getItem("token") || null;
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const chatApi = {
  async listConversations() {
    const { data } = await axios.get(`${API}/conversations`, { headers: authHeaders() });
    return data;
  },
  async listMessages(convId, { limit = 50, before } = {}) {
    const params = { limit };
    if (before) params.before = before;
    const { data } = await axios.get(`${API}/conversations/${convId}/messages`, { params, headers: authHeaders() });
    return data;
  },
  async sendMessage(convId, body) {
    const { data } = await axios.post(`${API}/conversations/${convId}/messages`, body, { headers: authHeaders() });
    return data;
  },
  async markRead(convId, lastMessageId) {
    const { data } = await axios.put(`${API}/conversations/${convId}/read`, { last_message_id: lastMessageId }, { headers: authHeaders() });
    return data;
  },
  async sendTyping(convId, isTyping) {
    try {
      await axios.post(`${API}/conversations/${convId}/typing`, { is_typing: isTyping }, { headers: authHeaders() });
    } catch (_) {}
  },
  async openDM(userId) {
    const { data } = await axios.post(`${API}/dm`, { user_id: userId }, { headers: authHeaders() });
    return data;
  },
  async listUsers() {
    const { data } = await axios.get(`${API}/users`, { headers: authHeaders() });
    return data;
  },
  async getTemplates() {
    const { data } = await axios.get(`${API}/templates`, { headers: authHeaders() });
    return data;
  },
  async toggleReaction(messageId, emoji) {
    const { data } = await axios.post(`${API}/messages/${messageId}/reaction`, { emoji }, { headers: authHeaders() });
    return data;
  },
  async uploadFile(file, onProgress) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await axios.post(`${API}/upload`, form, {
      headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress,
    });
    return data;
  },
  async getUnreadTotal() {
    const { data } = await axios.get(`${API}/unread-total`, { headers: authHeaders() });
    return data;
  },
  async createGroup(payload) {
    const { data } = await axios.post(`${API}/groups`, payload, { headers: authHeaders() });
    return data;
  },
  async getVapidPublicKey() {
    const { data } = await axios.get(`${API}/push/vapid-public-key`, { headers: authHeaders() });
    return data.key;
  },
  async pushSubscribe(subscription) {
    const { data } = await axios.post(`${API}/push/subscribe`, subscription, { headers: authHeaders() });
    return data;
  },
  async pushUnsubscribe(endpoint) {
    const { data } = await axios.delete(`${API}/push/subscribe`, { headers: authHeaders(), data: { endpoint } });
    return data;
  },
  async getSuggestedUsers(limit = 6) {
    const { data } = await axios.get(`${API}/suggested-users`, { params: { limit }, headers: authHeaders() });
    return data;
  },
  async getNotificationSettings() {
    const { data } = await axios.get(`${API}/notification-settings`, { headers: authHeaders() });
    return data;
  },
  async updateNotificationSettings(settings) {
    const { data } = await axios.put(`${API}/notification-settings`, { settings }, { headers: authHeaders() });
    return data;
  },
};

// ───────────────────────────────────────────
// WebSocket bağlantı yöneticisi
// ───────────────────────────────────────────
let ws = null;
let wsReconnectTimer = null;
let wsListeners = new Set();
let wsHeartbeat = null;

// 401/403 WS rejection sonrası token refresh için
let wsAuthRetries = 0;
const MAX_AUTH_RETRIES = 2;

async function tryRefreshAuthToken() {
  try {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;
    const res = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.token) return null;
    // Hem auth_token'ı hem app_session.token'ı güncelle
    localStorage.setItem("auth_token", data.token);
    if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
    try {
      const sess = JSON.parse(localStorage.getItem("app_session") || "null");
      if (sess) {
        sess.token = data.token;
        if (data.refresh_token) sess.refresh_token = data.refresh_token;
        localStorage.setItem("app_session", JSON.stringify(sess));
      }
    } catch (_) { /* noop */ }
    return data.token;
  } catch (_) {
    return null;
  }
}

export function connectChatWS() {
  const token = getToken();
  if (!token) return null;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }
  const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws/chat?token=${encodeURIComponent(token)}`;
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.error("Chat WS init error:", e);
    return null;
  }
  ws.onopen = () => {
    wsAuthRetries = 0; // bağlantı başarılı → retry sayacını sıfırla
    // Heartbeat: 25 saniyede bir ping (Cloudflare proxy timeout < 100s)
    if (wsHeartbeat) clearInterval(wsHeartbeat);
    wsHeartbeat = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send("ping"); } catch (_) {}
      }
    }, 25000);
  };
  ws.onmessage = (e) => {
    if (e.data === "pong") return;
    try {
      const msg = JSON.parse(e.data);
      wsListeners.forEach((cb) => {
        try { cb(msg); } catch (err) { console.warn("WS listener error:", err); }
      });
    } catch (_) {}
  };
  ws.onclose = async (ev) => {
    if (wsHeartbeat) { clearInterval(wsHeartbeat); wsHeartbeat = null; }
    // 4401/1008/4403 = auth reddi → access token expire olmuş, refresh dene
    // 1006 = anormal kapanma; sunucu tarafında accept() öncesi close() çağrılırsa
    // (auth reddi de dahil) tarayıcı bunu 1006 olarak raporlayabilir — savunma amaçlı
    // buraya da ekliyoruz. Zararsız: token geçerliyse refresh isteği başarısız olur
    // ve MAX_AUTH_RETRIES ile sınırlı kalır (aşağıya bakınız).
    const authRejected = ev && (ev.code === 4401 || ev.code === 4403 || ev.code === 1008 || ev.code === 1006);
    if (authRejected && wsAuthRetries < MAX_AUTH_RETRIES) {
      wsAuthRetries += 1;
      const newToken = await tryRefreshAuthToken();
      if (newToken) {
        // Hemen yeniden bağlan (taze token'la)
        if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
        wsReconnectTimer = setTimeout(() => connectChatWS(), 200);
        return;
      }
      // Refresh başarısız (geçici ağ kesintisi olabilir, illa token geçersiz demek değil) →
      // tamamen durmak yerine 30 sn sonra tekrar dene; sayacı sıfırla ki o denemede
      // yeni bir refresh şansı olsun (aksi halde MAX_AUTH_RETRIES tükenmiş kalırdı).
      wsAuthRetries = 0;
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(() => connectChatWS(), 30000);
      return;
    }
    // Normal kapanma → 3 sn sonra reconnect
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(() => connectChatWS(), 3000);
  };
  ws.onerror = (e) => {
    console.warn("Chat WS error", e);
  };
  return ws;
}

export function disconnectChatWS() {
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  if (wsHeartbeat) { clearInterval(wsHeartbeat); wsHeartbeat = null; }
  if (ws) {
    try { ws.close(); } catch (_) {}
    ws = null;
  }
}

export function onChatEvent(cb) {
  wsListeners.add(cb);
  return () => wsListeners.delete(cb);
}

// ───────────────────────────────────────────
// Web Push abonelik (VAPID)
// ───────────────────────────────────────────
function urlB64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const safe = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function ensurePushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { supported: false };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { supported: true, granted: false };
      const pubKey = await chatApi.getVapidPublicKey();
      if (!pubKey) return { supported: true, granted: false, reason: "no_vapid_key" };
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(pubKey),
      });
    }
    const json = sub.toJSON();
    await chatApi.pushSubscribe({
      endpoint: json.endpoint,
      keys: json.keys,
      user_agent: navigator.userAgent,
    });
    return { supported: true, granted: true, subscription: json };
  } catch (e) {
    console.warn("Push subscription error:", e);
    return { supported: true, granted: false, error: e.message };
  }
}
