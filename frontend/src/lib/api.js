// All application traffic shares this resolver (including native builds).
export function resolveBackendUrl(location, configuredUrl) {
  const canonical = /^(www\.|yeni\.)?bksistem\.space$/.test(location.hostname);
  const proxied = /^(app|panel|portal)\./.test(location.hostname);
  const base = canonical || proxied ? location.origin : (configuredUrl || location.origin);
  return new URL(base, location.origin).href.replace(/\/+$/, "");
}
export const BACKEND_URL = resolveBackendUrl(window.location, process.env.REACT_APP_BACKEND_URL);
export const API = `${BACKEND_URL}/api`;
export const WS_API = API.replace(/^http/, "ws");
