/**
 * Story 044: the three numbers an account shares with its sponsor (total XP, XP of the last 7
 * local days including today, current streak). Fixed instants and time zone.
 */
import { describe, expect, it } from 'vitest';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { computeShareProgress } from '../../../src/domain/progress';

const TZ = 'Asia/Ho_Chi_Minh';
const NOW = new Date('2026-11-24T05:00:00.000Z'); // 12:00 local, 24 Nov
let n = 0;
const ev = (type: EventType, timestamp: string, xp: number, extra: Record<string, unknown> = {}, userId = 'me'): LogEvent => ({
  id: `p${++n}`, type, timestamp, userId, schemaVersion: 1, payload: { xp, ...extra }, syncedAt: null,
});

describe('computeShareProgress', () => {
  it('sums all XP, the last 7 local days (today included) and keeps the streak', () => {
    const events = [
      ev('lesson_completed', '2026-11-24T01:00:00.000Z', 10, { lessonId: 'a' }), // today
      ev('activity_logged', '2026-11-24T02:00:00.000Z', 30, { personId: 'p' }), // today
      ev('lesson_completed', '2026-11-18T01:00:00.000Z', 10, { lessonId: 'b' }), // 18 Nov local: 6 days ago, inside
      ev('lesson_completed', '2026-11-17T16:30:00.000Z', 15, { lessonId: 'c' }), // 23:30 on 17 Nov local: 7 days ago, outside
    ];
    expect(computeShareProgress(events, NOW, { dailyXpGoal: 30 }, TZ)).toMatchObject({ xpTotal: 65, xp7d: 50, streak: 1 });
  });

  it('leaves out undone events and other household members', () => {
    const done = ev('activity_logged', '2026-11-24T02:00:00.000Z', 30, { personId: 'p' });
    const undo = ev('activity_logged', '2026-11-24T03:00:00.000Z', 0, { compensates: done.id });
    const spouse = ev('activity_logged', '2026-11-24T02:00:00.000Z', 20, { personId: 'q' }, 'spouse');
    expect(computeShareProgress([done, undo, spouse], NOW, { dailyXpGoal: 30 }, TZ, new Set(['spouse']))).toMatchObject({ xpTotal: 0, xp7d: 0, streak: 0 });
  });

  it('is all zero for an empty log', () => {
    expect(computeShareProgress([], NOW, { dailyXpGoal: 30 }, TZ)).toMatchObject({ xpTotal: 0, xp7d: 0, streak: 0 });
  });
});

describe('computeShareProgress extra numbers (story 050)', () => {
  const NOW2 = new Date('2026-11-24T05:00:00.000Z');
  const task = (ts: string, taskId: string, xp = 20) => ev('activity_logged', ts, xp, { personId: 'p', taskId, activityType: taskId });
  const lesson = (ts: string, id: string, xp = 10) => ev('lesson_completed', ts, xp, { lessonId: id });
  const ack = (ts: string, id: string, silent = false) => ({ ...ev('settings_changed', ts, 0), payload: { achievementAcknowledged: id, ...(silent ? { silent: true } : {}) } });

  it('reports today\'s goal, active days, tasks and badges of the last 7 days, lessons and the local day', () => {
    const events = [
      lesson('2026-11-24T01:00:00.000Z', 'a'), task('2026-11-24T02:00:00.000Z', 'demo'),
      task('2026-11-20T02:00:00.000Z', 'contact'), task('2026-11-20T03:00:00.000Z', 'new_customer'),
      task('2026-11-10T02:00:00.000Z', 'opp'), lesson('2026-11-10T01:00:00.000Z', 'b'),
      ack('2026-11-23T02:00:00.000Z', 'badge:task-demo:1'), ack('2026-11-23T02:00:00.000Z', 'badge:streak:3', true), ack('2026-11-01T02:00:00.000Z', 'badge:lessons:10'),
    ];
    const r = computeShareProgress(events, NOW2, { dailyXpGoal: 30 }, TZ);
    expect(r).toMatchObject({
      statsDay: '2026-11-24',
      goalToday: true,
      activeDays7d: 2,
      tasks7d: { contact: 1, demo: 1, opp: 0, new_customer: 1, new_npp: 0 },
      lessonsDistinct: 2,
      lastLessonAt: '2026-11-24T01:00:00.000Z',
      badges7d: 1,
    });
  });

  it('is empty for an empty log', () => {
    expect(computeShareProgress([], NOW2, { dailyXpGoal: 30 }, TZ)).toMatchObject({ goalToday: false, activeDays7d: 0, lessonsDistinct: 0, lastLessonAt: null, badges7d: 0 });
  });
});
