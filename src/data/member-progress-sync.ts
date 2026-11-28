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
  return last === null || JSON.stringify(last) !== JSON.stringify(next);
}

/** The `member_progress` row of a snapshot (story 044 numbers plus story 050's). */
export function memberProgressRow(accountId: string, p: ShareProgress, seenAt: string): Record<string, unknown> {
  return {
    user_id: accountId,
    xp_total: p.xpTotal,
    xp_7d: p.xp7d,
    streak: p.streak,
    stats_day: p.statsDay,
    goal_today: p.goalToday,
    goal_xp: p.goalXp,
    xp_week: p.xpWeek,
    week_start: p.weekStart,
    active_days_7d: p.activeDays7d,
    tasks_7d: p.tasks7d,
    lessons_distinct: p.lessonsDistinct,
    last_lesson_at: p.lastLessonAt,
    badges_7d: p.badges7d,
    last_seen_at: seenAt,
  };
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
      let { error } = await deps.client.from('member_progress').upsert(memberProgressRow(deps.accountId, next, new Date().toISOString()), { onConflict: 'user_id' });
      if (error !== null) {
        // A server before the story 071 migration has no xp_week / week_start.
        const { xp_week: _w, week_start: _s, ...row056 } = memberProgressRow(deps.accountId, next, new Date().toISOString());
        ({ error } = await deps.client.from('member_progress').upsert(row056, { onConflict: 'user_id' }));
      }
      if (error !== null) {
        // A server before the story 056 migration has no goal_xp column.
        const { goal_xp: _goal, xp_week: _w2, week_start: _s2, ...row050 } = memberProgressRow(deps.accountId, next, new Date().toISOString());
        ({ error } = await deps.client.from('member_progress').upsert(row050, { onConflict: 'user_id' }));
      }
      if (error !== null) {
        // A server before the story 050 migration has only the story 044 columns.
        ({ error } = await deps.client.from('member_progress').upsert({ user_id: deps.accountId, xp_total: next.xpTotal, xp_7d: next.xp7d, streak: next.streak }, { onConflict: 'user_id' }));
      }
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
    // Only a full snapshot (story 071) counts; an older one is sent again once.
    return typeof r.xpTotal === 'number' && typeof r.statsDay === 'string' && typeof r.tasks7d === 'object' && typeof r.goalXp === 'number' && typeof r.xpWeek === 'number' ? (r as unknown as ShareProgress) : null;
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
