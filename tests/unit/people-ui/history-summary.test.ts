/** Story 034: history rows carry note/xp; summarizeHistory. Fixed data only. */
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import type { PeopleConfig } from '../../../src/domain/people';
import { buildPersonHistory, summarizeHistory } from '../../../src/ui/people-helpers';

const CONFIG: PeopleConfig = { stages: [{ id: 'a', name: 'A', xp: 0 }], targets: { contactsTarget: 1, customersTarget: 1, f1Target: 1 } };
const NAMED = [
  { id: 'follow_up', name: 'Follow-up' },
  { id: 'demo', name: 'Demo' },
];
const NOW = new Date('2026-11-21T12:00:00.000Z');
const ADDED = ev('e0', 'person_added', '2026-11-01T00:00:00.000Z', { personId: 'p', name: 'P' });

function ev(id: string, type: LogEvent['type'], timestamp: string, payload: LogEvent['payload']): LogEvent {
  return { id, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const act = (id: string, ts: string, taskId: string, xp: number, extra: Record<string, unknown> = {}, personId = 'p') =>
  ev(id, 'activity_logged', ts, { activityType: taskId, taskId, xp, personId, ...extra });

describe('summarizeHistory', () => {
  const events: LogEvent[] = [
    ev('e0', 'person_added', '2026-11-01T00:00:00.000Z', { personId: 'p', name: 'P' }),
    act('e1', '2026-11-10T09:00:00.000Z', 'follow_up', 10),
    act('e2', '2026-11-12T09:00:00.000Z', 'demo', 20, { note: 'ok' }),
    act('e3', '2026-11-15T09:00:00.000Z', 'follow_up', 10),
    act('e4', '2026-11-20T09:00:00.000Z', 'demo', 20),
    ev('e5', 'activity_logged', '2026-11-20T10:00:00.000Z', { compensates: 'e4' }),
  ];

  it('counts per task, total XP, first/last and days since last, ignoring undone activities', () => {
    const s = summarizeHistory(buildPersonHistory(events, 'p', CONFIG, NAMED), NOW);
    expect(s.counts).toEqual([
      { id: 'follow_up', name: 'Follow-up', count: 2 },
      { id: 'demo', name: 'Demo', count: 1 },
    ]);
    expect(s.totalXp).toBe(40);
    expect(s.firstAt).toBe('2026-11-10T09:00:00.000Z');
    expect(s.lastAt).toBe('2026-11-15T09:00:00.000Z');
    expect(s.daysSinceLast).toBe(6);
  });

  it('includes the activity of an absorbed (merged) contact', () => {
    const merged = [
      ...events,
      ev('m0', 'person_added', '2026-11-02T00:00:00.000Z', { personId: 'q', name: 'Q' }),
      act('m1', '2026-11-18T09:00:00.000Z', 'demo', 20, {}, 'q'),
      ev('m2', 'person_merged', '2026-11-19T00:00:00.000Z', { keepId: 'p', mergedId: 'q' }),
    ];
    const s = summarizeHistory(buildPersonHistory(merged, 'p', CONFIG, NAMED), NOW);
    expect(s.counts.find((c) => c.id === 'demo')?.count).toBe(2);
    expect(s.totalXp).toBe(60);
    expect(s.lastAt).toBe('2026-11-18T09:00:00.000Z');
    expect(s.daysSinceLast).toBe(3);
  });

  it('is empty and null for a person with no activity', () => {
    const s = summarizeHistory([], NOW);
    expect(s).toEqual({ counts: [], totalXp: 0, firstAt: null, lastAt: null, daysSinceLast: null });
  });

  it('never reports negative days since last', () => {
    const s = summarizeHistory(buildPersonHistory([ADDED, act('f', '2026-11-22T00:00:00.000Z', 'demo', 20)], 'p', CONFIG, NAMED), NOW);
    expect(s.daysSinceLast).toBe(0);
  });
});

describe('buildPersonHistory note', () => {
  it('adds note only when present and keeps old rows without one', () => {
    const rows = buildPersonHistory([ADDED, act('a', '2026-11-10T00:00:00.000Z', 'demo', 20, { note: '  hẹn lại  ' }), act('b', '2026-11-11T00:00:00.000Z', 'demo', 20)], 'p', CONFIG, NAMED);
    expect(rows.find((r) => r.id === 'a')?.note).toBe('hẹn lại');
    expect(rows.find((r) => r.id === 'b')).not.toHaveProperty('note');
  });
});
