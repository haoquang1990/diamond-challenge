/**
 * Progress derivation: total XP, XP today, daily-goal status and streak,
 * recomputed from the event log (design/game-brief.md, MVP feature 3;
 * story-002-daily-goal-streak).
 *
 * Pure and deterministic: the clock (`now`) and the IANA time zone are
 * parameters, nothing reads the real clock.
 */
import { FORMER_MEMBER_ID } from '../data/event-store';
import type { LogEvent } from '../data/event-store';

/** Tunable values read from `src/config/game-config.json`. */
export interface ProgressConfig {
  /** XP a day needs to reach (inclusive) for the daily goal. */
  readonly dailyXpGoal: number;
}

/** Daily-goal status for today. */
export interface DailyGoalStatus {
  /** True when XP >= threshold AND at least one lesson (Học) AND one activity (Làm) today. */
  readonly met: boolean;
  /** XP earned today. */
  readonly xp: number;
  /** XP threshold from config. */
  readonly threshold: number;
  /** At least one non-compensated `lesson_completed` today. */
  readonly hasLesson: boolean;
  /** At least one non-compensated `activity_logged` today. */
  readonly hasActivity: boolean;
}

/** Result of {@link computeProgress}. */
export interface Progress {
  /** Sum of XP over all non-compensated events. */
  readonly totalXp: number;
  /** XP of events falling on today's local day. */
  readonly xpToday: number;
  /** Consecutive days with the goal met (today's day is not yet lost if unmet). */
  readonly streak: number;
  /** Today's daily-goal status. */
  readonly dailyGoal: DailyGoalStatus;
}

interface DayTotals {
  xp: number;
  hasLesson: boolean;
  hasActivity: boolean;
}

const MS_PER_DAY = 86_400_000;

/**
 * Local calendar day of an instant in `timeZone`, as a day number (days since
 * 1970-01-01 of the local calendar date). Consecutive local days differ by
 * exactly 1 regardless of DST, because only the calendar date is used.
 */
function localDayNumber(formatter: Intl.DateTimeFormat, instant: Date): number {
  const parts = formatter.formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get('year'), get('month') - 1, get('day')) / MS_PER_DAY;
}

/**
 * Computes progress from the event log.
 *
 * - Day boundaries are local midnights in `timeZone`; an event counts toward
 *   the local day of its own timestamp (late entries included).
 * - An event whose id appears in another event's `payload.compensates` is
 *   excluded; compensating events themselves carry no XP.
 * - XP is `payload.xp`; events whose xp is not a finite number are ignored.
 * - Streak: consecutive goal-met days ending today, or ending yesterday when
 *   today is not yet met. A missed earlier day resets it to 0.
 *
 * @param events Event log (any order).
 * @param now The current instant (injected).
 * @param config Tunable values from game-config.json.
 * @param timeZone IANA time zone (e.g. "Asia/Ho_Chi_Minh") that defines the local day.
 * @param others When given, events whose `userId` is in it add no XP and do not count for the
 *   day (story 023: another household member's events never add to my XP). Compensation still
 *   reads every event. See {@link otherMemberIds}.
 */
export function computeProgress(
  events: readonly LogEvent[],
  now: Date,
  config: ProgressConfig,
  timeZone: string,
  others?: ReadonlySet<string>,
): Progress {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });

  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }

  const days = new Map<number, DayTotals>();
  let totalXp = 0;
  for (const e of events) {
    const xp = e.payload.xp;
    if (typeof xp !== 'number' || !Number.isFinite(xp)) continue;
    if (compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    if (others?.has(e.userId) === true) continue;
    totalXp += xp;
    const day = localDayNumber(formatter, new Date(e.timestamp));
    const totals = days.get(day) ?? { xp: 0, hasLesson: false, hasActivity: false };
    totals.xp += xp;
    if (e.type === 'lesson_completed') totals.hasLesson = true;
    if (e.type === 'activity_logged') totals.hasActivity = true;
    days.set(day, totals);
  }

  const isMet = (t: DayTotals | undefined): boolean =>
    t !== undefined && t.xp >= config.dailyXpGoal && t.hasLesson && t.hasActivity;

  const today = localDayNumber(formatter, now);
  const todayTotals = days.get(today);
  const todayMet = isMet(todayTotals);

  let streak = 0;
  for (let day = todayMet ? today : today - 1; isMet(days.get(day)); day--) streak++;

  return {
    totalXp,
    xpToday: todayTotals?.xp ?? 0,
    streak,
    dailyGoal: {
      met: todayMet,
      xp: todayTotals?.xp ?? 0,
      threshold: config.dailyXpGoal,
      hasLesson: todayTotals?.hasLesson ?? false,
      hasActivity: todayTotals?.hasActivity ?? false,
    },
  };
}

/**
 * Authors whose events are NOT mine (story 023): {@link FORMER_MEMBER_ID} plus the persisted
 * household member account ids, minus every `localUserId` / `accountId` of this log's
 * `settings_changed { accountLinked }` events. Every other `userId` (this device, a restored
 * old device, a linked account) is mine. XP, streak, daily goal and stage / daily_goal /
 * streak milestones skip events whose `userId` is in this set.
 *
 * @example
 * const others = otherMemberIds(events, await store.readMemberIds());
 * computeProgress(events, new Date(), config, timeZone, others);
 */
export function otherMemberIds(events: readonly LogEvent[], memberIds: ReadonlySet<string>): ReadonlySet<string> {
  const others = new Set<string>(memberIds);
  others.add(FORMER_MEMBER_ID);
  for (const e of events) {
    if (e.type !== 'settings_changed') continue;
    const link = e.payload.accountLinked;
    if (typeof link !== 'object' || link === null) continue;
    const { localUserId, accountId } = link as { localUserId?: unknown; accountId?: unknown };
    if (typeof localUserId === 'string') others.delete(localUserId);
    if (typeof accountId === 'string') others.delete(accountId);
  }
  return others;
}
