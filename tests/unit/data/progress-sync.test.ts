/**
 * Pure parts of the personal progress sync (story 032): the stream filter, row mapping,
 * pulled-row parsing, cursor key. Fixed data, no clock, no random.
 */
import { describe, expect, it, vi } from 'vitest';
import { isContactEvent } from '../../../src/data/contact-sync';
import type { EventPayload, EventType, LogEvent } from '../../../src/data/event-store';
import {
  PROGRESS_CURSOR_PREFIX,
  isPersonalProgressEvent,
  parseProgressRow,
  progressCursorKey,
  selectProgressToPush,
  toProgressRow,
} from '../../../src/data/progress-sync';

const ACCOUNT = 'acc-1';

function ev(id: string, type: EventType, payload: EventPayload, syncedAt: string | null = null): LogEvent {
  return { id, type, timestamp: '2026-11-01T01:00:00.000Z', userId: 'local', schemaVersion: 1, payload, syncedAt };
}

const byIdOf = (events: readonly LogEvent[]) => new Map(events.map((e) => [e.id, e]));

describe('isPersonalProgressEvent', () => {
  it('accepts a lesson_completed', () => {
    expect(isPersonalProgressEvent(ev('a', 'lesson_completed', { lessonId: 'l1', xp: 10 }), new Map())).toBe(true);
  });

  it('accepts an activity_logged without personId and rejects one with personId', () => {
    expect(isPersonalProgressEvent(ev('a', 'activity_logged', { activityType: 'call', xp: 5 }), new Map())).toBe(true);
    expect(isPersonalProgressEvent(ev('b', 'activity_logged', { activityType: 'call', xp: 5, personId: 'p1' }), new Map())).toBe(false);
  });

  it.each(['achievementAcknowledged', 'stageAcknowledged', 'achievementsSeeded'])('accepts settings_changed carrying %s', (key) => {
    expect(isPersonalProgressEvent(ev('a', 'settings_changed', { [key]: 'x' }), new Map())).toBe(true);
  });

  it.each(['reminder', 'sound', 'dailyGoal', 'accountLinked', 'contactSync', 'somethingElse'])('rejects the device setting %s', (key) => {
    expect(isPersonalProgressEvent(ev('a', 'settings_changed', { [key]: { v: 1 } }), new Map())).toBe(false);
  });

  it.each<EventType>(['person_added', 'person_updated', 'person_archived', 'person_restored', 'person_stage_changed', 'activity_reassigned', 'person_merged', 'person_not_duplicate', 'person_transferred_out'])(
    'rejects the Danh bạ event %s',
    (type) => {
      expect(isPersonalProgressEvent(ev('a', type, { personId: 'p1' }), new Map())).toBe(false);
    },
  );

  it('follows a compensation of a personal activity and of a lesson', () => {
    const own = ev('own', 'activity_logged', { activityType: 'call', xp: 5 });
    const lesson = ev('les', 'lesson_completed', { xp: 10 });
    const undoOwn = ev('u1', 'activity_logged', { compensates: 'own' });
    const undoLesson = ev('u2', 'activity_logged', { compensates: 'les' });
    const map = byIdOf([own, lesson, undoOwn, undoLesson]);
    expect(isPersonalProgressEvent(undoOwn, map)).toBe(true);
    expect(isPersonalProgressEvent(undoLesson, map)).toBe(true);
  });

  it('follows a chain of compensations', () => {
    const own = ev('own', 'activity_logged', { xp: 5 });
    const u1 = ev('u1', 'activity_logged', { compensates: 'own' });
    const u2 = ev('u2', 'activity_logged', { compensates: 'u1' });
    expect(isPersonalProgressEvent(u2, byIdOf([own, u1, u2]))).toBe(true);
  });

  it('rejects a compensation of a Danh bạ activity (it belongs to the contact stream)', () => {
    const contact = ev('c', 'activity_logged', { xp: 5, personId: 'p1' });
    const undo = ev('u', 'activity_logged', { compensates: 'c' });
    const stage = ev('s', 'person_stage_changed', { personId: 'p1', xp: 20 });
    const undoStage = ev('us', 'activity_logged', { compensates: 's' });
    const map = byIdOf([contact, undo, stage, undoStage]);
    expect(isPersonalProgressEvent(undo, map)).toBe(false);
    expect(isPersonalProgressEvent(undoStage, map)).toBe(false);
  });

  it('rejects a compensation with an unknown target or a loop', () => {
    const unknown = ev('u', 'activity_logged', { compensates: 'missing' });
    const a = ev('a', 'activity_logged', { compensates: 'b' });
    const b = ev('b', 'activity_logged', { compensates: 'a' });
    expect(isPersonalProgressEvent(unknown, byIdOf([unknown]))).toBe(false);
    expect(isPersonalProgressEvent(a, byIdOf([a, b]))).toBe(false);
  });

  it('rejects a compensation whose target is a device setting', () => {
    const setting = ev('s', 'settings_changed', { sound: false });
    const undo = ev('u', 'activity_logged', { compensates: 's' });
    expect(isPersonalProgressEvent(undo, byIdOf([setting, undo]))).toBe(false);
  });
});

describe('contact and progress streams are mutually exclusive', () => {
  const log: LogEvent[] = [
    ev('lesson', 'lesson_completed', { xp: 10 }),
    ev('own', 'activity_logged', { xp: 5 }),
    ev('own-undo', 'activity_logged', { compensates: 'own' }),
    ev('contact-act', 'activity_logged', { xp: 5, personId: 'p1' }),
    ev('contact-undo', 'activity_logged', { compensates: 'contact-act' }),
    ev('ack', 'settings_changed', { achievementAcknowledged: 'a1' }),
    ev('stage-ack', 'settings_changed', { stageAcknowledged: 's1' }),
    ev('seeded', 'settings_changed', { achievementsSeeded: true }),
    ev('reminder', 'settings_changed', { reminder: { enabled: true } }),
    ev('sound', 'settings_changed', { sound: false }),
    ev('goal', 'settings_changed', { dailyGoal: { xp: 30 } }),
    ev('link', 'settings_changed', { accountLinked: { accountId: 'x' } }),
    ev('consent', 'settings_changed', { contactSync: { enabled: false } }),
    ev('p-add', 'person_added', { personId: 'p1', name: 'An' }),
    ev('p-upd', 'person_updated', { personId: 'p1', name: 'Anh' }),
    ev('p-arc', 'person_archived', { personId: 'p1' }),
    ev('p-res', 'person_restored', { personId: 'p1' }),
    ev('p-stage', 'person_stage_changed', { personId: 'p1', xp: 20 }),
    ev('p-re', 'activity_reassigned', { activityId: 'own', personId: 'p1' }),
    ev('p-merge', 'person_merged', { keepId: 'p1', mergedId: 'p2' }),
    ev('p-nd', 'person_not_duplicate', { personIds: ['p1', 'p2'] }),
    ev('p-out', 'person_transferred_out', { personId: 'p1' }),
    ev('orphan-undo', 'activity_logged', { compensates: 'nowhere' }),
  ];
  const map = byIdOf(log);
  const streamsOf = (e: LogEvent) => ({ contact: isContactEvent(e, map), progress: isPersonalProgressEvent(e, map) });

  it('never puts an event into both streams', () => {
    for (const e of log) {
      const s = streamsOf(e);
      expect(s.contact && s.progress, e.id).toBe(false);
    }
  });

  it('puts each event in exactly the expected stream, device settings and orphans in neither', () => {
    const expected: Record<string, 'contact' | 'progress' | 'none'> = {
      lesson: 'progress',
      own: 'progress',
      'own-undo': 'progress',
      'contact-act': 'contact',
      'contact-undo': 'contact',
      ack: 'progress',
      'stage-ack': 'progress',
      seeded: 'progress',
      reminder: 'none',
      sound: 'none',
      goal: 'none',
      link: 'none',
      consent: 'none',
      'p-add': 'contact',
      'p-upd': 'contact',
      'p-arc': 'contact',
      'p-res': 'contact',
      'p-stage': 'contact',
      'p-re': 'contact',
      'p-merge': 'contact',
      'p-nd': 'contact',
      'p-out': 'none',
      'orphan-undo': 'none',
    };
    for (const e of log) {
      const s = streamsOf(e);
      const actual = s.contact ? 'contact' : s.progress ? 'progress' : 'none';
      expect(actual, e.id).toBe(expected[e.id]);
    }
    expect(Object.keys(expected).sort()).toEqual(log.map((e) => e.id).sort());
  });
});

describe('selectProgressToPush', () => {
  it('returns only unsynced progress events, in log order', () => {
    const log = [
      ev('a', 'lesson_completed', { xp: 10 }, '2026-11-02T00:00:00.000Z'),
      ev('b', 'lesson_completed', { xp: 10 }),
      ev('c', 'person_added', { personId: 'p1', name: 'An' }),
      ev('d', 'settings_changed', { sound: false }),
      ev('e', 'activity_logged', { xp: 5 }),
    ];
    expect(selectProgressToPush(log).map((e) => e.id)).toEqual(['b', 'e']);
  });
});

describe('toProgressRow', () => {
  it('maps the event, sets user_id to the account and omits sync_seq and created_at', () => {
    const e = ev('a', 'lesson_completed', { xp: 10 });
    const row = toProgressRow(e, ACCOUNT);
    expect(row).toEqual({ id: 'a', user_id: ACCOUNT, type: 'lesson_completed', occurred_at: e.timestamp, schema_version: 1, payload: { xp: 10 } });
    expect(Object.keys(row)).not.toContain('sync_seq');
    expect(Object.keys(row)).not.toContain('created_at');
  });
});

describe('parseProgressRow', () => {
  const row = { id: 'a', user_id: ACCOUNT, type: 'lesson_completed', occurred_at: '2026-11-01T08:00:00+07:00', schema_version: 1, payload: { xp: 10 }, sync_seq: '7', created_at: 'x' };

  it('builds a synced event owned by the account', () => {
    const parsed = parseProgressRow(row, ACCOUNT, '2026-11-18T00:00:00.000Z');
    expect(parsed).toEqual({
      seq: 7,
      event: { id: 'a', type: 'lesson_completed', timestamp: '2026-11-01T01:00:00.000Z', userId: ACCOUNT, schemaVersion: 1, payload: { xp: 10 }, syncedAt: '2026-11-18T00:00:00.000Z' },
    });
  });

  it('returns null without a readable sync_seq', () => {
    expect(parseProgressRow({ ...row, sync_seq: 'abc' }, ACCOUNT, 'now')).toBeNull();
    expect(parseProgressRow(null, ACCOUNT, 'now')).toBeNull();
  });

  it('drops malformed rows but keeps the seq so the cursor moves on', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bad = [
      { ...row, payload: null },
      { ...row, payload: [] },
      { ...row, occurred_at: 'nope' },
      { ...row, schema_version: 'x' },
      { ...row, id: 5 },
      { ...row, type: 'person_added' },
      { ...row, type: 'activity_logged', payload: { personId: 'p1' } },
      { ...row, type: 'settings_changed', payload: { sound: false } },
    ];
    for (const b of bad) expect(parseProgressRow(b, ACCOUNT, 'now')).toEqual({ seq: 7, event: null });
    warn.mockRestore();
  });
});

describe('progressCursorKey', () => {
  it('is distinct from a household id', () => {
    expect(progressCursorKey(ACCOUNT)).toBe(`${PROGRESS_CURSOR_PREFIX}${ACCOUNT}`);
    expect(progressCursorKey(ACCOUNT)).not.toBe(ACCOUNT);
    expect(progressCursorKey('11111111-1111-4111-8111-111111111111').startsWith(PROGRESS_CURSOR_PREFIX)).toBe(true);
  });
});
