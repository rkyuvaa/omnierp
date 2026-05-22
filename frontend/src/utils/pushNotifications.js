import api from './api';

/**
 * Check if Push Notifications are supported in the current browser/device.
 */
export function isPushSupported() {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Convert VAPID base64url string to Uint8Array for PushManager subscription.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker and subscribe the user to push service.
 */
export async function subscribeUser() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device/browser.');
  }

  // 1. Register Service Worker
  const registration = await navigator.serviceWorker.register('/sw.js');
  
  // Wait for it to become active
  await navigator.serviceWorker.ready;

  // 2. Fetch VAPID public key from backend
  const res = await api.get('/hr/push-subscriptions/vapid-public-key');
  const vapidPublicKey = res.data.public_key;

  if (!vapidPublicKey) {
    throw new Error('VAPID public key not configured on backend.');
  }

  // 3. Request subscription from browser PushManager
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey
  });

  // 4. Send subscription details to backend
  const subscriptionJson = subscription.toJSON();
  await api.post('/hr/push-subscriptions/subscribe', subscriptionJson);

  return subscription;
}

/**
 * Unsubscribe user from push notifications (browser level and backend).
 */
export async function unsubscribeUser() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // 1. Remove subscription on backend
  try {
    await api.post('/hr/push-subscriptions/unsubscribe', {
      endpoint: subscription.endpoint
    });
  } catch (e) {
    console.error('Failed to remove subscription from backend', e);
  }

  // 2. Unsubscribe browser PushManager
  await subscription.unsubscribe();
}

/**
 * Get the current subscription status of the browser.
 */
export async function getSubscriptionStatus() {
  if (!isPushSupported()) return 'unsupported';
  
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return 'unsubscribed';

  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}
