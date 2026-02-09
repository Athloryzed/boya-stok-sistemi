// Push Notification Helper - iOS/Safari uyumlu

export const requestNotificationPermission = async () => {
  // Tarayıcı desteği kontrolü
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('Bu tarayıcı bildirimleri desteklemiyor');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (e) {
      console.error('Notification permission error:', e);
      return false;
    }
  }

  return false;
};

export const showNotification = (title, body, options = {}) => {
  // Tarayıcı desteği kontrolü
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  
  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    // Service Worker varsa onu kullan
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [100, 50, 100],
          tag: options.tag || 'default',
          renotify: true,
          ...options
        });
      }).catch(e => console.error('SW notification error:', e));
    } else {
      // Fallback: Normal notification
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        ...options
      });
    }
  } catch (e) {
    console.error('Notification error:', e);
  }
};

export const registerServiceWorker = async () => {
  // Tarayıcı desteği kontrolü
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};
