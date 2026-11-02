import { useCallback, useState } from 'react';
import type { EventStore } from './data/event-store';
import { LogActivityScreen } from './ui/screens/log-activity-screen';

/** Props for {@link App}. */
export interface AppProps {
  /** Event log shared by every screen. */
  readonly eventStore: EventStore;
}

/**
 * Root component. Until story 004 adds Hôm nay and navigation, it shows the
 * Làm screen and resets it to a fresh form when the flow finishes.
 */
export function App({ eventStore }: AppProps) {
  const [round, setRound] = useState(0);
  const handleDone = useCallback(() => setRound((r) => r + 1), []);
  return <LogActivityScreen key={round} eventStore={eventStore} onDone={handleDone} />;
}
