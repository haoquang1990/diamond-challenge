/**
 * Story 070: cheering earns XP (+5, at most 3 times a local day, not a "Việc làm"), and the Hôm nay
 * Nhóm card: who met today's goal and who to cheer first. Fixed data only.
 */
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { computeProgress } from '../../../src/domain/progress';
import { CHEER_XP, buildCheerXpEvent } from '../../../src/domain/cheer-xp';
import { nhomSummary, parseNhomRows } from '../../../src/data/nhom-service';

const VN = 'Asia/Ho_Chi_Minh';
const NOW = new Date('2026-11-28T05:00:00.000Z');
let n = 0;
const ev = (type: LogEvent['type'], ts: string, payload: LogEvent['payload'], userId = 'me'): LogEvent => ({ id: `e${++n}`, type, timestamp: ts, userId, schemaVersion: 1, payload, syncedAt: null });

describe('buildCheerXpEvent', () => {
  it('gives the configured XP for the first cheers of the day, then nothing', () => {
    const events: LogEvent[] = [];
    for (let i = 0; i < CHEER_XP.maxPerDay; i++) {
      const built = buildCheerXpEvent(events, NOW, VN, new Set(), { toHouseholdId: 'h' });
      expect(built?.payload.xp).toBe(CHEER_XP.xp);
      events.push(ev('cheer_sent', NOW.toISOString(), built!.payload));
    }
    expect(buildCheerXpEvent(events, NOW, VN, new Set(), { toHouseholdId: 'h' })).toBeNull();
  });

  it("counts per local day and ignores my spouse's cheers", () => {
    const yesterday = Array.from({ length: CHEER_XP.maxPerDay }, () => ev('cheer_sent', '2026-11-27T05:00:00.000Z', { xp: CHEER_XP.xp }));
    const spouse = Array.from({ length: CHEER_XP.maxPerDay }, () => ev('cheer_sent', NOW.toISOString(), { xp: CHEER_XP.xp }, 'minh'));
    expect(buildCheerXpEvent([...yesterday, ...spouse], NOW, VN, new Set(['minh']), { toHouseholdId: 'h', toUserId: 'u' })?.payload).toEqual({ xp: CHEER_XP.xp, toHouseholdId: 'h', toUserId: 'u' });
  });
});

describe('cheer XP in progress', () => {
  it("adds to today's XP but is not a Việc làm", () => {
    const p = computeProgress([ev('cheer_sent', NOW.toISOString(), { xp: 5 })], NOW, { dailyXpGoal: 30 }, VN);
    expect(p.xpToday).toBe(5);
    expect(p.dailyGoal.tasks).toBe(0);
  });
});

describe('Nhóm card', () => {
  const today = '2026-11-28';
  const rows = parseNhomRows([
    { user_id: 's', relation: 'spouse', household_id: 'hm', display_name: 'Minh', code: '7000000001', streak: 6, goal_today: true, stats_day: today, xp_7d: 140, last_seen_at: null, cheered_today: false },
    { user_id: 'u', relation: 'upline', household_id: 'hs', display_name: 'Chị Hoa', code: null, streak: 12, goal_today: false, stats_day: today, xp_7d: 210, last_seen_at: null, cheered_today: true },
    { user_id: 'd', relation: 'downline', household_id: 'hd', display_name: 'Anh Phong', code: null, streak: 5, goal_today: false, stats_day: today, xp_7d: 40, last_seen_at: null, cheered_today: false },
    { user_id: 'f', relation: 'friend', household_id: 'hf', display_name: 'Anh Khoa', code: null, streak: 0, goal_today: true, stats_day: '2026-11-27', xp_7d: 15, last_seen_at: '2026-11-25T05:00:00.000Z', cheered_today: false },
    { user_id: 'x', relation: 'boss' },
  ]);

  it("reads rows, dropping unknown relations, and a goal of another day is not today's", () => {
    expect(rows.map((r) => r.userId)).toEqual(['s', 'u', 'd', 'f']);
    expect(rows.find((r) => r.userId === 'f')?.goalToday).toBe(true);
  });

  it('counts who met today and lists who to cheer: losing a streak first, then by relation', () => {
    const s = nhomSummary(rows, today, NOW, 3);
    expect(s.total).toBe(4);
    expect(s.met).toBe(1);
    expect(s.avatars.map((a) => a.userId)).toEqual(['s', 'd', 'u', 'f']);
    expect(s.needs.map((r) => r.userId)).toEqual(['d', 'u', 'f']);
    expect(s.needs[2]?.daysAway).toBe(3);
  });

  it('shows at most the asked number', () => {
    expect(nhomSummary(rows, today, NOW, 1).needs.map((r) => r.userId)).toEqual(['d']);
  });
});
