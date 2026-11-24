/**
 * Huy hiệu (stories 046–047): a data-driven catalog of tiered badges (`src/content/badges.json`
 * plus one "Xong chặng" badge per lesson stage), the metrics they read from the event log, and
 * the achieved tiers. Every tier is one badge; each reached tier becomes an achievement item
 * (`badge:<id>:<threshold>`) acknowledged like the other achievements. No XP is awarded.
 * Pure; never throws.
 */
import type { LogEvent } from '../data/event-store';
import type { AchievedItem } from './achievements';
import { lessonHistory } from './lesson';
import type { Lesson } from './lesson';
import type { LessonStage } from './lesson-stages';
import { computePeopleStats, derivePeople } from './people';
import type { PeopleConfig } from './people';
import type { ProgressConfig } from './progress';

/** One badge group (a section of the Huy hiệu screen). */
export interface BadgeGroup {
  readonly id: string;
  readonly title: string;
}

/** One badge card: a metric and its increasing thresholds (one badge per threshold). */
export interface BadgeDef {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  readonly icon: string;
  readonly metric: string;
  readonly thresholds: readonly number[];
  readonly description: string;
  /** Tier title with `{n}` for the threshold, e.g. "Chuỗi {n} ngày". */
  readonly label: string;
}

/** Result of {@link parseBadges}. */
export interface ParsedBadges {
  readonly groups: readonly BadgeGroup[];
  readonly defs: readonly BadgeDef[];
  readonly problems: readonly string[];
}

/** Injected inputs of {@link computeBadgeMetrics}. */
export interface BadgeDeps {
  readonly people: PeopleConfig;
  readonly progress: ProgressConfig;
  readonly lessons: readonly Lesson[];
  readonly stages: readonly LessonStage[];
  /** Other household members' ids: their events never count for my badges (people counts excepted). */
  readonly others?: ReadonlySet<string>;
  /** Number of other members in my household (Bộ đôi). */
  readonly householdMembers: number;
}

/** A badge card with its current value. */
export interface BadgeRow {
  readonly def: BadgeDef;
  readonly value: number;
  /** Thresholds reached (0..thresholds.length). */
  readonly reached: number;
  /** Next threshold, or null when every tier is reached. */
  readonly next: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Reads the catalog and adds one "Xong chặng <stage>" badge per lesson stage that has lessons
 * (threshold = the stage's lesson count). Bad entries are skipped and reported.
 */
export function parseBadges(raw: unknown, stages: readonly LessonStage[], lessons: readonly Lesson[]): ParsedBadges {
  const problems: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.badges) || !Array.isArray(raw.groups)) {
    return { groups: [], defs: [], problems: ['File huy hiệu sai định dạng.'] };
  }
  const groups: BadgeGroup[] = [];
  for (const g of raw.groups as unknown[]) if (isRecord(g) && isText(g.id) && isText(g.title)) groups.push({ id: g.id, title: g.title });
  const groupIds = new Set(groups.map((g) => g.id));
  const defs: BadgeDef[] = [];
  const seen = new Set<string>();
  (raw.badges as unknown[]).forEach((b, i) => {
    const where = isRecord(b) && isText(b.id) ? `"${b.id}"` : `#${i + 1}`;
    if (!isRecord(b) || !isText(b.id) || !isText(b.name) || !isText(b.icon) || !isText(b.metric) || !isText(b.group) || !groupIds.has(b.group)) {
      problems.push(`Huy hiệu ${where} bị bỏ qua: thiếu thông tin.`);
      return;
    }
    const th = Array.isArray(b.thresholds) ? (b.thresholds as unknown[]) : [];
    const ok = th.length > 0 && th.every((x, k) => typeof x === 'number' && Number.isInteger(x) && x > 0 && (k === 0 || x > (th[k - 1] as number)));
    if (!ok || seen.has(b.id)) {
      problems.push(`Huy hiệu ${where} bị bỏ qua: mốc không hợp lệ hoặc trùng id.`);
      return;
    }
    seen.add(b.id);
    defs.push({
      id: b.id,
      group: b.group,
      name: b.name,
      icon: b.icon,
      metric: b.metric,
      thresholds: th as number[],
      description: isText(b.description) ? b.description : '',
      label: isText(b.label) ? b.label : b.name,
    });
  });
  const sb = isRecord(raw.stageBadges) ? raw.stageBadges : null;
  if (sb !== null && isText(sb.group) && groupIds.has(sb.group)) {
    const template = isText(sb.labelTemplate) ? sb.labelTemplate : 'Xong chặng {stage}';
    const icon = isText(sb.icon) ? sb.icon : 'flag';
    const at = defs.findIndex((d) => d.group === sb.group);
    const stageDefs: BadgeDef[] = [];
    for (const s of stages) {
      const count = lessons.filter((l) => l.stage === s.id).length;
      if (count === 0) continue;
      const name = template.replace('{stage}', s.title);
      stageDefs.push({ id: `stage-${s.id}`, group: sb.group, name, icon, metric: `lessonStage:${s.id}`, thresholds: [count], description: `Học hết ${count} bài của chặng ${s.title}`, label: name });
    }
    defs.splice(at < 0 ? defs.length : at, 0, ...stageDefs);
  }
  return { groups, defs, problems };
}

/** Local calendar parts of an instant. */
function localParts(formatter: Intl.DateTimeFormat, instant: Date): { day: number; hour: number; weekday: number; month: string } {
  const parts = formatter.formatToParts(instant);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const utc = Date.UTC(y, m - 1, d);
  const hour = Number(get('hour')) % 24;
  return { day: utc / 86_400_000, hour, weekday: new Date(utc).getUTCDay(), month: `${y}-${m}` };
}

interface DayInfo {
  xp: number;
  lesson: boolean;
  activity: boolean;
  tasks: Set<string>;
}

/**
 * Every metric a badge can read, as a map (missing = 0). My own non-compensated events count
 * for habits, XP, lessons and tasks (`others` are skipped); contacts, KH, NPP and 30x30 count
 * the whole household book.
 */
export function computeBadgeMetrics(events: readonly LogEvent[], now: Date, timeZone: string, deps: BadgeDeps): ReadonlyMap<string, number> {
  const m = new Map<string, number>();
  const add = (key: string, by = 1) => m.set(key, (m.get(key) ?? 0) + by);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' });
  const compensated = new Set<string>();
  for (const e of events) if (typeof e.payload.compensates === 'string') compensated.add(e.payload.compensates);
  const mine = events.filter((e) => !compensated.has(e.id) && typeof e.payload.compensates !== 'string' && deps.others?.has(e.userId) !== true);

  const days = new Map<number, DayInfo>();
  const dayOf = (d: number): DayInfo => {
    let info = days.get(d);
    if (info === undefined) {
      info = { xp: 0, lesson: false, activity: false, tasks: new Set() };
      days.set(d, info);
    }
    return info;
  };
  const lessonQuestions = new Map(deps.lessons.map((l) => [l.id, l.questions.length]));
  const lessonDays = new Set<number>();
  const addedAt = new Map<string, number>();
  for (const e of events) {
    if (e.type === 'person_added' && typeof e.payload.personId === 'string' && !addedAt.has(e.payload.personId)) addedAt.set(e.payload.personId, Date.parse(e.timestamp));
  }
  const customers = new Map<string, number>();
  const sponsored = new Set<string>();
  const cares = new Map<string, number>();
  let lessonEvents = 0;

  for (const e of mine) {
    if (e.type !== 'lesson_completed' && e.type !== 'activity_logged' && e.type !== 'person_stage_changed') continue;
    const at = localParts(formatter, new Date(e.timestamp));
    const info = dayOf(at.day);
    const xp = typeof e.payload.xp === 'number' && Number.isFinite(e.payload.xp) ? e.payload.xp : 0;
    info.xp += xp;
    add('xpTotal', xp);
    if (e.type === 'person_stage_changed') continue;
    if (at.hour < 7) add('earlyEvents');
    if (at.hour >= 22) add('lateEvents');
    if (e.type === 'lesson_completed') {
      info.lesson = true;
      lessonDays.add(at.day);
      lessonEvents += 1;
      const total = typeof e.payload.lessonId === 'string' ? lessonQuestions.get(e.payload.lessonId) : undefined;
      if (total !== undefined && e.payload.score === total) add('lessonsPerfect');
      continue;
    }
    info.activity = true;
    const taskId = typeof e.payload.taskId === 'string' ? e.payload.taskId : typeof e.payload.activityType === 'string' ? e.payload.activityType : null;
    if (taskId === null) continue;
    info.tasks.add(taskId);
    add(`task:${taskId}`);
    if (typeof e.payload.note === 'string' && e.payload.note.trim() !== '') add('notes');
    const personId = typeof e.payload.personId === 'string' ? e.payload.personId : null;
    if (personId === null) continue;
    const when = Date.parse(e.timestamp);
    if (taskId === 'new_customer') customers.set(personId, Math.min(customers.get(personId) ?? Infinity, when));
    if (taskId === 'new_npp') sponsored.add(personId);
    if (taskId === 'follow_up') cares.set(personId, (cares.get(personId) ?? 0) + 1);
  }

  m.set('customersDistinct', customers.size);
  m.set('sponsoredDistinct', sponsored.size);
  m.set('loyalCare', [...cares.values()].filter((c) => c >= 5).length);
  m.set('quickCloses', [...customers].filter(([pid, when]) => {
    const added = addedAt.get(pid);
    return added !== undefined && when - added <= 7 * 86_400_000;
  }).length);

  // Days: goal, streaks, weeks, months, weekends, combos.
  const met = (d: DayInfo | undefined) => d !== undefined && d.xp >= deps.progress.dailyXpGoal && d.lesson && d.activity;
  const sorted = [...days.keys()].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  const weeks = new Map<number, number>();
  const months = new Map<string, number>();
  for (const d of sorted) {
    const info = days.get(d);
    if (info !== undefined && info.xp > 0) add('activeDays');
    if (info !== undefined && info.tasks.size >= 3) add('multiTaskDays');
    if (info !== undefined && info.lesson && info.activity) add('learnAndDoDays');
    if (!met(info)) continue;
    add('goalDays');
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    prev = d;
    best = Math.max(best, run);
    const weekday = new Date(d * 86_400_000).getUTCDay();
    if (weekday === 0 || weekday === 6) add('weekendGoalDays');
    const monday = d - ((weekday + 6) % 7);
    weeks.set(monday, (weeks.get(monday) ?? 0) + 1);
    const date = new Date(d * 86_400_000);
    const month = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  m.set('streakBest', best);
  m.set('perfectWeeks', [...weeks.values()].filter((c) => c >= 7).length);
  m.set('busyMonths', [...months.values()].filter((c) => c >= 20).length);
  let bestDay = 0;
  let bestWeek = 0;
  for (const d of sorted) {
    bestDay = Math.max(bestDay, days.get(d)?.xp ?? 0);
    let sum = 0;
    for (let k = 0; k < 7; k++) sum += days.get(d + k)?.xp ?? 0;
    bestWeek = Math.max(bestWeek, sum);
  }
  m.set('bestDayXp', bestDay);
  m.set('best7DayXp', bestWeek);

  // Lessons.
  const learned = deps.lessons.filter((l) => lessonHistory(mine, l.id).count > 0);
  m.set('lessonsDistinct', learned.length);
  m.set('lessonReviews', Math.max(0, lessonEvents - learned.length));
  m.set('lessonDays', lessonDays.size);
  for (const s of deps.stages) m.set(`lessonStage:${s.id}`, learned.filter((l) => l.stage === s.id).length);
  m.set('lessonsAll', deps.lessons.length > 0 && learned.length === deps.lessons.length ? 1 : 0);

  // Household book.
  const stats = computePeopleStats(derivePeople(events, deps.people), deps.people);
  m.set('contacts', stats.contacts);
  m.set('customersNow', stats.customers);
  m.set('f1Now', stats.f1);
  m.set('achieved30x30', stats.achieved ? 1 : 0);
  m.set('householdMembers', deps.householdMembers);
  void now;
  return m;
}

/** Each badge card with its value, reached tiers and next threshold, in catalog order. */
export function badgeRows(defs: readonly BadgeDef[], metrics: ReadonlyMap<string, number>): BadgeRow[] {
  return defs.map((def) => {
    const value = metrics.get(def.metric) ?? 0;
    const reached = def.thresholds.filter((t) => value >= t).length;
    return { def, value, reached, next: def.thresholds[reached] ?? null };
  });
}

/** Tier title, e.g. "Chuỗi 7 ngày". */
export function tierLabel(def: BadgeDef, threshold: number): string {
  return def.label.replace('{n}', threshold.toLocaleString('vi-VN'));
}

/** One achievement item per reached tier (`badge:<id>:<threshold>`), in catalog then tier order. */
export function achievedBadgeItems(rows: readonly BadgeRow[]): AchievedItem[] {
  return rows.flatMap((r) =>
    r.def.thresholds.slice(0, r.reached).map((t) => ({ id: `badge:${r.def.id}:${t}`, kind: 'badge' as const, name: tierLabel(r.def, t), itemId: r.def.id })),
  );
}

/**
 * Colour of tier `index` (0-based) of a badge with `count` tiers: 1 bronze, 2 silver, 3 gold,
 * 4 diamond. Up to four tiers end on diamond; more tiers spread over the four colours; a
 * single-step badge is gold.
 */
export function tierColor(index: number, count: number): number {
  if (count <= 1) return 3;
  if (count <= 4) return 4 - count + index + 1;
  return Math.min(4, Math.max(1, Math.ceil(((index + 1) * 4) / count)));
}
