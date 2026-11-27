import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import gameConfig from '../../config/game-config.json';
import { backupFileName, buildBackup, parseBackup } from '../../data/backup';
import type { BackupRejectReason } from '../../data/backup';
import type { EventStore } from '../../data/event-store';
import { parseReminderConfig, parseReminderTime, readReminderSettings } from '../../domain/reminders';
import type { ReminderConfig, ReminderSettings } from '../../domain/reminders';
import { browserNotificationPlatform } from '../../notifications/reminders';
import type { NotificationPlatform, ReminderPermission } from '../../notifications/reminders';
import { readSoundEnabled } from '../achievements-helpers';
import { ACHIEVEMENTS_CONFIG } from '../achievements-overlay';
import { setSoundEnabled } from '../play-ting';
import { InstallGuideCard } from './install-guide-card';
import { authFailureText, contactSyncLastSyncedLabel, STRINGS, syncFailureText } from '../strings';
import { selectEventsToPush } from '../../data/contact-sync';
import { selectProgressToPush } from '../../data/progress-sync';
import type { ContactConsent, SyncStatus } from '../../data/contact-sync';
import { validateDisplayName } from '../../data/auth-service';
import { formatE164 } from '../../domain/people';
import type { AccountInfo, AuthResult } from '../../data/auth-service';

/**
 * Account section of Cài đặt (story 021). Pass it only when the build has Supabase
 * configured; without it the whole login feature is hidden.
 */
export interface SettingsAccountProps {
  /** Signed-in account, or null when signed out. */
  readonly account: AccountInfo | null;
  /** Signs out (the event log is untouched); resolves to false when it failed. */
  readonly onSignOut: () => Promise<boolean>;
  /** Saves a validated, trimmed display name. */
  readonly onSaveDisplayName: (name: string) => Promise<AuthResult>;
  /** Opens "Thêm người đứng chung (mã số kép)" (story 025, 055). */
  readonly onOpenHousehold: () => void;
  /** Opens "Quản trị" (story 029); pass it ONLY for an account with role = admin. */
  readonly onOpenAdmin?: () => void;
}

/** "Đồng bộ Danh bạ hộ" status card (story 023). Pass it only when the build has Supabase configured. */
export interface SettingsContactSyncProps {
  readonly consent: ContactConsent;
  readonly status: SyncStatus;
  /** Personal progress sync status (story 032); its own line so its error never hides the Danh bạ one. */
  readonly progressStatus?: SyncStatus;
  /** Syncs now (re-checks consent first when it is unknown). */
  readonly onSyncNow: () => void;
}

function syncStatusText(status: SyncStatus): string {
  switch (status.kind) {
    case 'idle':
      return STRINGS.contactSyncIdle;
    case 'syncing':
      return STRINGS.contactSyncSyncing;
    case 'synced':
      return contactSyncLastSyncedLabel(status.at);
    case 'failed':
      return syncFailureText(status.reason);
  }
}

/** Read-only status of the household contact sync and "Đồng bộ ngay" (no on/off switch, story 030). */
function ContactSyncCard({ consent, status, progressStatus, onSyncNow }: SettingsContactSyncProps) {
  const granted = consent === 'granted';
  const failed = granted && status.kind === 'failed';
  const text = consent === 'unknown' ? STRINGS.contactSyncChecking : consent === 'missing' ? STRINGS.contactSyncNotConsented : syncStatusText(status);
  const progressFailed = granted && progressStatus?.kind === 'failed';
  const syncing = status.kind === 'syncing' || progressStatus?.kind === 'syncing';
  return (
    <section className="card form" aria-labelledby="contact-sync-title">
      <h2 id="contact-sync-title" className="card__title">
        {STRINGS.contactSyncHeading}
      </h2>
      <p className={failed ? 'message message--error' : 'card__body'} role={failed ? 'alert' : 'status'}>
        {granted && progressStatus !== undefined ? `${STRINGS.contactSyncContactsLabel} ${text}` : text}
      </p>
      {granted && progressStatus !== undefined && (
        <p className={progressFailed ? 'message message--error' : 'card__body'} role={progressFailed ? 'alert' : 'status'} data-testid="progress-sync-status">
          {`${STRINGS.contactSyncProgressLabel} ${progressStatus.kind === 'failed' && progressStatus.reason === 'denied' ? STRINGS.progressSyncDenied : syncStatusText(progressStatus)}`}
        </p>
      )}
      <button type="button" className="button button--secondary" onClick={onSyncNow} disabled={syncing}>
        {STRINGS.contactSyncNow}
      </button>
    </section>
  );
}

/** Props for {@link SettingsScreen}. */
export interface SettingsScreenProps {
  /** Event log the settings are read from and saved to (injected). */
  readonly eventStore: EventStore;
  /** "Quay lại": back to Hôm nay. */
  readonly onBack: () => void;
  /** Called after a setting was saved (and any permission prompt answered); used to reschedule. */
  readonly onSaved?: () => void;
  /**
   * Called (and awaited) right after a successful backup import, before anything
   * else re-checks; the app uses it to acknowledge existing milestones silently.
   */
  readonly onImported?: () => void | Promise<void>;
  /** Notification capabilities; defaults to the browser's. */
  readonly platform?: NotificationPlatform;
  /** Reminder defaults; defaults to game-config.json. */
  readonly reminderConfig?: ReminderConfig;
  /** Saves backup text as a file; defaults to a Blob download via <a download>. */
  readonly download?: (fileName: string, text: string) => void;
  /** Clock for the backup file name and `exportedAt`; defaults to the real time. */
  readonly now?: () => Date;
  /** Account section; omitted when Supabase is not configured. */
  readonly accountSection?: SettingsAccountProps;
  /** Household contact sync card; omitted when Supabase is not configured. */
  readonly contactSync?: SettingsContactSyncProps;
  /**
   * "Đăng xuất và xoá dữ liệu trên máy này" (story 030): signs out and deletes THIS account's
   * store. Called only after the confirm step and when no contact event is left to sync.
   * Resolves to false when it failed. Omit when there is no signed-in account.
   */
  readonly onEraseDevice?: () => Promise<boolean>;
  /** "Mã số của tôi" card (story 055), shown under Tài khoản. */
  readonly householdSlot?: ReactNode;
  /** "Mục tiêu hằng ngày" card (story 056). */
  readonly goalSlot?: ReactNode;
  /** "Thông báo khi được cổ vũ" card (story 057), under Ứng dụng. */
  readonly pushSlot?: ReactNode;
}

/**
 * Account card (story 055 splits it): `profile` = login phone and display name; `actions` =
 * Quản trị (admins) and Đăng xuất, near the end of Cài đặt.
 */
function AccountCard({ account, onSignOut, onSaveDisplayName, onOpenAdmin, part }: SettingsAccountProps & { readonly part: 'profile' | 'actions' }) {
  const [name, setName] = useState(account?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ readonly text: string; readonly error: boolean } | null>(null);

  const onSave = async () => {
    if (busy) return;
    const valid = validateDisplayName(name);
    if (valid === null) {
      setMessage({ text: STRINGS.displayNameInvalid, error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await onSaveDisplayName(valid);
      setMessage(result.ok ? { text: STRINGS.displayNameSaved, error: false } : { text: authFailureText(result.reason, result.code), error: true });
      if (result.ok) setName(valid);
    } catch (error) {
      console.error('[settings] could not save the display name', error);
      setMessage({ text: authFailureText('server'), error: true });
    }
    setBusy(false);
  };

  const onOut = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    if (!(await onSignOut())) {
      setMessage({ text: STRINGS.accountSignOutError, error: true });
      setBusy(false);
    }
  };

  if (part === 'actions') {
    if (account === null) return null;
    return (
      <section className="card form" aria-label={STRINGS.accountSignOut}>
        {onOpenAdmin !== undefined && (
          <button type="button" className="button button--secondary" onClick={onOpenAdmin}>
            {STRINGS.adminEntry}
          </button>
        )}
        <button type="button" className="button button--secondary" onClick={() => void onOut()} disabled={busy}>
          {STRINGS.accountSignOut}
        </button>
        <p className="message">{STRINGS.accountSignOutKeepsData}</p>
        {message !== null && message.error && (
          <p className="message message--error" role="alert">
            {message.text}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="card form" aria-labelledby="account-title">
      <h2 id="account-title" className="visually-hidden">
        {STRINGS.accountHeading}
      </h2>
      {account === null ? (
        <p className="account-name">{STRINGS.accountSignedOut}</p>
      ) : (
        <>
          {account.phone !== null && (
            <div className="household-card__row">
              <span className="household-card__key">{STRINGS.accountLoginLabel}</span>
              <span className="household-card__value">{formatE164(account.phone)}</span>
            </div>
          )}
          <label className="form__field">
            <span className="form__label">{STRINGS.displayNameLabel}</span>
            <input type="text" maxLength={120} className="note__input form__input" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </label>
          <button type="button" className="button button--secondary" onClick={() => void onSave()} disabled={busy}>
            {STRINGS.save}
          </button>
          {message !== null && (
            <p className={message.error ? 'message message--error' : 'message'} role={message.error ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Default file download: Blob + temporary <a download> (works on phones and desktop). */
function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rejectText(reason: BackupRejectReason): string {
  switch (reason) {
    case 'not-json':
      return STRINGS.backupRejectNotJson;
    case 'unknown-version':
      return STRINGS.backupRejectVersion;
    case 'events-not-array':
      return STRINGS.backupRejectEvents;
    case 'not-object':
    case 'wrong-format':
      return STRINGS.backupRejectFormat;
  }
}

/** Outcome line under the backup buttons. */
type BackupStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'exported' }
  | { readonly kind: 'imported'; readonly added: number; readonly skipped: number; readonly invalid: number }
  | { readonly kind: 'error'; readonly text: string };

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
  onImported,
  platform = DEFAULT_PLATFORM,
  reminderConfig = DEFAULT_REMINDER_CONFIG,
  download = downloadTextFile,
  now = () => new Date(),
  accountSection,
  contactSync,
  onEraseDevice,
  householdSlot,
  goalSlot,
  pushSlot,
}: SettingsScreenProps) {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [soundOn, setSoundOn] = useState(ACHIEVEMENTS_CONFIG.soundDefault);
  const [soundError, setSoundError] = useState(false);
  const [permission, setPermission] = useState<ReminderPermission>(() => platform.permission());

  useEffect(() => {
    let cancelled = false;
    eventStore
      .list()
      .then((events) => {
        if (cancelled) return;
        setSoundOn(readSoundEnabled(events, ACHIEVEMENTS_CONFIG.soundDefault));
        setState({ kind: 'ready', settings: readReminderSettings(events, reminderConfig) });
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

  const onSoundToggle = async () => {
    const previous = soundOn;
    const enabled = !previous;
    setSoundOn(enabled);
    setSoundEnabled(enabled);
    setSoundError(false);
    try {
      await eventStore.append({ type: 'settings_changed', payload: { sound: { enabled } } });
    } catch (error) {
      console.error('[settings] could not save the sound setting', error);
      setSoundOn(previous);
      setSoundEnabled(previous);
      setSoundError(true);
    }
  };

  const busy = saveStatus === 'saving';
  const [backup, setBackup] = useState<BackupStatus>({ kind: 'idle' });
  const backupBusy = backup.kind === 'busy';
  const [erase, setErase] = useState<{ readonly step: 'idle' | 'confirm' | 'busy'; readonly blocked: number; readonly error: boolean }>({ step: 'idle', blocked: 0, error: false });

  const onEraseConfirm = async () => {
    if (onEraseDevice === undefined || erase.step === 'busy') return;
    setErase({ step: 'busy', blocked: 0, error: false });
    try {
      // Both unsynced Danh bạ and progress events block the erase (story 033).
      const events = await eventStore.list();
      const left = selectEventsToPush(events).length + selectProgressToPush(events).length;
      if (left > 0) {
        setErase({ step: 'confirm', blocked: left, error: false });
        return;
      }
      if (await onEraseDevice()) return;
    } catch (error) {
      console.error('[settings] erase failed', error);
    }
    setErase({ step: 'confirm', blocked: 0, error: true });
  };

  const onExport = async () => {
    if (backupBusy) return;
    setBackup({ kind: 'busy' });
    try {
      const at = now();
      download(backupFileName(at), JSON.stringify(buildBackup(await eventStore.list(), at), null, 2));
      setBackup({ kind: 'exported' });
    } catch (error) {
      console.error('[settings] backup export failed', error);
      setBackup({ kind: 'error', text: STRINGS.backupExportError });
    }
  };

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (file === undefined || backupBusy) return;
    setBackup({ kind: 'busy' });
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setBackup({ kind: 'error', text: rejectText(parsed.reason) });
      } else {
        const result = await eventStore.importEvents(parsed.events);
        try {
          await onImported?.();
        } catch (error) {
          console.error('[settings] after-import step failed', error);
        }
        setBackup({ kind: 'imported', added: result.added, skipped: result.skipped + parsed.invalid, invalid: parsed.invalid });
        setReloadKey((k) => k + 1);
        onSaved?.();
      }
    } catch (error) {
      console.error('[settings] backup import failed', error);
      setBackup({ kind: 'error', text: STRINGS.backupImportError });
    } finally {
      input.value = '';
    }
  };

  const onToggle = () => {
    if (state.kind !== 'ready' || busy) return;
    const previous = state.settings;
    const enabled = !previous.enabled;
    // Must run synchronously inside the tap, before any await, or browsers ignore the prompt.
    const request = enabled && platform.permission() === 'default' ? platform.requestPermission() : null;
    void save({ ...previous, enabled }, previous, request);
  };

  /**
   * The time input keeps a local draft while the picker is open and saves once on
   * blur. iOS fires change events while the wheel spins, before the user taps ✓;
   * saving (and disabling the input) on each one closed the picker mid-selection.
   */
  const [draftTime, setDraftTime] = useState<string | null>(null);

  const onTimeCommit = () => {
    const value = draftTime;
    setDraftTime(null);
    if (value === null || state.kind !== 'ready' || busy || parseReminderTime(value) === null || value === state.settings.time) return;
    void save({ ...state.settings, time: value }, state.settings, null);
  };

  const enabled = state.kind === 'ready' && state.settings.enabled;
  const fallbackNeeded = enabled && (permission === 'denied' || permission === 'unsupported');

  return (
    <main className="screen">
      <header className="screen__header">
        <button type="button" className="back-button" onClick={onBack}>
          ‹ {STRINGS.back}
        </button>
        <h1 className="screen__title">{STRINGS.settingsTitle}</h1>
      </header>

      {accountSection !== undefined && (
        <>
          <h2 className="settings-group">{STRINGS.settingsGroupAccount}</h2>
          <AccountCard key={accountSection.account?.accountId ?? 'signed-out'} {...accountSection} part="profile" />
        </>
      )}
      {householdSlot !== undefined && (
        <>
          <h2 className="settings-group">{STRINGS.settingsGroupCode}</h2>
          {householdSlot}
        </>
      )}
      {goalSlot !== undefined && (
        <>
          <h2 className="settings-group">{STRINGS.settingsGroupGoal}</h2>
          {goalSlot}
        </>
      )}

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
          <h2 className="settings-group">{STRINGS.settingsGroupApp}</h2>
          <InstallGuideCard />
          {/* Story 058: one "Thông báo" card: this device's push, cheer pushes, the daily reminder. */}
          <section className="card form" aria-labelledby="notify-title">
            <h2 id="notify-title" className="card__title">
              {STRINGS.pushTitle}
            </h2>
            {pushSlot}
            {pushSlot !== undefined && <div className="notify-sep" aria-hidden="true" />}
            <div className="setting-row">
              <span className="notify-row__text">
                <span id="reminder-toggle-label" className="setting-row__label">
                  {STRINGS.reminderDailyToggle}
                </span>
                <span className="notify-row__hint">{STRINGS.reminderDailyHint}</span>
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
                value={draftTime ?? state.settings.time}
                onChange={(e) => setDraftTime(e.target.value)}
                onBlur={onTimeCommit}
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
            {pushSlot === undefined && <p className="card__body">{permissionText(permission, enabled)}</p>}
            {fallbackNeeded && <p className="reminder-notice">{STRINGS.permissionFallback}</p>}
          </section>

          <section className="card">
            <div className="setting-row">
              <span id="sound-toggle-label" className="setting-row__label">
                {STRINGS.soundToggle}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                aria-labelledby="sound-toggle-label"
                className={soundOn ? 'switch switch--on' : 'switch'}
                onClick={() => void onSoundToggle()}
              >
                <span className="switch__thumb" aria-hidden="true" />
              </button>
            </div>
            {soundError && (
              <p className="message message--error" role="alert">
                {STRINGS.soundSaveError}
              </p>
            )}
          </section>

          <h2 className="settings-group">{STRINGS.settingsGroupData}</h2>
          {contactSync !== undefined && <ContactSyncCard {...contactSync} />}
          <section className="card person-section" aria-labelledby="backup-title">
            <h2 id="backup-title" className="card__title">
              {STRINGS.backupHeading}
            </h2>
            <p className="backup-warning">{STRINGS.backupWarning}</p>
            <div className="backup-actions">
              <button type="button" className="button button--secondary" onClick={() => void onExport()} disabled={backupBusy}>
                {STRINGS.backupExport}
              </button>
              <label className={backupBusy ? 'button button--secondary backup-file backup-file--disabled' : 'button button--secondary backup-file'}>
                {STRINGS.backupImport}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="backup-file__input"
                  onChange={(e) => void onImportFile(e)}
                  disabled={backupBusy}
                />
              </label>
            </div>
            {backup.kind === 'busy' && (
              <p className="message" role="status">
                {STRINGS.backupBusy}
              </p>
            )}
            {backup.kind === 'exported' && (
              <p className="message" role="status">
                {STRINGS.backupExported}
              </p>
            )}
            {backup.kind === 'imported' && (
              <p className="message" role="status">
                {STRINGS.backupImportDone(backup.added, backup.skipped)}
                {backup.invalid > 0 && ` ${STRINGS.backupImportInvalid(backup.invalid)}`}
              </p>
            )}
            {backup.kind === 'error' && (
              <p className="message message--error" role="alert">
                {backup.text}
              </p>
            )}
          </section>
        </>
      )}

      {state.kind !== 'ready' && contactSync !== undefined && <ContactSyncCard {...contactSync} />}

      {(accountSection?.account != null || onEraseDevice !== undefined) && <h2 className="settings-group">{STRINGS.settingsGroupOther}</h2>}
      {accountSection !== undefined && <AccountCard key={`actions-${accountSection.account?.accountId ?? 'signed-out'}`} {...accountSection} part="actions" />}
      {onEraseDevice !== undefined && (
        <section className="card form card--danger" aria-labelledby="erase-title">
          <h2 id="erase-title" className="card__title">
            {STRINGS.eraseHeading}
          </h2>
          {erase.step === 'idle' ? (
            <button type="button" className="button button--secondary" onClick={() => setErase({ step: 'confirm', blocked: 0, error: false })}>
              {STRINGS.eraseOpen}
            </button>
          ) : (
            <>
              <p className="message message--warn" role="alert">
                {STRINGS.eraseWarning}
              </p>
              {erase.blocked > 0 && (
                <p className="message message--error" role="alert">
                  {STRINGS.eraseBlocked(erase.blocked)}
                </p>
              )}
              {erase.error && (
                <p className="message message--error" role="alert">
                  {STRINGS.eraseError}
                </p>
              )}
              <div className="erase-actions">
                {erase.blocked > 0 && contactSync !== undefined && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      contactSync.onSyncNow();
                      // "Xoá và đăng xuất" checks again before erasing, so it can be offered again now.
                      setErase({ step: 'confirm', blocked: 0, error: false });
                    }}
                  >
                    {STRINGS.contactSyncNow}
                  </button>
                )}
                {erase.blocked > 0 && (
                  <button type="button" className="button button--secondary" onClick={() => void onExport()} disabled={backupBusy}>
                    {STRINGS.eraseExport}
                  </button>
                )}
                <button type="button" className="button button--primary" onClick={() => void onEraseConfirm()} disabled={erase.step === 'busy' || erase.blocked > 0}>
                  {STRINGS.eraseConfirm}
                </button>
                <button type="button" className="button button--secondary" onClick={() => setErase({ step: 'idle', blocked: 0, error: false })} disabled={erase.step === 'busy'}>
                  {STRINGS.eraseCancel}
                </button>
              </div>
            </>
          )}
        </section>
      )}

    </main>
  );
}
