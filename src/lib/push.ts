// Client-side Web Push subscription manager

function urlBase64ToUint8Array(base64String: string): Uint8Array | null {
  try {
    if (!base64String || typeof base64String !== 'string') return null;
    const cleanStr = base64String.trim();
    const padding = '='.repeat((4 - (cleanStr.length % 4)) % 4);
    const base64 = (cleanStr + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (err) {
    console.warn('Invalid base64 string provided to urlBase64ToUint8Array:', err);
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration error:', err);
    return null;
  }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported in this browser');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    // Get public VAPID key from backend
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) {
      console.warn('Could not fetch VAPID key (HTTP ' + res.status + ')');
      return false;
    }
    const text = await res.text();
    let publicKey = '';
    try {
      const data = JSON.parse(text);
      publicKey = data.publicKey;
    } catch {
      console.warn('Invalid VAPID response from server');
      return false;
    }

    if (!publicKey || typeof publicKey !== 'string' || publicKey.length < 10) {
      console.warn('No valid VAPID public key received');
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      if (!convertedKey) {
        console.warn('Failed to convert VAPID key');
        return false;
      }
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // Send subscription to server
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: subscription.toJSON()
      })
    });

    return saveRes.ok;
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
    return false;
  }
}

export async function unsubscribeUserFromPush(userId: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.error('Error unsubscribing from push:', err);
    return false;
  }
}
