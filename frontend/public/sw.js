// Service Worker for Push Notifications - v2
const CACHE_VERSION = 'v2';

// Install event - eski cache'leri temizle
self.addEventListener('install', function(event) {
  // Yeni SW'yi hemen aktif et
  self.skipWaiting();
});

// Activate event - eski cache'leri sil
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Eski cache'leri sil
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Tüm client'lara hemen kontrol et
      return self.clients.claim();
    })
  );
});

// Fetch event - cache kullanma, her zaman network'ten al
self.addEventListener('fetch', function(event) {
  // Cache bypass - her zaman fresh content
  event.respondWith(
    fetch(event.request).catch(function() {
      // Offline durumda basit bir fallback
      return new Response('Offline');
    })
  );
});

// Push notification
self.addEventListener('push', function(event) {
  const options = {
    body: event.data ? event.data.text() : 'Yeni bildirim',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {action: 'open', title: 'Aç'},
      {action: 'close', title: 'Kapat'}
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Buse Kağıt', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open') {
    clients.openWindow('/');
  }
});
