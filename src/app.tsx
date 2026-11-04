import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EventStore } from './data/event-store';
import { browserNotificationPlatform, createReminderScheduler } from './notifications/reminders';
import type { NotificationPlatform } from './notifications/reminders';
import { Board30x30Screen } from './ui/screens/board-30x30-screen';
import { DiamondPathScreen } from './ui/screens/diamond-path-screen';
import { LessonScreen } from './ui/screens/lesson-screen';
import { PeopleScreen } from './ui/screens/people-screen';
import { LogActivityScreen } from './ui/screens/log-activity-screen';
import { SettingsScreen } from './ui/screens/settings-screen';
import { TodayScreen } from './ui/screens/today-screen';
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

/** Top-level destinations; `settings` (Cài đặt nhắc nhở) is opened from Hôm nay, not from the tab bar. */
type Tab = 'today' | 'learn' | 'do' | 'path' | 'people' | 'settings' | 'board';

const TABS: readonly { readonly id: Exclude<Tab, 'settings' | 'board'>; readonly label: string }[] = [
  { id: 'today', label: STRINGS.tabToday },
  { id: 'learn', label: STRINGS.tabLearn },
  { id: 'do', label: STRINGS.tabDo },
  { id: 'path', label: STRINGS.tabPath },
  { id: 'people', label: STRINGS.tabPeople },
];

/**
 * Root component with state-based routing (no router library). Opens on
 * Hôm nay. Switching tabs unmounts the previous screen, so Hôm nay re-reads
 * the event log every time it is shown.
 *
 * Làm is a focused flow: it hides the tab bar and returns to Hôm nay via its
 * back button (`onCancel`) or after a save (`onDone`). Cài đặt nhắc nhở
 * behaves the same way (no tab bar, "Quay lại" to Hôm nay).
 *
 * Reminders (story 007): one scheduler is refreshed on app start, when the
 * app becomes visible, whenever Hôm nay is shown (i.e. after any Học/Làm
 * save) and after a settings change. A tapped reminder notification brings
 * the app to Hôm nay.
 */
export function App({ eventStore, notificationPlatform = DEFAULT_PLATFORM }: AppProps) {
  const [tab, setTab] = useState<Tab>('today');
  const [lessonActive, setLessonActive] = useState(false);
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

  // App start and every time Hôm nay is shown (covers returning after a Học/Làm save).
  useEffect(() => {
    if (tab === 'today') refreshReminders();
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

  if (tab === 'do') {
    return <LogActivityScreen eventStore={eventStore} onDone={goToday} onCancel={goToday} />;
  }

  if (tab === 'board') {
    return (
      <div className="app-shell">
        <Board30x30Screen eventStore={eventStore} onBack={() => setTab('path')} onOpenPeople={() => setTab('people')} />
      </div>
    );
  }

  if (tab === 'settings') {
    return (
      <div className="app-shell">
        <SettingsScreen eventStore={eventStore} onBack={goToday} onSaved={refreshReminders} platform={notificationPlatform} />
      </div>
    );
  }

  return (
    <div className={tab === 'learn' && lessonActive ? 'app-shell' : 'app-shell app-shell--tabs'}>
      {tab === 'today' && (
        <TodayScreen
          eventStore={eventStore}
          onLearn={() => setTab('learn')}
          onDo={() => setTab('do')}
          onOpenSettings={() => setTab('settings')}
          notificationPermission={notificationPlatform.permission}
        />
      )}
      {tab === 'learn' && <LessonScreen eventStore={eventStore} onDone={goToday} onActiveChange={onLessonActive} />}
      {tab === 'path' && <DiamondPathScreen eventStore={eventStore} onOpenBoard={() => setTab('board')} />}
      {tab === 'people' && <PeopleScreen eventStore={eventStore} />}
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
