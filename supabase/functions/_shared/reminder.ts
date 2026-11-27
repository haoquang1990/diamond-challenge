/**
 * Pure parts of the server daily reminder (story 058), shared by the send-reminders Edge Function
 * and covered by Vitest from tests/unit/push/. No Deno or network APIs here.
 */
import type { PushPayload } from './push.ts';

/** How long after the chosen time a missed run may still send (a later run never nags at night). */
export const REMINDER_WINDOW_MINUTES = 180;

/** Local date "YYYY-MM-DD" and minutes since local midnight of `now` in `timeZone`; null for a bad zone. */
export function localDateTime(now: Date, timeZone: string): { readonly date: string; readonly minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
  } catch {
    return null;
  }
}

/** One account's reminder settings and today's numbers, as the function reads them. */
export interface ReminderState {
  readonly timeZone: string;
  /** "HH:MM" local. */
  readonly time: string;
  /** Local date of the last push reminder, or null. */
  readonly lastRemindedOn: string | null;
  /** `member_progress.stats_day` / `goal_today`: met only counts when the numbers are from today. */
  readonly statsDay: string | null;
  readonly goalToday: boolean;
}

/**
 * Due when the local time is at or after the chosen time (within {@link REMINDER_WINDOW_MINUTES}),
 * no reminder went out today, and today's goal is not known to be met. Pure.
 */
export function reminderDue(now: Date, s: ReminderState): { readonly due: boolean; readonly localDate: string } {
  const local = localDateTime(now, s.timeZone);
  const m = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(s.time);
  if (local === null || m === null) return { due: false, localDate: local?.date ?? '' };
  const at = Number(m[1]) * 60 + Number(m[2]);
  const inWindow = local.minutes >= at && local.minutes < at + REMINDER_WINDOW_MINUTES;
  const metToday = s.statsDay === local.date && s.goalToday;
  return { due: inWindow && s.lastRemindedOn !== local.date && !metToday, localDate: local.date };
}

/** The reminder push; its tag is the app's own reminder tag, so the two never show twice. */
export function reminderPushPayload(streak: number): PushPayload {
  return {
    title: streak > 0 ? `🔥 Giữ chuỗi ${streak} ngày nhé!` : '💎 Hôm nay bạn chưa đạt mục tiêu',
    body: 'Hôm nay bạn chưa đạt mục tiêu. Học 1 bài, làm 1 việc là kịp.',
    url: './?tab=today',
    tag: 'daily-reminder',
  };
}
