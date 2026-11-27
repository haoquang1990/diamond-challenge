import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { browserPushEnvironment, enablePush, hasPushSubscription, pushSupport } from '../../notifications/push';
import type { PushSupport } from '../../notifications/push';
import { STRINGS } from '../strings';

/** The VAPID public key (public by design; the private key lives only in the Supabase function secrets). */
const VAPID_PUBLIC_KEY = (gameConfig as { push?: { vapidPublicKey?: unknown } }).push?.vapidPublicKey;
const KEY = typeof VAPID_PUBLIC_KEY === 'string' ? VAPID_PUBLIC_KEY : '';

/** Props for {@link PushCard}. */
export interface PushCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  /** Defaults to this browser. */
  readonly support?: PushSupport;
}

/**
 * Cài đặt "Thông báo khi được cổ vũ" (story 057): turns on web push on this device (asks for
 * permission from the tap), or says why it cannot: iPhone needs the home-screen app, notifications
 * blocked, browser without push, keys not set up yet.
 */
export function PushCard({ clientPromise, support = pushSupport(browserPushEnvironment(KEY)) }: PushCardProps) {
  const [on, setOn] = useState(false);
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
    const r = await enablePush(await clientPromise, KEY);
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
      {support !== 'ready' && <p className="message">{STRINGS.pushSupport[support]}</p>}
      {message !== null && (
        <p className={message.error ? 'message message--error' : 'message'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
