import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAWaGmpYp5u7pyxnGvLPu_53ZhLOFWVWTA",
  authDomain: "buse-kagit.firebaseapp.com",
  projectId: "buse-kagit",
  storageBucket: "buse-kagit.firebasestorage.app",
  messagingSenderId: "480110726560",
  appId: "1:480110726560:web:254bdd2ceaa2b36caae8c5",
  measurementId: "G-4T4BB8ECEC"
};

// Initialize Firebase (her zaman güvenli)
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging — sadece tarayıcı destekliyorsa
// (desteklenmeyen tarayıcılarda console'u kirletmemek için sessizce skip)
let messaging = null;
let _supportPromise = null;

const _initMessaging = async () => {
  try {
    const supported = await isSupported();
    if (!supported) {
      // Bu tarayıcıda FCM desteklenmiyor (desktop Safari, gizli sekme, eski tarayıcı vs.) — sessizce çık
      return null;
    }
    messaging = getMessaging(app);
    return messaging;
  } catch {
    return null;
  }
};

// İlk çağrıda lazy init
const _ensureMessaging = () => {
  if (messaging) return Promise.resolve(messaging);
  if (!_supportPromise) _supportPromise = _initMessaging();
  return _supportPromise;
};

const VAPID_KEY = "BAVL2mjQoYMisRDBY6Hq1QC9XQ7jjnK2novEVfelCigP5Hte9UiSZUuejcZJkqQGTv5r3WNdYAk3eXD5C6XD3CA";

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  const m = await _ensureMessaging();
  if (!m) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
    const token = await getToken(m, { vapidKey: VAPID_KEY });
    return token;
  } catch {
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = () => {
  return _ensureMessaging().then((m) => {
    if (!m) return null;
    return new Promise((resolve) => {
      onMessage(m, (payload) => resolve(payload));
    });
  });
};

export { messaging };
