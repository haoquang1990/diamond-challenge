import { useCallback, useEffect, useState } from 'react';
import gameConfig from '../../config/game-config.json';
import type { EventStore } from '../../data/event-store';
import { parseReminderConfig, parseReminderTime, readReminderSettings } from '../../domain/reminders';
import type { ReminderConfig, ReminderSettings } from '../../domain/reminders';
import { browserNotificationPlatform } from '../../notifications/reminders';
import type { NotificationPlatform, ReminderPermission } from '../../notifications/reminders';
import { STRINGS } from '../strings';

/** Props for {@link SettingsScreen}. */
export interface SettingsScreenProps {
  /** Event log the settings are read from and saved to (injected). */
  readonly eventStore: EventStore;
  /** "Quay lại": back to Hôm nay. */
  readonly onBack: () => void;
  /** Called after a setting was saved (and any permission prompt answered); used to reschedule. */
  readonly onSaved?: () => void;
  /** Notification capabilities; defaults to the browser's. */
  readonly platform?: NotificationPlatform;
  /** Reminder defaults; defaults to game-config.json. */
  readonly reminderConfig?: ReminderConfig;
}

/**
 * Screen states:
 * - `loading`: reading the log.
 * - `error`: the read failed; retry offered.
 * - `ready`: current settings shown and editable (saves tracked by `SaveStatus`).
 */
type ScreenState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly settings: ReminderSettings };

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEFAULT_REMINDER_CONFIG = parseReminderConfig(gameConfig.reminder);
const DEFAULT_PLATFORM = browserNotificationPlatform();

function permissionText(permission: ReminderPermission, enabled: boolean): string {
  switch (permission) {
    case 'granted':
      return STRINGS.permissionGranted;
    case 'denied':
      return STRINGS.permissionDenied;
    case 'unsupported':
      return STRINGS.permissionUnsupported;
    case 'default':
      return enabled ? STRINGS.permissionDefaultEnabled : STRINGS.permissionDefault;
  }
}

/**
 * Cài đặt nhắc nhở (story 007): on/off toggle, reminder time, notification
 * permission status and the "not guaranteed outside the app" note.
 *
 * Each change is saved at once as `settings_changed { reminder: { enabled, time } }`.
 * Turning reminders on asks for notification permission in that same tap
 * (only when it was never answered). A denied or unsupported permission does
 * not block saving: the in-app banner on Hôm nay still works.
 */
export function SettingsScreen({
  eventStore,
  onBack,
  onSaved,
  platform = DEFAULT_PLATFORM,
  reminderConfig = DEFAULT_REMINDER_CONFIG,
}: SettingsScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [permission, setPermission] = useState<ReminderPermission>(() => platform.permission());

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (!cancelled) setState({ kind: 'ready', settings: readReminderSettings(events, reminderConfig) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[settings] failed to read the event log', error);
        setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [eventStore, reminderConfig, reloadKey]);

  const save = useCallback(
    async (next: ReminderSettings, previous: ReminderSettings, permissionRequest: Promise<ReminderPermission> | null) => {
      setState({ kind: 'ready', settings: next });
      setSaveStatus('saving');
      try {
        await eventStore.append({ type: 'settings_changed', payload: { reminder: { enabled: next.enabled, time: next.time } } });
        setSaveStatus('saved');
      } catch (error) {
        console.error('[settings] could not save the reminder setting', error);
        setState({ kind: 'ready', settings: previous });
        setSaveStatus('error');
      }
      if (permissionRequest !== null) setPermission(await permissionRequest);
      else setPermission(platform.permission());
      onSaved?.();
    },
    [eventStore, onSaved, platform],
  );

  const busy = saveStatus === 'saving';

  const onToggle = () => {
    if (state.kind !== 'ready' || busy) return;
    const previous = state.settings;
    const enabled = !previous.enabled;
    // Must run synchronously inside the tap, before any await, or browsers ignore the prompt.
    const request = enabled && platform.permission() === 'default' ? platform.requestPermission() : null;
    void save({ ...previous, enabled }, previous, request);
  };

  const onTimeChange = (value: string) => {
    if (state.kind !== 'ready' || busy || parseReminderTime(value) === null || value === state.settings.time) return;
    void save({ ...state.settings, time: value }, state.settings, null);
  };

  const enabled = state.kind === 'ready' && state.settings.enabled;
  const fallbackNeeded = enabled && (permission === 'denied' || permission === 'unsupported');

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.settingsTitle}</h1>
        <p className="screen__prompt">{STRINGS.settingsPrompt}</p>
      </header>

      {state.kind === 'loading' && (
        <p className="message" role="status">
          {STRINGS.loading}
        </p>
      )}

      {state.kind === 'error' && (
        <div className="card">
          <p className="message message--error" role="alert">
            {STRINGS.settingsLoadError}
          </p>
          <button type="button" className="button button--secondary" onClick={() => setReloadKey((k) => k + 1)}>
            {STRINGS.retry}
          </button>
        </div>
      )}

      {state.kind === 'ready' && (
        <>
          <section className="card">
            <div className="setting-row">
              <span id="reminder-toggle-label" className="setting-row__label">
                {STRINGS.reminderToggle}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-labelledby="reminder-toggle-label"
                className={enabled ? 'switch switch--on' : 'switch'}
                onClick={onToggle}
                disabled={busy}
              >
                <span className="switch__thumb" aria-hidden="true" />
              </button>
            </div>
            <label className="setting-row">
              <span className="setting-row__label">{STRINGS.reminderTimeLabel}</span>
              <input
                type="time"
                className="time-input"
                value={state.settings.time}
                onChange={(e) => onTimeChange(e.target.value)}
                disabled={busy}
              />
            </label>
            {saveStatus === 'saving' && (
              <p className="message" role="status">
                {STRINGS.reminderSaving}
              </p>
            )}
            {saveStatus === 'saved' && (
              <p className="message" role="status">
                {STRINGS.reminderSaved}
              </p>
            )}
            {saveStatus === 'error' && (
              <p className="message message--error" role="alert">
                {STRINGS.reminderSaveError}
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="permission-title">
            <h2 id="permission-title" className="card__title">
              {STRINGS.permissionHeading}
            </h2>
            <p className="card__body">{permissionText(permission, enabled)}</p>
            {fallbackNeeded && <p className="reminder-notice">{STRINGS.permissionFallback}</p>}
          </section>

          <p className="reminder-disclaimer">{STRINGS.reminderDisclaimer}</p>
        </>
      )}
    </main>
  );
}
