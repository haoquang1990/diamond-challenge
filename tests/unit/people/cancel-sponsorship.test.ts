/**
 * Huỷ bảo trợ (story 040): cancelling a sponsorship reverts the NPP label,
 * keeps the XP, frees the Bảo trợ task again and lowers the F1 count. Fixed data only.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import {
  buildSponsorshipCancelEvent,
  buildTaskCompletionEvent,
  computePeopleStats,
  derivePeople,
  parsePeopleConfig,
} from '../../../src/domain/people';
import type { PeopleConfig, Person } from '../../../src/domain/people';
import { computeProgress } from '../../../src/domain/progress';
import { buildPersonHistory } from '../../../src/ui/people-helpers';

const CONFIG: PeopleConfig = parsePeopleConfig(gameConfig);
const D1 = '2026-03-01T00:00:00.000Z';
const D2 = '2026-03-02T00:00:00.000Z';
const D3 = '2026-03-03T00:00:00.000Z';
const D4 = '2026-03-04T00:00:00.000Z';
const D5 = '2026-03-05T00:00:00.000Z';

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp: string): LogEvent {
  counter += 1;
  return { id: `c${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const added = (id: string): LogEvent => ev('person_added', { personId: id, name: id }, D1);
const blank = (id: string): Person => ({ personId: id, name: id, note: '', archived: false, stageId: 'acquaintance', stageXpAwarded: [], doneTaskIds: [] });
const task = (id: string, taskId: string, ts: string): LogEvent => {
  const r = buildTaskCompletionEvent(blank(id), taskId, CONFIG, ts);
  if (!r.ok) throw new Error(r.reason);
  return ev(r.event.type, { ...r.event.payload }, ts);
};
const one = (events: LogEvent[], id = 'a'): Person => {
  const p = derivePeople(events, CONFIG).find((x) => x.personId === id);
  if (p === undefined) throw new Error('missing person');
  return p;
};
const cancel = (events: LogEvent[], ts: string, note = ''): LogEvent => {
  const r = buildSponsorshipCancelEvent(one(events), ts, note);
  if (!r.ok) throw new Error('cancel rejected');
  return ev(r.event.type, { ...r.event.payload }, ts);
};

describe('buildSponsorshipCancelEvent', () => {
  it('builds sponsorship_cancelled with the note for an NPP and rejects anyone else', () => {
    const log = [added('a'), task('a', 'new_npp', D2)];
    const r = buildSponsorshipCancelEvent(one(log), D3, '  không hoạt động  ');
    expect(r).toEqual({ ok: true, event: { type: 'sponsorship_cancelled', timestamp: D3, payload: { personId: 'a', note: 'không hoạt động' } } });
    expect(buildSponsorshipCancelEvent(one([added('a')]), D3, '').ok).toBe(false);
    const noNote = buildSponsorshipCancelEvent(one(log), D3, '   ');
    expect(noNote.ok && 'note' in noNote.event.payload).toBe(false);
  });
});

describe('derivePeople with a cancelled sponsorship', () => {
  it('drops the NPP label (no label when never a customer) and frees the Bảo trợ task', () => {
    const log = [added('a'), task('a', 'new_npp', D2)];
    const after = one([...log, cancel(log, D3)]);
    expect(after.label).toBeNull();
    expect(after.nppAt).toBeNull();
    expect(after.doneTaskIds).not.toContain('new_npp');
  });

  it('goes back to KH with the first customer date when the person was a customer', () => {
    const log = [added('a'), task('a', 'new_customer', D2), task('a', 'new_npp', D3)];
    const after = one([...log, cancel(log, D4)]);
    expect(after.label).toBe('KH');
    expect(after.labelledAt).toBe(D2);
  });

  it('can sponsor again: NPP with the date of the new sponsorship', () => {
    const log = [added('a'), task('a', 'new_npp', D2)];
    const withCancel = [...log, cancel(log, D3)];
    const again = [...withCancel, task('a', 'new_npp', D5)];
    expect(one(again).label).toBe('NPP');
    expect(one(again).nppAt).toBe(D5);
  });

  it('lowers the F1 count and keeps the XP of the sponsorship', () => {
    const log = [added('a'), added('b'), task('a', 'new_npp', D2), task('b', 'new_npp', D2)];
    const withCancel = [...log, cancel(log, D3)];
    expect(computePeopleStats(derivePeople(log, CONFIG), CONFIG).f1).toBe(2);
    expect(computePeopleStats(derivePeople(withCancel, CONFIG), CONFIG).f1).toBe(1);
    const now = new Date(D4);
    expect(computeProgress(withCancel, now, { dailyXpGoal: 30 }, 'UTC').totalXp).toBe(computeProgress(log, now, { dailyXpGoal: 30 }, 'UTC').totalXp);
  });

  it('ignores a cancel for someone who is not NPP at that point', () => {
    const early = ev('sponsorship_cancelled', { personId: 'a' }, D2);
    const log = [added('a'), early, task('a', 'new_npp', D3)];
    expect(one(log).label).toBe('NPP');
  });

  it('is not a daily activity', () => {
    const log = [added('a'), task('a', 'new_npp', D2)];
    const onlyCancelToday = [...log, cancel(log, D4)];
    const today = computeProgress(onlyCancelToday, new Date(D4), { dailyXpGoal: 30 }, 'UTC');
    expect(today.dailyGoal.hasActivity).toBe(false);
  });

  it('shows "Huỷ bảo trợ" with its note in the person history', () => {
    const log = [added('a'), task('a', 'new_npp', D2)];
    const history = buildPersonHistory([...log, cancel(log, D3, 'không hoạt động')], 'a', CONFIG, []);
    expect(history[0]).toMatchObject({ kind: 'cancel', note: 'không hoạt động', timestamp: D3 });
  });
});
