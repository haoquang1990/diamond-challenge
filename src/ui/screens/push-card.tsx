import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { browserPushEnvironment, enablePush, fetchPushPublicKey, hasPushSubscription, pushSupport } from '../../notifications/push';
import type { PushSupport } from '../../notifications/push';
import { STRINGS } from '../strings';

/**
 * A VAPID public key set in the config wins; otherwise it is read from the server
 * (`push-public-key`), where the deploy created the key pair. The private key never leaves the
 * Supabase function secrets.
 */
const CONFIG_KEY = (gameConfig as { push?: { vapidPublicKey?: unknown } }).push?.vapidPublicKey;
const KEY_FROM_CONFIG = typeof CONFIG_KEY === 'string' ? CONFIG_KEY : '';

/** Props for {@link PushCard}. */
export interface PushCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  /** Defaults to this browser (decided once the public key is known). */
  readonly support?: PushSupport;
}

/**
 * Cài đặt "Thông báo khi được cổ vũ" (story 057): turns on web push on this device (asks for
 * permission from the tap), or says why it cannot: iPhone needs the home-screen app, notifications
 * blocked, browser without push, keys not set up yet.
 */
export function PushCard({ clientPromise, support: forced }: PushCardProps) {
  /** null while the key is being read. */
  const [key, setKey] = useState<string | null>(KEY_FROM_CONFIG === '' ? null : KEY_FROM_CONFIG);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (key !== null) return undefined;
    let cancelled = false;
    void clientPromise.then(fetchPushPublicKey).then((k) => {
      if (!cancelled) setKey(k);
    });
    return () => {
      cancelled = true;
    };
  }, [clientPromise, key]);
  const support: PushSupport | null = forced ?? (key === null ? null : pushSupport(browserPushEnvironment(key)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ readonly text: string; readonly error: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (support === 'ready' && typeof Notification !== 'undefined' && Notification.permission === 'granted')
      void hasPushSubscription().then((has) => {
        if (!cancelled) setOn(has);
      });
    return () => {
      cancelled = true;
    };
  }, [support]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    const r = await enablePush(await clientPromise, key ?? '');
    setBusy(false);
    if (r === 'enabled') {
      setOn(true);
      setMessage({ text: STRINGS.pushEnabled, error: false });
    } else setMessage({ text: STRINGS.pushErrors[r], error: true });
  };

  return (
    <section className="card form" aria-labelledby="push-title">
      <h2 id="push-title" className="card__title">
        {STRINGS.pushTitle}
      </h2>
      <p className="card__body">{STRINGS.pushIntro}</p>
      {support === 'ready' &&
        (on ? (
          <p className="install-guide__done">{STRINGS.pushOn}</p>
        ) : (
          <button type="button" className="button button--primary" onClick={() => void enable()} disabled={busy || !navigator.onLine}>
            {STRINGS.pushEnable}
          </button>
        ))}
      {support === null && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {support !== null && support !== 'ready' && <p className="message">{STRINGS.pushSupport[support]}</p>}
      {message !== null && (
        <p className={message.error ? 'message message--error' : 'message'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
