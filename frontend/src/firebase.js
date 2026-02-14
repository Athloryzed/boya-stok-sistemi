import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAWaGmpYp5u7pyxnGvLPu_53ZhLOFWVWTA",
  authDomain: "buse-kagit.firebaseapp.com",
  projectId: "buse-kagit",
  storageBucket: "buse-kagit.firebasestorage.app",
  messagingSenderId: "480110726560",
  appId: "1:480110726560:web:254bdd2ceaa2b36caae8c5",
  measurementId: "G-4T4BB8ECEC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.log("Firebase messaging not supported:", error);
}

const VAPID_KEY = "BAVL2mjQoYMisRDBY6Hq1QC9XQ7jjnK2novEVfelCigP5Hte9UiSZUuejcZJkqQGTv5r3WNdYAk3eXD5C6XD3CA";

// Request notification permission and get FCM token
export const requestNotificationPermission = async () => {
  if (!messaging) {
    console.log("Messaging not available");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log("FCM Token:", token);
      return token;
    } else {
      console.log("Notification permission denied");
      return null;
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

// Listen for foreground messages
export const onMessageListener = () => {
  if (!messaging) return Promise.resolve(null);
  
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      resolve(payload);
    });
  });
};

export { messaging };
