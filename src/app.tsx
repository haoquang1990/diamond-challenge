import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventStore } from './data/event-store';
import { browserNotificationPlatform, createReminderScheduler } from './notifications/reminders';
import type { NotificationPlatform } from './notifications/reminders';
import { AchievementsOverlay, ACHIEVEMENTS_CONFIG } from './ui/achievements-overlay';
import { createObservedStore, readSoundEnabled } from './ui/achievements-helpers';
import { setSoundEnabled } from './ui/play-ting';
import { AchievementsScreen } from './ui/screens/achievements-screen';
import { Board30x30Screen } from './ui/screens/board-30x30-screen';
import { DiamondPathScreen } from './ui/screens/diamond-path-screen';
import { LessonScreen } from './ui/screens/lesson-screen';
import { PeopleScreen } from './ui/screens/people-screen';
import { SettingsScreen } from './ui/screens/settings-screen';
import { TodayScreen } from './ui/screens/today-screen';
import type { ContactsFilter } from './ui/people-helpers';
import { STRINGS } from './ui/strings';

/** Props for {@link App}. */
export interface AppProps {
  /** Event log shared by every screen. */
  readonly eventStore: EventStore;
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
type Tab = 'today' | 'learn' | 'people' | 'path' | 'settings' | 'board' | 'achievements';

const TABS: readonly { readonly id: Exclude<Tab, 'settings' | 'board' | 'achievements'>; readonly label: string }[] = [
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
 */
export function App({ eventStore: rawEventStore, notificationPlatform = DEFAULT_PLATFORM }: AppProps) {
  // Every screen gets the observed store, so each saved event reaches the achievements overlay.
  const observed = useMemo(() => createObservedStore(rawEventStore), [rawEventStore]);
  const eventStore = observed.store;
  const [popupOpen, setPopupOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [lessonActive, setLessonActive] = useState(false);
  /** Set when Làm was opened from Bảng 30x30 (preselected filter + back control); null otherwise. */
  const [fromBoard, setFromBoard] = useState<ContactsFilter | null>(null);
  const goToday = () => setTab('today');
  const onLessonActive = useCallback((active: boolean) => setLessonActive(active), []);

  const scheduler = useMemo(
    () =>
      createReminderScheduler({
        eventStore,
        platform: notificationPlatform,
        now: realNow,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  }, [refreshSound]);

  const screen = renderScreen();
  return (
    <>
      <div className="app-inert" inert={popupOpen}>
        {screen}
      </div>
      <AchievementsOverlay observed={observed} rawStore={rawEventStore} tab={tab} onPopupOpenChange={setPopupOpen} silentAcknowledgeRef={silentAcknowledgeRef} />
    </>
  );

  function renderScreen() {
  if (tab === 'board') {
    return (
      <div className="app-shell">
        <Board30x30Screen eventStore={eventStore} onBack={() => setTab('path')}
          onOpenPeople={() => setTab('people')}
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
        <AchievementsScreen eventStore={eventStore} onBack={() => setTab('path')} />
      </div>
    );
  }

  if (tab === 'settings') {
    return (
      <div className="app-shell">
        <SettingsScreen eventStore={eventStore} onBack={goToday} onSaved={refreshReminders} onImported={onImported} platform={notificationPlatform} />
      </div>
    );
  }

  return (
    <div className={tab === 'learn' && lessonActive ? 'app-shell' : 'app-shell app-shell--tabs'}>
      {tab === 'today' && (
        <TodayScreen
          eventStore={eventStore}
          onLearn={() => setTab('learn')}
          onDo={() => {
            setFromBoard(null);
            setTab('people');
          }}
          onOpenSettings={() => setTab('settings')}
          notificationPermission={notificationPlatform.permission}
        />
      )}
      {tab === 'learn' && <LessonScreen eventStore={eventStore} onDone={goToday} onActiveChange={onLessonActive} />}
      {tab === 'path' && <DiamondPathScreen eventStore={eventStore} onOpenBoard={() => setTab('board')} onOpenAchievements={() => setTab('achievements')} />}
      {tab === 'people' && (
        <PeopleScreen
          key={fromBoard ?? 'tab'}
          eventStore={eventStore}
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
