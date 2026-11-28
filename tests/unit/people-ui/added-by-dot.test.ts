/**
 * Làm list dot (story 064): orange when my spouse added the contact, purple when both of us had
 * it before the household books were merged (two contacts merged into one). Fixed data only.
 */
import { expect, it } from 'vitest';
import { derivePeople } from '../../../src/domain/people';
import { FORMER_MEMBER_ID } from '../../../src/data/event-store';
import { addedByDot } from '../../../src/ui/people-helpers';
import { PEOPLE_CONFIG } from '../../../src/ui/people-config';

let n = 0;
const mk = (type: string, ts: string, userId: string, payload: Record<string, unknown>) => ({ id: `e${++n}`, type, timestamp: ts, userId, schemaVersion: 1, payload, syncedAt: null }) as never;
const SPOUSE = new Set(['minh']);
const events = [
  mk('person_added', '2026-11-01T01:00:00.000Z', 'lan', { personId: 'mine', name: 'Anh Bình Thử' }),
  mk('person_added', '2026-11-01T02:00:00.000Z', 'minh', { personId: 'his', name: 'Chị Lan Thử' }),
  mk('person_added', '2026-11-01T03:00:00.000Z', 'lan', { personId: 'a', name: 'Anh Phong Thử' }),
  mk('person_added', '2026-11-02T03:00:00.000Z', 'minh', { personId: 'b', name: 'Anh Phong Thử' }),
  mk('person_merged', '2026-11-03T03:00:00.000Z', 'lan', { keepId: 'a', mergedId: 'b' }),
  mk('person_added', '2026-11-01T04:00:00.000Z', FORMER_MEMBER_ID, { personId: 'gone', name: 'Cô Mai Thử' }),
];
const byId = () => Object.fromEntries(derivePeople(events, PEOPLE_CONFIG).map((p) => [p.personId, p]));

it('records who added each contact, merged ones included', () => {
  const p = byId();
  expect(p.mine!.addedBy).toEqual(['lan']);
  expect(p.his!.addedBy).toEqual(['minh']);
  expect([...p.a!.addedBy!].sort()).toEqual(['lan', 'minh']);
});

it('shows no dot for my own contacts', () => {
  expect(addedByDot(byId().mine!, SPOUSE)).toBeNull();
});

it('shows the spouse dot for a contact my spouse added', () => {
  expect(addedByDot(byId().his!, SPOUSE)).toBe('spouse');
});

it('shows the shared dot when both of us had the contact', () => {
  expect(addedByDot(byId().a!, SPOUSE)).toBe('both');
});

it('shows no dot for a former member or when I have no spouse', () => {
  expect(addedByDot(byId().gone!, SPOUSE)).toBeNull();
  expect(addedByDot(byId().his!, new Set())).toBeNull();
});

it('splitting a merge drops the shared dot', () => {
  const split = [...events, mk('person_merged', '2026-11-04T03:00:00.000Z', 'lan', { compensates: 'e5' })];
  const a = derivePeople(split, PEOPLE_CONFIG).find((p) => p.personId === 'a')!;
  expect(addedByDot(a, SPOUSE)).toBeNull();
});
