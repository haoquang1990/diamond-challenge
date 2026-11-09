import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gameConfig from './config/game-config.json';
import { getSupabaseClient } from './config/supabase';
import { dismissCheers, loadUnseenCheer } from './data/group-service';
import { ensureAccountLinked, loadAccount, saveDisplayName, signOut } from './data/auth-service';
import type { AccountInfo, AuthResult } from './data/auth-service';
import {
  CONTACT_EVENT_TYPES,
  createContactSyncController,
  readContactConsent,
  readContactSyncDeclined,
  recordContactConsent,
  withHouseholdClock,
} from './data/contact-sync';
import type { ContactConsent, ContactSyncController, HouseholdMember, SyncFailure, SyncStatus } from './data/contact-sync';
import type { EventStore, SyncStateStore } from './data/event-store';
import { browserNotificationPlatform, createReminderScheduler } from './notifications/reminders';
import type { NotificationPlatform } from './notifications/reminders';
import { AchievementsOverlay, ACHIEVEMENTS_CONFIG } from './ui/achievements-overlay';
import { createObservedStore, readSoundEnabled } from './ui/achievements-helpers';
import { setSoundEnabled } from './ui/play-ting';
import { AchievementsScreen } from './ui/screens/achievements-screen';
import { createAggregatesSync } from './data/aggregates-sync';
import type { AggregatesSync } from './data/aggregates-sync';
import { PEOPLE_CONFIG } from './ui/people-config';
import { Board30x30Screen } from './ui/screens/board-30x30-screen';
import { ChangePasswordScreen, DisplayNameScreen } from './ui/screens/change-password-screen';
import { CreateAccountScreen } from './ui/screens/create-account-screen';
import { ConsentScreen } from './ui/screens/consent-screen';
import { DiamondPathScreen } from './ui/screens/diamond-path-screen';
import { LessonScreen } from './ui/screens/lesson-screen';
import { HouseholdScreen } from './ui/screens/household-screen';
import { MyGroupScreen } from './ui/screens/my-group-screen';
import { LoginScreen } from './ui/screens/login-screen';
import { DuplicatesScreen } from './ui/screens/duplicates-screen';
import { PeopleScreen } from './ui/screens/people-screen';
import { SettingsScreen } from './ui/screens/settings-screen';
import { TodayScreen } from './ui/screens/today-screen';
import type { ContactsFilter } from './ui/people-helpers';
import { STRINGS } from './ui/strings';

/** Props for {@link App}. */
export interface AppProps {
  /** Event log shared by every screen; also keeps the contact-sync bookkeeping (story 023). */
  readonly eventStore: EventStore & SyncStateStore;
  /** Notification capabilities for reminders (story 007); defaults to the browser's. */
  readonly notificationPlatform?: NotificationPlatform;
}

/** Message the service worker posts when a reminder notification is tapped (public/sw.js). */
const OPEN_TODAY_MESSAGE = 'reminder-open-today';

const DEFAULT_PLATFORM = browserNotificationPlatform();

function realNow(): Date {
  return new Date();
}

/**
 * Top-level destinations. The tab bar shows exactly four (story 015):
 * Hôm nay · Học · Làm · Con đường. Làm keeps the id `people`: it is the
 * merged person list (Danh bạ). `settings` (opened from Hôm nay) and `board`
 * (opened from Con đường) are not in the tab bar.
 */
type Tab = 'today' | 'learn' | 'people' | 'path' | 'settings' | 'board' | 'achievements' | 'login' | 'household' | 'duplicates' | 'group';

const TABS: readonly { readonly id: Exclude<Tab, 'settings' | 'board' | 'achievements' | 'login' | 'household' | 'duplicates' | 'group'>; readonly label: string }[] = [
  { id: 'today', label: STRINGS.tabToday },
  { id: 'learn', label: STRINGS.tabLearn },
  { id: 'people', label: STRINGS.tabPeople },
  { id: 'path', label: STRINGS.tabPath },
];

/**
 * Root component with state-based routing (no router library). Opens on
 * Hôm nay. Switching tabs unmounts the previous screen, so Hôm nay re-reads
 * the event log every time it is shown.
 *
 * Làm (tab id 'people', story 015) is the person list: filters, name search,
 * add person, restore and legacy activity assignment; tasks are completed on
 * the person detail page. Hôm nay's Làm button opens it. From Bảng 30x30 it
 * opens with a filter preselected and a back control to the board. Cài đặt
 * has no tab bar ("Quay lại" to Hôm nay).
 *
 * Reminders (story 007): one scheduler is refreshed on app start, when the
 * app becomes visible, on every tab change (covers returning from Học and
 * leaving Làm, which no longer routes back to Hôm nay) and after a settings
 * change. A tapped reminder notification brings the app to Hôm nay.
 *
 * Household contact sync (story 023): once signed in (after the password and display-name
 * steps), the consent screen shows while `has_contact_consent()` is false and the user has
 * not declined on this device. With consent, a sync runs on start, after consenting, ~2 s
 * after a Danh bạ append, after a backup restore and on `online`. New Danh bạ events get the
 * household clock (`withHouseholdClock`).
 */
export function App({ eventStore: rawEventStore, notificationPlatform = DEFAULT_PLATFORM }: AppProps) {
  // Every screen gets the observed store, so each saved event reaches the achievements overlay.
  const observed = useMemo(() => createObservedStore(withHouseholdClock(rawEventStore, realNow, gameConfig.contactSync.maxClockSkewMs)), [rawEventStore]);
  const eventStore = observed.store;
  const [popupOpen, setPopupOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  /** Person whose account is being created (story 024); the screen has no tab bar. */
  const [createAccountFor, setCreateAccountFor] = useState<string | null>(null);
  /** Person detail to reopen in Làm after the account screen. */
  const [reopenPerson, setReopenPerson] = useState<string | null>(null);
  const [lessonActive, setLessonActive] = useState(false);
  /** Set when Làm was opened from Bảng 30x30 (preselected filter + back control); null otherwise. */
  /** The duplicates screen was opened from Bảng 30x30 (its back control returns there). */
  const [duplicatesFromBoard, setDuplicatesFromBoard] = useState(false);
  const [fromBoard, setFromBoard] = useState<ContactsFilter | null>(null);
  useEffect(() => {
    if (tab !== 'people') setReopenPerson(null);
  }, [tab]);
  const goToday = () => setTab('today');
  const onLessonActive = useCallback((active: boolean) => setLessonActive(active), []);

  // Optional account (story 021): the whole feature is hidden when the build has no Supabase config.
  const clientPromise = useMemo(() => getSupabaseClient(), []);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  /** Temporary password typed at sign-in; memory only, cleared once the password is changed. */
  const temporaryPasswordRef = useRef<string | null>(null);
  const [askDisplayName, setAskDisplayName] = useState(false);

  // Household contact sync (story 023).
  const [consent, setConsent] = useState<ContactConsent>('unknown');
  const [declined, setDeclined] = useState(false);
  /** The consent screen was reopened from Cài đặt. */
  const [consentOpen, setConsentOpen] = useState(false);
  const [syncController, setSyncController] = useState<ContactSyncController | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: 'idle' });
  const [members, setMembers] = useState<ReadonlyMap<string, HouseholdMember> | null>(null);
  /** Bumped when a sync pulled new events, so the open Làm list re-reads the log. */
  const [dataVersion, setDataVersion] = useState(0);
  /** Persisted household member ids: their events are not mine (works offline and signed out). */
  const [memberIds, setMemberIds] = useState<ReadonlySet<string>>(() => new Set());
  const memberIdsRef = useRef(memberIds);
  memberIdsRef.current = memberIds;
  const refreshMemberIds = useCallback(() => {
    rawEventStore
      .readMemberIds()
      .then(setMemberIds)
      .catch((error: unknown) => console.error('[contact-sync] could not read the member ids', error));
  }, [rawEventStore]);
  const accountId = account?.accountId ?? null;
  const passwordPending = account?.mustChangePassword === true;

  // Story 028: an unseen cheer from the sponsor household shows as a dismissible card on Hôm nay.
  const [unseenCheer, setUnseenCheer] = useState<{ readonly message: string; readonly allIds: readonly string[] } | null>(null);
  useEffect(() => {
    if (clientPromise === null || accountId === null || passwordPending || tab !== 'today' || !navigator.onLine) return;
    let cancelled = false;
    clientPromise
      .then((client) => loadUnseenCheer(client, accountId))
      .then((found) => {
        if (!cancelled) setUnseenCheer(found === null ? null : { message: found.cheer.message, allIds: found.allIds });
      })
      .catch((error: unknown) => console.error('[group] could not read cheers', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, passwordPending, tab]);
  const onDismissCheer = useCallback(() => {
    setUnseenCheer((current) => {
      if (current !== null) dismissCheers(current.allIds);
      return null;
    });
  }, []);

  useEffect(() => {
    if (clientPromise === null) return;
    let cancelled = false;
    clientPromise
      .then(loadAccount)
      .then((loaded) => {
        if (!cancelled) setAccount(loaded);
      })
      .catch((error: unknown) => console.error('[auth] could not restore the session', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise]);

  useEffect(() => {
    rawEventStore
      .list()
      .then((events) => setDeclined(readContactSyncDeclined(events)))
      .catch((error: unknown) => console.error('[contact-sync] could not read the sync setting', error));
    refreshMemberIds();
  }, [rawEventStore, refreshMemberIds]);

  const checkConsent = useCallback(async () => {
    if (clientPromise === null || accountId === null) return;
    try {
      const result = await readContactConsent(await clientPromise);
      setConsent(result.ok ? (result.consented ? 'granted' : 'missing') : 'unknown');
    } catch (error) {
      console.error('[contact-sync] consent check failed', error);
      setConsent('unknown');
    }
  }, [clientPromise, accountId]);

  useEffect(() => {
    setConsent('unknown');
    if (accountId !== null && !passwordPending) void checkConsent();
  }, [accountId, passwordPending, checkConsent]);

  useEffect(() => {
    if (clientPromise === null || accountId === null || consent !== 'granted' || declined) return;
    let controller: ContactSyncController | null = null;
    let cancelled = false;
    void clientPromise.then((client) => {
      if (cancelled) return;
      const created = createContactSyncController({ client, store: rawEventStore, accountId, config: gameConfig.contactSync, now: realNow });
      controller = created;
      created.subscribe(() => {
        const status = created.status();
        setSyncStatus(status);
        setMembers(created.members());
        if (status.kind === 'synced') refreshMemberIds();
        if (status.kind === 'synced' && status.pulled > 0) setDataVersion((v) => v + 1);
      });
      setSyncController(created);
      void created.sync(false);
    });
    return () => {
      cancelled = true;
      controller?.dispose();
      setSyncController(null);
      setSyncStatus({ kind: 'idle' });
      setMembers(null);
    };
  }, [clientPromise, accountId, consent, declined, rawEventStore, refreshMemberIds]);

  // Debounced push after a local Danh bạ append (the sync itself picks only Danh bạ events).
  useEffect(
    () =>
      observed.subscribe((event) => {
        if (CONTACT_EVENT_TYPES.includes(event.type)) syncController?.schedule();
      }),
    [observed, syncController],
  );

  useEffect(() => {
    const onOnline = () => {
      if (consent === 'unknown') void checkConsent();
      else if (!declined) void syncController?.sync(false);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [consent, declined, checkConsent, syncController]);

  // Household 30x30 numbers (story 027): sent only when signed in, consented and online, and only when they changed.
  const [aggregates, setAggregates] = useState<AggregatesSync | null>(null);
  useEffect(() => {
    if (clientPromise === null || accountId === null || consent !== 'granted' || declined) return;
    let created: AggregatesSync | null = null;
    let cancelled = false;
    void clientPromise.then((client) => {
      if (cancelled) return;
      created = createAggregatesSync({ client, list: () => rawEventStore.list(), accountId, peopleConfig: PEOPLE_CONFIG, config: gameConfig.aggregatesSync });
      setAggregates(created);
      created.schedule();
    });
    return () => {
      cancelled = true;
      created?.dispose();
      setAggregates(null);
    };
  }, [clientPromise, accountId, consent, declined, rawEventStore]);
  useEffect(
    () =>
      observed.subscribe((event) => {
        if (CONTACT_EVENT_TYPES.includes(event.type)) aggregates?.schedule();
      }),
    [observed, aggregates],
  );
  useEffect(() => {
    if (syncStatus.kind === 'synced') aggregates?.schedule();
  }, [syncStatus, aggregates]);
  useEffect(() => {
    const onOnline = () => void aggregates?.flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [aggregates]);

  const onConsentAgree = async (): Promise<SyncFailure | null> => {
    if (clientPromise === null) return 'server';
    if (consent !== 'granted') {
      const result = await recordContactConsent(await clientPromise, gameConfig.contactConsentVersion);
      if (!result.ok) return result.reason;
    }
    await eventStore.append({ type: 'settings_changed', payload: { contactSync: { enabled: true } } });
    setDeclined(false);
    setConsentOpen(false);
    setConsent('granted');
    return null;
  };

  const onConsentDecline = async () => {
    try {
      await eventStore.append({ type: 'settings_changed', payload: { contactSync: { enabled: false } } });
    } catch (error) {
      console.error('[contact-sync] could not save the choice', error);
    }
    setDeclined(true);
    setConsentOpen(false);
  };

  const onSignedIn = (signedIn: AccountInfo, password: string) => {
    ensureAccountLinked(rawEventStore, signedIn.accountId).catch((error: unknown) => console.error('[auth] could not link the account', error));
    setAccount(signedIn);
    if (signedIn.mustChangePassword) temporaryPasswordRef.current = password;
    setTab('settings');
  };

  const onSignOut = async (): Promise<boolean> => {
    if (clientPromise === null) return false;
    try {
      const result = await signOut(await clientPromise);
      if (!result.ok) return false;
    } catch (error) {
      console.error('[auth] sign-out failed', error);
      return false;
    }
    temporaryPasswordRef.current = null;
    setAskDisplayName(false);
    setConsentOpen(false);
    setAccount(null);
    return true;
  };

  const onSaveDisplayName = async (name: string): Promise<AuthResult> => {
    if (clientPromise === null) return { ok: false, reason: 'server' };
    const result = await saveDisplayName(await clientPromise, name);
    if (result.ok) setAccount((a) => (a === null ? a : { ...a, displayName: name }));
    return result;
  };

  const scheduler = useMemo(
    () =>
      createReminderScheduler({
        eventStore,
        platform: notificationPlatform,
        now: realNow,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        memberIds: () => memberIdsRef.current,
      }),
    [eventStore, notificationPlatform],
  );
  const refreshReminders = useCallback(() => void scheduler.refresh(), [scheduler]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshReminders();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      scheduler.dispose();
    };
  }, [scheduler, refreshReminders]);

  // App start and every tab change (covers returning after a Học save and leaving Làm).
  useEffect(() => {
    refreshReminders();
  }, [tab, refreshReminders]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (typeof data === 'object' && data !== null && (data as { type?: unknown }).type === OPEN_TODAY_MESSAGE) {
        setTab('today');
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  // Reward sound: config default, then the latest saved choice (on start, when settings change, after a restore).
  const refreshSound = useCallback(async () => {
    try {
      setSoundEnabled(readSoundEnabled(await rawEventStore.list(), ACHIEVEMENTS_CONFIG.soundDefault));
    } catch (error) {
      console.error('[sound] could not read the sound setting', error);
    }
  }, [rawEventStore]);

  useEffect(() => {
    setSoundEnabled(ACHIEVEMENTS_CONFIG.soundDefault);
    void refreshSound();
    return observed.subscribe((event) => {
      if (event.type === 'settings_changed' && event.payload.sound !== undefined) void refreshSound();
    });
  }, [observed, refreshSound]);

  // After a backup restore: acknowledge existing milestones silently (no popups), then re-read sound and reminders.
  const silentAcknowledgeRef = useRef<(() => Promise<void>) | null>(null);
  const onImported = useCallback(async () => {
    try {
      await silentAcknowledgeRef.current?.();
    } catch (error) {
      console.error('[achievements] silent acknowledge after restore failed', error);
    }
    await refreshSound();
    // Restored Danh bạ events are unsynced like any local event.
    syncController?.schedule();
  }, [refreshSound, syncController]);

  const screen = renderScreen();
  return (
    <>
      <div className="app-inert" inert={popupOpen}>
        {screen}
      </div>
      <AchievementsOverlay observed={observed} rawStore={rawEventStore} tab={tab} memberIds={memberIds} onPopupOpenChange={setPopupOpen} silentAcknowledgeRef={silentAcknowledgeRef} />
    </>
  );

  function renderScreen() {
  if (clientPromise !== null && account?.mustChangePassword === true) {
    return (
      <div className="app-shell">
        <ChangePasswordScreen
          clientPromise={clientPromise}
          temporaryPassword={temporaryPasswordRef.current}
          onDone={() => {
            temporaryPasswordRef.current = null;
            setAccount({ ...account, mustChangePassword: false });
            setAskDisplayName(true);
          }}
          onSignOut={() => void onSignOut()}
        />
      </div>
    );
  }

  if (clientPromise !== null && account !== null && askDisplayName) {
    const done = () => {
      setAskDisplayName(false);
      setTab('settings');
    };
    return (
      <div className="app-shell">
        <DisplayNameScreen
          clientPromise={clientPromise}
          onSaved={(name) => {
            setAccount({ ...account, displayName: name });
            done();
          }}
          onSkip={done}
        />
      </div>
    );
  }

  if (clientPromise !== null && account !== null && (consentOpen || (consent === 'missing' && !declined))) {
    return (
      <div className="app-shell">
        <ConsentScreen onAgree={onConsentAgree} onDecline={() => void onConsentDecline()} />
      </div>
    );
  }

  if (createAccountFor !== null && clientPromise !== null && account !== null) {
    return (
      <div className="app-shell">
        <CreateAccountScreen
          clientPromise={clientPromise}
          eventStore={eventStore}
          personId={createAccountFor}
          onBack={() => {
            setReopenPerson(createAccountFor);
            setCreateAccountFor(null);
          }}
        />
      </div>
    );
  }

  if (tab === 'login' && clientPromise !== null) {
    return (
      <div className="app-shell">
        <LoginScreen clientPromise={clientPromise} onBack={() => setTab('settings')} onSignedIn={onSignedIn} />
      </div>
    );
  }

  if (tab === 'household' && clientPromise !== null && account !== null) {
    return (
      <div className="app-shell">
        <HouseholdScreen clientPromise={clientPromise} accountId={account.accountId} onBack={() => setTab('settings')} />
      </div>
    );
  }

  if (tab === 'group' && clientPromise !== null && account !== null) {
    return (
      <div className="app-shell">
        <MyGroupScreen clientPromise={clientPromise} accountId={account.accountId} onBack={() => setTab('path')} />
      </div>
    );
  }

  if (tab === 'duplicates') {
    return (
      <div className="app-shell">
        <DuplicatesScreen eventStore={eventStore} memberIds={memberIds} members={members} dataVersion={dataVersion} onBack={() => setTab(duplicatesFromBoard ? 'board' : 'people')} />
      </div>
    );
  }

  if (tab === 'board') {
    return (
      <div className="app-shell">
        <Board30x30Screen eventStore={eventStore} onBack={() => setTab('path')}
          onOpenPeople={() => setTab('people')}
          onOpenDuplicates={() => {
            setDuplicatesFromBoard(true);
            setTab('duplicates');
          }}
          dataVersion={dataVersion}
          onOpenContacts={(filter) => {
            setFromBoard(filter);
            setTab('people');
          }}
        />
      </div>
    );
  }

  if (tab === 'achievements') {
    return (
      <div className="app-shell">
        <AchievementsScreen eventStore={eventStore} memberIds={memberIds} onBack={() => setTab('path')} />
      </div>
    );
  }

  if (tab === 'settings') {
    return (
      <div className="app-shell">
        <SettingsScreen eventStore={eventStore} onBack={goToday} onSaved={refreshReminders} onImported={onImported}
          platform={notificationPlatform}
          {...(clientPromise === null
            ? {}
            : {
                accountSection: { account, onLogin: () => setTab('login'), onSignOut, onSaveDisplayName, onOpenHousehold: () => setTab('household') },
                contactSync: {
                  signedIn: account !== null,
                  consent,
                  declined,
                  status: syncStatus,
                  onEnable: () => setConsentOpen(true),
                  onSyncNow: () => {
                    if (consent === 'granted' && !declined) void syncController?.sync(true);
                    else void checkConsent();
                  },
                },
              })}
        />
      </div>
    );
  }

  return (
    <div className={tab === 'learn' && lessonActive ? 'app-shell' : 'app-shell app-shell--tabs'}>
      {tab === 'today' && (
        <TodayScreen
          eventStore={eventStore}
          memberIds={memberIds}
          onLearn={() => setTab('learn')}
          onDo={() => {
            setFromBoard(null);
            setTab('people');
          }}
          onOpenSettings={() => setTab('settings')}
          notificationPermission={notificationPlatform.permission}
          cheer={unseenCheer}
          onDismissCheer={onDismissCheer}
        />
      )}
      {tab === 'learn' && <LessonScreen eventStore={eventStore} onDone={goToday} onActiveChange={onLessonActive} />}
      {tab === 'path' && <DiamondPathScreen eventStore={eventStore} memberIds={memberIds} onOpenBoard={() => setTab('board')} {...(clientPromise === null ? {} : { onOpenGroup: () => setTab('group'), groupLocked: account === null })} onOpenAchievements={() => setTab('achievements')} />}
      {tab === 'people' && (
        <PeopleScreen
          key={fromBoard ?? 'tab'}
          eventStore={eventStore}
          members={members}
          memberIds={memberIds}
          dataVersion={dataVersion}
          onOpenDuplicates={() => {
            setDuplicatesFromBoard(false);
            setTab('duplicates');
          }}
          initialOpenId={reopenPerson}
          {...(clientPromise === null || account === null ? {} : { onCreateAccount: setCreateAccountFor })}
          {...(fromBoard === null
            ? {}
            : {
                initialFilter: fromBoard,
                onBack: () => {
                  setFromBoard(null);
                  setTab('board');
                },
              })}
        />
      )}
      {!(tab === 'learn' && lessonActive) && (
      <nav className="tab-bar" aria-label={STRINGS.navLabel}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={id === tab ? 'tab-bar__tab tab-bar__tab--active' : 'tab-bar__tab'}
            aria-current={id === tab ? 'page' : undefined}
            onClick={() => {
              setFromBoard(null);
              setTab(id);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      )}
    </div>
  );
  }
}
