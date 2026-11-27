import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { createPrefsSync } from '../../data/notification-prefs';
import { PUSH_PROMPT, parsePushPromptMemo, pushPromptView, reminderOnPayload, snoozePushPrompt } from '../../domain/push-prompt';
import type { PushPromptMemo, PushPromptView } from '../../domain/push-prompt';
import { parseReminderConfig, readReminderSettings } from '../../domain/reminders';
import { browserPushEnvironment, enablePush, fetchPushPublicKey, hasPushSubscription, pushSupport } from '../../notifications/push';
import type { PushSupport } from '../../notifications/push';
import { STRINGS } from '../strings';

const CONFIG_KEY = (gameConfig as { push?: { vapidPublicKey?: unknown } }).push?.vapidPublicKey;
const KEY_FROM_CONFIG = typeof CONFIG_KEY === 'string' ? CONFIG_KEY : '';
const REMINDER_CONFIG = parseReminderConfig(gameConfig.reminder);
const MEMO_PREFIX = 'diamond.pushPrompt.';

/** Props for {@link PushPromptCard}. */
export interface PushPromptCardProps {
  readonly clientPromise: Promise<SupabaseClient>;
  readonly accountId: string;
  readonly eventStore: EventStore;
  /** After the reminder setting changed (re-schedules and sends it to the server). */
  readonly onChanged?: () => void;
  /** Test/capture override of what this browser can do. */
  readonly support?: PushSupport;
  readonly now?: () => Date;
}

function readMemo(accountId: string): PushPromptMemo {
  try {
    return parsePushPromptMemo(localStorage.getItem(MEMO_PREFIX + accountId));
  } catch {
    return {};
  }
}

function writeMemo(accountId: string, memo: PushPromptMemo): void {
  try {
    localStorage.setItem(MEMO_PREFIX + accountId, JSON.stringify(memo));
  } catch {
    // Best effort: without storage the card comes back next time.
  }
}

function Bell({ check = false }: { readonly check?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {check ? (
        <path d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z" />
      ) : (
        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
      )}
    </svg>
  );
}

/**
 * Hôm nay "Bật thông báo" (story 063): one tap asks the phone for permission, subscribes this
 * browser and turns on both cheers and the daily reminder. On an iPhone browser tab it shows the
 * home-screen steps; when blocked, how to unblock. "Để sau" hides it for a few days, "Đã hiểu" for good.
 */
export function PushPromptCard({ clientPromise, accountId, eventStore, onChanged, support: forced, now = () => new Date() }: PushPromptCardProps) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [key, setKey] = useState<string | null>(KEY_FROM_CONFIG === '' ? null : KEY_FROM_CONFIG);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [memo, setMemo] = useState<PushPromptMemo>(() => readMemo(accountId));
  const [time, setTime] = useState(REMINDER_CONFIG.defaultTime);
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done' | 'gone'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void clientPromise.then(async (c) => {
      if (cancelled) return;
      setClient(c);
      if (key === null) {
        const k = await fetchPushPublicKey(c);
        if (!cancelled) setKey(k);
      }
    });
    void hasPushSubscription().then((has) => {
      if (!cancelled) setSubscribed(has && typeof Notification !== 'undefined' && Notification.permission === 'granted');
    });
    void eventStore.list().then((events) => {
      if (!cancelled) setTime(readReminderSettings(events, REMINDER_CONFIG).time);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPromise, eventStore]);

  useEffect(() => {
    if (phase !== 'done') return undefined;
    const id = window.setTimeout(() => setPhase('gone'), PUSH_PROMPT.doneShowMs);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === 'gone') return null;
  if (phase === 'done')
    return (
      <section className="card push-prompt push-prompt--done" role="status">
        <div className="push-prompt__head">
          <span className="push-prompt__bell">
            <Bell check />
          </span>
          <div>
            <h2 className="push-prompt__title">{STRINGS.pushPromptDoneTitle}</h2>
            <p className="push-prompt__body">{STRINGS.pushPromptDoneBody(time)}</p>
          </div>
        </div>
      </section>
    );

  const support: PushSupport | null = forced ?? (key === null ? null : pushSupport(browserPushEnvironment(key)));
  if (support === null || subscribed === null) return null;
  const view: PushPromptView = pushPromptView(support, subscribed, memo, now().getTime());
  if (view === 'hidden') return null;

  const remember = (next: PushPromptMemo) => {
    setMemo(next);
    writeMemo(accountId, next);
  };
  const later = () => remember(snoozePushPrompt(memo, now().getTime()));
  const gotIt = () => remember({ ...memo, dismissed: true });

  // Called straight from the tap: enablePush asks for permission before its first await.
  const turnOn = () => {
    if (client === null || key === null) return;
    setPhase('busy');
    setError(null);
    void enablePush(client, key).then(async (r) => {
      if (r !== 'enabled') {
        setPhase('idle');
        if (r === 'denied') setSubscribed(false);
        setError(STRINGS.pushErrors[r]);
        return;
      }
      try {
        const settings = readReminderSettings(await eventStore.list(), REMINDER_CONFIG);
        const payload = reminderOnPayload(settings);
        if (payload !== null) await eventStore.append({ type: 'settings_changed', payload });
        setTime(settings.time);
        await createPrefsSync({ client, accountId }).save({ cheers: true });
      } catch (e) {
        console.warn('[push-prompt] reminder not turned on', e);
      }
      onChanged?.();
      setPhase('done');
    });
  };

  const bellBlocked = view === 'blocked';
  return (
    <section className="card push-prompt" aria-labelledby="push-prompt-title">
      <div className="push-prompt__head">
        <span className={bellBlocked ? 'push-prompt__bell push-prompt__bell--off' : 'push-prompt__bell'}>
          <Bell />
        </span>
        <div>
          <h2 id="push-prompt-title" className="push-prompt__title">
            {view === 'ask' ? STRINGS.pushPromptAskTitle : view === 'install' ? STRINGS.pushPromptInstallTitle : STRINGS.pushPromptBlockedTitle}
          </h2>
          <p className="push-prompt__body">{view === 'ask' ? STRINGS.pushPromptAskBody(time) : view === 'install' ? STRINGS.pushPromptInstallBody : STRINGS.pushPromptBlockedBody}</p>
        </div>
      </div>
      {view === 'install' && (
        <ol className="push-prompt__steps">
          {STRINGS.pushPromptInstallSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {error !== null && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      <div className="push-prompt__actions">
        {view === 'ask' ? (
          <>
            <button type="button" className="button button--secondary push-prompt__later" onClick={later}>
              {STRINGS.pushPromptLater}
            </button>
            <button type="button" className="button button--primary" onClick={turnOn} disabled={phase === 'busy' || client === null}>
              {STRINGS.pushPromptOn}
            </button>
          </>
        ) : (
          <button type="button" className="button button--secondary" onClick={view === 'install' ? later : gotIt}>
            {view === 'install' ? STRINGS.pushPromptLater : STRINGS.pushPromptGotIt}
          </button>
        )}
      </div>
    </section>
  );
}
