/**
 * Pushes the household's 30x30 numbers to `household_aggregates` (story 027; ADR-0001).
 *
 * Only when signed in with contact consent (the caller creates the controller only then),
 * online, and the numbers changed since the last successful send. Bursts of changes are batched
 * by a debounce (`game-config.json` `aggregatesSync.debounceMs`). Offline or failed sends stay
 * pending and retry on the next `flush()` (online event) or `schedule()` (next change).
 * Never writes `needs_recount`, `updated_at` or `updated_by` (a server trigger sets them) and
 * never creates an event. Only the publishable key is used.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregatesChanged, buildAggregatePayload, parseAggregatePayload } from '../domain/household-board';
import type { AggregatePayload } from '../domain/household-board';
import type { PeopleConfig } from '../domain/people';
import type { LogEvent } from './event-store';

/** Tunable values (`game-config.json` `aggregatesSync`). */
export interface AggregatesSyncConfig {
  /** Quiet time after the last change before sending. */
  readonly debounceMs: number;
}

/** Injected dependencies of {@link createAggregatesSync}. */
export interface AggregatesSyncDeps {
  readonly client: SupabaseClient;
  /** Reads the local log (which holds the household's events once synced). */
  readonly list: () => Promise<readonly LogEvent[]>;
  /** Signed-in account id (`auth.uid()`). */
  readonly accountId: string;
  readonly peopleConfig: PeopleConfig;
  readonly config: AggregatesSyncConfig;
  /** Defaults to `localStorage`; failures are swallowed. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Defaults to `navigator.onLine`. */
  readonly isOnline?: () => boolean;
}

/** Result of one send attempt. */
export type AggregatesFlushResult = 'sent' | 'unchanged' | 'offline' | 'failed' | 'disposed';

/** Sends the household aggregate when it changed. Main thread only. */
export interface AggregatesSync {
  /** Sends after `config.debounceMs` (restarted by every call). */
  schedule(): void;
  /** Computes and sends now if online and changed; one run at a time (a call during a run is folded into it). */
  flush(): Promise<AggregatesFlushResult>;
  /** Cancels the timer and ignores every later call. */
  dispose(): void;
}

const STORAGE_PREFIX = 'diamond.aggregates.lastSent.';

/**
 * Creates the aggregate sender of one account.
 *
 * @example
 * const agg = createAggregatesSync({ client, list: () => store.list(), accountId, peopleConfig, config: gameConfig.aggregatesSync });
 * agg.schedule();
 */
export function createAggregatesSync(deps: AggregatesSyncDeps): AggregatesSync {
  const storage = deps.storage === undefined ? safeLocalStorage() : deps.storage;
  const isOnline = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const storageKey = STORAGE_PREFIX + deps.accountId;
  let householdId: string | null = null;
  let lastSent: AggregatePayload | null = readStored(storage, storageKey);
  let lastSentHousehold: string | null = lastHousehold(storage, storageKey);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let again = false;
  let disposed = false;

  const findHousehold = async (): Promise<string | null> => {
    if (householdId !== null) return householdId;
    const member = await deps.client.from('household_members').select('household_id').eq('user_id', deps.accountId).is('left_at', null).maybeSingle();
    const id = (member.data as { household_id?: unknown } | null)?.household_id;
    if (member.error !== null || typeof id !== 'string') return null;
    householdId = id;
    return id;
  };

  const once = async (): Promise<AggregatesFlushResult> => {
    if (!isOnline()) return 'offline';
    const next = buildAggregatePayload(await deps.list(), deps.peopleConfig);
    const id = await findHousehold();
    if (id === null) return 'failed';
    // The remembered value belongs to one household; a different household needs a fresh send.
    if (!aggregatesChanged(lastSent, next) && lastSentHousehold === id) return 'unchanged';
    const { error } = await deps.client.from('household_aggregates').upsert({ household_id: id, ...next }, { onConflict: 'household_id' });
    if (error !== null) return 'failed';
    lastSent = next;
    lastSentHousehold = id;
    writeStored(storage, storageKey, next, id);
    return 'sent';
  };

  const flush = async (): Promise<AggregatesFlushResult> => {
    if (disposed) return 'disposed';
    if (running) {
      again = true;
      return 'unchanged';
    }
    running = true;
    let result: AggregatesFlushResult = 'failed';
    try {
      do {
        again = false;
        try {
          result = await once();
        } catch (error) {
          console.error('[aggregates-sync] send failed', error);
          result = 'failed';
        }
      } while (again && !disposed && result !== 'offline');
    } finally {
      running = false;
    }
    return result;
  };

  return {
    schedule() {
      if (disposed) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, deps.config.debounceMs);
    },
    flush,
    dispose() {
      disposed = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readRaw(storage: Pick<Storage, 'getItem'> | null, key: string): Record<string, unknown> | null {
  try {
    const text = storage?.getItem(key);
    if (typeof text !== 'string') return null;
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readStored(storage: Pick<Storage, 'getItem'> | null, key: string): AggregatePayload | null {
  return parseAggregatePayload(readRaw(storage, key)?.payload);
}

function lastHousehold(storage: Pick<Storage, 'getItem'> | null, key: string): string | null {
  const id = readRaw(storage, key)?.householdId;
  return typeof id === 'string' ? id : null;
}

function writeStored(storage: Pick<Storage, 'setItem'> | null, key: string, payload: AggregatePayload, householdId: string): void {
  try {
    storage?.setItem(key, JSON.stringify({ householdId, payload }));
  } catch {
    // Persistence is best effort: without it the next launch sends once more.
  }
}
