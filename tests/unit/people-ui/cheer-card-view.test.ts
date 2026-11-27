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
    expect(v.kind === 'list' && v.spouses.length).toBe(1);
  });

  it('says everyone is cheered when nobody is left', () => {
    expect(cheerCardView(group([house('a', true)], [{ cheeredToday: true }]), NOW, 3).kind).toBe('done');
  });

  it('is hidden without any F1 or spouse', () => {
    expect(cheerCardView(group([], []), NOW, 3).kind).toBe('hidden');
    expect(cheerCardView(null, NOW, 3).kind).toBe('hidden');
  });

  it('forgets yesterday\'s "cheered" marks in a cached group', () => {
    const yesterday = new Date(2026, 10, 26, 22, 0);
    const v = cheerCardView(group([house('a', true)], [{ cheeredToday: true }], yesterday), NOW, 3);
    expect(v.kind).toBe('list');
    expect(v.kind === 'list' && v.households.length + v.spouses.length).toBe(2);
  });
});
