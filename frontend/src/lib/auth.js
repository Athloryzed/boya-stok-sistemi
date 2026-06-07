/**
 * Merkezi auth yönetimi — tüm paneller tek session'a bakar.
 *
 * Politika:
 *  - localStorage anahtarı: `app_session` JSON: { token, refresh_token, role, roles[], username, display_name, login_at, remember_me }
 *  - Geriye dönük uyumluluk: Eski panel-bazlı session anahtarları (bobin_session, plan_session, vs.)
 *    set/clear edilirken birlikte yazılır/silinir.
 *  - 24 saat oturum: remember_me=false ise login_at + 24h dolunca session "expired" sayılır.
 *  - remember_me=true ise refresh_token (7g) süresine kadar geçerli; username + password ana sayfa
 *    formunda otomatik dolu gelir (sadece username; şifre güvenlik için tutulmaz).
 *  - Yönetim rolü: tüm panellere erişebilir.
 *  - Plan rolü: plan, warehouse, paint, bobin, marka-stok, driver.
 *  - Operator rolü: sadece operator.
 *  - Sofor rolü: sadece driver.
 */

export const SESSION_KEY = "app_session";
export const REMEMBER_USERNAME_KEY = "app_remember_username";

// Panel ↔ izinli roller eşlemesi (her zaman yonetim'e açık)
export const ROUTE_ROLES = {
  "/management": ["yonetim"],
  "/operator":   ["yonetim", "operator"],
  "/plan":       ["yonetim", "plan"],
  "/warehouse":  ["yonetim", "plan", "depo"],
  "/paint":      ["yonetim", "plan", "depo"],
  "/bobin":      ["yonetim", "plan", "depo"],
  "/marka-stok": ["yonetim", "plan", "depo"],
  "/driver":     ["yonetim", "plan", "sofor"],
  // Dashboard ve takip her zaman ayrı şifre ile (sabit) erişilir
};

// Rolün default landing sayfası
export const ROLE_DEFAULT_ROUTE = {
  yonetim: "/management",
  plan: "/plan",
  operator: "/operator",
  depo: "/warehouse",
  sofor: "/driver",
};

const PANEL_SESSION_KEYS = [
  "operator_session", "plan_session", "depo_session",
  "warehouse_session", "bobin_session", "yonetim_master",
  "paint_session", "marka_stok_session",
];

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s || !s.token) return null;
    return s;
  } catch {
    return null;
  }
}

/** Session geçerli mi? Token varlığı + (remember_me veya 24h içinde) kontrolü. */
export function isSessionValid() {
  const s = getSession();
  if (!s) return false;
  if (s.remember_me) return true; // refresh token süresine kadar
  const loginAt = new Date(s.login_at || 0).getTime();
  const ageMs = Date.now() - loginAt;
  return ageMs < 24 * 60 * 60 * 1000; // 24 saat
}

/** Kullanıcının panele erişimi var mı? */
export function canAccessRoute(pathname) {
  const s = getSession();
  if (!s) return false;
  const allowed = ROUTE_ROLES[pathname];
  if (!allowed) return true; // koruma olmayan path
  const userRoles = (s.roles && s.roles.length ? s.roles : [s.role]).filter(Boolean);
  return userRoles.some((r) => allowed.includes(r));
}

/** Rolün erişebileceği route listesini döner (path) */
export function getAccessibleRoutes(rolesArg) {
  const s = getSession();
  const roles = rolesArg || (s ? (s.roles?.length ? s.roles : [s.role]) : []);
  return Object.entries(ROUTE_ROLES)
    .filter(([, allowed]) => roles.some((r) => allowed.includes(r)))
    .map(([path]) => path);
}

/** Login sonrası session yazımı + axios header güncelleme */
export function saveSession({
  token, refresh_token, role, roles, username, display_name, remember_me,
}) {
  const session = {
    token,
    refresh_token: refresh_token || null,
    role: role || (roles && roles[0]) || "",
    roles: roles && roles.length ? roles : (role ? [role] : []),
    username: username || "",
    display_name: display_name || username || "",
    login_at: new Date().toISOString(),
    remember_me: !!remember_me,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem("auth_token", token); // axios interceptor için
    if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
    if (remember_me && username) {
      localStorage.setItem(REMEMBER_USERNAME_KEY, username);
    }
    // Geriye dönük uyumluluk: panel-bazlı session keylerini de yaz
    const nowMs = Date.now();
    const compat = {
      username, display_name: display_name || username,
      roles: session.roles, role: session.role,
      token, refresh_token,
      // Panel session formatları için ek alanlar
      login_time: nowMs,
      expiry: nowMs + (remember_me ? 7 * 86400000 : 86400000),
    };
    for (const k of PANEL_SESSION_KEYS) {
      localStorage.setItem(k, JSON.stringify(compat));
    }
    // Yönetim rolü için management_session (expiry formatlı) ek olarak yaz
    if (session.roles.includes("yonetim")) {
      const expiry = Date.now() + (remember_me ? 7 * 86400000 : 86400000);
      localStorage.setItem("management_session", JSON.stringify({
        managerId: username || "yonetim",
        token,
        expiry,
      }));
    }
    return session;
  } catch (e) {
    console.error("saveSession error", e);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    for (const k of PANEL_SESSION_KEYS) {
      localStorage.removeItem(k);
    }
    localStorage.removeItem("management_session");
    localStorage.removeItem("dashboard_token");
    sessionStorage.removeItem("dashboard_token");
    sessionStorage.removeItem("dashboard_session");
  } catch (_) {
    /* noop */
  }
}

export function getRememberedUsername() {
  try {
    return localStorage.getItem(REMEMBER_USERNAME_KEY) || "";
  } catch (_) {
    return "";
  }
}
