/**
 * Web Push Notifications utility
 * Handles permission requests, subscription management, and push subscription storage.
 *
 * VAPID keys should be set via environment variables:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 */

import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Convert a URL-safe base64 string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported in this browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission state.
 */
export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 * Returns the permission result.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Subscribe to push notifications and save the subscription to the database.
 */
export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return null;

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      if (!VAPID_PUBLIC_KEY) {
        console.warn('[Push] VAPID public key not configured. Push subscription skipped.');
        return null;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // Save to database
    const subscriptionJSON = subscription.toJSON();
    const keys = subscriptionJSON.keys as { p256dh?: string; auth?: string } | undefined;

    await supabase.from('push_subscriptions').upsert(
      {
        id: `push-${userId}-${Date.now()}`,
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: keys?.p256dh || null,
        auth: keys?.auth || null,
      },
      { onConflict: 'id' }
    );

    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications and remove from database.
 */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove all subscriptions for this user
    await supabase.from('push_subscriptions').delete().eq('user_id', userId);

  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
  }
}
