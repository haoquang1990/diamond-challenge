/**
 * Story 065: editing an activity's note from Lịch sử (`activity_note_changed`), and the
 * "Thêm vào danh sách" date of the summary. Fixed data only.
 */
import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { isContactEvent } from '../../../src/data/contact-sync';
import type { PeopleConfig } from '../../../src/domain/people';
import { derivePeople } from '../../../src/domain/people';
import { buildNoteChangeEvent, buildPersonHistory, personAddedAt } from '../../../src/ui/people-helpers';

const CONFIG: PeopleConfig = { stages: [{ id: 'a', name: 'A', xp: 0 }], targets: { contactsTarget: 1, customersTarget: 1, f1Target: 1 } };
const NAMED = [{ id: 'demo', name: 'Demo' }];
function ev(id: string, type: LogEvent['type'], timestamp: string, payload: LogEvent['payload'], userId = 'lan'): LogEvent {
  return { id, type, timestamp, userId, schemaVersion: 1, payload, syncedAt: null };
}
const base = [
  ev('e0', 'person_added', '2026-11-01T00:00:00.000Z', { personId: 'p', name: 'P' }),
  ev('a1', 'activity_logged', '2026-11-10T09:00:00.000Z', { personId: 'p', activityType: 'demo', taskId: 'demo', xp: 15, note: 'Xem demo' }),
  ev('a2', 'activity_logged', '2026-11-11T09:00:00.000Z', { personId: 'p', activityType: 'demo', taskId: 'demo', xp: 15 }),
];
const row = (events: LogEvent[], id: string) => buildPersonHistory(events, 'p', CONFIG, NAMED).find((r) => r.id === id);

describe('buildNoteChangeEvent', () => {
  it('builds a household-book event naming the person and the activity, note trimmed', () => {
    const r = buildNoteChangeEvent('p', 'a1', '  hẹn tuần sau  ', 500);
    expect(r).toEqual({ ok: true, event: { type: 'activity_note_changed', payload: { personId: 'p', activityId: 'a1', note: 'hẹn tuần sau' } } });
    if (r.ok) expect(isContactEvent(r.event as never, new Map())).toBe(true);
  });

  it('refuses a note over the limit', () => {
    expect(buildNoteChangeEvent('p', 'a1', 'x'.repeat(501), 500)).toEqual({ ok: false, reason: 'too_long' });
  });
});

describe('buildPersonHistory with note changes', () => {
  it('shows the latest note and marks it edited, by either member', () => {
    const events = [
      ...base,
      ev('n1', 'activity_note_changed', '2026-11-12T00:00:00.000Z', { personId: 'p', activityId: 'a1', note: 'Lần 1' }),
      ev('n2', 'activity_note_changed', '2026-11-13T00:00:00.000Z', { personId: 'p', activityId: 'a1', note: 'Xem demo, hẹn gọi lại' }, 'minh'),
    ];
    expect(row(events, 'a1')).toMatchObject({ note: 'Xem demo, hẹn gọi lại', noteEdited: true });
    expect(row(events, 'a2')).not.toHaveProperty('noteEdited');
  });

  it('adds a note to an activity that had none, and an empty note removes it', () => {
    const events = [
      ...base,
      ev('n1', 'activity_note_changed', '2026-11-12T00:00:00.000Z', { personId: 'p', activityId: 'a2', note: 'Mới thêm' }),
      ev('n2', 'activity_note_changed', '2026-11-12T00:00:00.000Z', { personId: 'p', activityId: 'a1', note: '' }),
    ];
    expect(row(events, 'a2')?.note).toBe('Mới thêm');
    expect(row(events, 'a1')).not.toHaveProperty('note');
    expect(row(events, 'a1')?.noteEdited).toBe(true);
  });

  it('ignores an undone note change and keeps the change out of the rows and of contact dates', () => {
    const events = [
      ...base,
      ev('n1', 'activity_note_changed', '2026-11-20T00:00:00.000Z', { personId: 'p', activityId: 'a1', note: 'Sai' }),
      ev('n1x', 'activity_note_changed', '2026-11-20T00:01:00.000Z', { compensates: 'n1' }),
    ];
    expect(row(events, 'a1')?.note).toBe('Xem demo');
    expect(buildPersonHistory(events, 'p', CONFIG, NAMED)).toHaveLength(2);
    expect(derivePeople(events, CONFIG)[0]?.lastContactAt).toBe('2026-11-11T09:00:00.000Z');
  });
});

describe('personAddedAt', () => {
  it('is when the kept contact was added (the earlier of a merged pair)', () => {
    const events = [
      ...base,
      ev('q0', 'person_added', '2026-11-05T00:00:00.000Z', { personId: 'q', name: 'Q' }, 'minh'),
      ev('m', 'person_merged', '2026-11-15T00:00:00.000Z', { keepId: 'p', mergedId: 'q' }),
    ];
    expect(personAddedAt(base, 'p')).toBe('2026-11-01T00:00:00.000Z');
    expect(personAddedAt(events, 'p')).toBe('2026-11-01T00:00:00.000Z');
    expect(personAddedAt(events, 'q')).toBeNull();
    expect(personAddedAt(base, 'nobody')).toBeNull();
  });
});
