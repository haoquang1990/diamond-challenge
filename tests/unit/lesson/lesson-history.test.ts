// Bài đã học được lưu (2026-11-24): the Học list shows how many times a lesson was learned and when last.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { lessonHistory } from '../../../src/domain/lesson';

const done = (id: string, lessonId: string, timestamp: string, xp = 10): LogEvent => ({
  id, type: 'lesson_completed', timestamp, userId: 'u', schemaVersion: 1, syncedAt: null, payload: { lessonId, xp },
});

describe('lessonHistory', () => {
  it('counts completions that earned XP and keeps the latest time', () => {
    const log = [done('a', 'L1', '2026-11-20T02:00:00.000Z'), done('b', 'L1', '2026-11-22T02:00:00.000Z'), done('c', 'L2', '2026-11-21T02:00:00.000Z')];
    expect(lessonHistory(log, 'L1')).toEqual({ count: 2, lastAt: '2026-11-22T02:00:00.000Z' });
  });

  it('ignores same-day zero-XP replays and undone completions', () => {
    const undone = done('b', 'L1', '2026-11-22T02:00:00.000Z');
    const undo: LogEvent = { ...undone, id: 'u1', payload: { compensates: 'b' } };
    const log = [done('a', 'L1', '2026-11-20T02:00:00.000Z'), done('z', 'L1', '2026-11-20T03:00:00.000Z', 0), undone, undo];
    expect(lessonHistory(log, 'L1')).toEqual({ count: 1, lastAt: '2026-11-20T02:00:00.000Z' });
  });

  it('returns zero and null for a lesson never learned', () => {
    expect(lessonHistory([], 'L9')).toEqual({ count: 0, lastAt: null });
  });
});
