/**
 * Buse Kağıt Cloudflare Worker Proxy
 * 
 * Amaç: app.bksistem.space → bksistem.space proxy
 * 
 * Nasıl çalışır:
 * 1. Kullanıcı app.bksistem.space'e istek atar
 * 2. Worker, isteği Cloudflare ağı içinde bksistem.space'e iletir
 * 3. ISS engellemesini bypass eder (Cloudflare→Cloudflare iç trafik)
 * 4. WebSocket, API, statik dosyalar — hepsi proxy'lenir
 * 
 * Deployment:
 * - Cloudflare Dashboard → Workers & Pages → Create Worker
 * - Bu kodu yapıştır → Deploy
 * - Route: app.bksistem.space/* → Worker
 */

const ORIGIN_HOST = "bksistem.space";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originalHost = url.hostname;
    
    // Worker'ı sağlık kontrolü için ping endpoint
    if (url.pathname === "/__worker_health") {
      return new Response(JSON.stringify({
        status: "ok",
        proxy: ORIGIN_HOST,
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Hostname'i origin'e çevir
    url.hostname = ORIGIN_HOST;
    url.port = ""; // CF default port kullanılsın
    
    // Yeni istek oluştur, headers korunarak
    const headers = new Headers(request.headers);
    headers.set("Host", ORIGIN_HOST);
    
    // X-Forwarded-Host ekle (backend kim olduğunu bilsin)
    headers.set("X-Forwarded-Host", originalHost);
    headers.set("X-Forwarded-Proto", "https");
    
    // CF-Connecting-IP zaten Cloudflare tarafından ayarlanır
    
    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: "manual", // 3xx redirect'leri Worker yakalasın, browser'a aktarmasın
    });
    
    try {
      const response = await fetch(newRequest);
      
      // Response headers'ı klonla, modify et
      const newHeaders = new Headers(response.headers);
      
      // CORS — alt domain'in de gelmesine izin ver
      // Backend zaten CORS_ORIGINS'te app.bksistem.space'i kabul ediyor
      // ama emniyet için worker da ekleyebilir
      
      // 3xx redirect'leri rewrite et — Location header'da bksistem.space varsa
      // bunu kullanıcının erişeceği alt domain'e çevir
      const location = newHeaders.get("Location");
      if (location && location.includes(ORIGIN_HOST)) {
        const rewritten = location.replace(
          new RegExp(`https?://${ORIGIN_HOST}`, "g"),
          `https://${originalHost}`
        );
        newHeaders.set("Location", rewritten);
      }
      
      // Set-Cookie header'larında Domain=bksistem.space varsa kaldır
      // (Browser kendi domain'i için cookie set etsin)
      const setCookies = newHeaders.getAll
        ? newHeaders.getAll("Set-Cookie")
        : (newHeaders.get("Set-Cookie") ? [newHeaders.get("Set-Cookie")] : []);
      
      if (setCookies.length > 0) {
        newHeaders.delete("Set-Cookie");
        setCookies.forEach(cookie => {
          // Domain= directive'ini kaldır → cookie host-only olur
          const cleaned = cookie.replace(/;\s*domain=[^;]+/i, "");
          newHeaders.append("Set-Cookie", cleaned);
        });
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({
        error: "Proxy fetch failed",
        message: err.message,
        upstream: ORIGIN_HOST
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
