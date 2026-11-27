import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import { browserPushEnvironment, enablePush, fetchPushPublicKey, hasPushSubscription, pushSupport } from '../../notifications/push';
import type { PushSupport } from '../../notifications/push';
import { createPrefsSync, loadCheersPref } from '../../data/notification-prefs';
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
  /** Signed-in account: the "Khi có người cổ vũ" switch is saved for it (story 058). */
  readonly accountId: string;
  /** Defaults to this browser (decided once the public key is known). */
  readonly support?: PushSupport;
}

/**
 * Cài đặt "Thông báo khi được cổ vũ" (story 057): turns on web push on this device (asks for
 * permission from the tap), or says why it cannot: iPhone needs the home-screen app, notifications
 * blocked, browser without push, keys not set up yet.
 */
export function PushCard({ clientPromise, accountId, support: forced }: PushCardProps) {
  const [cheers, setCheers] = useState<boolean | null>(null);
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
  useEffect(() => {
    if (!navigator.onLine) return undefined;
    let cancelled = false;
    void clientPromise.then(loadCheersPref).then((v) => {
      if (!cancelled) setCheers(v);
    });
    return () => {
      cancelled = true;
    };
  }, [clientPromise]);
  const toggleCheers = async () => {
    if (cheers === null) return;
    const next = !cheers;
    setCheers(next);
    const r = await createPrefsSync({ client: await clientPromise, accountId }).save({ cheers: next });
    if (r === 'failed') {
      setCheers(!next);
      setMessage({ text: STRINGS.pushPrefsError, error: true });
    }
  };
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

  // Story 058: rendered inside Cài đặt's "Thông báo" card, above the daily reminder rows.
  return (
    <>
      {support === null && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}
      {support === 'ready' &&
        (on ? (
          <p className="install-guide__done">{STRINGS.pushOn}</p>
        ) : (
          <>
            <p className="card__body">{STRINGS.pushIntro}</p>
            <button type="button" className="button button--primary" onClick={() => void enable()} disabled={busy || !navigator.onLine}>
              {STRINGS.pushEnable}
            </button>
          </>
        ))}
      {support !== null && support !== 'ready' && <p className="message">{STRINGS.pushSupport[support]}</p>}
      {message !== null && (
        <p className={message.error ? 'message message--error' : 'message'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <div className="notify-row">
        <span className="notify-row__text">
          <span id="cheer-push-label" className="setting-row__label">
            {STRINGS.pushCheersToggle}
          </span>
          <span className="notify-row__hint">{STRINGS.pushCheersHint}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={cheers !== false}
          aria-labelledby="cheer-push-label"
          className={cheers !== false ? 'switch switch--on' : 'switch'}
          onClick={() => void toggleCheers()}
          disabled={cheers === null || !navigator.onLine}
        >
          <span className="switch__thumb" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
