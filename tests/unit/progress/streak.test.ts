/**
 * Daily goal + streak derivation (story 002). Fixed instants only: the clock
 * and time zone are passed to computeProgress, never read from the machine.
 */
import { describe, expect, it } from 'vitest';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { computeProgress } from '../../../src/domain/progress';

const CONFIG = { dailyXpGoal: 30 };
const VN = 'Asia/Ho_Chi_Minh';
const NEW_YORK = 'America/New_York';
const LESSON_XP = 10;
const ACTIVITY_XP = 20;

let eventCounter = 0;
/** Builds a stored event fixture; `xp` undefined leaves it out of the payload. */
function ev(type: EventType, timestamp: string, xp: number | undefined, extra: Record<string, unknown> = {}): LogEvent {
  eventCounter += 1;
  return {
    id: `e${eventCounter}`,
    type,
    timestamp,
    userId: 'u',
    schemaVersion: 1,
    payload: xp === undefined ? extra : { xp, ...extra },
    syncedAt: null,
  };
}

/** One goal-met day: a lesson at 09:00 and an activity at 10:00 local (`offset` is the UTC offset suffix). */
function metDay(date: string, offset = 'Z'): LogEvent[] {
  return [
    ev('lesson_completed', `${date}T09:00:00.000${offset}`, LESSON_XP),
    ev('activity_logged', `${date}T10:00:00.000${offset}`, ACTIVITY_XP),
  ];
}

const THREE_DAYS = [...metDay('2026-11-01'), ...metDay('2026-11-02'), ...metDay('2026-11-03')];
const NOV_3_NOON = new Date('2026-11-03T12:00:00Z');

describe('computeProgress', () => {
  it('counts a 3-day streak ending today', () => {
    const p = computeProgress(THREE_DAYS, NOV_3_NOON, CONFIG, VN);
    expect(p.streak).toBe(3);
    expect(p.totalXp).toBe(90);
    expect(p.xpToday).toBe(30);
    expect(p.dailyGoal.met).toBe(true);
  });

  it('keeps the streak while today is not yet met', () => {
    const p = computeProgress(THREE_DAYS, new Date('2026-11-04T05:00:00Z'), CONFIG, VN);
    expect(p.streak).toBe(3);
    expect(p.dailyGoal.met).toBe(false);
    expect(p.xpToday).toBe(0);
  });

  it('resets the streak after a missed day', () => {
    const p = computeProgress(THREE_DAYS, new Date('2026-11-05T05:00:00Z'), CONFIG, VN);
    expect(p.streak).toBe(0);
  });

  it('needs both a Học and a Làm, not just enough XP', () => {
    const p = computeProgress([ev('activity_logged', '2026-11-03T03:00:00Z', 50)], NOV_3_NOON, CONFIG, VN);
    expect(p.dailyGoal.met).toBe(false);
    expect(p.dailyGoal.hasActivity).toBe(true);
    expect(p.dailyGoal.hasLesson).toBe(false);
  });

  it('reads the XP threshold from config', () => {
    const p = computeProgress(metDay('2026-11-03'), NOV_3_NOON, { dailyXpGoal: 31 }, VN);
    expect(p.dailyGoal.met).toBe(false);
    expect(p.dailyGoal.threshold).toBe(31);
  });

  it('uses the local (VN) day boundary, not UTC', () => {
    // 2026-11-02T17:30Z is 00:30 on 2026-11-03 in Ho Chi Minh City.
    const events = [ev('lesson_completed', '2026-11-02T17:30:00Z', 10), ev('activity_logged', '2026-11-02T18:00:00Z', 20)];
    const p = computeProgress(events, NOV_3_NOON, CONFIG, VN);
    expect(p.xpToday).toBe(30);
    expect(p.dailyGoal.met).toBe(true);
  });

  it('keeps a streak across the DST fall-back day (America/New_York, 2026-11-01)', () => {
    const events = [...metDay('2026-10-31', '-04:00'), ...metDay('2026-11-01', '-05:00'), ...metDay('2026-11-02', '-05:00')];
    const p = computeProgress(events, new Date('2026-11-02T23:00:00-05:00'), CONFIG, NEW_YORK);
    expect(p.streak).toBe(3);
  });

  it('keeps a streak across the DST spring-forward day (America/New_York, 2026-03-08)', () => {
    const events = [...metDay('2026-03-07', '-05:00'), ...metDay('2026-03-08', '-04:00'), ...metDay('2026-03-09', '-04:00')];
    const p = computeProgress(events, new Date('2026-03-09T23:30:00-04:00'), CONFIG, NEW_YORK);
    expect(p.streak).toBe(3);
  });

  it('counts a late entry on the day of its own timestamp', () => {
    const events = [
      ...metDay('2026-11-01'),
      ev('lesson_completed', '2026-11-02T02:00:00Z', 10),
      ev('activity_logged', '2026-11-02T03:00:00Z', 20),
      ...metDay('2026-11-03'),
    ];
    const p = computeProgress(events, NOV_3_NOON, CONFIG, VN);
    expect(p.streak).toBe(3);
  });

  it('excludes an event undone via payload.compensates', () => {
    const activity = ev('activity_logged', '2026-11-03T03:00:00Z', 20);
    const events = [
      ev('lesson_completed', '2026-11-03T02:00:00Z', 10),
      activity,
      ev('activity_logged', '2026-11-03T03:01:00Z', undefined, { compensates: activity.id }),
    ];
    const p = computeProgress(events, NOV_3_NOON, CONFIG, VN);
    expect(p.xpToday).toBe(10);
    expect(p.dailyGoal.hasActivity).toBe(false);
  });

  it('is deterministic for the same input', () => {
    const first = computeProgress(THREE_DAYS, NOV_3_NOON, CONFIG, VN);
    const second = computeProgress(THREE_DAYS, NOV_3_NOON, CONFIG, VN);
    expect(second).toEqual(first);
  });

  it('handles an empty log', () => {
    const p = computeProgress([], NOV_3_NOON, CONFIG, VN);
    expect(p.streak).toBe(0);
    expect(p.totalXp).toBe(0);
    expect(p.xpToday).toBe(0);
    expect(p.dailyGoal).toEqual({ met: false, xp: 0, threshold: 30, hasLesson: false, hasActivity: false });
  });
});
