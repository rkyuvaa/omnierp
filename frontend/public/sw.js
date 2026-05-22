/*
 * OmniERP Service Worker for Push Notifications
 */

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const payload = event.data.json();
      
      const options = {
        body: payload.body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [100, 50, 100],
        data: {
          url: payload.url || '/hr/notifications'
        }
      };

      event.waitUntil(
        self.registration.showNotification(payload.title, options)
      );
    } catch (e) {
      console.error("Error displaying push notification:", e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const targetUrl = event.notification.data ? event.notification.data.url : '/hr/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // If a window is already open under our origin, focus it
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            return client.focus().then(function(focusedClient) {
              if (focusedClient && 'navigate' in focusedClient) {
                return focusedClient.navigate(targetUrl);
              }
            });
          }
        }
        // If no windows are open, open a new tab/window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
