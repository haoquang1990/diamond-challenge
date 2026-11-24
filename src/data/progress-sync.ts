/**
 * Personal progress sync (story 032; ADR-0004).
 *
 * Lessons, personal activities and achievement / stage acknowledgements go up to Supabase
 * `personal_events` (insert, on conflict on `id` do nothing) and come back by the server-assigned
 * `sync_seq`, so a new device or a cleared device gets the account's XP, streak, achievements and
 * lessons back. The decisions (which events go up, row mapping, pulled-row parsing) are pure
 * functions; the network part takes an injected Supabase client (publishable key only).
 *
 * One event belongs to exactly one stream: {@link isPersonalProgressEvent} and
 * `isContactEvent` (contact-sync.ts) never both return true. Device settings (`reminder`, `sound`,
 * `dailyGoal`, `accountLinked`, `contactSync`, ...) are pushed by neither. Nothing here creates an
 * event, so nothing here carries `xp`; nothing logs a token or password.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { classifySyncFailure, pullLowerBound } from './contact-sync';
import type { ContactSyncConfig, SyncFailure, SyncStatus } from './contact-sync';
import type { EventPayload, EventStore, EventType, LogEvent, SyncStateStore } from './event-store';

/** Event types the `personal_events` table accepts (the server also checks the payload). */
export const PERSONAL_EVENT_TYPES: readonly EventType[] = ['lesson_completed', 'activity_logged', 'settings_changed'];

/** `settings_changed` payload keys that mark an achievement / stage acknowledgement (synced); every other settings key stays on the device. */
export const PROGRESS_SETTINGS_KEYS: readonly string[] = ['achievementAcknowledged', 'stageAcknowledged', 'achievementsSeeded', 'badgesSeeded'];

/** Prefix of the pull cursor id. Household ids are UUIDs, so `progressCursor:<account id>` never equals one. */
export const PROGRESS_CURSOR_PREFIX = 'progressCursor:';

/** Id passed to `readSyncCursor` / `writeSyncCursor` for this account's progress cursor. */
export function progressCursorKey(accountId: string): string {
  return PROGRESS_CURSOR_PREFIX + accountId;
}

/** Tunable sync values; the same numbers as the contact sync (`game-config.json` `contactSync`). */
export type ProgressSyncConfig = Pick<ContactSyncConfig, 'pushBatchSize' | 'pullOverlap' | 'pullPageSize' | 'debounceMs'>;

/** One `personal_events` row as the app inserts it (`sync_seq` and `created_at` are server-assigned). */
export interface ProgressRow {
  readonly id: string;
  readonly user_id: string;
  readonly type: EventType;
  readonly occurred_at: string;
  readonly schema_version: number;
  readonly payload: EventPayload;
}

/** True when a `settings_changed` payload carries an acknowledgement key. */
function hasProgressSettingsKey(payload: EventPayload): boolean {
  return PROGRESS_SETTINGS_KEYS.some((key) => key in payload);
}

/**
 * True when `event` belongs to the personal progress stream: `lesson_completed`; an
 * `activity_logged` without a string `personId`; a `settings_changed` carrying
 * `achievementAcknowledged`, `stageAcknowledged` or `achievementsSeeded`; or a compensation
 * (`payload.compensates`) of such an event, followed through chains. A compensation whose target
 * is unknown or that loops is NOT progress (it is not pushed). Every Danh bạ event and every
 * device setting is false.
 *
 * @example
 * isPersonalProgressEvent({ type: 'lesson_completed', payload: { xp: 10 } }, new Map()); // true
 */
export function isPersonalProgressEvent(event: Pick<LogEvent, 'type' | 'payload'>, byId: ReadonlyMap<string, LogEvent>): boolean {
  const seen = new Set<string>();
  let current: Pick<LogEvent, 'type' | 'payload'> | undefined = event;
  while (current !== undefined) {
    if (current.type === 'lesson_completed') return true;
    if (current.type === 'settings_changed') return hasProgressSettingsKey(current.payload);
    if (current.type !== 'activity_logged' || typeof current.payload.personId === 'string') return false;
    const target = current.payload.compensates;
    if (target === undefined) return true;
    if (typeof target !== 'string' || seen.has(target)) return false;
    seen.add(target);
    current = byId.get(target);
  }
  return false;
}

/**
 * Progress events not yet accepted by the server (`syncedAt` null), in log order. Includes data
 * copied from an old shared store (story 030): it is simply unsynced.
 *
 * @example
 * const rows = selectProgressToPush(await store.list()).map((e) => toProgressRow(e, accountId));
 */
export function selectProgressToPush(events: readonly LogEvent[]): LogEvent[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  return events.filter((e) => e.syncedAt === null && isPersonalProgressEvent(e, byId));
}

/** Maps a local event to the row inserted into `personal_events`; the owner is the account. */
export function toProgressRow(event: LogEvent, accountId: string): ProgressRow {
  return {
    id: event.id,
    user_id: accountId,
    type: event.type,
    occurred_at: event.timestamp,
    schema_version: event.schemaVersion,
    payload: event.payload,
  };
}

/**
 * Parses one pulled row at the network boundary. Returns null when `sync_seq` is unreadable;
 * `event` is null (after a `console.warn`) when the rest of the row is unusable or is not a
 * progress shape, so the cursor still moves past it. The event gets `userId` = `accountId` (every
 * row is the user's own), `timestamp` in `toISOString()` form and `syncedAt` = `syncedAt`, so it
 * is never pushed back.
 *
 * @example
 * const parsed = parseProgressRow(row, accountId, new Date().toISOString());
 */
export function parseProgressRow(raw: unknown, accountId: string, syncedAt: string): { readonly seq: number; readonly event: LogEvent | null } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const seq = typeof r.sync_seq === 'number' ? r.sync_seq : typeof r.sync_seq === 'string' ? Number(r.sync_seq) : Number.NaN;
  if (!Number.isSafeInteger(seq)) return null;
  const time = typeof r.occurred_at === 'string' ? Date.parse(r.occurred_at) : Number.NaN;
  const payload = r.payload;
  const validShape =
    typeof r.id === 'string' &&
    typeof r.type === 'string' &&
    (PERSONAL_EVENT_TYPES as readonly string[]).includes(r.type) &&
    !Number.isNaN(time) &&
    Number.isInteger(r.schema_version) &&
    typeof payload === 'object' &&
    payload !== null &&
    !Array.isArray(payload);
  const p = payload as EventPayload;
  const valid = validShape && !(r.type === 'activity_logged' && typeof p.personId === 'string') && !(r.type === 'settings_changed' && !hasProgressSettingsKey(p));
  if (!valid) {
    console.warn(`[progress-sync] skipping unreadable row ${String(r.id)}`);
    return { seq, event: null };
  }
  return {
    seq,
    event: {
      id: r.id as string,
      type: r.type as EventType,
      timestamp: new Date(time).toISOString(),
      userId: accountId,
      schemaVersion: r.schema_version as number,
      payload: p,
      syncedAt,
    },
  };
}

/** Outcome of {@link syncProgress}. */
export type ProgressSyncResult =
  | { readonly ok: true; readonly pushed: number; readonly pulled: number; readonly at: string }
  | { readonly ok: false; readonly reason: SyncFailure };

/** Injected dependencies of {@link syncProgress} and {@link createProgressSyncController}. */
export interface ProgressSyncDeps {
  readonly client: SupabaseClient;
  readonly store: EventStore & SyncStateStore;
  /** Signed-in account id (`auth.uid()`), sent as `user_id`. An empty id means signed out. */
  readonly accountId: string;
  /** True only when the account agreed to the current consent version. False: nothing is sent or read. */
  readonly consented: boolean;
  readonly config: ProgressSyncConfig;
  readonly now: () => Date;
}

/**
 * One full progress sync: push every unsynced progress event in batches (setting `syncedAt` only
 * after the server accepted the batch), then pull the account's events page by page from
 * `cursor - overlap` (stored with `importEvents`, which skips known ids) and persist the highest
 * `sync_seq`. Without an account or consent it returns `denied` and touches nothing. A failed
 * request stops the run; what was not accepted stays unsynced and goes up next time. Nothing is
 * ever deleted locally.
 *
 * @example
 * const result = await syncProgress({ client, store, accountId, consented: true, config: gameConfig.contactSync, now: () => new Date() });
 */
export async function syncProgress({ client, store, accountId, consented, config, now }: ProgressSyncDeps): Promise<ProgressSyncResult> {
  if (accountId === '' || !consented) return { ok: false, reason: 'denied' };

  const toPush = selectProgressToPush(await store.list());
  let pushed = 0;
  for (let i = 0; i < toPush.length; i += config.pushBatchSize) {
    const batch = toPush.slice(i, i + config.pushBatchSize);
    const rows = batch.map((e) => toProgressRow(e, accountId));
    const { error, status } = await client.from('personal_events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error !== null) return { ok: false, reason: classifySyncFailure(error, status) };
    await store.markSynced(
      batch.map((e) => e.id),
      now().toISOString(),
    );
    pushed += batch.length;
  }

  const cursorKey = progressCursorKey(accountId);
  const cursor = await store.readSyncCursor(cursorKey);
  let highest = cursor ?? 0;
  let bound = pullLowerBound(cursor, config.pullOverlap);
  let pulled = 0;
  for (;;) {
    const { data, error, status } = await client
      .from('personal_events')
      .select('*')
      .eq('user_id', accountId)
      .gt('sync_seq', bound)
      .order('sync_seq', { ascending: true })
      .limit(config.pullPageSize);
    if (error !== null) return { ok: false, reason: classifySyncFailure(error, status) };
    const rows: unknown[] = Array.isArray(data) ? data : [];
    const at = now().toISOString();
    const parsed = rows.map((r) => parseProgressRow(r, accountId, at)).filter((p) => p !== null);
    pulled += (await store.importEvents(parsed.flatMap((p) => (p.event === null ? [] : [p.event])))).added;
    const pageMax = parsed.reduce((max, p) => Math.max(max, p.seq), bound);
    if (pageMax > highest) {
      highest = pageMax;
      await store.writeSyncCursor(cursorKey, highest);
    }
    if (rows.length < config.pullPageSize || pageMax <= bound) break;
    bound = pageMax;
  }
  return { ok: true, pushed, pulled, at: now().toISOString() };
}

/** Runs {@link syncProgress} for one signed-in, consented account. Main thread only. */
export interface ProgressSyncController {
  status(): SyncStatus;
  /**
   * Syncs now (one run at a time; calls during a run queue one more). An automatic call
   * (`manual` false) does nothing after a `denied` failure; a manual one retries.
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
 * Creates the progress sync controller of one account (same shape and rules as the contact one).
 *
 * @example
 * const sync = createProgressSyncController({ client, store, accountId, consented: true, config, now: () => new Date() });
 * sync.subscribe(() => render(sync.status()));
 * void sync.sync(false);
 */
export function createProgressSyncController(deps: ProgressSyncDeps): ProgressSyncController {
  let status: SyncStatus = { kind: 'idle' };
  let running = false;
  let again = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const setStatus = (next: SyncStatus) => {
    status = next;
    for (const listener of [...listeners]) listener();
  };
  const stopped = () => status.kind === 'failed' && status.reason === 'denied';

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
        let result: ProgressSyncResult;
        try {
          result = await syncProgress(deps);
        } catch (error) {
          console.error('[progress-sync] sync failed', error);
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
