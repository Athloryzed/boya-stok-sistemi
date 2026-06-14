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
};

// ───────────────────────────────────────────
// WebSocket bağlantı yöneticisi
// ───────────────────────────────────────────
let ws = null;
let wsReconnectTimer = null;
let wsListeners = new Set();
let wsHeartbeat = null;

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
  ws.onclose = () => {
    if (wsHeartbeat) { clearInterval(wsHeartbeat); wsHeartbeat = null; }
    // 3 sn sonra otomatik yeniden bağlan
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
