/**
 * Müşteri sipariş takip portalı — kimlik yönetimi.
 *
 * Personel oturumundan (lib/auth.js, app_session) TAMAMEN bağımsızdır:
 * - Ayrı localStorage anahtarı (portal_session) — hiçbir personel rolü/route
 *   kararına karışmaz, ROUTE_ROLES'a girmez.
 * - Ayrı axios instance (portalApi) — App.js'teki global interceptor her
 *   istekte "auth_token" (personel token'ı) varsa onu Authorization header'ına
 *   yazıyor; aynı tarayıcıda hem personel hem portal oturumu açıksa bu portal
 *   isteklerine yanlış token'ın binmesine yol açar. portalApi kendi request
 *   interceptor'ında SADECE portal_session'daki token'ı kullanır.
 * - "Beni hatırla" yok: token localStorage'da süresi (12 saat) dolana kadar
 *   kalır, süre dolunca müşteri kodu tekrar girer.
 */
import axios from "axios";
import { API } from "../App";

export const PORTAL_SESSION_KEY = "portal_session";

export function getPortalSession() {
  try {
    const s = JSON.parse(localStorage.getItem(PORTAL_SESSION_KEY) || "null");
    if (!s || !s.token) return null;
    return s;
  } catch {
    return null;
  }
}

/** Token var mı ve süresi dolmamış mı? */
export function isPortalSessionValid() {
  const s = getPortalSession();
  if (!s) return false;
  if (!s.expires_at) return true;
  return Date.now() < s.expires_at;
}

/** Login sonrası portal session yazımı. */
export function savePortalSession({ token, customer_name, expires_in }) {
  const session = {
    token,
    customer_name: customer_name || "",
    login_at: new Date().toISOString(),
    expires_at: Date.now() + (expires_in ? expires_in * 1000 : 12 * 3600 * 1000),
  };
  try {
    localStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
  } catch (_) {
    /* noop */
  }
  return session;
}

export function clearPortalSession() {
  try {
    localStorage.removeItem(PORTAL_SESSION_KEY);
  } catch (_) {
    /* noop */
  }
}

/** Portal API çağrıları için ayrı axios instance — personel token'ından izole. */
export const portalApi = axios.create({ baseURL: API });

portalApi.interceptors.request.use((config) => {
  const s = getPortalSession();
  if (s?.token) {
    config.headers.Authorization = `Bearer ${s.token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearPortalSession();
    }
    return Promise.reject(error);
  }
);
