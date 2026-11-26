// Story 052: the Làm list order (synced per account) and the day count on each row.
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { isPersonalProgressEvent } from '../../../src/data/progress-sync';
import type { Person } from '../../../src/domain/people';
import { CONTACT_SORTS, readContactSort, sortContacts } from '../../../src/ui/people-helpers';

const p = (personId: string, name: string, over: Partial<Person> = {}): Person =>
  ({ personId, name, note: '', archived: false, stageId: 's', stageXpAwarded: [], label: null, phone: null, amwayCode: null, ...over }) as Person;

// Log order = order added: An (oldest), Bình, Chi, Dũng (newest).
const AN = p('a', 'Ánh', { lastContactAt: '2026-11-20T01:00:00.000Z' });
const BINH = p('b', 'Bình', { lastContactAt: '2026-11-25T01:00:00.000Z', label: 'NPP', nppAt: '2026-11-01T00:00:00.000Z', amwayCode: '111' });
const CHI = p('c', 'chi', {});
const DUNG = p('d', 'Dũng', { lastContactAt: '2026-11-10T01:00:00.000Z', label: 'NPP', nppAt: '2026-11-15T00:00:00.000Z', amwayCode: '222' });
const ALL = [AN, BINH, CHI, DUNG];
const ids = (xs: readonly Person[]) => xs.map((x) => x.personId);

describe('sortContacts', () => {
  it('recent: latest activity first, never-contacted last (newest added first among them)', () => {
    expect(ids(sortContacts(ALL, ALL, 'recent'))).toEqual(['b', 'a', 'd', 'c']);
  });

  it('stale: never-contacted first, then the oldest activity', () => {
    expect(ids(sortContacts(ALL, ALL, 'stale'))).toEqual(['c', 'd', 'a', 'b']);
  });

  it('name: Vietnamese alphabetical, ignoring case and marks', () => {
    expect(ids(sortContacts(ALL, ALL, 'name'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('added: newest added first, whatever order the shown list had', () => {
    expect(ids(sortContacts([AN, DUNG, CHI], ALL, 'added'))).toEqual(['d', 'c', 'a']);
  });

  it('NPP sorts: newest sponsored first; XP sorts use the F1 numbers', () => {
    const npp = [BINH, DUNG];
    expect(ids(sortContacts(npp, ALL, 'nppNewest'))).toEqual(['d', 'b']);
    const progress = new Map([['111', { xpTotal: 900, xp7d: 10, streak: 0 }], ['222', { xpTotal: 100, xp7d: 50, streak: 2 }]]);
    expect(ids(sortContacts(npp, ALL, 'xpTotal', progress))).toEqual(['b', 'd']);
    expect(ids(sortContacts(npp, ALL, 'xp7d', progress))).toEqual(['d', 'b']);
  });
});

const ev = (id: string, payload: Record<string, unknown>, userId = 'me', type: LogEvent['type'] = 'settings_changed'): LogEvent =>
  ({ id, type, timestamp: `2026-11-2${id.length}T00:00:00.000Z`, userId, schemaVersion: 1, syncedAt: null, payload }) as unknown as LogEvent;

describe('readContactSort', () => {
  it('is recent by default and follows my latest valid choice', () => {
    expect(readContactSort([], new Set())).toBe('recent');
    expect(readContactSort([ev('1', { contactSort: 'name' }), ev('22', { contactSort: 'stale' })], new Set())).toBe('stale');
  });

  it('ignores unknown values and a spouse\'s choice', () => {
    expect(readContactSort([ev('1', { contactSort: 'name' }), ev('22', { contactSort: 'bogus' })], new Set())).toBe('name');
    expect(readContactSort([ev('1', { contactSort: 'name' }), ev('22', { contactSort: 'stale' }, 'spouse')], new Set(['spouse']))).toBe('name');
  });

  it('lists every choice once', () => {
    expect(new Set(CONTACT_SORTS).size).toBe(CONTACT_SORTS.length);
  });
});

describe('sync', () => {
  it('pushes the choice with the personal progress stream', () => {
    expect(isPersonalProgressEvent({ type: 'settings_changed', payload: { contactSort: 'name' } }, new Map())).toBe(true);
  });
});
