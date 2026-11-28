/**
 * Story 066: who looks after a contact ("Phụ trách"), the dot and the "Của tôi / Của Minh"
 * filter that follow it, and the remembered filter. Fixed data only.
 */
import { describe, expect, it } from 'vitest';
import { derivePeople } from '../../../src/domain/people';
import { FORMER_MEMBER_ID } from '../../../src/data/event-store';
import { PEOPLE_CONFIG } from '../../../src/ui/people-config';
import { addedByDot, buildOwnerChange, filterByOwner, ownerChoice, readOwnerFilter } from '../../../src/ui/people-helpers';

let n = 0;
const mk = (type: string, ts: string, userId: string, payload: Record<string, unknown>) => ({ id: `e${++n}`, type, timestamp: ts, userId, schemaVersion: 1, payload, syncedAt: null }) as never;
// As in the app: otherMemberIds always holds the former-member id too.
const OTHERS = new Set(['minh', FORMER_MEMBER_ID]);
const base = () => {
  n = 0;
  return [
    mk('person_added', '2026-11-01T01:00:00.000Z', 'lan', { personId: 'mine', name: 'Anh Bình Thử' }),
    mk('person_added', '2026-11-01T02:00:00.000Z', 'minh', { personId: 'his', name: 'Chị Lan Thử' }),
    mk('person_added', '2026-11-01T03:00:00.000Z', 'lan', { personId: 'forHim', name: 'Chú Hùng Thử' }),
    mk('person_added', '2026-11-01T04:00:00.000Z', FORMER_MEMBER_ID, { personId: 'gone', name: 'Cô Mai Thử' }),
  ];
};
const people = (events: never[]) => Object.fromEntries(derivePeople(events, PEOPLE_CONFIG).map((p) => [p.personId, p]));

describe('Phụ trách', () => {
  it('defaults to whoever added the contact', () => {
    const p = people(base());
    expect(ownerChoice(p.mine!, OTHERS)).toBe('me');
    expect(ownerChoice(p.his!, OTHERS)).toBe('spouse');
    expect(ownerChoice(p.gone!, OTHERS)).toBe('me');
  });

  it('follows the latest change, made by either of us', () => {
    const ev = [
      ...base(),
      mk('person_updated', '2026-11-02T00:00:00.000Z', 'lan', buildOwnerChange('forHim', 'spouse', 'lan', 'minh').payload as never),
      mk('person_updated', '2026-11-03T00:00:00.000Z', 'minh', buildOwnerChange('his', 'both', 'lan', 'minh').payload as never),
    ];
    const p = people(ev as never[]);
    expect(p.forHim!.owners).toEqual(['minh']);
    expect(addedByDot(p.forHim!, OTHERS)).toBe('spouse');
    expect(ownerChoice(p.his!, OTHERS)).toBe('both');
    expect(addedByDot(p.his!, OTHERS)).toBe('both');
  });

  it('a name or phone edit keeps the owner', () => {
    const ev = [...base(), mk('person_updated', '2026-11-02T00:00:00.000Z', 'lan', { personId: 'his', name: 'Chị Lan Thử Mới' })];
    expect(ownerChoice(people(ev as never[]).his!, OTHERS)).toBe('spouse');
  });

  it('builds owners for each choice', () => {
    expect(buildOwnerChange('p', 'me', 'lan', 'minh').payload).toEqual({ personId: 'p', owners: ['lan'] });
    expect(buildOwnerChange('p', 'both', 'lan', 'minh').payload).toEqual({ personId: 'p', owners: ['lan', 'minh'] });
  });
});

describe('filterByOwner', () => {
  const ev = [...base(), mk('person_updated', '2026-11-02T00:00:00.000Z', 'lan', { personId: 'forHim', owners: ['lan', 'minh'] })];
  const list = derivePeople(ev as never[], PEOPLE_CONFIG);
  const ids = (f: 'all' | 'mine' | 'spouse') => filterByOwner(list, f, OTHERS).map((p) => p.personId).sort();

  it('Của tôi has mine, shared and former members\' contacts', () => {
    expect(ids('mine')).toEqual(['forHim', 'gone', 'mine']);
  });

  it('Của Minh has his and shared contacts', () => {
    expect(ids('spouse')).toEqual(['forHim', 'his']);
  });

  it('Tất cả, or no spouse, keeps everyone', () => {
    expect(ids('all')).toHaveLength(4);
    expect(filterByOwner(list, 'spouse', new Set([FORMER_MEMBER_ID]))).toHaveLength(4);
  });
});

describe('readOwnerFilter', () => {
  it('is my latest choice, not my spouse\'s, defaulting to Tất cả', () => {
    expect(readOwnerFilter(base(), OTHERS)).toBe('all');
    const ev = [
      ...base(),
      mk('settings_changed', '2026-11-02T00:00:00.000Z', 'lan', { contactSort: 'recent', contactOwner: 'mine' }),
      mk('settings_changed', '2026-11-03T00:00:00.000Z', 'minh', { contactSort: 'recent', contactOwner: 'spouse' }),
      mk('settings_changed', '2026-11-04T00:00:00.000Z', 'lan', { contactSort: 'name' }),
    ];
    expect(readOwnerFilter(ev, OTHERS)).toBe('mine');
  });
});
