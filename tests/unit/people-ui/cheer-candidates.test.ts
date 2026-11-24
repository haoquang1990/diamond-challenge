// Hôm nay "Cổ vũ nhóm" (story 041): which F1 households the card lists, and in what order.
import { describe, expect, it } from 'vitest';
import type { GroupHousehold } from '../../../src/data/group-service';
import { cheerCandidates, householdActivityNote, householdNames } from '../../../src/ui/group-helpers';

const NOW = new Date('2026-11-24T05:00:00.000Z');
const INACTIVE_DAYS = 7;
const house = (id: string, lastActivityAt: string | null, cheeredToday = false): GroupHousehold =>
  ({ householdId: id, code: null, members: [], memberCount: 1, lastActivityAt, numbers: null, cheeredToday }) as unknown as GroupHousehold;

describe('cheerCandidates', () => {
  it('lists households not cheered today, inactive and never-active first', () => {
    const list = [house('active', '2026-11-23T00:00:00.000Z'), house('old', '2026-11-01T00:00:00.000Z'), house('never', null), house('done', null, true)];
    expect(cheerCandidates(list, NOW, INACTIVE_DAYS).map((h) => h.householdId)).toEqual(['old', 'never', 'active']);
  });

  it('is empty when every household was cheered today or there is none', () => {
    expect(cheerCandidates([house('a', null, true)], NOW, INACTIVE_DAYS)).toEqual([]);
    expect(cheerCandidates([], NOW, INACTIVE_DAYS)).toEqual([]);
  });
});

describe('householdActivityNote', () => {
  it('names the inactive days, never-active, or nothing when active', () => {
    expect(householdActivityNote(house('a', '2026-11-14T05:00:00.000Z'), NOW, INACTIVE_DAYS)).toBe('10 ngày chưa hoạt động');
    expect(householdActivityNote(house('a', null), NOW, INACTIVE_DAYS)).toBe('Chưa hoạt động lần nào');
    expect(householdActivityNote(house('a', '2026-11-23T05:00:00.000Z'), NOW, INACTIVE_DAYS)).toBeNull();
  });
});

describe('householdNames (2026-11-24)', () => {
  const h = (members: { userId: string; displayName: string | null; phone: string | null }[], code: string | null = '1234567890') =>
    ({ householdId: 'h', code, members, memberCount: members.length, lastActivityAt: null, numbers: null, cheeredToday: false }) as unknown as GroupHousehold;
  const LINKED = new Map([['u1', 'Anh Bình']]);
  const BY_CODE = new Map([['1234567890', 'Chị Hoa']]);

  it('shows both spouses joined with &', () => {
    expect(householdNames(h([{ userId: 'u1', displayName: null, phone: '+849' }, { userId: 'u2', displayName: 'Chị Mai', phone: '+848' }]), LINKED)).toBe('Anh Bình & Chị Mai');
  });

  it('uses my contact name for the household code when no member has a name', () => {
    expect(householdNames(h([{ userId: 'x', displayName: null, phone: '+849' }]), new Map(), BY_CODE)).toBe('Chị Hoa');
    expect(householdNames(h([{ userId: 'x', displayName: null, phone: '+849' }, { userId: 'y', displayName: null, phone: '+848' }]), new Map(), BY_CODE)).toBe('Chị Hoa & +848');
  });

  it('gives the code name to the unnamed member when the spouse has a name', () => {
    expect(householdNames(h([{ userId: 'x', displayName: null, phone: '+849' }, { userId: 'y', displayName: 'Chị Mai', phone: '+848' }]), new Map(), BY_CODE)).toBe('Chị Hoa & Chị Mai');
  });

  it('falls back to the phone without any name', () => {
    expect(householdNames(h([{ userId: 'x', displayName: null, phone: '+849' }], null), new Map(), BY_CODE)).toBe('+849');
  });
});
