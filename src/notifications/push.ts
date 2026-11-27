/**
 * Web push on this device (story 057): whether it can receive pushes, and subscribing it so the
 * server can send "được cổ vũ" (and later reminders) while the app is closed. The subscription is
 * stored through `register_push_subscription`, owner-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** What the device can do about push. */
export type PushSupport = 'ready' | 'unsupported' | 'needs_install' | 'denied' | 'not_configured';

/** Facts {@link pushSupport} decides on (read from the browser by {@link browserPushEnvironment}). */
export interface PushEnvironment {
  readonly hasPush: boolean;
  readonly hasServiceWorker: boolean;
  readonly permission: NotificationPermission | 'unsupported';
  readonly ios: boolean;
  /** Running from the home screen. */
  readonly standalone: boolean;
  /** A VAPID public key is configured. */
  readonly configured: boolean;
}

/** iPhone/iPad get pushes only from the home-screen app (iOS 16.4+). Pure. */
export function pushSupport(env: PushEnvironment): PushSupport {
  if (!env.configured) return 'not_configured';
  if (env.ios && !env.standalone) return 'needs_install';
  if (!env.hasPush || !env.hasServiceWorker || env.permission === 'unsupported') return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  return 'ready';
}

/** Decodes a base64url VAPID key for `applicationServerKey`. Pure. */
export function urlBase64ToUint8Array(key: string): Uint8Array<ArrayBuffer> {
  const padded = `${key}${'='.repeat((4 - (key.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Reads the browser (browser only). */
export function browserPushEnvironment(vapidPublicKey: string): PushEnvironment {
  const nav = navigator as Navigator & { readonly standalone?: boolean };
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
  const standalone = nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  return {
    hasPush: typeof window !== 'undefined' && 'PushManager' in window,
    hasServiceWorker: 'serviceWorker' in nav,
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    ios,
    standalone,
    configured: vapidPublicKey.trim() !== '',
  };
}

/** Outcome of {@link enablePush}. */
export type EnablePushResult = 'enabled' | 'denied' | 'unsupported' | 'failed';

/**
 * Asks for permission (call from a tap), subscribes this browser and stores the subscription for
 * the signed-in account. Safe to call again: the same browser keeps one row.
 */
export async function enablePush(client: Pick<SupabaseClient, 'rpc'>, vapidPublicKey: string): Promise<EnablePushResult> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return 'failed';
    const { error } = await client.rpc('register_push_subscription', { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
    return error === null ? 'enabled' : 'failed';
  } catch (error) {
    console.error('[push] could not enable', error);
    return 'failed';
  }
}

/** True when this browser already has a push subscription (it may still need registering). */
export async function hasPushSubscription(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) != null;
  } catch {
    return false;
  }
}
