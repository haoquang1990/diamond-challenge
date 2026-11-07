/**
 * Append-only local event log: types, the `EventStore` interface and the
 * storage-boundary validation shared by every implementation.
 *
 * Derived values (XP, streak, milestones) are never stored; they are
 * recomputed from the log. "Undo" is a compensating event appended later
 * (convention: put the compensated event's id in `payload.compensates`),
 * never an edit or a delete.
 */

/** `userId` of a pulled household event whose author account no longer exists (story 023). */
export const FORMER_MEMBER_ID = 'former-member';

/** Current event schema version written to every new event. */
export const EVENT_SCHEMA_VERSION = 1;

/**
 * Every event type the log accepts.
 *
 * Payload conventions (owned by the features that append them):
 * - `activity_logged`: `{ activityType, xp, personId?: string, taskId?: string }`. `personId` is the
 *   optional person (see `src/domain/people.ts`) the activity was done with; `taskId` marks the
 *   completion of a person task (activityType equals taskId then).
 * - `person_added`: `{ personId, name, note?, phone?: { country, number }, amwayCode? }`
 * - `person_updated`: `{ personId, name?, note?, phone?: { country, number }, amwayCode? }` (latest wins;
 *   an empty `number` clears the phone, an empty `amwayCode` clears the code; `amwayCode` is the
 *   normalized digits, an invalid one is ignored when deriving; never carries xp)
 * - `person_archived`: `{ personId }`
 * - `person_restored`: `{ personId }` (archived state = latest of archived / restored)
 * - `person_stage_changed`: `{ personId, from, to, xp }` (xp feeds computeProgress)
 * - `activity_reassigned`: `{ activityId, personId }` (carries no xp)
 * - `person_merged`, `person_not_duplicate`: household-book events (payloads owned by story 026)
 * - `person_transferred_out`: written by the server only (pulled, never sent; story 023)
 */
export const EVENT_TYPES = [
  'activity_logged',
  'lesson_completed',
  'settings_changed',
  'person_added',
  'person_updated',
  'person_archived',
  'person_restored',
  'person_stage_changed',
  'activity_reassigned',
  'person_merged',
  'person_not_duplicate',
  'person_transferred_out',
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
  /**
   * Bulk import (story 011): inserts events verbatim (id, timestamp, userId, schemaVersion,
   * payload, syncedAt kept) only when no event with that id exists; duplicates (also inside
   * `events`) are skipped. Never overwrites or deletes. Equal timestamps list in the given order.
   */
  importEvents(events: readonly LogEvent[]): Promise<{ added: number; skipped: number }>;
}

/**
 * Sync bookkeeping kept next to the event log (story 023). Implemented by every real store.
 *
 * @example
 * await store.markSynced(['id-1', 'id-2'], new Date().toISOString());
 * await store.writeSyncCursor(householdId, 1234);
 */
export interface SyncStateStore {
  /**
   * Sets `syncedAt` on the events with these ids whose `syncedAt` is still null (the only
   * field ever changed after storage). Returns how many were marked.
   */
  markSynced(ids: readonly string[], syncedAt: string): Promise<number>;
  /** Highest `sync_seq` pulled for this household, or null before the first pull. */
  readSyncCursor(householdId: string): Promise<number | null>;
  /** Persists the pull cursor of this household. */
  writeSyncCursor(householdId: string, seq: number): Promise<void>;
  /** Replaces the persisted account ids of this household's members (last successful fetch). */
  writeMemberIds(householdId: string, ids: readonly string[]): Promise<void>;
  /** Union of the persisted member ids of every household this device has synced with. */
  readMemberIds(): Promise<ReadonlySet<string>>;
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
