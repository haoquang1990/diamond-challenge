/**
 * Huy hiệu (story 046): the 150-badge catalog, the metrics computed from the log and the
 * achieved tiers. Fixed instants and time zone.
 */
import { describe, expect, it } from 'vitest';
import badgesJson from '../../../src/content/badges.json';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { achievedBadgeItems, badgeRows, computeBadgeMetrics, parseBadges, tierColor } from '../../../src/domain/badges';
import type { BadgeDeps } from '../../../src/domain/badges';
import { parsePeopleConfig } from '../../../src/domain/people';
import { LESSON_ICONS } from '../../../src/ui/lesson-icons';
import { LOADED_LESSONS, LOADED_STAGES } from '../../../src/ui/lesson-content';

const TZ = 'Asia/Ho_Chi_Minh';
const PEOPLE = parsePeopleConfig(gameConfig);
const DEPS = (over: Partial<BadgeDeps> = {}): BadgeDeps => ({
  people: PEOPLE,
  progress: { dailyXpGoal: 30 },
  lessons: LOADED_LESSONS.lessons,
  stages: LOADED_STAGES,
  householdMembers: 0,
  ...over,
});
let n = 0;
const ev = (type: EventType, timestamp: string, payload: Record<string, unknown>, userId = 'me'): LogEvent => ({
  id: `b${++n}`, type, timestamp, userId, schemaVersion: 1, payload, syncedAt: null,
});
// Local day d of Nov 2026 at hh:00 local (UTC+7).
const at = (d: number, hh = 9) => new Date(Date.UTC(2026, 10, d, hh - 7)).toISOString();
const lesson = (d: number, id: string, score = 0, xp = 10, hh = 9) => ev('lesson_completed', at(d, hh), { lessonId: id, xp, score });
const task = (d: number, taskId: string, personId: string, extra: Record<string, unknown> = {}, hh = 10) =>
  ev('activity_logged', at(d, hh), { activityType: taskId, taskId, xp: 20, personId, ...extra });
const added = (d: number, personId: string) => ev('person_added', at(d, 8), { personId, name: personId });
/** A goal-met day: one lesson and one task, 30 XP. */
const goalDay = (d: number, id = `l${d}`) => [lesson(d, 'why-start'), task(d, 'contact', `p${id}`)];

describe('catalog', () => {
  const parsed = parseBadges(badgesJson, LOADED_STAGES, LOADED_LESSONS.lessons);

  it('has 150 badges (tiers) on unique cards with known icons and groups', () => {
    expect(parsed.problems).toEqual([]);
    expect(parsed.defs.reduce((sum, d) => sum + d.thresholds.length, 0)).toBe(150);
    expect(new Set(parsed.defs.map((d) => d.id)).size).toBe(parsed.defs.length);
    for (const d of parsed.defs) {
      expect(Object.hasOwn(LESSON_ICONS, d.icon), d.id).toBe(true);
      expect(parsed.groups.some((g) => g.id === d.group), d.id).toBe(true);
      expect([...d.thresholds].sort((a, b) => a - b)).toEqual(d.thresholds);
    }
  });

  it('adds one "Xong chặng" badge per lesson stage, needing every lesson of the stage', () => {
    const stageDefs = parsed.defs.filter((d) => d.metric.startsWith('lessonStage:'));
    expect(stageDefs).toHaveLength(LOADED_STAGES.length);
    expect(stageDefs[0]).toMatchObject({ name: 'Xong chặng Khởi đầu', thresholds: [5] });
  });

  it('skips a bad entry and reports it', () => {
    const r = parseBadges({ groups: badgesJson.groups, badges: [{ id: 'x', group: 'xp', name: 'X', icon: 'star', metric: 'xpTotal', thresholds: [] }] }, [], []);
    expect(r.defs).toEqual([]);
    expect(r.problems).toHaveLength(1);
  });
});

describe('computeBadgeMetrics', () => {
  const now = new Date(at(24, 12));

  it('counts habits: best streak, goal days, active days, weekend days, early and late events', () => {
    // 16..22 Nov 2026 is Monday..Sunday: a perfect week; 23 missed; 24 goal met.
    const log = [16, 17, 18, 19, 20, 21, 22, 24].flatMap((d) => goalDay(d)).concat([lesson(23, 'why-start', 0, 0, 6), task(23, 'demo', 'x', {}, 23)]);
    const m = computeBadgeMetrics(log, now, TZ, DEPS());
    expect(m.get('streakBest')).toBe(7);
    expect(m.get('goalDays')).toBe(8);
    expect(m.get('perfectWeeks')).toBe(1);
    expect(m.get('activeDays')).toBe(9);
    expect(m.get('weekendGoalDays')).toBe(2);
    expect(m.get('earlyEvents')).toBe(1);
    expect(m.get('lateEvents')).toBe(1);
  });

  it('counts XP, best day and best 7 days', () => {
    const log = [lesson(1, 'a', 0, 10), task(1, 'opp', 'p', {}), task(2, 'opp', 'p'), task(10, 'opp', 'p')];
    const m = computeBadgeMetrics(log, now, TZ, DEPS());
    expect(m.get('xpTotal')).toBe(70);
    expect(m.get('bestDayXp')).toBe(30);
    expect(m.get('best7DayXp')).toBe(50);
  });

  it('counts lessons: distinct, perfect, reviews, days and stage completion', () => {
    const start = LOADED_LESSONS.lessons.filter((l) => l.stage === 'start');
    const log = [
      ...start.map((l, i) => lesson(1 + i, l.id, l.questions.length)),
      lesson(9, start[0]!.id, 2, 0),
    ];
    const m = computeBadgeMetrics(log, now, TZ, DEPS());
    expect(m.get('lessonsDistinct')).toBe(start.length);
    expect(m.get('lessonsPerfect')).toBe(start.length);
    expect(m.get('lessonReviews')).toBe(1);
    expect(m.get('lessonDays')).toBe(start.length + 1);
    expect(m.get('lessonStage:start')).toBe(start.length);
    expect(m.get('lessonsAll')).toBe(0);
  });

  it('counts work: tasks, distinct customers and NPP, notes, multi-task days, quick closes and loyal care', () => {
    const log = [
      added(1, 'a'), added(1, 'b'),
      task(3, 'new_customer', 'a'), task(4, 'new_customer', 'a'), task(20, 'new_customer', 'b'),
      task(5, 'new_npp', 'a'),
      ...[6, 7, 8, 9, 10].map((d) => task(d, 'follow_up', 'b', { note: 'ok' })),
      task(11, 'contact', 'a'), task(11, 'demo', 'a'), task(11, 'opp', 'a'),
    ];
    const m = computeBadgeMetrics(log, now, TZ, DEPS());
    expect(m.get('customersDistinct')).toBe(2);
    expect(m.get('sponsoredDistinct')).toBe(1);
    expect(m.get('task:follow_up')).toBe(5);
    expect(m.get('notes')).toBe(5);
    expect(m.get('multiTaskDays')).toBe(1);
    expect(m.get('quickCloses')).toBe(1);
    expect(m.get('loyalCare')).toBe(1);
    expect(m.get('contacts')).toBe(2);
    expect(m.get('f1Now')).toBe(1);
  });

  it('leaves out undone events and other household members, counts the household', () => {
    const done = task(3, 'demo', 'a');
    const log = [added(1, 'a'), done, ev('activity_logged', at(3), { compensates: done.id }), task(4, 'demo', 'a', {}, 10)];
    log[3] = { ...log[3]!, userId: 'spouse' };
    const m = computeBadgeMetrics(log, now, TZ, DEPS({ others: new Set(['spouse']), householdMembers: 1 }));
    expect(m.get('task:demo') ?? 0).toBe(0);
    expect(m.get('householdMembers')).toBe(1);
  });
});

describe('rows and achieved items', () => {
  const parsed = parseBadges(badgesJson, LOADED_STAGES, LOADED_LESSONS.lessons);

  it('marks reached tiers and builds one achieved item per tier', () => {
    const metrics = new Map([['streakBest', 8]]);
    const rows = badgeRows(parsed.defs, metrics);
    const streak = rows.find((r) => r.def.id === 'streak');
    expect(streak).toMatchObject({ value: 8, reached: 2, next: 14 });
    const ids = achievedBadgeItems(rows).map((a) => a.id);
    expect(ids).toEqual(['badge:streak:3', 'badge:streak:7']);
    expect(achievedBadgeItems(rows)[1]).toMatchObject({ kind: 'badge', name: 'Chuỗi 7 ngày', itemId: 'streak' });
  });

  it('colours tiers from bronze to diamond, a single-step badge is gold', () => {
    expect([0, 1, 2, 3].map((i) => tierColor(i, 4))).toEqual([1, 2, 3, 4]);
    expect([0, 7].map((i) => tierColor(i, 8))).toEqual([1, 4]);
    expect(tierColor(0, 1)).toBe(3);
    expect([0, 1, 2].map((i) => tierColor(i, 3))).toEqual([2, 3, 4]);
  });
});
