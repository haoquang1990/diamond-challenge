/**
 * Household contact-book sync (story 023; design/gdd/crm.md rules 16-18, 25; ADR-0002).
 *
 * Danh bạ events go up to Supabase `contact_events` (insert, on conflict on `id` do nothing)
 * and the household's events come back by the server-assigned `sync_seq`. The decisions
 * (which events go up, row mapping, pulled-row parsing, the pull bound, the household clock)
 * are pure functions; the network part takes an injected Supabase client.
 *
 * Personal events (lessons, activities without a person, settings, achievement acks) never
 * leave the device. Only the publishable key is ever used; nothing here logs a token.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { EVENT_TYPES, FORMER_MEMBER_ID } from './event-store';
import type { EventPayload, EventStore, EventType, LogEvent, SyncStateStore } from './event-store';

/** Event types that belong to the household book (`person_transferred_out` is server-only and never sent). */
export const CONTACT_EVENT_TYPES: readonly EventType[] = [
  'person_added',
  'person_updated',
  'person_archived',
  'person_restored',
  'person_stage_changed',
  'activity_logged',
  'activity_reassigned',
  'person_merged',
  'person_not_duplicate',
];

/** `userId` given to a pulled event whose author account no longer exists (`author_id` null). */
export { FORMER_MEMBER_ID };

/** Tunable sync values (`game-config.json` `contactSync`). */
export interface ContactSyncConfig {
  /** Events per insert request. */
  readonly pushBatchSize: number;
  /** How far below the stored cursor the first pull page starts (late-committed rows). */
  readonly pullOverlap: number;
  /** Rows per pull request; a shorter page ends the pull. */
  readonly pullPageSize: number;
  /** Delay before syncing after a local Danh bạ append. */
  readonly debounceMs: number;
  /** A household timestamp further than this ahead of the device clock is ignored by the household clock. */
  readonly maxClockSkewMs: number;
}

/** Server-side consent state as the app knows it: `unknown` until `has_contact_consent()` answered. */
export type ContactConsent = 'unknown' | 'granted' | 'missing';

/** One `contact_events` row as the app inserts it (`sync_seq` and `created_at` are server-assigned). */
export interface ContactRow {
  readonly id: string;
  readonly household_id: string;
  readonly author_id: string;
  readonly type: EventType;
  readonly occurred_at: string;
  readonly schema_version: number;
  readonly payload: EventPayload;
}

/**
 * True when `event` belongs to the household book: one of {@link CONTACT_EVENT_TYPES}, where an
 * `activity_logged` counts only with a `personId`, or when it compensates an event that is itself
 * a Danh bạ event (followed through chains of compensations; an unknown target is personal).
 *
 * @example
 * isContactEvent({ type: 'activity_logged', payload: { personId: 'p1', xp: 5 } }, new Map()); // true
 */
export function isContactEvent(event: Pick<LogEvent, 'type' | 'payload'>, byId: ReadonlyMap<string, LogEvent>): boolean {
  const seen = new Set<string>();
  let current: Pick<LogEvent, 'type' | 'payload'> | undefined = event;
  while (current !== undefined) {
    if (!CONTACT_EVENT_TYPES.includes(current.type)) return false;
    if (current.type !== 'activity_logged' || typeof current.payload.personId === 'string') return true;
    const target = current.payload.compensates;
    if (typeof target !== 'string' || seen.has(target)) return false;
    seen.add(target);
    current = byId.get(target);
  }
  return false;
}

/**
 * Danh bạ events not yet accepted by the server (`syncedAt` null), in log order.
 *
 * @example
 * const rows = selectEventsToPush(await store.list()).map((e) => toContactRow(e, householdId, accountId));
 */
export function selectEventsToPush(events: readonly LogEvent[]): LogEvent[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return events.filter((e) => e.syncedAt === null && isContactEvent(e, byId));
}

/** Maps a local event to the row inserted into `contact_events`; the author is the account. */
export function toContactRow(event: LogEvent, householdId: string, accountId: string): ContactRow {
  return {
    id: event.id,
    household_id: householdId,
    author_id: accountId,
    type: event.type,
    occurred_at: event.timestamp,
    schema_version: event.schemaVersion,
    payload: event.payload,
  };
}

/**
 * Parses one pulled row at the network boundary. Returns null when `sync_seq` is unreadable;
 * `event` is null (after a `console.warn`) when the rest of the row is unusable, so the cursor
 * still moves past it. The event gets `userId` = `author_id` (or {@link FORMER_MEMBER_ID}),
 * `timestamp` = `occurred_at` in `toISOString()` form and `syncedAt` = `syncedAt`.
 *
 * @example
 * const parsed = parseContactRow(row, new Date().toISOString());
 */
export function parseContactRow(raw: unknown, syncedAt: string): { readonly seq: number; readonly event: LogEvent | null } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const seq = typeof r.sync_seq === 'number' ? r.sync_seq : typeof r.sync_seq === 'string' ? Number(r.sync_seq) : Number.NaN;
  if (!Number.isSafeInteger(seq)) return null;
  const time = typeof r.occurred_at === 'string' ? Date.parse(r.occurred_at) : Number.NaN;
  const valid =
    typeof r.id === 'string' &&
    typeof r.type === 'string' &&
    (EVENT_TYPES as readonly string[]).includes(r.type) &&
    !Number.isNaN(time) &&
    Number.isInteger(r.schema_version) &&
    typeof r.payload === 'object' &&
    r.payload !== null &&
    !Array.isArray(r.payload) &&
    (r.author_id === null || typeof r.author_id === 'string');
  if (!valid) {
    console.warn(`[contact-sync] skipping unreadable row ${String(r.id)}`);
    return { seq, event: null };
  }
  return {
    seq,
    event: {
      id: r.id as string,
      type: r.type as EventType,
      timestamp: new Date(time).toISOString(),
      userId: (r.author_id as string | null) ?? FORMER_MEMBER_ID,
      schemaVersion: r.schema_version as number,
      payload: r.payload as EventPayload,
      syncedAt,
    },
  };
}

/** Exclusive lower `sync_seq` bound of the first pull page: the cursor minus the overlap, never below 0. */
export function pullLowerBound(cursor: number | null, overlap: number): number {
  return Math.max(0, (cursor ?? 0) - overlap);
}

/**
 * Timestamp for a NEW Danh bạ event. Once the device holds household events (any event with a
 * `syncedAt`), it is `max(now, latest Danh bạ timestamp + 1 ms)`, so "the later edit wins"
 * suffers less from a slow device clock; before that it is `now`. When the latest timestamp
 * lies more than `maxClockSkewMs` after `now`, the other device's clock is treated as wrong
 * and `now` is used.
 *
 * @example
 * householdTimestamp(events, new Date(), 600_000); // '2026-11-07T10:00:00.001Z'
 */
export function householdTimestamp(events: readonly LogEvent[], now: Date, maxClockSkewMs: number): string {
  if (!events.some((e) => e.syncedAt !== null)) return now.toISOString();
  const byId = new Map(events.map((e) => [e.id, e]));
  let latest = Number.NEGATIVE_INFINITY;
  for (const e of events) if (isContactEvent(e, byId)) latest = Math.max(latest, Date.parse(e.timestamp));
  if (latest > now.getTime() + maxClockSkewMs) return now.toISOString();
  return new Date(Math.max(now.getTime(), latest + 1)).toISOString();
}

/**
 * Wraps `store` so a new Danh bạ event appended without an explicit timestamp gets
 * {@link householdTimestamp}. Everything else delegates unchanged.
 *
 * @example
 * const screens = withHouseholdClock(rawStore, () => new Date(), 600_000);
 */
export function withHouseholdClock(store: EventStore, now: () => Date, maxClockSkewMs: number): EventStore {
  return {
    getUserId: () => store.getUserId(),
    list: (range) => store.list(range),
    importEvents: (events) => store.importEvents(events),
    async append(event) {
      if (event.timestamp !== undefined) return store.append(event);
      const events = await store.list();
      if (!isContactEvent(event, new Map(events.map((e) => [e.id, e])))) return store.append(event);
      return store.append({ ...event, timestamp: householdTimestamp(events, now(), maxClockSkewMs) });
    },
  };
}

/**
 * True when the latest personal `settings_changed { contactSync: { enabled } }` on this device
 * says `false` (the user answered "Không đồng ý").
 */
export function readContactSyncDeclined(events: readonly LogEvent[]): boolean {
  let declined = false;
  for (const e of events) {
    if (e.type !== 'settings_changed') continue;
    const setting = e.payload.contactSync;
    if (typeof setting === 'object' && setting !== null && typeof (setting as { enabled?: unknown }).enabled === 'boolean') {
      declined = !(setting as { enabled: boolean }).enabled;
    }
  }
  return declined;
}

/** Why a sync step failed. `denied` and `no-household` stop automatic syncing. */
export type SyncFailure = 'network' | 'denied' | 'no-household' | 'server';

/** Outcome of {@link syncContacts}. */
export type SyncResult =
  | { readonly ok: true; readonly householdId: string; readonly pushed: number; readonly pulled: number; readonly at: string }
  | { readonly ok: false; readonly reason: SyncFailure };

/** A household member as the history shows them. */
export interface HouseholdMember {
  readonly displayName: string | null;
  readonly phone: string | null;
}

/** Injected dependencies of {@link syncContacts} and {@link createContactSyncController}. */
export interface ContactSyncDeps {
  readonly client: SupabaseClient;
  readonly store: EventStore & SyncStateStore;
  /** Signed-in account id (`auth.uid()`), sent as `author_id`. */
  readonly accountId: string;
  readonly config: ContactSyncConfig;
  readonly now: () => Date;
}

/** Maps a PostgREST response (status 0 = the request never reached the server) to a failure. */
export function classifySyncFailure(error: { readonly code?: string }, status: number): SyncFailure {
  if (status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 'network';
  if (status === 401 || status === 403 || error.code === '42501') return 'denied';
  return 'server';
}

/** `has_contact_consent()`. */
export async function readContactConsent(client: SupabaseClient): Promise<{ readonly ok: true; readonly consented: boolean } | { readonly ok: false; readonly reason: SyncFailure }> {
  const { data, error, status } = await client.rpc('has_contact_consent');
  if (error !== null) return { ok: false, reason: classifySyncFailure(error, status) };
  return typeof data === 'boolean' ? { ok: true, consented: data } : { ok: false, reason: 'server' };
}

/** `record_contact_consent(p_version)`. */
export async function recordContactConsent(client: SupabaseClient, version: number): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: SyncFailure }> {
  const { error, status } = await client.rpc('record_contact_consent', { p_version: version });
  return error === null ? { ok: true } : { ok: false, reason: classifySyncFailure(error, status) };
}

/** Readable `profiles` rows (own household), or null when the request failed. */
export async function fetchHouseholdMembers(client: SupabaseClient): Promise<ReadonlyMap<string, HouseholdMember> | null> {
  const { data, error } = await client.from('profiles').select('id, phone, display_name');
  if (error !== null || !Array.isArray(data)) return null;
  const members = new Map<string, HouseholdMember>();
  for (const row of data as Record<string, unknown>[]) {
    if (typeof row.id !== 'string') continue;
    const name = typeof row.display_name === 'string' && row.display_name.trim() !== '' ? row.display_name : null;
    members.set(row.id, { displayName: name, phone: typeof row.phone === 'string' && row.phone !== '' ? row.phone : null });
  }
  return members;
}

/**
 * One full sync: find the caller's household, push every unsynced Danh bạ event in batches
 * (setting `syncedAt` only after the server accepted the batch), then pull the household's
 * events page by page from `cursor - overlap` (stored with `importEvents`, which skips known
 * ids) and persist the highest `sync_seq` seen. A failed request stops the run; whatever was
 * not accepted stays unsynced and goes up next time.
 *
 * @example
 * const result = await syncContacts({ client, store, accountId, config: gameConfig.contactSync, now: () => new Date() });
 */
export async function syncContacts({ client, store, accountId, config, now }: ContactSyncDeps): Promise<SyncResult> {
  const member = await client.from('household_members').select('household_id').eq('user_id', accountId).is('left_at', null).maybeSingle();
  if (member.error !== null) return { ok: false, reason: classifySyncFailure(member.error, member.status) };
  const householdId = (member.data as { household_id?: unknown } | null)?.household_id;
  if (typeof householdId !== 'string') return { ok: false, reason: 'no-household' };

  const toPush = selectEventsToPush(await store.list());
  let pushed = 0;
  for (let i = 0; i < toPush.length; i += config.pushBatchSize) {
    const batch = toPush.slice(i, i + config.pushBatchSize);
    const rows = batch.map((e) => toContactRow(e, householdId, accountId));
    const { error, status } = await client.from('contact_events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error !== null) return { ok: false, reason: classifySyncFailure(error, status) };
    await store.markSynced(
      batch.map((e) => e.id),
      now().toISOString(),
    );
    pushed += batch.length;
  }

  const cursor = await store.readSyncCursor(householdId);
  let highest = cursor ?? 0;
  let bound = pullLowerBound(cursor, config.pullOverlap);
  let pulled = 0;
  for (;;) {
    const { data, error, status } = await client
      .from('contact_events')
      .select('*')
      .eq('household_id', householdId)
      .gt('sync_seq', bound)
      .order('sync_seq', { ascending: true })
      .limit(config.pullPageSize);
    if (error !== null) return { ok: false, reason: classifySyncFailure(error, status) };
    const rows: unknown[] = Array.isArray(data) ? data : [];
    const at = now().toISOString();
    const parsed = rows.map((r) => parseContactRow(r, at)).filter((p) => p !== null);
    pulled += (await store.importEvents(parsed.flatMap((p) => (p.event === null ? [] : [p.event])))).added;
    const pageMax = parsed.reduce((max, p) => Math.max(max, p.seq), bound);
    if (pageMax > highest) {
      highest = pageMax;
      await store.writeSyncCursor(householdId, highest);
    }
    if (rows.length < config.pullPageSize || pageMax <= bound) break;
    bound = pageMax;
  }
  return { ok: true, householdId, pushed, pulled, at: now().toISOString() };
}

/** What the Settings card shows about the running sync. */
export type SyncStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'synced'; readonly at: string; readonly pulled: number }
  | { readonly kind: 'failed'; readonly reason: SyncFailure };

/** Runs {@link syncContacts} for one signed-in, consented account. Not thread-safe; main thread only. */
export interface ContactSyncController {
  status(): SyncStatus;
  /** Household members after the last successful sync (their ids are also persisted with `writeMemberIds`), or null before. */
  members(): ReadonlyMap<string, HouseholdMember> | null;
  /**
   * Syncs now (one run at a time; calls during a run queue one more). An automatic call
   * (`manual` false) does nothing after a `denied` / `no-household` failure; a manual one retries.
   */
  sync(manual: boolean): Promise<void>;
  /** Automatic sync after `config.debounceMs` (restarted by every call). */
  schedule(): void;
  /** Called after every status change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Cancels the pending timer and ignores every later call. */
  dispose(): void;
}

/**
 * Creates the sync controller of one account.
 *
 * @example
 * const sync = createContactSyncController({ client, store, accountId, config, now: () => new Date() });
 * sync.subscribe(() => render(sync.status()));
 * void sync.sync(false);
 */
export function createContactSyncController(deps: ContactSyncDeps): ContactSyncController {
  let status: SyncStatus = { kind: 'idle' };
  let members: ReadonlyMap<string, HouseholdMember> | null = null;
  let running = false;
  let again = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const setStatus = (next: SyncStatus) => {
    status = next;
    for (const listener of [...listeners]) listener();
  };
  const stopped = () => status.kind === 'failed' && (status.reason === 'denied' || status.reason === 'no-household');

  const sync = async (manual: boolean): Promise<void> => {
    if (disposed || (!manual && stopped())) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        setStatus({ kind: 'syncing' });
        let result: SyncResult;
        try {
          result = await syncContacts(deps);
          if (result.ok) {
            const fetched = await fetchHouseholdMembers(deps.client);
            if (fetched !== null) {
              members = fetched;
              await deps.store.writeMemberIds(result.householdId, [...fetched.keys()]);
            }
          }
        } catch (error) {
          console.error('[contact-sync] sync failed', error);
          result = { ok: false, reason: typeof navigator !== 'undefined' && navigator.onLine === false ? 'network' : 'server' };
        }
        if (disposed) return;
        setStatus(result.ok ? { kind: 'synced', at: result.at, pulled: result.pulled } : { kind: 'failed', reason: result.reason });
      } while (again && !stopped());
    } finally {
      running = false;
    }
  };

  return {
    status: () => status,
    members: () => members,
    sync,
    schedule() {
      if (disposed || stopped()) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void sync(false);
      }, deps.config.debounceMs);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
      listeners.clear();
    },
  };
}
