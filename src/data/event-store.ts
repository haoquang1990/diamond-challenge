/**
 * Append-only local event log: types, the `EventStore` interface and the
 * storage-boundary validation shared by every implementation.
 *
 * Derived values (XP, streak, milestones) are never stored; they are
 * recomputed from the log. "Undo" is a compensating event appended later
 * (convention: put the compensated event's id in `payload.compensates`),
 * never an edit or a delete.
 */

/** Current event schema version written to every new event. */
export const EVENT_SCHEMA_VERSION = 1;

/**
 * Every event type the log accepts.
 *
 * Payload conventions (owned by the features that append them):
 * - `activity_logged`: `{ activityType, xp, personId?: string }`. `personId` is the
 *   optional person (see `src/domain/people.ts`) the activity was done with.
 * - `person_added`: `{ personId, name, note? }`
 * - `person_updated`: `{ personId, name?, note? }` (latest wins)
 * - `person_archived`: `{ personId }`
 * - `person_stage_changed`: `{ personId, from, to, xp }` (xp feeds computeProgress)
 * - `activity_reassigned`: `{ activityId, personId }` (carries no xp)
 */
export const EVENT_TYPES = [
  'activity_logged',
  'lesson_completed',
  'settings_changed',
  'person_added',
  'person_updated',
  'person_archived',
  'person_stage_changed',
  'activity_reassigned',
] as const;

/** Discriminator for an event. */
export type EventType = (typeof EVENT_TYPES)[number];

/** Free-form event payload; its shape is owned by the feature that appends the event. */
export type EventPayload = Readonly<Record<string, unknown>>;

/** A persisted event. Immutable once stored. */
export interface LogEvent {
  /** UUID (crypto.randomUUID). */
  readonly id: string;
  readonly type: EventType;
  /** ISO-8601 UTC instant, always in `Date.prototype.toISOString()` form. */
  readonly timestamp: string;
  /** Stable local user id, generated once per device. */
  readonly userId: string;
  readonly schemaVersion: number;
  readonly payload: EventPayload;
  /** ISO UTC instant of the last successful sync, or null while unsynced (phase 2). */
  readonly syncedAt: string | null;
}

/** What a caller supplies; the store fills id, userId, schemaVersion and syncedAt. */
export interface NewEvent {
  readonly type: EventType;
  readonly payload: EventPayload;
  /** ISO UTC instant; defaults to now. */
  readonly timestamp?: string;
}

/** Inclusive timestamp range; an omitted bound is open. */
export interface EventRange {
  readonly from?: string;
  readonly to?: string;
}

/**
 * Append-only event storage. Implementations are async and safe to call
 * from the main thread only.
 *
 * @example
 * const store: EventStore = new IndexedDbEventStore('diamond-challenge');
 * const saved = await store.append({ type: 'activity_logged', payload: { minutes: 20 } });
 * const today = await store.list({ from: startOfDayIso, to: endOfDayIso });
 */
export interface EventStore {
  /** Stable local user id (same value on every call and every app launch). */
  getUserId(): Promise<string>;
  /** Appends one event and returns it as stored. Never overwrites. */
  append(event: NewEvent): Promise<LogEvent>;
  /** Returns events with `from <= timestamp <= to`, oldest first (ties in insertion order). */
  list(range?: EventRange): Promise<LogEvent[]>;
}

/** Builds a complete event from caller input. Shared by all implementations. */
export function createEvent(input: NewEvent, userId: string): LogEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    userId,
    schemaVersion: EVENT_SCHEMA_VERSION,
    payload: input.payload,
    syncedAt: null,
  };
}

/**
 * Validates a raw stored value. Returns the event, or null (after a
 * `console.warn`) when the schemaVersion is unknown or the record is corrupt.
 * Never throws.
 */
export function parseStoredEvent(raw: unknown): LogEvent | null {
  if (typeof raw !== 'object' || raw === null) {
    console.warn('[event-log] skipping corrupt record: not an object');
    return null;
  }
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== EVENT_SCHEMA_VERSION) {
    console.warn(`[event-log] skipping event with unknown schemaVersion: ${String(r.schemaVersion)}`);
    return null;
  }
  const valid =
    typeof r.id === 'string' &&
    typeof r.type === 'string' &&
    (EVENT_TYPES as readonly string[]).includes(r.type) &&
    typeof r.timestamp === 'string' &&
    !Number.isNaN(Date.parse(r.timestamp)) &&
    typeof r.userId === 'string' &&
    typeof r.payload === 'object' &&
    r.payload !== null &&
    (r.syncedAt === null || typeof r.syncedAt === 'string');
  if (!valid) {
    console.warn(`[event-log] skipping corrupt event: ${String(r.id)}`);
    return null;
  }
  return r as unknown as LogEvent;
}

/** True when `timestamp` lies within the inclusive range. ISO UTC strings compare chronologically. */
export function isInRange(timestamp: string, range: EventRange): boolean {
  return (range.from === undefined || timestamp >= range.from) && (range.to === undefined || timestamp <= range.to);
}
