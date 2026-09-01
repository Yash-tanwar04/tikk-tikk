import webpush from 'web-push';
import { getPushSubscription, getVapidPrivateKey, getVapidPublicKey, removePushSubscription } from './storage';

let isConfigured = false;

function ensureVapidConfig() {
  const pub = getVapidPublicKey();
  const priv = getVapidPrivateKey();
  if (pub && priv) {
    try {
      webpush.setVapidDetails(
        'mailto:support@lovelink.app',
        pub,
        priv
      );
      isConfigured = true;
    } catch (err) {
      console.error('Failed to configure web-push VAPID details:', err);
    }
  }
}

export async function sendPushNotification(
  recipientId: string,
  payload: {
    title: string;
    body: string;
    type: string;
    connectionId: string;
    signalId?: string;
  }
): Promise<boolean> {
  ensureVapidConfig();
  if (!isConfigured) {
    console.warn('Web push not configured yet');
    return false;
  }

  const sub = getPushSubscription(recipientId);
  if (!sub) {
    // No push subscription registered for this user
    return false;
  }

  const pushSubscriptionObject = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    }
  };

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    type: payload.type,
    connectionId: payload.connectionId,
    signalId: payload.signalId,
    url: '/'
  });

  try {
    await webpush.sendNotification(pushSubscriptionObject, payloadString, {
      TTL: 60 * 60 * 24 // 24 hours
    });
    return true;
  } catch (err: any) {
    console.error('Push notification send error:', err?.statusCode || err?.message || err);
    // If subscription is expired/unregistered (404, 410), clean it up
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      removePushSubscription(recipientId);
    }
    return false;
  }
}
