import api from './api';

/**
 * Check if Push Notifications are supported in the current browser/device.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
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

  // 3. Request subscription from browser PushManager (or reuse existing)
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });
  }

  // 4. Send subscription details to backend
  const subscriptionJson = subscription.toJSON();
  await api.post('/hr/push-subscriptions/subscribe', subscriptionJson);

  return subscription;
}

/**
 * Automatically prompt for notification permission and subscribe the user.
 * Handles both user-gesture contexts (login) and page loads across desktop & mobile.
 */
export async function autoEnablePushNotifications() {
  if (!isPushSupported()) return false;

  // If user previously blocked/denied notifications in browser site settings, do not prompt
  if (Notification.permission === 'denied') return false;

  const tryPromptAndSubscribe = async () => {
    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;
      }

      if (Notification.permission === 'granted') {
        await subscribeUser();
        console.log('✅ Push notifications auto-enabled for current user');
        return true;
      }
    } catch (e) {
      console.warn('Auto push notification prompt/subscription:', e);
    }
    return false;
  };

  // If already granted, ensure subscription is active and registered with backend
  if (Notification.permission === 'granted') {
    return await tryPromptAndSubscribe();
  }

  // If permission is 'default' (not yet asked)
  if (Notification.permission === 'default') {
    // 1. Try immediate request (works during direct user-gesture context)
    try {
      const ok = await tryPromptAndSubscribe();
      if (ok) return true;
    } catch (_) {}

    // 2. In browsers requiring a user gesture on page mount, attach a one-time gesture trigger
    const onUserInteraction = () => {
      window.removeEventListener('click', onUserInteraction, true);
      window.removeEventListener('touchend', onUserInteraction, true);
      if (Notification.permission === 'default') {
        tryPromptAndSubscribe().catch(() => {});
      }
    };
    window.addEventListener('click', onUserInteraction, { once: true, capture: true });
    window.addEventListener('touchend', onUserInteraction, { once: true, capture: true });
  }

  return false;
}

/**
 * Resubscribe the current browser subscription to the backend.
 */
export async function resubscribeForCurrentUser() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const subscriptionJson = subscription.toJSON();
  await api.post('/hr/push-subscriptions/subscribe', subscriptionJson);
}

/**
 * Remove this browser's push subscription from the backend for the current user.
 * Does NOT unsubscribe the browser PushManager, so the same endpoint can be
 * re-used by the next user who logs in on this device.
 */
export async function unsubscribeUser() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // Remove subscription association from backend (non-critical, swallow errors)
  try {
    await api.post('/hr/push-subscriptions/unsubscribe', {
      endpoint: subscription.endpoint
    });
  } catch (e) {
    console.error('Failed to remove subscription from backend on logout', e);
  }
}

/**
 * Fully unsubscribe from push (browser-level + backend).
 * Call this when the user explicitly disables notifications in settings.
 */
export async function fullyUnsubscribeUser() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // 1. Remove from backend
  try {
    await api.post('/hr/push-subscriptions/unsubscribe', {
      endpoint: subscription.endpoint
    });
  } catch (e) {
    console.error('Failed to remove subscription from backend', e);
  }

  // 2. Unsubscribe from browser PushManager
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
