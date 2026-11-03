/**
 * Daily reminder rules (design/game-brief.md MVP feature 7; story-007, option
 * P1 in production/qa/evidence/story-007-feasibility.md section F).
 *
 * Pure and deterministic: the clock (`now`) and the IANA time zone are
 * parameters, nothing reads the real clock. Reminder settings are never stored
 * separately; they are read back from the latest valid
 * `settings_changed { reminder: { enabled, time } }` event in the log. The key
 * `reminder` does not collide with `stageAcknowledged` (story 006), and the
 * payload carries no `xp`, so it never changes progress.
 */
import type { LogEvent } from '../data/event-store';
import type { DailyGoalStatus } from './progress';

/** Reminder choice saved by the player. */
export interface ReminderSettings {
  /** Whether the daily reminder is on. */
  readonly enabled: boolean;
  /** Local wall-clock time "HH:MM" (24 h). */
  readonly time: string;
}

/** Tunable defaults read from `reminder` in `src/config/game-config.json`. */
export interface ReminderConfig {
  /** Reminder time used until the player picks one, "HH:MM". */
  readonly defaultTime: string;
  /** Whether reminders are on before the player touches the setting. */
  readonly enabledByDefault: boolean;
}

/** What is still missing today, for the reminder text. */
export interface ReminderMissing {
  /** XP still needed to reach the threshold (0 when reached). */
  readonly xp: number;
  /** No lesson (Học) yet today. */
  readonly lesson: boolean;
  /** No activity (Làm) yet today. */
  readonly activity: boolean;
}

/** Used only when game-config.json's `reminder` block is missing or invalid. */
const FALLBACK_CONFIG: ReminderConfig = { defaultTime: '20:00', enabledByDefault: false };

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses "HH:MM" (00:00–23:59) into minutes after local midnight, or null when
 * the value is not a valid time string.
 */
export function parseReminderTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = TIME_PATTERN.exec(value);
  if (match === null) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Validates the raw `reminder` block from game-config.json. Never throws;
 * each invalid field falls back to a safe built-in value.
 */
export function parseReminderConfig(raw: unknown): ReminderConfig {
  if (!isRecord(raw)) return FALLBACK_CONFIG;
  return {
    defaultTime: parseReminderTime(raw.defaultTime) !== null ? (raw.defaultTime as string) : FALLBACK_CONFIG.defaultTime,
    enabledByDefault: typeof raw.enabledByDefault === 'boolean' ? raw.enabledByDefault : FALLBACK_CONFIG.enabledByDefault,
  };
}

/** Validates one `payload.reminder` value; null when it is not a complete, valid setting. */
function parseReminderPayload(raw: unknown): ReminderSettings | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.enabled !== 'boolean' || parseReminderTime(raw.time) === null) return null;
  return { enabled: raw.enabled, time: raw.time as string };
}

/**
 * Current reminder settings from the event log.
 *
 * Considers `settings_changed` events whose `payload.reminder` is a complete,
 * valid `{ enabled: boolean, time: "HH:MM" }`; invalid ones are ignored (the
 * previous valid choice stays). Compensated events and compensating events
 * are skipped, as everywhere else. Latest timestamp wins; ties go to the
 * later event in the array. With no valid event, the config defaults apply.
 *
 * @param events Event log (any order).
 * @param config Defaults from {@link parseReminderConfig}.
 */
export function readReminderSettings(events: readonly LogEvent[], config: ReminderConfig): ReminderSettings {
  const compensated = new Set<string>();
  for (const e of events) {
    const target = e.payload.compensates;
    if (typeof target === 'string') compensated.add(target);
  }
  let bestTimestamp: string | null = null;
  let settings: ReminderSettings = { enabled: config.enabledByDefault, time: config.defaultTime };
  for (const e of events) {
    if (e.type !== 'settings_changed') continue;
    if (compensated.has(e.id) || typeof e.payload.compensates === 'string') continue;
    const parsed = parseReminderPayload(e.payload.reminder);
    if (parsed === null) continue;
    if (bestTimestamp === null || e.timestamp >= bestTimestamp) {
      bestTimestamp = e.timestamp;
      settings = parsed;
    }
  }
  return settings;
}

/** Local wall-clock fields of an instant in a time zone. */
interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  /** Minutes after local midnight. */
  readonly minutes: number;
}

function localFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
}

function localParts(formatter: Intl.DateTimeFormat, instant: number): LocalParts {
  const parts = formatter.formatToParts(new Date(instant));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), minutes: (get('hour') % 24) * 60 + get('minute') };
}

/** Local wall time of `instant`, expressed as if it were UTC (ms, minute precision). */
function wallAsUtc(formatter: Intl.DateTimeFormat, instant: number): number {
  const p = localParts(formatter, instant);
  return Date.UTC(p.year, p.month - 1, p.day) + p.minutes * MS_PER_MINUTE;
}

/**
 * The instant at which the local wall clock reads `minutes` after midnight on
 * the given local date. DST-safe, same rule as Temporal's "compatible":
 * a repeated time (fall back) takes the earlier instant; a skipped time
 * (spring forward) moves forward by the gap, e.g. 02:30 → 03:30.
 */
function localTimeToInstant(
  formatter: Intl.DateTimeFormat,
  year: number,
  month: number,
  day: number,
  minutes: number,
): number {
  const wall = Date.UTC(year, month - 1, day) + minutes * MS_PER_MINUTE;
  // Offsets (wall - instant) a day before and after: at most one transition between them.
  const offsetBefore = wallAsUtc(formatter, wall - MS_PER_DAY) - (wall - MS_PER_DAY);
  const offsetAfter = wallAsUtc(formatter, wall + MS_PER_DAY) - (wall + MS_PER_DAY);
  const candidates = [wall - offsetBefore, wall - offsetAfter]
    .filter((instant) => wallAsUtc(formatter, instant) === wall)
    .sort((a, b) => a - b);
  return candidates[0] ?? wall - offsetBefore;
}

/**
 * True when the in-app reminder should show now: reminders are enabled, the
 * local time is at or after today's reminder time, and today's goal is not met.
 *
 * @param settings From {@link readReminderSettings}.
 * @param now The current instant (injected).
 * @param timeZone IANA time zone defining the local day.
 * @param goalMet `computeProgress(...).dailyGoal.met` for `now`.
 */
export function shouldShowReminder(settings: ReminderSettings, now: Date, timeZone: string, goalMet: boolean): boolean {
  if (!settings.enabled || goalMet) return false;
  const target = parseReminderTime(settings.time);
  if (target === null) return false;
  return localParts(localFormatter(timeZone), now.getTime()).minutes >= target;
}

/**
 * The next instant the reminder is due: today's reminder time when it is
 * still in the future, otherwise the same local time tomorrow (or the first
 * valid instant after it on a DST day). Returns null when the time is invalid.
 *
 * @param settings From {@link readReminderSettings}; `enabled` is not checked here.
 * @param now The current instant (injected).
 * @param timeZone IANA time zone defining the local day.
 * @param skipToday Start from tomorrow even if today's time is still ahead
 *   (used when today's goal is already met).
 */
export function nextReminderAt(
  settings: ReminderSettings,
  now: Date,
  timeZone: string,
  skipToday = false,
): Date | null {
  const target = parseReminderTime(settings.time);
  if (target === null) return null;
  const formatter = localFormatter(timeZone);
  const today = localParts(formatter, now.getTime());
  if (!skipToday) {
    const todayAt = localTimeToInstant(formatter, today.year, today.month, today.day, target);
    if (todayAt > now.getTime()) return new Date(todayAt);
  }
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return new Date(
    localTimeToInstant(formatter, tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), target),
  );
}

/** What today's goal still needs, for {@link reminderMessage}-style text. */
export function reminderMissing(goal: DailyGoalStatus): ReminderMissing {
  return { xp: Math.max(0, goal.threshold - goal.xp), lesson: !goal.hasLesson, activity: !goal.hasActivity };
}
