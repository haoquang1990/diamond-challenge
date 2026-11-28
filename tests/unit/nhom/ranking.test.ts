/** Story 071: XP of this week (from Monday, local) and the weekly ranking of the Nhóm. Fixed data only. */
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { computeShareProgress, weekStartKey } from '../../../src/domain/progress';
import { parseNhomRows, weeklyRanking } from '../../../src/data/nhom-service';

const VN = 'Asia/Ho_Chi_Minh';
let n = 0;
const ev = (ts: string, xp: number): LogEvent => ({ id: `e${++n}`, type: 'lesson_completed', timestamp: ts, userId: 'me', schemaVersion: 1, payload: { lessonId: `l${n}`, xp }, syncedAt: null });

describe('weekStartKey', () => {
  it('is the Monday of the local week', () => {
    expect(weekStartKey(new Date('2026-11-28T05:00:00Z'), VN)).toBe('2026-11-23');
    expect(weekStartKey(new Date('2026-11-23T00:30:00+07:00'), VN)).toBe('2026-11-23');
    expect(weekStartKey(new Date('2026-11-29T23:30:00+07:00'), VN)).toBe('2026-11-23');
    expect(weekStartKey(new Date('2026-11-30T00:10:00+07:00'), VN)).toBe('2026-11-30');
  });
});

describe('xpWeek', () => {
  it('counts XP from Monday, not the 7 rolling days', () => {
    const events = [ev('2026-11-22T05:00:00Z', 50), ev('2026-11-23T05:00:00Z', 20), ev('2026-11-28T05:00:00Z', 10)];
    const p = computeShareProgress(events, new Date('2026-11-28T06:00:00Z'), { dailyXpGoal: 30 }, VN);
    expect(p.xpWeek).toBe(30);
    expect(p.weekStart).toBe('2026-11-23');
    expect(p.xp7d).toBe(80);
  });
});

describe('weeklyRanking', () => {
  const people = parseNhomRows([
    { user_id: 's', relation: 'spouse', household_id: 'h', display_name: 'Minh', xp_week: 500, week_start: '2026-11-23', cheered_today: false },
    { user_id: 'd', relation: 'downline', household_id: 'hd', display_name: 'Anh Tuấn', xp_week: 210, week_start: '2026-11-23', cheered_today: false },
    { user_id: 'f', relation: 'friend', household_id: 'hf', display_name: 'Chị Ngọc', xp_week: 320, week_start: '2026-11-23', cheered_today: false, tasks_7d: { contact: 3 }, customers: 2, f1: null },
    { user_id: 'o', relation: 'friend', household_id: 'ho', display_name: 'Anh Cũ', xp_week: 900, week_start: '2026-11-16', cheered_today: false },
    { user_id: 'u', relation: 'upline', household_id: 'hu', display_name: 'Chị Hoa', xp_week: 999, week_start: '2026-11-23', cheered_today: false },
  ]);

  it('reads shared tasks and counts only when given', () => {
    expect(people.find((p) => p.userId === 'f')).toMatchObject({ tasks7d: { contact: 3 }, customers: 2, f1: null });
    expect(people.find((p) => p.userId === 'd')?.tasks7d).toBeNull();
  });

  it('ranks me, my friends and my F1 by XP of this week; last week counts as 0', () => {
    const r = weeklyRanking(people, 180, '2026-11-23');
    expect(r.rows.map((x) => `${x.userId}:${x.xp}`)).toEqual(['f:320', 'd:210', 'me:180', 'o:0']);
    expect(r.myRank).toBe(3);
    expect(r.ahead).toEqual({ userId: 'd', gap: 31 });
  });

  it('first place says by how much I lead', () => {
    const r = weeklyRanking(people, 400, '2026-11-23');
    expect(r.myRank).toBe(1);
    expect(r.ahead).toBeNull();
    expect(r.lead).toBe(80);
  });
});
