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
    expect(computeShareProgress(events, NOW, { dailyXpGoal: 30 }, TZ)).toEqual({ xpTotal: 65, xp7d: 50, streak: 1 });
  });

  it('leaves out undone events and other household members', () => {
    const done = ev('activity_logged', '2026-11-24T02:00:00.000Z', 30, { personId: 'p' });
    const undo = ev('activity_logged', '2026-11-24T03:00:00.000Z', 0, { compensates: done.id });
    const spouse = ev('activity_logged', '2026-11-24T02:00:00.000Z', 20, { personId: 'q' }, 'spouse');
    expect(computeShareProgress([done, undo, spouse], NOW, { dailyXpGoal: 30 }, TZ, new Set(['spouse']))).toEqual({ xpTotal: 0, xp7d: 0, streak: 0 });
  });

  it('is all zero for an empty log', () => {
    expect(computeShareProgress([], NOW, { dailyXpGoal: 30 }, TZ)).toEqual({ xpTotal: 0, xp7d: 0, streak: 0 });
  });
});
