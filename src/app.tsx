import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gameConfig from './config/game-config.json';
import { getSupabaseClient } from './config/supabase';
import { loadIsAdmin } from './data/admin-service';
import { loadCodeRequirement } from './data/account-service';
import type { CodeRequirement } from './data/account-service';
import { clearGroupCaches, dismissCheers, loadUnseenCheer } from './data/group-service';
import { ensureAccountLinked, saveDisplayName, signOut } from './data/auth-service';
import { readDeviceAccount, updateDeviceAccount } from './data/account-stores';
import type { AccountInfo, AuthResult } from './data/auth-service';
import {
  CONTACT_EVENT_TYPES,
  createContactSyncController,
  readContactConsent,
  readContactConsentVersion,
  recordContactConsent,
  withHouseholdClock,
} from './data/contact-sync';
import type { ContactConsent, ContactSyncController, HouseholdMember, SyncFailure, SyncStatus } from './data/contact-sync';
import type { EventStore, SyncStateStore } from './data/event-store';
import { createProgressSyncController, PERSONAL_EVENT_TYPES } from './data/progress-sync';
import type { ProgressSyncController } from './data/progress-sync';
import { browserNotificationPlatform, createReminderScheduler } from './notifications/reminders';
import { createPrefsSync } from './data/notification-prefs';
import { parseReminderConfig, readReminderSettings } from './domain/reminders';
import type { NotificationPlatform } from './notifications/reminders';
import { AchievementsOverlay, ACHIEVEMENTS_CONFIG } from './ui/achievements-overlay';
import { createObservedStore, readSoundEnabled } from './ui/achievements-helpers';
import { setSoundEnabled } from './ui/play-ting';
import { createAggregatesSync } from './data/aggregates-sync';
import type { AggregatesSync } from './data/aggregates-sync';
import { computeShareProgress, otherMemberIds } from './domain/progress';
import { createMemberProgressSync } from './data/member-progress-sync';
import type { MemberProgressSync } from './data/member-progress-sync';
import { PEOPLE_CONFIG } from './ui/people-config';
import { AdminScreen } from './ui/screens/admin-screen';
import { ChangePasswordScreen, DisplayNameScreen } from './ui/screens/change-password-screen';
import { CodeRequiredScreen } from './ui/screens/code-required-screen';
import { GroupScreen } from './ui/screens/group-screen';
import { GroupTodayCard } from './ui/screens/group-today-card';
import { readInviteToken, requestFriendByToken } from './data/friends-service';
import { CreateAccountScreen } from './ui/screens/create-account-screen';
import { ConsentScreen } from './ui/screens/consent-screen';
import { BadgesScreen } from './ui/screens/badges-screen';
import { LessonScreen } from './ui/screens/lesson-screen';
import { GoalCard } from './ui/screens/goal-card';
import { PushCard } from './ui/screens/push-card';
import { HouseholdCard, HouseholdScreen } from './ui/screens/household-screen';
import { GroupCheerCard } from './ui/screens/group-cheer-card';
import type { Person } from './domain/people';
import { F1HouseholdBox } from './ui/screens/f1-household-box';
import { useGroupData } from './ui/use-group-data';
import { localDayKey } from './ui/group-helpers';
import { progressByCode } from './ui/group-helpers';
import { DuplicatesScreen } from './ui/screens/duplicates-screen';
import { PeopleScreen } from './ui/screens/people-screen';
import { SettingsScreen } from './ui/screens/settings-screen';
import { TodayScreen } from './ui/screens/today-screen';
import { PushPromptCard } from './ui/screens/push-prompt-card';
import { STRINGS } from './ui/strings';

/** Props for {@link App}. */
export interface AppProps {
  /** Event log shared by every screen; also keeps the contact-sync bookkeeping (story 023). */
  readonly eventStore: EventStore & SyncStateStore;
  /** Notification capabilities for reminders (story 007); defaults to the browser's. */
  readonly notificationPlatform?: NotificationPlatform;
  /**
   * The signed-in account (story 030), given by the login gate. Absent when Supabase is not
   * configured: the account features are then hidden and nothing is gated.
   */
  readonly session?: AppSession;
}

/** The signed-in session the login gate hands to {@link App}. */
export interface AppSession {
  readonly account: AccountInfo;
  /** Temporary password typed at sign-in (memory only), or null. */
  readonly temporaryPassword: string | null;
  /** Called after sign-out: the gate shows the Login screen. */
  readonly onSignedOut: () => void;
  /** Deletes this account's store and the cached device account; resolves false on failure. */
  readonly onEraseDevice: (accountId: string) => Promise<boolean>;
}

/** Message the service worker posts when a reminder notification is tapped (public/sw.js). */
const OPEN_TODAY_MESSAGE = 'reminder-open-today';

const DEFAULT_PLATFORM = browserNotificationPlatform();

/** Reminder defaults (story 007), for sending the settings to the server (story 058). */
const REMINDER_CONFIG = parseReminderConfig(gameConfig.reminder);

function realNow(): Date {
  return new Date();
}

/**
 * Top-level destinations. The tab bar shows exactly four (story 015):
 * Hôm nay · Học · Làm · Con đường. Làm keeps the id `people`: it is the
 * merged person list (Danh bạ). `settings` (opened from Hôm nay) is not in the tab bar.
 * Bảng 30x30 and Nhóm của tôi were removed in story 042.
 */
/** sessionStorage key holding an invite link token until the account is signed in (story 069). */
const INVITE_STORAGE_KEY = 'diamond.pendingFriendInvite';

type Tab = 'today' | 'learn' | 'people' | 'badges' | 'settings' | 'household' | 'admin' | 'duplicates' | 'group';

const TABS: readonly { readonly id: Exclude<Tab, 'settings' | 'household' | 'admin' | 'duplicates' | 'group'>; readonly label: string }[] = [
  { id: 'today', label: STRINGS.tabToday },
  { id: 'learn', label: STRINGS.tabLearn },
  { id: 'people', label: STRINGS.tabPeople },
  { id: 'badges', label: STRINGS.tabBadges },
];

/**
 * Root component with state-based routing (no router library). Opens on
 * Hôm nay. Switching tabs unmounts the previous screen, so Hôm nay re-reads
 * the event log every time it is shown.
 *
 * Làm (tab id 'people', story 015) is the person list: filters, name search,
 * add person, restore and legacy activity assignment; tasks are completed on
 * the person detail page. Hôm nay's Làm button opens it. Cài đặt
 * has no tab bar ("Quay lại" to Hôm nay).
 *
 * Reminders (story 007): one scheduler is refreshed on app start, when the
 * app becomes visible, on every tab change (covers returning from Học and
 * leaving Làm, which no longer routes back to Hôm nay) and after a settings
 * change. A tapped reminder notification brings the app to Hôm nay.
 *
 * Household contact sync (story 023): once signed in (after the password and display-name
 * steps), the consent screen shows until the server has the account's consent (story 030:
 * required; a local "Không đồng ý" no longer counts; a cached agreement opens the app offline).
 * With consent, a sync runs on start, after consenting, ~2 s
 * after a Danh bạ append, after a backup restore and on `online`. New Danh bạ events get the
 * household clock (`withHouseholdClock`).
 */
export function App({ eventStore: rawEventStore, notificationPlatform = DEFAULT_PLATFORM, session }: AppProps) {
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
  /** Lesson Hôm nay asked Học to start (story 039); cleared when leaving Học. */
  const [startLessonId, setStartLessonId] = useState<string | null>(null);
  useEffect(() => {
    if (tab !== 'people') setReopenPerson(null);
  }, [tab]);
  const goToday = () => setTab('today');
  // A lesson started from Hôm nay runs once; coming back to Học later shows the path (story 039).
  useEffect(() => {
    if (tab !== 'learn') setStartLessonId(null);
  }, [tab]);
  const onLessonActive = useCallback((active: boolean) => setLessonActive(active), []);

  // Optional account (story 021): the whole feature is hidden when the build has no Supabase config.
  const clientPromise = useMemo(() => (session === undefined ? null : getSupabaseClient()), [session]);
  const [account, setAccount] = useState<AccountInfo | null>(session?.account ?? null);
  /** Temporary password typed at sign-in; memory only, cleared once the password is changed. */
  const temporaryPasswordRef = useRef<string | null>(session?.temporaryPassword ?? null);
  const [askDisplayName, setAskDisplayName] = useState(false);
  /** Story 068: whether my household still needs its Amway code (null while unread). */
  const [codeReq, setCodeReq] = useState<CodeRequirement | null>(null);

  // Household contact sync (story 023).
  // Consent is required (story 030): server state is the truth; the cached agreement opens the app offline.
  const [consent, setConsent] = useState<ContactConsent>(() => {
    const cached = session === undefined ? null : readDeviceAccount();
    return cached !== null && cached.accountId === session?.account.accountId && (cached.consentVersion ?? 0) >= gameConfig.contactConsentVersion ? 'granted' : 'unknown';
  });
  const [syncController, setSyncController] = useState<ContactSyncController | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ kind: 'idle' });
  // Personal progress sync (story 032, ADR-0004): its own controller and status, same rhythm as Danh bạ.
  const [progressController, setProgressController] = useState<ProgressSyncController | null>(null);
  const [progressStatus, setProgressStatus] = useState<SyncStatus>({ kind: 'idle' });
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

  // Story 029: "Quản trị" is shown only to role = admin (read from the own profile; the server enforces it too).
  const [isAdmin, setIsAdmin] = useState(() => session !== undefined && readDeviceAccount()?.accountId === session.account.accountId && readDeviceAccount()?.isAdmin === true);
  useEffect(() => {
    if (clientPromise === null || accountId === null || passwordPending) return;
    let cancelled = false;
    clientPromise
      .then((client) => loadIsAdmin(client, accountId))
      .then((admin) => {
        if (cancelled) return;
        setIsAdmin(admin);
        updateDeviceAccount(accountId, { isAdmin: admin });
      })
      .catch((error: unknown) => console.error('[admin] could not read the role', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, passwordPending]);

  // Story 068: ask once for the household's Amway code when it has none (offline: never blocks).
  useEffect(() => {
    setCodeReq(null);
    if (clientPromise === null || accountId === null || passwordPending) return;
    let cancelled = false;
    clientPromise
      .then((client) => loadCodeRequirement(client, accountId))
      .then((req) => {
        if (!cancelled) setCodeReq(req);
      })
      .catch((error: unknown) => console.error('[code] could not read the household code', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, passwordPending]);

  // Story 069: an invite link (?ban=<token>) is kept until signed in, then sent as a friend request.
  const [groupNotice, setGroupNotice] = useState<string | null>(null);
  useEffect(() => {
    const token = readInviteToken(window.location.search);
    if (token === null) return;
    try {
      sessionStorage.setItem(INVITE_STORAGE_KEY, token);
    } catch {
      // Without storage the request is sent only when already signed in.
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('ban');
    window.history.replaceState(null, '', url.toString());
  }, []);
  useEffect(() => {
    if (clientPromise === null || accountId === null || passwordPending || codeReq === null || codeReq === 'missing') return;
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(INVITE_STORAGE_KEY);
    } catch {
      token = null;
    }
    if (token === null) return;
    void clientPromise
      .then((client) => requestFriendByToken(client, token))
      .then((r) => {
        if (r === 'failed') return;
        try {
          sessionStorage.removeItem(INVITE_STORAGE_KEY);
        } catch {
          // ignore
        }
        setGroupNotice(r === 'limit' ? STRINGS.friendLimit : STRINGS.friendInviteSentFromLink);
        setTab('group');
      });
  }, [clientPromise, accountId, passwordPending, codeReq]);

  // Story 028: an unseen cheer from the sponsor household shows as a dismissible card on Hôm nay.
  const [unseenCheer, setUnseenCheer] = useState<{ readonly message: string; readonly senderName: string | null; readonly allIds: readonly string[] } | null>(null);
  // A cheer belongs to one account's household: drop it when the account changes or signs out.
  useEffect(() => setUnseenCheer(null), [accountId]);
  useEffect(() => {
    if (clientPromise === null || accountId === null || passwordPending || tab !== 'today' || !navigator.onLine) return;
    let cancelled = false;
    clientPromise
      .then((client) => loadUnseenCheer(client, accountId))
      .then((found) => {
        if (!cancelled) setUnseenCheer(found === null ? null : { message: found.cheer.message, senderName: found.cheer.senderName, allIds: found.allIds });
      })
      .catch((error: unknown) => console.error('[group] could not read cheers', error));
    return () => {
      cancelled = true;
    };
  }, [clientPromise, accountId, passwordPending, tab]);
  const onDismissCheer = useCallback(() => {
    if (unseenCheer !== null) dismissCheers(unseenCheer.allIds);
    setUnseenCheer(null);
  }, [unseenCheer]);

  // Link this account to the store's local user id (story 021); a no-op when already linked.
  useEffect(() => {
    if (accountId === null) return;
    ensureAccountLinked(rawEventStore, accountId).catch((error: unknown) => console.error('[auth] could not link the account', error));
  }, [rawEventStore, accountId]);

  useEffect(() => {
    refreshMemberIds();
  }, [rawEventStore, refreshMemberIds]);

  const checkConsent = useCallback(async () => {
    if (clientPromise === null || accountId === null) return;
    try {
      const client = await clientPromise;
      const result = await readContactConsent(client);
      if (!result.ok) {
        // Offline or failed: keep an agreement cached on this device, else stay undecided.
        setConsent((c) => (c === 'granted' ? c : 'unknown'));
        return;
      }
      if (!result.consented) {
        updateDeviceAccount(accountId, { consentVersion: null });
        setConsent('missing');
        return;
      }
      // Agreed on the server: ask again once when the consent text version increased.
      const version = await readContactConsentVersion(client);
      if (version === null) {
        // Version unreadable: never assume the current version (story 033); keep a cached current agreement only.
        setConsent((c) => (c === 'granted' ? c : 'unknown'));
        return;
      }
      if (version < gameConfig.contactConsentVersion) {
        updateDeviceAccount(accountId, { consentVersion: version });
        setConsent('missing');
        return;
      }
      updateDeviceAccount(accountId, { consentVersion: version });
      setConsent('granted');
    } catch (error) {
      console.error('[contact-sync] consent check failed', error);
      setConsent((c) => (c === 'granted' ? c : 'unknown'));
    }
  }, [clientPromise, accountId]);

  useEffect(() => {
    if (accountId !== null && !passwordPending) void checkConsent();
  }, [accountId, passwordPending, checkConsent]);

  useEffect(() => {
    if (clientPromise === null || accountId === null || consent !== 'granted') return;
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
  }, [clientPromise, accountId, consent, rawEventStore, refreshMemberIds]);

  useEffect(() => {
    if (clientPromise === null || accountId === null || consent !== 'granted') return;
    let controller: ProgressSyncController | null = null;
    let cancelled = false;
    void clientPromise.then((client) => {
      if (cancelled) return;
      const created = createProgressSyncController({ client, store: rawEventStore, accountId, consented: true, config: gameConfig.contactSync, now: realNow });
      controller = created;
      created.subscribe(() => {
        const status = created.status();
        setProgressStatus(status);
        if (status.kind === 'synced' && status.pulled > 0) setDataVersion((v) => v + 1);
      });
      setProgressController(created);
      void created.sync(false);
    });
    return () => {
      cancelled = true;
      controller?.dispose();
      setProgressController(null);
      setProgressStatus({ kind: 'idle' });
    };
  }, [clientPromise, accountId, consent, rawEventStore]);

  // Debounced push after a local append; each controller picks only its own stream's events.
  useEffect(
    () =>
      observed.subscribe((event) => {
        if (CONTACT_EVENT_TYPES.includes(event.type)) syncController?.schedule();
        if (PERSONAL_EVENT_TYPES.includes(event.type)) progressController?.schedule();
      }),
    [observed, syncController, progressController],
  );

  useEffect(() => {
    const onOnline = () => {
      if (consent === 'unknown') void checkConsent();
      else {
        void syncController?.sync(false);
        void progressController?.sync(false);
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [consent, checkConsent, syncController, progressController]);

  // Household 30x30 numbers (story 027): sent only when signed in, consented and online, and only when they changed.
  const [aggregates, setAggregates] = useState<AggregatesSync | null>(null);
  /** True once the household contact book was pulled in this session (gates aggregate sends). */
  const contactsPulledRef = useRef(false);
  useEffect(() => {
    contactsPulledRef.current = false;
  }, [accountId]);
  useEffect(() => {
    if (clientPromise === null || accountId === null || consent !== 'granted') return;
    let created: AggregatesSync | null = null;
    let cancelled = false;
    void clientPromise.then((client) => {
      if (cancelled) return;
      created = createAggregatesSync({
        client,
        list: () => rawEventStore.list(),
        accountId,
        peopleConfig: PEOPLE_CONFIG,
        config: gameConfig.aggregatesSync,
        isReady: () => contactsPulledRef.current,
      });
      setAggregates(created);
      // The first send waits for the first completed contact sync (below).
      if (contactsPulledRef.current) created.schedule();
    });
    return () => {
      cancelled = true;
      created?.dispose();
      setAggregates(null);
    };
  }, [clientPromise, accountId, consent, rawEventStore]);
  useEffect(
    () =>
      observed.subscribe((event) => {
        if (CONTACT_EVENT_TYPES.includes(event.type)) aggregates?.schedule();
      }),
    [observed, aggregates],
  );
  useEffect(() => {
    if (syncStatus.kind !== 'synced') return;
    contactsPulledRef.current = true;
    aggregates?.schedule();
  }, [syncStatus, aggregates]);
  useEffect(() => {
    const onOnline = () => void aggregates?.flush();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [aggregates]);

  // Story 044: share total XP, 7-day XP and streak with the upline once personal progress was pulled.
  const progressPulledRef = useRef(false);
  useEffect(() => {
    progressPulledRef.current = false;
  }, [accountId]);
  const [memberShare, setMemberShare] = useState<MemberProgressSync | null>(null);
  useEffect(() => {
    if (clientPromise === null || accountId === null || consent !== 'granted') return;
    let created: MemberProgressSync | null = null;
    let cancelled = false;
    void clientPromise.then((client) => {
      if (cancelled) return;
      created = createMemberProgressSync({
        client,
        accountId,
        debounceMs: gameConfig.aggregatesSync.debounceMs,
        isReady: () => progressPulledRef.current,
        compute: async () => {
          const events = await rawEventStore.list();
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          return computeShareProgress(events, new Date(), { dailyXpGoal: gameConfig.dailyXpGoal }, timeZone, otherMemberIds(events, memberIdsRef.current));
        },
      });
      setMemberShare(created);
      if (progressPulledRef.current) created.schedule();
    });
    return () => {
      cancelled = true;
      created?.dispose();
      setMemberShare(null);
    };
  }, [clientPromise, accountId, consent, rawEventStore]);
  useEffect(() => observed.subscribe(() => memberShare?.schedule()), [observed, memberShare]);
  useEffect(() => {
    if (progressStatus.kind !== 'synced') return;
    progressPulledRef.current = true;
    memberShare?.schedule();
    // Story 046: progress pulled from the server (a new device, another device of mine) holds
    // milestones already celebrated elsewhere: acknowledge them silently, no popup flood.
    if (progressStatus.pulled > 0) void silentAcknowledgeRef.current?.().catch((error: unknown) => console.error('[achievements] silent acknowledge after pull failed', error));
  }, [progressStatus, memberShare]);
  useEffect(() => {
    // A new day changes the 7-day XP and the streak without any new event.
    const onVisible = () => {
      if (document.visibilityState === 'visible') memberShare?.schedule();
    };
    const onOnline = () => void memberShare?.flush();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [memberShare]);

  // F1 group for the NPP ranking in Làm (story 044); refreshed each time Làm opens.
  const group = useGroupData(tab === 'people' ? clientPromise : null, tab === 'people' ? accountId : null);
  const nppProgress = useMemo(() => (group === null ? undefined : progressByCode(group.households, localDayKey(new Date()))), [group]);
  // Story 059: the F1 accounts I sponsor, by account id (name they set, login phone).
  const f1Accounts = useMemo(() => {
    const map = new Map<string, { readonly displayName: string | null; readonly phone: string | null }>();
    for (const h of group?.households ?? []) for (const m of h.members) map.set(m.userId, { displayName: m.displayName, phone: m.phone });
    return map;
  }, [group]);

  const onConsentAgree = async (): Promise<SyncFailure | null> => {
    if (clientPromise === null || accountId === null) return 'server';
    const result = await recordContactConsent(await clientPromise, gameConfig.contactConsentVersion);
    if (!result.ok) return result.reason;
    updateDeviceAccount(accountId, { consentVersion: gameConfig.contactConsentVersion });
    setConsent('granted');
    return null;
  };

  /** Signs out (keeping this account's store) and returns to the Login screen. */
  const onSignOut = async (): Promise<boolean> => {
    if (clientPromise === null || session === undefined) return false;
    try {
      const result = await signOut(await clientPromise);
      if (!result.ok) return false;
    } catch (error) {
      console.error('[auth] sign-out failed', error);
      return false;
    }
    temporaryPasswordRef.current = null;
    setAskDisplayName(false);
    setUnseenCheer(null);
    clearGroupCaches();
    setAccount(null);
    session.onSignedOut();
    return true;
  };

  /** Deletes this account's store, then signs out. Settings has already checked nothing is left to sync. */
  const onEraseDevice = async (): Promise<boolean> => {
    if (session === undefined || accountId === null) return false;
    if (!(await session.onEraseDevice(accountId))) return false;
    if (!(await onSignOut())) session.onSignedOut();
    return true;
  };

  const onSaveDisplayName = async (name: string): Promise<AuthResult> => {
    if (clientPromise === null) return { ok: false, reason: 'server' };
    const result = await saveDisplayName(await clientPromise, name);
    if (result.ok) {
      setAccount((a) => (a === null ? a : { ...a, displayName: name }));
      if (accountId !== null) updateDeviceAccount(accountId, { displayName: name });
    }
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
  // Story 058: the server pushes the reminder while the app is closed, so it needs the settings.
  const prefsSync = useMemo(() => (clientPromise === null || accountId === null ? null : { accountId, clientPromise }), [clientPromise, accountId]);
  const syncReminderPrefs = useCallback(async () => {
    if (prefsSync === null || !navigator.onLine) return;
    try {
      const settings = readReminderSettings(await eventStore.list(), REMINDER_CONFIG);
      await createPrefsSync({ client: await prefsSync.clientPromise, accountId: prefsSync.accountId }).save({
        reminder: { enabled: settings.enabled, time: settings.time },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (error) {
      console.warn('[app] reminder settings not sent', error);
    }
  }, [prefsSync, eventStore]);
  const refreshReminders = useCallback(() => {
    void scheduler.refresh();
    void syncReminderPrefs();
  }, [scheduler, syncReminderPrefs]);

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
    progressController?.schedule();
  }, [refreshSound, syncController, progressController]);

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
          initialName={account.displayName ?? ''}
          onSaved={(name) => {
            setAccount({ ...account, displayName: name });
            done();
          }}
          onSkip={done}
        />
      </div>
    );
  }

  if (clientPromise !== null && account !== null && consent !== 'granted') {
    return (
      <div className="app-shell">
        <ConsentScreen
          onAgree={onConsentAgree}
          onSignOut={() => void onSignOut()}
          needsNetwork={consent === 'unknown'}
          onRetry={() => void checkConsent()}
        />
      </div>
    );
  }

  if (clientPromise !== null && account !== null && codeReq === 'missing') {
    return (
      <div className="app-shell">
        <CodeRequiredScreen clientPromise={clientPromise} onSaved={() => setCodeReq('ok')} onPending={() => setCodeReq('pending')} onSignOut={() => void onSignOut()} />
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

  if (tab === 'household' && clientPromise !== null && account !== null) {
    return (
      <div className="app-shell">
        <HouseholdScreen clientPromise={clientPromise} accountId={account.accountId} onBack={() => setTab('settings')} startAdding />
      </div>
    );
  }

  if (tab === 'admin' && clientPromise !== null && account !== null && isAdmin) {
    return (
      <div className="app-shell">
        <AdminScreen clientPromise={clientPromise} onBack={() => setTab('settings')} />
      </div>
    );
  }

  if (tab === 'group' && clientPromise !== null && account !== null) {
    return (
      <div className="app-shell">
        <GroupScreen
          clientPromise={clientPromise}
          notice={groupNotice}
          appUrl={new URL(import.meta.env.BASE_URL, window.location.href).toString()}
          onBack={() => {
            setGroupNotice(null);
            setDataVersion((v) => v + 1);
            goToday();
          }}
        />
      </div>
    );
  }

  if (tab === 'duplicates') {
    return (
      <div className="app-shell">
        <DuplicatesScreen eventStore={eventStore} memberIds={memberIds} members={members} dataVersion={dataVersion} onBack={() => setTab('people')} />
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
                accountSection: { account, onSignOut, onSaveDisplayName, onOpenHousehold: () => setTab('household'), ...(isAdmin ? { onOpenAdmin: () => setTab('admin') } : {}) },
                contactSync: {
                  consent,
                  status: syncStatus,
                  progressStatus,
                  onSyncNow: () => {
                    if (consent === 'granted') {
                      void syncController?.sync(true);
                      void progressController?.sync(true);
                    } else void checkConsent();
                  },
                },
                onEraseDevice,
                goalSlot: <GoalCard eventStore={eventStore} memberIds={memberIds} />,
                ...(account !== null ? { pushSlot: <PushCard clientPromise={clientPromise} accountId={account.accountId} /> } : {}),
                ...(account !== null ? { householdSlot: <HouseholdCard clientPromise={clientPromise} accountId={account.accountId} onAddMember={() => setTab('household')} /> } : {}),
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
          {...(clientPromise !== null && account !== null
            ? { groupCard: <GroupTodayCard clientPromise={clientPromise} dataVersion={dataVersion} onOpen={() => setTab('group')} /> }
            : {})}
          {...(clientPromise !== null && account !== null
            ? { cheerGroup: <GroupCheerCard clientPromise={clientPromise} accountId={account.accountId} eventStore={eventStore} dataVersion={dataVersion} /> }
            : {})}
          onStartLesson={(lessonId) => {
            setStartLessonId(lessonId);
            setTab('learn');
          }}
          onOpenSettings={() => setTab('settings')}
          onOpenWork={() => setTab('people')}
          notificationPermission={notificationPlatform.permission}
          {...(clientPromise !== null && account !== null
            ? { pushPrompt: <PushPromptCard clientPromise={clientPromise} accountId={account.accountId} eventStore={eventStore} onChanged={refreshReminders} /> }
            : {})}
          cheer={unseenCheer}
          onDismissCheer={onDismissCheer}
        />
      )}
      {tab === 'learn' && (
        <LessonScreen
          key={startLessonId ?? 'path'}
          eventStore={eventStore}
          onDone={goToday}
          onActiveChange={onLessonActive}
          {...(startLessonId === null ? {} : { initialLessonId: startLessonId })}
        />
      )}
      {tab === 'badges' && <BadgesScreen eventStore={eventStore} memberIds={memberIds} dataVersion={dataVersion} />}
      {tab === 'people' && (
        <PeopleScreen
          eventStore={eventStore}
          members={members}
          memberIds={memberIds}
          dataVersion={dataVersion}
          onOpenDuplicates={() => setTab('duplicates')}
          {...(nppProgress === undefined ? {} : { nppProgress })}
          {...(clientPromise === null || account === null
            ? {}
            : {
                renderPersonExtra: (person: Person) =>
                  person.label === 'NPP' && person.amwayCode != null && person.amwayCode !== '' ? (
                    <F1HouseholdBox clientPromise={clientPromise} accountId={account.accountId} amwayCode={person.amwayCode} contactNames={person.linkedUserId == null ? undefined : new Map([[person.linkedUserId, person.name]])} />
                  ) : null,
              })}
          linkedAccountFor={(userId) => f1Accounts.get(userId) ?? null}
          initialOpenId={reopenPerson}
          {...(clientPromise === null || account === null ? {} : { onCreateAccount: setCreateAccountFor })}
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
            onClick={() => setTab(id)}
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
