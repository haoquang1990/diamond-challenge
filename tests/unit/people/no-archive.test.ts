/**
 * Lưu trữ removed (story 043): an archived contact is listed again, can do tasks and counts in
 * the numbers as before it was archived. Old archive events are still read without error.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { buildTaskCompletionEvent, computePeopleStats, derivePeople, parsePeopleConfig, pendingTasks } from '../../../src/domain/people';
import { CONTACTS_FILTERS, filterContacts } from '../../../src/ui/people-helpers';

const CONFIG = parsePeopleConfig(gameConfig);
let n = 0;
const ev = (type: EventType, payload: Record<string, unknown>, ts = '2026-03-01T00:00:00.000Z'): LogEvent => ({
  id: `a${++n}`, type, timestamp: ts, userId: 'u', schemaVersion: 1, payload, syncedAt: null,
});

describe('archived contacts come back (story 043)', () => {
  const log = [
    ev('person_added', { personId: 'a', name: 'A' }),
    ev('activity_logged', { personId: 'a', taskId: 'new_customer', activityType: 'new_customer', xp: 30 }, '2026-03-02T00:00:00.000Z'),
    ev('person_archived', { personId: 'a' }, '2026-03-03T00:00:00.000Z'),
  ];

  it('is not archived, is listed under all and KH, and counts as a customer', () => {
    const [a] = derivePeople(log, CONFIG);
    expect(a?.archived).toBe(false);
    const people = derivePeople(log, CONFIG);
    expect(filterContacts(people, 'all').map((p) => p.personId)).toEqual(['a']);
    expect(filterContacts(people, 'kh').map((p) => p.personId)).toEqual(['a']);
    expect(computePeopleStats(people, CONFIG).customers).toBe(1);
  });

  it('can do tasks again', () => {
    const [a] = derivePeople(log, CONFIG);
    if (a === undefined) throw new Error('missing');
    expect(pendingTasks(a, CONFIG).length).toBeGreaterThan(0);
    expect(buildTaskCompletionEvent(a, 'demo', CONFIG).ok).toBe(true);
  });

  it('has no "Đã lưu trữ" filter any more', () => {
    expect(CONTACTS_FILTERS).toEqual(['all', 'kh', 'npp']);
  });
});
