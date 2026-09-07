/**
 * WebSocket auth-reddi sonrası token yenileme — messenger.js'teki chat WS
 * deseninin diğer WS bağlantılarında (operator/warehouse/manager) tekrar
 * kullanılabilir hali. tryRefreshAuthToken'ın kendisi burada tekrar
 * yazılmıyor, messenger.js'ten import ediliyor (tek kaynak).
 */
import { tryRefreshAuthToken } from "./messenger";

// 4401/4403/1008 = backend'in bilinçli auth reddi. 1006 = anormal kapanma;
// bir websocket accept edilmeden close() çağrılırsa tarayıcı bunu 1006 olarak
// raporlayabilir (bkz. chat_websocket geçmişi) — savunma amaçlı buraya da dahil.
export const WS_AUTH_REJECT_CODES = [4401, 4403, 1008, 1006];

const MAX_AUTH_RETRIES = 2;
const AUTH_RETRY_FAST_MS = 200; // taze token alındıktan hemen sonra
const AUTH_RETRY_FALLBACK_MS = 30000; // refresh başarısız/tükendiğinde uzun aralık

export function isAuthRejectedClose(code) {
  return WS_AUTH_REJECT_CODES.includes(code);
}

/**
 * WS `onclose` handler'ının İÇİNDEN çağrılır.
 *
 * Auth reddiyse (4401/4403/1008/1006): token yenilemeyi dener, reconnect'i
 * KENDİSİ planlar (setTimeout ile `reconnect` çağrılır) ve `true` döner —
 * çağıran bu durumda KENDİ normal reconnect mantığını ÇALIŞTIRMAMALI.
 *
 * Auth reddi değilse hiçbir şey yapmaz, `false` döner — çağıran kendi normal
 * reconnect mantığını (sabit aralık, exponential backoff vb.) uygulamalı.
 *
 * @param {CloseEvent} closeEvent
 * @param {{current: number}} retryCountRef - çağıranın kendi useRef(0)'ı;
 *   bağlantı başarıyla açıldığında (onopen) çağıran bunu 0'a sıfırlamalı.
 * @param {() => void} reconnect - yeniden bağlanma fonksiyonu
 * @returns {Promise<boolean>} true = auth reddi ele alındı, false = değil
 */
export async function handleWsAuthRejection(closeEvent, retryCountRef, reconnect) {
  const code = closeEvent?.code;
  if (!isAuthRejectedClose(code)) return false;

  if (retryCountRef.current < MAX_AUTH_RETRIES) {
    retryCountRef.current += 1;
    const newToken = await tryRefreshAuthToken();
    if (newToken) {
      setTimeout(reconnect, AUTH_RETRY_FAST_MS);
      return true;
    }
  }
  // Refresh başarısız oldu ya da deneme hakkı tükendi → sayaç sıfırlanıp
  // uzun aralıkla tekrar denenir (kalıcı ölüm yerine yavaş nabız).
  retryCountRef.current = 0;
  setTimeout(reconnect, AUTH_RETRY_FALLBACK_MS);
  return true;
}
