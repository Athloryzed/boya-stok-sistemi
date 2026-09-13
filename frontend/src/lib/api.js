// Backend URL belirleme:
// - Eğer alt domain'den geliniyorsa (app.*, panel.*, portal.*) Worker proxy aktif demektir
//   → same-origin kullan
// - Eğer ana domain'lerimizden geliniyorsa (bksistem.space, www., yeni.) → same-origin
// - Aksi durumda .env'deki REACT_APP_BACKEND_URL kullanılır
const isProxiedSubdomain = typeof window !== "undefined" &&
  /^(app|panel|portal)\./.test(window.location.hostname);
const isCanonicalHost = typeof window !== "undefined" &&
  /^(www\.|yeni\.)?bksistem\.space$/.test(window.location.hostname);
const BACKEND_URL = (isProxiedSubdomain || isCanonicalHost)
  ? window.location.origin
  : process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

