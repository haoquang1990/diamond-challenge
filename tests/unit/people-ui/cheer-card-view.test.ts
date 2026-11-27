// 2026-11-27: the cheer card shows at once from the cache, and says so when everyone was cheered.
import { describe, expect, it } from 'vitest';
import type { GroupData, GroupHousehold } from '../../../src/data/group-service';
import { cheerCardView } from '../../../src/ui/group-helpers';

const NOW = new Date(2026, 10, 27, 9, 0);
const house = (id: string, cheeredToday: boolean): GroupHousehold =>
  ({ householdId: id, code: id, lastActivityAt: NOW.toISOString(), numbers: null, cheeredToday, memberCount: 1, members: [] }) as unknown as GroupHousehold;
const group = (households: GroupHousehold[], spouses: { cheeredToday: boolean }[], loadedAt = NOW): GroupData =>
  ({ myHouseholdId: 'me', maxMembers: 2, households, spouses: spouses.map((s, i) => ({ userId: `s${i}`, displayName: 'Minh', phone: null, ...s })), loadedAt: loadedAt.toISOString() }) as unknown as GroupData;

describe('cheerCardView', () => {
  it('lists who is not cheered yet', () => {
    const v = cheerCardView(group([house('a', true), house('b', false)], [{ cheeredToday: false }]), NOW, 3);
    expect(v.kind).toBe('list');
    expect(v.kind === 'list' && v.households.map((h) => h.householdId)).toEqual(['b']);
  });

  it('says everyone is cheered when nobody is left', () => {
    expect(cheerCardView(group([house('a', true)], [{ cheeredToday: true }]), NOW, 3).kind).toBe('done');
  });

  it('is hidden without any F1 (the spouse has its own card since story 061)', () => {
    expect(cheerCardView(group([], []), NOW, 3).kind).toBe('hidden');
    expect(cheerCardView(group([], [{ cheeredToday: false }]), NOW, 3).kind).toBe('hidden');
    expect(cheerCardView(null, NOW, 3).kind).toBe('hidden');
  });

  it('forgets yesterday\'s "cheered" marks in a cached group', () => {
    const yesterday = new Date(2026, 10, 26, 22, 0);
    const v = cheerCardView(group([house('a', true)], [{ cheeredToday: true }], yesterday), NOW, 3);
    expect(v.kind).toBe('list');
    expect(v.kind === 'list' && v.households.length).toBe(1);
  });
});

describe('spouseCard (story 061)', () => {
  it('shows each spouse with today\'s goal, streak, 7-day XP and last open; no numbers yet is said', async () => {
    const { spouseCard } = await import('../../../src/ui/group-helpers');
    const withNumbers = { userId: 's1', displayName: 'Minh', phone: null, cheeredToday: false, progress: { xpTotal: 900, xp7d: 210, streak: 6, updatedAt: NOW.toISOString(), statsDay: '2026-11-27', goalToday: true, lastSeenAt: NOW.toISOString() } };
    const without = { userId: 's2', displayName: null, phone: '+84922222222', cheeredToday: true, progress: null };
    expect(spouseCard([withNumbers, without] as never, NOW)).toEqual([
      { userId: 's1', goalToday: true, streak: 6, xp7d: 210, lastSeenAt: NOW.toISOString(), cheeredToday: false },
      { userId: 's2', goalToday: false, streak: 0, xp7d: null, lastSeenAt: null, cheeredToday: true },
    ]);
  });
});
