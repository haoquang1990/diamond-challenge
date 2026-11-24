// Story 044: household progress (members added up, best streak) and ranking NPP contacts by it.
import { describe, expect, it } from 'vitest';
import type { GroupHousehold, MemberProgress } from '../../../src/data/group-service';
import { householdProgress, householdProgressLabel, progressByCode, sortNppByProgress } from '../../../src/ui/group-helpers';

const mp = (xpTotal: number, xp7d: number, streak: number): MemberProgress => ({ xpTotal, xp7d, streak, updatedAt: '2026-11-24T00:00:00.000Z' });
const house = (code: string | null, ...progress: (MemberProgress | null)[]): GroupHousehold =>
  ({
    householdId: `h-${code}`, code, lastActivityAt: null, numbers: null, cheeredToday: false, memberCount: progress.length,
    members: progress.map((p, i) => ({ userId: `u${i}`, displayName: null, phone: null, progress: p })),
  }) as unknown as GroupHousehold;

describe('householdProgress', () => {
  it("adds both spouses' XP and keeps the best streak", () => {
    expect(householdProgress(house('1', mp(100, 20, 3), mp(50, 40, 5)))).toEqual({ xpTotal: 150, xp7d: 60, streak: 5 });
  });

  it('counts only members who sent numbers, null when nobody did', () => {
    expect(householdProgress(house('1', mp(10, 5, 1), null))).toEqual({ xpTotal: 10, xp7d: 5, streak: 1 });
    expect(householdProgress(house('1', null))).toBeNull();
  });
});

describe('sortNppByProgress', () => {
  const people = [{ id: 'a', amwayCode: '1' }, { id: 'b', amwayCode: '2' }, { id: 'c', amwayCode: null }, { id: 'd', amwayCode: '3' }];
  const map = progressByCode([house('1', mp(100, 5, 0)), house('2', mp(50, 40, 2)), house('3', mp(100, 40, 1))]);

  it('ranks by total XP, ties keep the given order, contacts without numbers last', () => {
    expect(sortNppByProgress(people, map, 'xpTotal').map((p) => p.id)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('ranks by 7-day XP', () => {
    expect(sortNppByProgress(people, map, 'xp7d').map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('keeps the given order for newest', () => {
    expect(sortNppByProgress(people, map, 'newest').map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('householdProgressLabel', () => {
  it('shows 7-day XP, total and streak', () => {
    expect(householdProgressLabel({ xpTotal: 2340, xp7d: 120, streak: 5 })).toBe('XP 7 ngày 120 · Tổng 2.340 XP · Chuỗi 5 ngày');
  });
});
