/**
 * "đã làm N lần" counts for the Hoạt động list (story 035): non-compensated activity_logged
 * rows for the person, merged contacts included, as the history shows them. Fixed data only.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { buildTaskCompletionEvent, parsePeopleConfig } from '../../../src/domain/people';
import type { Person } from '../../../src/domain/people';
import { buildPersonHistory, countDoneTasks } from '../../../src/ui/people-helpers';

const CONFIG = parsePeopleConfig(gameConfig);
const TS = '2026-11-22T08:00:00.000Z';
const NAMED = (CONFIG.tasks ?? []).map((t) => ({ id: t.id, name: t.name }));

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>): LogEvent {
  counter += 1;
  return { id: `d${counter}`, type, timestamp: TS, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const personOf = (personId: string): Person => ({ personId, name: personId, note: '', archived: false, stageId: 'a', stageXpAwarded: [] });
const added = (personId: string): LogEvent => ev('person_added', { personId, name: personId });
function task(personId: string, taskId: string): LogEvent {
  const r = buildTaskCompletionEvent(personOf(personId), taskId, CONFIG, TS);
  if (!r.ok) throw new Error(r.reason);
  return ev('activity_logged', { ...r.event.payload });
}
const countsFor = (events: LogEvent[], personId = 'a') => countDoneTasks(buildPersonHistory(events, personId, CONFIG, NAMED));

describe('countDoneTasks', () => {
  it('counts each repeat of a task and leaves undone tasks absent', () => {
    const counts = countsFor([added('a'), task('a', 'demo'), task('a', 'demo'), task('a', 'contact')]);
    expect(counts.get('demo')).toBe(2);
    expect(counts.get('contact')).toBe(1);
    expect(counts.has('opp')).toBe(false);
  });

  it('drops a compensated completion', () => {
    const second = task('a', 'demo');
    const counts = countsFor([added('a'), task('a', 'demo'), second, ev('activity_logged', { compensates: second.id })]);
    expect(counts.get('demo')).toBe(1);
  });

  it('does not count another person', () => {
    expect(countsFor([added('a'), added('b'), task('b', 'demo')]).has('demo')).toBe(false);
  });

  it('includes a merged contact', () => {
    const log = [added('a'), added('b'), task('a', 'demo'), task('b', 'demo'), ev('person_merged', { keepId: 'a', mergedId: 'b' })];
    expect(countsFor(log).get('demo')).toBe(2);
  });
});
