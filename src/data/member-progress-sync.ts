/**
 * Shares this account's progress numbers with its upline (story 044): total XP, XP of the last 7
 * days and the current streak, written to `member_progress` (one row per account, owner-only
 * writes). Sends only when online, once the personal progress was pulled at least once on this
 * device (so a fresh device never overwrites the real numbers with zeros), and when the numbers
 * differ from the last successful send. Bursts are batched by a debounce. Never creates an event.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ShareProgress } from '../domain/progress';

/** Injected dependencies of {@link createMemberProgressSync}. */
export interface MemberProgressSyncDeps {
  readonly client: Pick<SupabaseClient, 'from'>;
  /** Signed-in account id (`auth.uid()`). */
  readonly accountId: string;
  /** Computes the numbers now (reads the local log). */
  readonly compute: () => Promise<ShareProgress>;
  /** Quiet time after the last change before sending. */
  readonly debounceMs: number;
  /** False until the personal progress was pulled once on this device; nothing is sent before. */
  readonly isReady: () => boolean;
  /** Defaults to `localStorage`; failures are swallowed. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Defaults to `navigator.onLine`. */
  readonly isOnline?: () => boolean;
}

/** Result of one send attempt. */
export type MemberProgressFlushResult = 'sent' | 'unchanged' | 'offline' | 'not_ready' | 'failed' | 'disposed';

/** Sends the account's progress numbers when they changed. Main thread only. */
export interface MemberProgressSync {
  /** Sends after `debounceMs` (restarted by every call). */
  schedule(): void;
  /** Computes and sends now when allowed and changed; one run at a time. */
  flush(): Promise<MemberProgressFlushResult>;
  /** Cancels the timer and ignores every later call. */
  dispose(): void;
}

const STORAGE_PREFIX = 'diamond.memberProgress.lastSent.';

/** True when the two snapshots differ in any number. Pure. */
export function shareProgressChanged(last: ShareProgress | null, next: ShareProgress): boolean {
  return last === null || last.xpTotal !== next.xpTotal || last.xp7d !== next.xp7d || last.streak !== next.streak;
}

/**
 * Creates the progress sender of one account.
 *
 * @example
 * const share = createMemberProgressSync({ client, accountId, compute, debounceMs: 3000, isReady: () => pulled });
 * share.schedule();
 */
export function createMemberProgressSync(deps: MemberProgressSyncDeps): MemberProgressSync {
  const storage = deps.storage === undefined ? safeLocalStorage() : deps.storage;
  const isOnline = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const key = STORAGE_PREFIX + deps.accountId;
  let lastSent = readStored(storage, key);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let disposed = false;

  const flush = async (): Promise<MemberProgressFlushResult> => {
    if (disposed) return 'disposed';
    if (running) return 'unchanged';
    if (!isOnline()) return 'offline';
    if (!deps.isReady()) return 'not_ready';
    running = true;
    try {
      const next = await deps.compute();
      if (!shareProgressChanged(lastSent, next)) return 'unchanged';
      const { error } = await deps.client
        .from('member_progress')
        .upsert({ user_id: deps.accountId, xp_total: next.xpTotal, xp_7d: next.xp7d, streak: next.streak }, { onConflict: 'user_id' });
      if (error !== null) return 'failed';
      lastSent = next;
      writeStored(storage, key, next);
      return 'sent';
    } catch (error) {
      console.error('[member-progress] send failed', error);
      return 'failed';
    } finally {
      running = false;
    }
  };

  return {
    schedule() {
      if (disposed) return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void flush();
      }, deps.debounceMs);
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

function readStored(storage: Pick<Storage, 'getItem'> | null, key: string): ShareProgress | null {
  try {
    const text = storage?.getItem(key);
    if (typeof text !== 'string') return null;
    const r = JSON.parse(text) as Record<string, unknown>;
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
    return ok(r.xpTotal) && ok(r.xp7d) && ok(r.streak) ? { xpTotal: r.xpTotal, xp7d: r.xp7d, streak: r.streak } : null;
  } catch {
    return null;
  }
}

function writeStored(storage: Pick<Storage, 'setItem'> | null, key: string, value: ShareProgress): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Best effort: without it the next launch sends once more.
  }
}
