import { useCallback, useState } from 'react';
import type { EventStore } from './data/event-store';
import { ComingSoonScreen } from './ui/screens/coming-soon-screen';
import { LessonScreen } from './ui/screens/lesson-screen';
import { LogActivityScreen } from './ui/screens/log-activity-screen';
import { TodayScreen } from './ui/screens/today-screen';
import { STRINGS } from './ui/strings';

/** Props for {@link App}. */
export interface AppProps {
  /** Event log shared by every screen. */
  readonly eventStore: EventStore;
}

/** Top-level destinations. */
type Tab = 'today' | 'learn' | 'do' | 'path';

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: 'today', label: STRINGS.tabToday },
  { id: 'learn', label: STRINGS.tabLearn },
  { id: 'do', label: STRINGS.tabDo },
  { id: 'path', label: STRINGS.tabPath },
];

/**
 * Root component with state-based routing (no router library). Opens on
 * Hôm nay. Switching tabs unmounts the previous screen, so Hôm nay re-reads
 * the event log every time it is shown.
 *
 * Làm is a focused flow: it hides the tab bar and returns to Hôm nay via its
 * back button (`onCancel`) or after a save (`onDone`).
 */
export function App({ eventStore }: AppProps) {
  const [tab, setTab] = useState<Tab>('today');
  const [lessonActive, setLessonActive] = useState(false);
  const goToday = () => setTab('today');
  const onLessonActive = useCallback((active: boolean) => setLessonActive(active), []);

  if (tab === 'do') {
    return <LogActivityScreen eventStore={eventStore} onDone={goToday} onCancel={goToday} />;
  }

  return (
    <div className={tab === 'learn' && lessonActive ? 'app-shell' : 'app-shell app-shell--tabs'}>
      {tab === 'today' && <TodayScreen eventStore={eventStore} onLearn={() => setTab('learn')} onDo={() => setTab('do')} />}
      {tab === 'learn' && <LessonScreen eventStore={eventStore} onDone={goToday} onActiveChange={onLessonActive} />}
      {tab === 'path' && <ComingSoonScreen title={STRINGS.tabPath} />}
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
