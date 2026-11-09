/**
 * Household 30x30 board (story 027): counts on a household book, equal numbers for two synced
 * logs, the pending-duplicates count, the aggregate payload and the "send only when changed"
 * decision. Pure functions, fixed data.
 */
import { expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { buildMergeEvent, pendingDuplicates, planMerge } from '../../../src/domain/duplicates';
import { aggregatesChanged, buildAggregatePayload, parseAggregatePayload } from '../../../src/domain/household-board';
import { derivePeople } from '../../../src/domain/people';
import { PEOPLE_CONFIG } from '../../../src/ui/people-config';

let n = 0;
const mk = (type: string, ts: string, userId: string, payload: Record<string, unknown>, syncedAt: string | null = null) =>
  ({ id: `e${++n}`, type, timestamp: ts, userId, schemaVersion: 1, payload, syncedAt }) as unknown as LogEvent;
const task = (pid: string, taskId: string, xp: number, ts: string, u: string) => mk('activity_logged', ts, u, { personId: pid, taskId, activityType: taskId, xp });

/** Lan's An (KH, code) and Minh's "An Nguyễn" (NPP, same code): a certain duplicate; plus an unrelated archived contact. */
const household = (): LogEvent[] => {
  n = 0;
  return [
    mk('person_added', '2026-11-01T01:00:00.000Z', 'lan', { personId: 'a', name: 'Nguyễn Văn An', amwayCode: '7004053634' }),
    task('a', 'new_customer', 30, '2026-11-02T02:00:00.000Z', 'lan'),
    mk('person_added', '2026-11-03T01:00:00.000Z', 'minh', { personId: 'b', name: 'An Nguyễn', amwayCode: '7004053634' }),
    task('b', 'new_npp', 50, '2026-11-04T02:00:00.000Z', 'minh'),
    mk('person_added', '2026-11-04T05:00:00.000Z', 'lan', { personId: 'z', name: 'Lê Thị Hoa' }),
    mk('person_archived', '2026-11-04T06:00:00.000Z', 'lan', { personId: 'z' }),
  ];
};

it('counts a merged pair once and leaves archived contacts out', () => {
  const ev = household();
  expect(buildAggregatePayload(ev, PEOPLE_CONFIG)).toEqual({ customers: 1, f1: 1, contacts: 2, achieved_30x30: false, pending_duplicates: 1 });
  const people = derivePeople(ev, PEOPLE_CONFIG);
  const plan = planMerge(people.find((p) => p.personId === 'a')!, people.find((p) => p.personId === 'b')!);
  if (!plan.ok) throw new Error('plan');
  const r = buildMergeEvent(plan);
  if (!r.ok) throw new Error('merge');
  const merged = [...ev, mk(r.event.type, '2026-11-05T01:00:00.000Z', 'lan', r.event.payload as never)];
  expect(buildAggregatePayload(merged, PEOPLE_CONFIG)).toEqual({ customers: 0, f1: 1, contacts: 1, achieved_30x30: false, pending_duplicates: 0 });
});

it('gives equal numbers to two members holding the same synced log', () => {
  const ev = household();
  const lan = ev.map((e) => ({ ...e, syncedAt: '2026-11-05T00:00:00.000Z' }));
  const minh = [...lan].reverse().map((e) => ({ ...e }));
  expect(buildAggregatePayload(minh, PEOPLE_CONFIG)).toEqual(buildAggregatePayload(lan, PEOPLE_CONFIG));
});

it('counts pending duplicates and drops the warning once the pair is marked not the same person', () => {
  const ev = household();
  const people = derivePeople(ev, PEOPLE_CONFIG);
  expect(pendingDuplicates(people, ev, PEOPLE_CONFIG)).toBe(1);
  const marked = [...ev, mk('person_not_duplicate', '2026-11-05T01:00:00.000Z', 'lan', { personIds: ['a', 'b'] })];
  expect(buildAggregatePayload(marked, PEOPLE_CONFIG).pending_duplicates).toBe(0);
});

it('sends only when a number changed', () => {
  const p = buildAggregatePayload(household(), PEOPLE_CONFIG);
  expect(aggregatesChanged(null, p)).toBe(true);
  expect(aggregatesChanged(p, { ...p })).toBe(false);
  expect(aggregatesChanged(p, { ...p, pending_duplicates: 0 })).toBe(true);
  expect(aggregatesChanged(p, { ...p, achieved_30x30: true })).toBe(true);
});

it('reads a stored payload back only when every field is valid', () => {
  const p = buildAggregatePayload(household(), PEOPLE_CONFIG);
  expect(parseAggregatePayload(JSON.parse(JSON.stringify(p)))).toEqual(p);
  expect(parseAggregatePayload({ ...p, f1: -1 })).toBeNull();
  expect(parseAggregatePayload(null)).toBeNull();
});
