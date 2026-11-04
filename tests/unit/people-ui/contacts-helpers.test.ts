import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import type { PeopleConfig, Person } from '../../../src/domain/people';
import { buildPersonHistory, countContacts, filterContacts, formatPhone } from '../../../src/ui/people-helpers';

const CONFIG: PeopleConfig = {
  stages: [
    { id: 'a', name: 'A', xp: 0 },
    { id: 'b', name: 'B', xp: 5 },
  ],
  targets: { contactsTarget: 1, customersTarget: 1, f1Target: 1 },
};

function person(over: Partial<Person>): Person {
  return { personId: 'p', name: 'P', note: '', archived: false, stageId: 'a', stageXpAwarded: [], ...over };
}

function ev(id: string, type: LogEvent['type'], timestamp: string, payload: LogEvent['payload']): LogEvent {
  return { id, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}

const PEOPLE: Person[] = [
  person({ personId: '1', label: 'KH', lastContactAt: '2026-01-05T00:00:00.000Z' }),
  person({ personId: '2', label: 'NPP', nppAt: '2026-01-02T00:00:00.000Z' }),
  person({ personId: '3', label: 'KH', lastContactAt: '2026-01-01T00:00:00.000Z' }),
  person({ personId: '4', label: 'NPP', nppAt: '2026-01-09T00:00:00.000Z' }),
  person({ personId: '5', archived: true, label: 'NPP', nppAt: '2026-01-03T00:00:00.000Z' }),
  person({ personId: '6' }),
];

describe('filterContacts', () => {
  it('all: non-archived, newest added first, each person exactly once', () => {
    expect(filterContacts(PEOPLE, 'all').map((p) => p.personId)).toEqual(['6', '4', '3', '2', '1']);
  });
  it('kh: longest without contact first', () => {
    expect(filterContacts(PEOPLE, 'kh').map((p) => p.personId)).toEqual(['3', '1']);
  });
  it('npp: newest NPP first, archived excluded', () => {
    expect(filterContacts(PEOPLE, 'npp').map((p) => p.personId)).toEqual(['4', '2']);
  });
  it('archived: only archived people', () => {
    expect(filterContacts(PEOPLE, 'archived').map((p) => p.personId)).toEqual(['5']);
  });
  it('counts match the lists', () => {
    expect(countContacts(PEOPLE)).toEqual({ all: 5, kh: 2, npp: 2, archived: 1 });
  });
});

describe('formatPhone', () => {
  it('formats country and number, empty when none', () => {
    expect(formatPhone({ country: '+84', number: '912345678' })).toBe('+84 912345678');
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
  });
});

describe('buildPersonHistory', () => {
  const events: LogEvent[] = [
    ev('e1', 'person_added', '2026-01-01T00:00:00.000Z', { personId: 'p', name: 'P' }),
    ev('e2', 'activity_logged', '2026-01-02T00:00:00.000Z', { activityType: 'demo', taskId: 'demo', xp: 10, personId: 'p' }),
    ev('e3', 'activity_logged', '2026-01-03T00:00:00.000Z', { activityType: 'contact', taskId: 'contact', xp: 5, personId: 'p' }),
    ev('e4', 'activity_logged', '2026-01-04T00:00:00.000Z', { compensates: 'e3' }),
    ev('e5', 'person_stage_changed', '2026-01-05T00:00:00.000Z', { personId: 'p', from: 'a', to: 'b', xp: 5 }),
    ev('e6', 'activity_logged', '2026-01-06T00:00:00.000Z', { activityType: 'demo', xp: 10, personId: 'other' }),
  ];
  it('lists own non-compensated activities and stage changes, newest first', () => {
    const h = buildPersonHistory(events, 'p', CONFIG, [{ id: 'demo', name: 'Demo' }]);
    expect(h.map((x) => [x.id, x.kind, x.name])).toEqual([
      ['e5', 'stage', 'B'],
      ['e2', 'activity', 'Demo'],
    ]);
  });
});
