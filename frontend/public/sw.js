/*
 * OmniERP Service Worker for Push Notifications
 * Supports desktop browsers, Android Chrome, and iOS PWA (Safari 16.4+)
 */

// Force this SW to take control of all pages immediately when updated
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'OmniERP', body: event.data.text() };
  }

  const title = payload.title || 'OmniERP Notification';
  const options = {
    body: payload.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    vibrate: [100, 50, 100],
    // Tag deduplicates: same-type notifications collapse instead of stacking
    tag: payload.reference_type ? `${payload.reference_type}-${payload.reference_id}` : 'omnierp',
    renotify: true,
    data: {
      url: payload.url || '/hr/notifications',
      reference_type: payload.reference_type,
      reference_id: payload.reference_id
    },
    // Actions for Android Chrome
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/hr/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Try to find an existing window with our origin
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url && client.url.startsWith(self.location.origin)) {
            return client.focus().then(function(focusedClient) {
              if (focusedClient && 'navigate' in focusedClient) {
                return focusedClient.navigate(targetUrl);
              }
            });
          }
        }
        // No existing window — open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Optionally track dismissed notifications for analytics in the future
});
