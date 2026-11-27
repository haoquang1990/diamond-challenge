// Story 056: each person picks the daily XP goal (20–200, step 5); a change counts from the next day.
import { describe, expect, it } from 'vitest';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { buildXpGoalEvent, computeProgress, readXpGoal, XP_GOAL_RANGE } from '../../../src/domain/progress';

const CONFIG = { dailyXpGoal: 30 };
const VN = 'Asia/Ho_Chi_Minh';
let n = 0;
const ev = (type: EventType, timestamp: string, payload: Record<string, unknown>, userId = 'me'): LogEvent =>
  ({ id: `e${++n}`, type, timestamp, userId, schemaVersion: 1, payload, syncedAt: null }) as LogEvent;
/** A day with a lesson and an activity worth `xp` in total (local VN date YYYY-MM-DD). */
const day = (date: string, xp: number): LogEvent[] => [
  ev('lesson_completed', `${date}T02:00:00.000Z`, { xp: 10, lessonId: 'l' }),
  ev('activity_logged', `${date}T03:00:00.000Z`, { xp: xp - 10, activityType: 'study' }),
];
const goal = (xp: number, from: string, at: string, userId = 'me') => ev('settings_changed', at, { xpGoal: { xp, from } }, userId);
const NOW = new Date('2026-11-27T05:00:00.000Z'); // 12:00 in Việt Nam

describe('per-day goal', () => {
  it('uses the config goal until a choice starts, then the chosen goal from its start day', () => {
    const events = [...day('2026-11-25', 40), ...day('2026-11-26', 40), goal(50, '2026-11-27', '2026-11-26T10:00:00.000Z'), ...day('2026-11-27', 40)];
    const p = computeProgress(events, NOW, CONFIG, VN);
    expect(p.dailyGoal.threshold).toBe(50);
    expect(p.dailyGoal.met).toBe(false); // 40 < 50 today
    expect(p.streak).toBe(2); // 25 and 26 counted with 30
  });

  it('does not change today when picked today (applies from tomorrow)', () => {
    const events = [...day('2026-11-27', 40), goal(100, '2026-11-28', '2026-11-27T04:00:00.000Z')];
    const p = computeProgress(events, NOW, CONFIG, VN);
    expect(p.dailyGoal.threshold).toBe(30);
    expect(p.dailyGoal.met).toBe(true);
  });

  it('ignores a spouse\'s choice and out-of-range values', () => {
    const events = [goal(20, '2026-11-27', '2026-11-26T10:00:00.000Z', 'spouse'), goal(5, '2026-11-27', '2026-11-26T11:00:00.000Z'), ...day('2026-11-27', 25)];
    expect(computeProgress(events, NOW, CONFIG, VN, new Set(['spouse'])).dailyGoal.threshold).toBe(30);
  });
});

describe('readXpGoal and buildXpGoalEvent', () => {
  it('reports today\'s goal and a choice waiting for tomorrow', () => {
    const events = [goal(50, '2026-11-27', '2026-11-26T10:00:00.000Z'), goal(75, '2026-11-28', '2026-11-27T04:00:00.000Z')];
    expect(readXpGoal(events, NOW, CONFIG, VN)).toEqual({ today: { xp: 50, lessons: 1, tasks: 1 }, next: { goal: { xp: 75, lessons: 1, tasks: 1 }, from: '2026-11-28' } });
    expect(readXpGoal([], NOW, CONFIG, VN)).toEqual({ today: { xp: 30, lessons: 1, tasks: 1 }, next: null });
  });

  it('builds a choice starting tomorrow, snapped to the range and step', () => {
    const g = (xp: number) => ({ xp, lessons: 1, tasks: 1 });
    expect(buildXpGoalEvent(g(77), NOW, VN)).toEqual({ type: 'settings_changed', payload: { xpGoal: { xp: 75, lessons: 1, tasks: 1, from: '2026-11-28' } } });
    expect(buildXpGoalEvent(g(5), NOW, VN).payload).toEqual({ xpGoal: { xp: XP_GOAL_RANGE.min, lessons: 1, tasks: 1, from: '2026-11-28' } });
    expect(buildXpGoalEvent(g(999), NOW, VN).payload).toEqual({ xpGoal: { xp: XP_GOAL_RANGE.max, lessons: 1, tasks: 1, from: '2026-11-28' } });
  });
});

describe('lessons and tasks per day (story 062)', () => {
  const lesson = (date: string, h: number) => ev('lesson_completed', `${date}T0${h}:00:00.000Z`, { xp: 10, lessonId: `l${h}` });
  const task = (date: string, h: number) => ev('activity_logged', `${date}T0${h}:30:00.000Z`, { xp: 10, activityType: 'study' });

  it('needs the chosen number of lessons and tasks; old choices without them mean 1 and 1', () => {
    const day = '2026-11-27';
    const events = [goal(30, '2026-11-27', '2026-11-26T10:00:00.000Z'), lesson(day, 1), task(day, 2), task(day, 3)];
    expect(computeProgress(events, NOW, CONFIG, VN).dailyGoal).toMatchObject({ met: true, lessons: 1, lessonsNeeded: 1, tasks: 2, tasksNeeded: 1 });
    const harder = [ev('settings_changed', '2026-11-26T10:00:00.000Z', { xpGoal: { xp: 30, lessons: 2, tasks: 3, from: '2026-11-27' } }), lesson(day, 1), task(day, 2), task(day, 3)];
    expect(computeProgress(harder, NOW, CONFIG, VN).dailyGoal).toMatchObject({ met: false, lessonsNeeded: 2, tasksNeeded: 3 });
  });

  it('0 lessons or 0 tasks drops that part of the goal', () => {
    const day = '2026-11-27';
    const events = [ev('settings_changed', '2026-11-26T10:00:00.000Z', { xpGoal: { xp: 20, lessons: 0, tasks: 2, from: '2026-11-27' } }), task(day, 2), task(day, 3)];
    expect(computeProgress(events, NOW, CONFIG, VN).dailyGoal.met).toBe(true);
  });

  it('reads and builds the full goal', () => {
    const events = [ev('settings_changed', '2026-11-27T04:00:00.000Z', { xpGoal: { xp: 40, lessons: 2, tasks: 0, from: '2026-11-28' } })];
    expect(readXpGoal(events, NOW, CONFIG, VN)).toEqual({ today: { xp: 30, lessons: 1, tasks: 1 }, next: { goal: { xp: 40, lessons: 2, tasks: 0 }, from: '2026-11-28' } });
    expect(buildXpGoalEvent({ xp: 42, lessons: 12, tasks: 3 }, NOW, VN).payload).toEqual({ xpGoal: { xp: 40, lessons: 10, tasks: 3, from: '2026-11-28' } });
  });
});
