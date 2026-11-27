/**
 * Progress derivation: total XP, XP today, daily-goal status and streak,
 * recomputed from the event log (design/game-brief.md, MVP feature 3;
 * story-002-daily-goal-streak).
 *
 * Pure and deterministic: the clock (`now`) and the IANA time zone are
 * parameters, nothing reads the real clock.
 */
import { FORMER_MEMBER_ID } from '../data/event-store';
import type { EventPayload, LogEvent } from '../data/event-store';
import gameConfig from '../config/game-config.json';

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

  // Story 056: each day uses the goal I picked for it (a change counts from its start day).
  const goalFor = xpGoalByDay(events, config.dailyXpGoal, others);
  const isMet = (t: DayTotals | undefined, day: number): boolean =>
    t !== undefined && t.xp >= goalFor(day) && t.hasLesson && t.hasActivity;

  const today = localDayNumber(formatter, now);
  const todayTotals = days.get(today);
  const todayMet = isMet(todayTotals, today);

  let streak = 0;
  for (let day = todayMet ? today : today - 1; isMet(days.get(day), day); day--) streak++;

  return {
    totalXp,
    xpToday: todayTotals?.xp ?? 0,
    streak,
    dailyGoal: {
      met: todayMet,
      xp: todayTotals?.xp ?? 0,
      threshold: goalFor(today),
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

/** The numbers an account shares with its sponsor (story 044). */
export interface ShareProgress {
  /** Same as {@link Progress.totalXp}. */
  readonly xpTotal: number;
  /** XP of the last 7 local days, today included. */
  readonly xp7d: number;
  /** Same as {@link Progress.streak}. */
  readonly streak: number;
  /** Local date (YYYY-MM-DD) the numbers were computed for (story 050). */
  readonly statsDay: string;
  /** Today's daily goal met. */
  readonly goalToday: boolean;
  /** Local days with XP among the last 7 (today included). */
  readonly activeDays7d: number;
  /** Tasks of the last 7 days by type (story 050). */
  readonly tasks7d: Readonly<Record<ShareTask, number>>;
  /** Lessons learned at least once (xp > 0). */
  readonly lessonsDistinct: number;
  /** ISO time of the latest lesson completion, or null. */
  readonly lastLessonAt: string | null;
  /** Badges that popped up (non-silent acknowledgements) in the last 7 days. */
  readonly badges7d: number;
  /** Today's XP goal (story 056: picked by the person, 20–200). */
  readonly goalXp: number;
}

/** Task types counted in {@link ShareProgress.tasks7d}. */
export const SHARE_TASKS = ['contact', 'demo', 'opp', 'new_customer', 'new_npp'] as const;
export type ShareTask = (typeof SHARE_TASKS)[number];

/** Local days counted by {@link ShareProgress.xp7d}. */
export const SHARE_XP_DAYS = 7;

/**
 * Total XP, XP of the last {@link SHARE_XP_DAYS} local days (today included) and the current
 * streak, under the same rules as {@link computeProgress} (compensation, `others`, local days).
 *
 * @example
 * computeShareProgress(events, new Date(), { dailyXpGoal: 30 }, 'Asia/Ho_Chi_Minh', others);
 */
export function computeShareProgress(
  events: readonly LogEvent[],
  now: Date,
  config: ProgressConfig,
  timeZone: string,
  others?: ReadonlySet<string>,
): ShareProgress {
  const progress = computeProgress(events, now, config, timeZone, others);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  const today = localDayNumber(formatter, now);
  const firstDay = today - (SHARE_XP_DAYS - 1);
  let xp7d = 0;
  const activeDays = new Set<number>();
  const tasks7d: Record<ShareTask, number> = { contact: 0, demo: 0, opp: 0, new_customer: 0, new_npp: 0 };
  const lessons = new Set<string>();
  let lastLessonAt: string | null = null;
  let badges7d = 0;
  for (const e of events) {
    if (compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    if (others?.has(e.userId) === true) continue;
    const day = localDayNumber(formatter, new Date(e.timestamp));
    const recent = day >= firstDay;
    if (e.type === 'settings_changed') {
      const id = e.payload.achievementAcknowledged;
      if (recent && typeof id === 'string' && id.startsWith('badge:') && e.payload.silent !== true) badges7d += 1;
      continue;
    }
    const xp = e.payload.xp;
    if (typeof xp !== 'number' || !Number.isFinite(xp)) continue;
    if (e.type === 'lesson_completed') {
      if (xp > 0 && typeof e.payload.lessonId === 'string') lessons.add(e.payload.lessonId);
      if (lastLessonAt === null || e.timestamp > lastLessonAt) lastLessonAt = e.timestamp;
    }
    if (!recent) continue;
    xp7d += xp;
    if (xp > 0) activeDays.add(day);
    const task = e.type === 'activity_logged' ? e.payload.taskId : undefined;
    if (typeof task === 'string' && (SHARE_TASKS as readonly string[]).includes(task)) tasks7d[task as ShareTask] += 1;
  }
  const date = new Date(today * MS_PER_DAY);
  const statsDay = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return {
    xpTotal: Math.max(0, progress.totalXp),
    xp7d: Math.max(0, xp7d),
    streak: progress.streak,
    statsDay,
    goalToday: progress.dailyGoal.met,
    goalXp: progress.dailyGoal.threshold,
    activeDays7d: activeDays.size,
    tasks7d,
    lessonsDistinct: lessons.size,
    lastLessonAt,
    badges7d,
  };
}

/** Allowed daily XP goals (story 056), from `xpGoalRange` in game-config.json. */
export const XP_GOAL_RANGE: { readonly min: number; readonly max: number; readonly step: number } = (() => {
  const raw = (gameConfig as { xpGoalRange?: { min?: unknown; max?: unknown; step?: unknown } }).xpGoalRange;
  const int = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : d);
  const min = int(raw?.min, 20);
  const max = Math.max(min, int(raw?.max, 200));
  return { min, max, step: int(raw?.step, 5) };
})();

/** Day number (as {@link localDayNumber}) of a "YYYY-MM-DD" local date, or null. */
function dateKeyToDay(key: unknown): number | null {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** "YYYY-MM-DD" of a day number. */
function dayToDateKey(day: number): string {
  const d = new Date(day * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** True for an allowed goal: inside {@link XP_GOAL_RANGE} and on its step. */
function validGoal(xp: unknown): xp is number {
  return typeof xp === 'number' && Number.isInteger(xp) && xp >= XP_GOAL_RANGE.min && xp <= XP_GOAL_RANGE.max && (xp - XP_GOAL_RANGE.min) % XP_GOAL_RANGE.step === 0;
}

/** My goal choices `{ xpGoal: { xp, from } }`, oldest written first (spouse's and undone ones dropped). */
function goalChoices(events: readonly LogEvent[], others?: ReadonlySet<string>): { readonly xp: number; readonly from: number }[] {
  const undone = new Set<string>();
  for (const e of events) if (typeof e.payload.compensates === 'string') undone.add(e.payload.compensates);
  const out: { xp: number; from: number }[] = [];
  for (const e of events) {
    if (e.type !== 'settings_changed' || undone.has(e.id) || others?.has(e.userId) === true) continue;
    const g = e.payload.xpGoal as { xp?: unknown; from?: unknown } | undefined;
    const from = dateKeyToDay(g?.from);
    if (typeof g === 'object' && g !== null && validGoal(g.xp) && from !== null) out.push({ xp: g.xp, from });
  }
  return out;
}

/**
 * The XP goal of each day (story 056): the latest-written choice whose start day is on or before
 * it, else `fallback`. Pure.
 */
export function xpGoalByDay(events: readonly LogEvent[], fallback: number, others?: ReadonlySet<string>): (day: number) => number {
  const choices = goalChoices(events, others);
  return (day) => {
    let xp = fallback;
    for (const c of choices) if (c.from <= day) xp = c.xp;
    return xp;
  };
}

/** Today's goal and a choice that starts later ("from tomorrow"), for Cài đặt (story 056). */
export function readXpGoal(events: readonly LogEvent[], now: Date, config: ProgressConfig, timeZone: string, others?: ReadonlySet<string>): { readonly today: number; readonly next: { readonly xp: number; readonly from: string } | null } {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  const today = localDayNumber(formatter, now);
  const goalFor = xpGoalByDay(events, config.dailyXpGoal, others);
  const later = goalChoices(events, others).filter((c) => c.from > today).at(-1);
  const next = later === undefined || later.xp === goalFor(today) ? null : { xp: later.xp, from: dayToDateKey(later.from) };
  return { today: goalFor(today), next };
}

/** The setting event for a new goal, snapped to {@link XP_GOAL_RANGE}, starting tomorrow (local). */
export function buildXpGoalEvent(xp: number, now: Date, timeZone: string): { readonly type: 'settings_changed'; readonly payload: EventPayload } {
  const { min, max, step } = XP_GOAL_RANGE;
  const snapped = Math.min(max, Math.max(min, min + Math.round((xp - min) / step) * step));
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
  return { type: 'settings_changed', payload: { xpGoal: { xp: snapped, from: dayToDateKey(localDayNumber(formatter, now) + 1) } } };
}
