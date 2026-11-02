import { createEvent, isInRange, parseStoredEvent } from './event-store';
import type { EventRange, EventStore, LogEvent, NewEvent } from './event-store';

/**
 * In-memory `EventStore` for tests. Nothing survives the instance.
 *
 * @example
 * const store = new MemoryEventStore('test-user');
 * await store.append({ type: 'settings_changed', payload: { dailyGoal: 30 } });
 */
export class MemoryEventStore implements EventStore {
  private readonly events: unknown[] = [];

  /** @param userId Local user id; a random UUID when omitted. */
  constructor(private readonly userId: string = crypto.randomUUID()) {}

  /** @inheritdoc */
  getUserId(): Promise<string> {
    return Promise.resolve(this.userId);
  }

  /** @inheritdoc */
  append(event: NewEvent): Promise<LogEvent> {
    const stored = createEvent(event, this.userId);
    this.events.push(stored);
    return Promise.resolve(stored);
  }

  /** @inheritdoc */
  list(range: EventRange = {}): Promise<LogEvent[]> {
    const result = this.events
      .map((raw) => parseStoredEvent(raw))
      .filter((e): e is LogEvent => e !== null && isInRange(e.timestamp, range));
    // Array.prototype.sort is stable, so equal timestamps keep insertion order.
    result.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
    return Promise.resolve(result);
  }
}
