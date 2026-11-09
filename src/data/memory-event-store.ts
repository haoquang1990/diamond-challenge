import { createEvent, isInRange, parseStoredEvent } from './event-store';
import type { EventRange, EventStore, LogEvent, NewEvent, SyncStateStore } from './event-store';

/**
 * In-memory `EventStore` for tests. Nothing survives the instance.
 *
 * @example
 * const store = new MemoryEventStore('test-user');
 * await store.append({ type: 'settings_changed', payload: { dailyGoal: 30 } });
 */
export class MemoryEventStore implements EventStore, SyncStateStore {
  private readonly events: unknown[] = [];
  private readonly cursors = new Map<string, number>();
  private readonly memberIds = new Map<string, readonly string[]>();

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

  /** @inheritdoc */
  importEvents(events: readonly LogEvent[]): Promise<{ added: number; skipped: number }> {
    const known = new Set<string>();
    for (const raw of this.events) {
      const id = (raw as { id?: unknown } | null)?.id;
      if (typeof id === 'string') known.add(id);
    }
    let added = 0;
    let skipped = 0;
    for (const event of events) {
      if (known.has(event.id)) {
        skipped += 1;
        continue;
      }
      known.add(event.id);
      this.events.push(event);
      added += 1;
    }
    return Promise.resolve({ added, skipped });
  }

  /** @inheritdoc */
  markSynced(ids: readonly string[], syncedAt: string): Promise<number> {
    const wanted = new Set(ids);
    let marked = 0;
    this.events.forEach((raw, index) => {
      const value = raw as { id?: unknown; syncedAt?: unknown } | null;
      if (value !== null && typeof value.id === 'string' && wanted.has(value.id) && value.syncedAt === null) {
        this.events[index] = { ...value, syncedAt };
        marked += 1;
      }
    });
    return Promise.resolve(marked);
  }

  /** @inheritdoc */
  readSyncCursor(householdId: string): Promise<number | null> {
    return Promise.resolve(this.cursors.get(householdId) ?? null);
  }

  /** @inheritdoc */
  writeSyncCursor(householdId: string, seq: number): Promise<void> {
    this.cursors.set(householdId, seq);
    return Promise.resolve();
  }

  /** @inheritdoc */
  writeMemberIds(householdId: string, ids: readonly string[]): Promise<void> {
    this.memberIds.set(householdId, [...ids]);
    return Promise.resolve();
  }

  /** @inheritdoc */
  readMemberIds(): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set([...this.memberIds.values()].flat()));
  }
}
