/**
 * Person tasks, KH/NPP labels, legacy migration, phone and 30x30 stats
 * (story 012). Fixed data only: no clock, no randomness.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import { EVENT_TYPES, parseStoredEvent } from '../../../src/data/event-store';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import {
  buildTaskCompletionEvent,
  computePeopleStats,
  derivePeople,
  parseCountryCodes,
  parsePeopleConfig,
  parsePersonTasks,
  pendingTasks,
  sortCustomersByLastContact,
  sortNppByDate,
  validatePhone,
} from '../../../src/domain/people';
import type { PeopleConfig, Person } from '../../../src/domain/people';
import { computeProgress } from '../../../src/domain/progress';
import { computeStageProgress, parseStageConfig } from '../../../src/domain/stages';

const CONFIG: PeopleConfig = parsePeopleConfig(gameConfig);
const NOW = new Date('2026-03-10T12:00:00.000Z');
const D1 = '2026-03-01T00:00:00.000Z';
const D2 = '2026-03-02T00:00:00.000Z';
const D3 = '2026-03-03T00:00:00.000Z';
const D4 = '2026-03-04T00:00:00.000Z';

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp = D1): LogEvent {
  counter += 1;
  return { id: `t${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const added = (personId: string, ts = D1, extra: Record<string, unknown> = {}): LogEvent =>
  ev('person_added', { personId, name: personId, ...extra }, ts);
const task = (personId: string, taskId: string, ts = D2): LogEvent => {
  const r = buildTaskCompletionEvent(personOf(personId), taskId, CONFIG, ts);
  if (!r.ok) throw new Error(r.reason);
  return ev(r.event.type, { ...r.event.payload }, ts);
};
const moved = (personId: string, to: string, xp: number, ts = D2): LogEvent =>
  ev('person_stage_changed', { personId, from: 'x', to, xp }, ts);
const undo = (target: LogEvent): LogEvent => ev('activity_logged', { compensates: target.id });
function personOf(personId: string, over: Partial<Person> = {}): Person {
  return { personId, name: personId, note: '', archived: false, stageId: 'acquaintance', stageXpAwarded: [], doneTaskIds: [], ...over };
}
const one = (events: LogEvent[], id = 'a'): Person => {
  const p = derivePeople(events, CONFIG).find((x) => x.personId === id);
  if (p === undefined) throw new Error('missing person');
  return p;
};
const pendingIds = (p: Person): string[] => pendingTasks(p, CONFIG).map((t) => t.id);

describe('config parsing', () => {
  it('reads the six tasks and the country codes with no problems', () => {
    expect(CONFIG.tasks?.map((t) => [t.id, t.xp, t.repeatable, t.label ?? null])).toEqual([
      ['contact', 5, false, null],
      ['demo', 10, false, null],
      ['opp', 20, false, null],
      ['follow_up', 10, true, null],
      ['new_customer', 30, false, 'KH'],
      ['new_npp', 50, false, 'NPP'],
    ]);
    expect(CONFIG.countryCodes?.[0]).toEqual({ code: '+84', name: 'Việt Nam' });
    expect(parsePeopleConfig(gameConfig).problems).toEqual([]);
  });

  it.each([undefined, null, 'x', 5, {}])('personTasks %j gives no tasks and a problem, no throw', (raw) => {
    const r = parsePersonTasks(raw);
    expect(r.tasks).toEqual([]);
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it('skips invalid task items and reports each', () => {
    const r = parsePersonTasks([
      { id: 'a', name: 'A', xp: 1 },
      { id: 'a', name: 'dup', xp: 1 },
      { id: 'b', name: 'B', xp: -1 },
      { id: 'c', name: 'C', xp: 1, label: 'ZZ', repeatable: 'yes' },
      null,
    ]);
    expect(r.tasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(r.tasks[1]).toEqual({ id: 'c', name: 'C', xp: 1, repeatable: false });
    expect(r.problems).toHaveLength(5);
  });

  it('falls back to Việt Nam for broken country codes and skips bad entries', () => {
    expect(parseCountryCodes('nope')).toMatchObject({ countryCodes: [{ code: '+84' }] });
    expect(parseCountryCodes('nope').problems).not.toEqual([]);
    const r = parseCountryCodes([{ code: '84', name: 'x' }, { code: '+1', name: 'US' }, { code: '+1', name: 'dup' }]);
    expect(r.countryCodes).toEqual([{ code: '+1', name: 'US' }]);
    expect(r.problems).toHaveLength(2);
  });

  it('reports problems through parsePeopleConfig when the keys are present but broken', () => {
    const r = parsePeopleConfig({ ...gameConfig, personTasks: 3, countryCodes: [] });
    expect(r.problems.length).toBeGreaterThanOrEqual(2);
    expect(r.tasks).toEqual([]);
    expect(r.countryCodes[0]?.code).toBe('+84');
  });
});

describe('pendingTasks', () => {
  it('lists all six for a new person, in config order', () => {
    expect(pendingIds(one([added('a')]))).toEqual(['contact', 'demo', 'opp', 'follow_up', 'new_customer', 'new_npp']);
  });

  it('hides a done non-repeatable task but keeps follow_up always', () => {
    const p = one([added('a'), task('a', 'contact'), task('a', 'follow_up'), task('a', 'follow_up')]);
    expect(pendingIds(p)).not.toContain('contact');
    expect(pendingIds(p)).toContain('follow_up');
  });

  it('shows the task again after the completion is compensated', () => {
    const done = task('a', 'demo');
    expect(pendingIds(one([added('a'), done]))).not.toContain('demo');
    expect(pendingIds(one([added('a'), done, undo(done)]))).toContain('demo');
  });

  it('gives an archived person no tasks and ignores unknown task ids', () => {
    const p = one([added('a'), ev('person_archived', { personId: 'a' })]);
    expect(pendingIds(p)).toEqual([]);
    const q = one([added('a'), ev('activity_logged', { activityType: 'gone', taskId: 'gone', xp: 1, personId: 'a' })]);
    expect(pendingIds(q)).toHaveLength(6);
  });
});

describe('buildTaskCompletionEvent', () => {
  it('builds one activity_logged with xp from config', () => {
    const r = buildTaskCompletionEvent(personOf('a'), 'opp', CONFIG, D2);
    expect(r).toEqual({
      ok: true,
      xp: 20,
      event: { type: 'activity_logged', payload: { activityType: 'opp', taskId: 'opp', xp: 20, personId: 'a' }, timestamp: D2 },
    });
  });

  it('omits the timestamp when none is given', () => {
    const r = buildTaskCompletionEvent(personOf('a'), 'opp', CONFIG);
    expect(r.ok && 'timestamp' in r.event).toBe(false);
  });

  it('rejects archived people, unknown tasks and done non-repeatable tasks', () => {
    expect(buildTaskCompletionEvent(personOf('a', { archived: true }), 'demo', CONFIG)).toEqual({ ok: false, reason: 'archived' });
    expect(buildTaskCompletionEvent(personOf('a'), 'zzz', CONFIG)).toEqual({ ok: false, reason: 'unknown_task' });
    expect(buildTaskCompletionEvent(personOf('a', { doneTaskIds: ['demo'] }), 'demo', CONFIG)).toEqual({ ok: false, reason: 'already_done' });
  });

  it('allows a repeatable task again', () => {
    expect(buildTaskCompletionEvent(personOf('a', { doneTaskIds: ['follow_up'] }), 'follow_up', CONFIG).ok).toBe(true);
  });
});

describe('labels', () => {
  it('new_customer gives KH, new_npp gives NPP', () => {
    expect(one([added('a'), task('a', 'new_customer')]).label).toBe('KH');
    expect(one([added('a'), task('a', 'new_npp')]).label).toBe('NPP');
    expect(one([added('a')]).label).toBeNull();
  });

  it('NPP replaces KH and never reverts to KH', () => {
    const p = one([added('a'), task('a', 'new_customer', D2), task('a', 'new_npp', D3), task('a', 'follow_up', D4)]);
    expect(p.label).toBe('NPP');
    expect(p.labelledAt).toBe(D3);
    const q = one([added('a'), task('a', 'new_npp', D2), task('a', 'new_customer', D3)]);
    expect(q.label).toBe('NPP');
    expect(q.labelledAt).toBe(D2);
  });

  it('undoing the closing recomputes the label', () => {
    const kh = task('a', 'new_customer', D2);
    const npp = task('a', 'new_npp', D3);
    expect(one([added('a'), kh, npp, undo(npp)]).label).toBe('KH');
    expect(one([added('a'), kh, npp, undo(npp)]).labelledAt).toBe(D2);
    expect(one([added('a'), kh, undo(kh)]).label).toBeNull();
  });

  it('legacy new_customer activity without taskId gives no label', () => {
    const p = one([added('a'), ev('activity_logged', { activityType: 'new_customer', xp: 25, personId: 'a' })]);
    expect(p.label).toBeNull();
  });

  it('follows an activity reassigned to another person', () => {
    const t = task('a', 'new_customer');
    const events = [added('a'), added('b'), t, ev('activity_reassigned', { activityId: t.id, personId: 'b' })];
    expect(one(events, 'a').label).toBeNull();
    expect(one(events, 'b').label).toBe('KH');
  });
});

describe('legacy migration', () => {
  const legacy = (): LogEvent[] => [
    added('a'),
    moved('a', 'contacted', 5, D2),
    moved('a', 'demoed', 10, D3),
    moved('a', 'heard_opp', 20, D3),
    moved('a', 'customer', 30, D4),
  ];

  it('maps stage events to label and done tasks', () => {
    const p = one(legacy());
    expect(p.label).toBe('KH');
    expect(p.doneTaskIds).toEqual(expect.arrayContaining(['contact', 'demo', 'opp']));
    expect(pendingIds(p)).toEqual(['follow_up', 'new_customer', 'new_npp']);
  });

  it('downline gives NPP, other known stages give no label, unknown stages are ignored', () => {
    expect(one([added('a'), moved('a', 'downline', 50)]).label).toBe('NPP');
    expect(one([added('a'), moved('a', 'customer', 30, D2), moved('a', 'demoed', 0, D3)]).label).toBeNull();
    const p = one([added('a'), moved('a', 'customer', 30, D2), moved('a', 'ghost_stage', 9, D3)]);
    expect(p.label).toBe('KH');
    expect(p.stageId).toBe('customer');
  });

  it('a stage that earned no XP does not mark the task done', () => {
    expect(one([added('a'), moved('a', 'contacted', 0)]).doneTaskIds).toEqual([]);
    const m = moved('a', 'contacted', 5);
    expect(one([added('a'), m, undo(m)]).doneTaskIds).toEqual([]);
  });

  it('legacy demo/opp activities with a personId mark tasks done; others do not', () => {
    const p = one([
      added('a'),
      ev('activity_logged', { activityType: 'demo', xp: 15, personId: 'a' }),
      ev('activity_logged', { activityType: 'follow_up', xp: 10, personId: 'a' }),
    ]);
    expect(p.doneTaskIds).toEqual(['demo']);
  });

  it('keeps total XP, daily goal and milestones identical, and completing a task adds no hidden XP', () => {
    const stages = parseStageConfig(gameConfig.stages).stages;
    const today = '2026-03-10T05:00:00.000Z';
    const log: LogEvent[] = [
      added('a'),
      moved('a', 'contacted', 5, '2026-03-09T01:00:00.000Z'),
      moved('a', 'customer', 30, today),
      ev('activity_logged', { activityType: 'new_customer', xp: 25, personId: 'a' }, today),
      ev('lesson_completed', { lessonId: 'l', xp: 10 }, today),
    ];
    const before = computeProgress(log, NOW, { dailyXpGoal: gameConfig.dailyXpGoal }, 'UTC');
    derivePeople(log, CONFIG);
    const after = computeProgress(log, NOW, { dailyXpGoal: gameConfig.dailyXpGoal }, 'UTC');
    expect(before.totalXp).toBe(70);
    expect(after).toEqual(before);
    expect(before.dailyGoal).toMatchObject({ xp: 65, met: true, hasActivity: true });
    expect(computeStageProgress(log, before.totalXp, stages).current?.id).toBe('start');

    const withTask = [...log, task('a', 'new_customer', today)];
    expect(computeProgress(withTask, NOW, { dailyXpGoal: gameConfig.dailyXpGoal }, 'UTC').totalXp).toBe(100);
    const emerald = computeStageProgress(withTask, 100, stages).stages.find((s) => s.stage.id === 'emerald');
    expect(emerald?.milestones[0]?.count).toBe(5);
    expect(emerald?.milestones[0]?.current).toBe(2);
  });
});

describe('computePeopleStats by label', () => {
  const crowd = (prefix: string, n: number, taskId: string): LogEvent[] =>
    Array.from({ length: n }, (_, i) => [added(`${prefix}${i}`), task(`${prefix}${i}`, taskId)]).flat();
  const stats = (events: LogEvent[]) => computePeopleStats(derivePeople(events, CONFIG), CONFIG);

  it('AC-12: 31 KH + 29 NPP not achieved; one KH takes new_npp -> 30/30 achieved', () => {
    const base = [...crowd('k', 31, 'new_customer'), ...crowd('n', 29, 'new_npp')];
    expect(stats(base)).toMatchObject({ customers: 31, f1: 29, achieved: false });
    expect(stats([...base, task('k0', 'new_npp', D3)])).toMatchObject({ customers: 30, f1: 30, achieved: true });
  });

  it('does not count archived people, and counts them again after person_restored', () => {
    const base = [...crowd('k', 30, 'new_customer'), ...crowd('n', 30, 'new_npp')];
    const arch = ev('person_archived', { personId: 'k0' }, D3);
    expect(stats([...base, arch])).toMatchObject({ customers: 29, contacts: 59, achieved: false });
    expect(stats([...base, arch, ev('person_restored', { personId: 'k0' }, D4)])).toMatchObject({ customers: 30, achieved: true });
  });

  it('contacts boundary 249 / 250', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => added(`x${i}`));
    expect(stats(many(249))).toMatchObject({ contacts: 249, contactsMet: false });
    expect(stats(many(250))).toMatchObject({ contacts: 250, contactsMet: true });
  });
});

describe('lastContactAt, nppAt and sorting', () => {
  it('falls back to the add timestamp and ignores add_name', () => {
    const p = one([added('a', D1), ev('activity_logged', { activityType: 'add_name', xp: 5, personId: 'a' }, D4)]);
    expect(p.lastContactAt).toBe(D1);
  });

  it('uses the latest non-compensated activity or legacy stage change', () => {
    const t = task('a', 'contact', D3);
    expect(one([added('a'), t]).lastContactAt).toBe(D3);
    expect(one([added('a'), t, undo(t)]).lastContactAt).toBe(D1);
    expect(one([added('a'), t, moved('a', 'demoed', 10, D4)]).lastContactAt).toBe(D4);
  });

  it('nppAt is the time the NPP label was set, null otherwise', () => {
    expect(one([added('a'), task('a', 'new_npp', D3)]).nppAt).toBe(D3);
    expect(one([added('a'), task('a', 'new_customer', D3)]).nppAt).toBeNull();
  });

  it('sorts customers oldest contact first and NPP newest first', () => {
    const people = derivePeople(
      [added('a', D1), added('b', D1), added('c', D1), task('a', 'contact', D4), task('b', 'contact', D2), task('c', 'contact', D3)],
      CONFIG,
    );
    expect(sortCustomersByLastContact(people).map((p) => p.personId)).toEqual(['b', 'c', 'a']);
    const npp = derivePeople([added('a'), added('b'), added('c'), task('a', 'new_npp', D2), task('b', 'new_npp', D4), task('c', 'new_npp', D3)], CONFIG);
    expect(sortNppByDate(npp).map((p) => p.personId)).toEqual(['b', 'c', 'a']);
  });
});

describe('person_restored and phone', () => {
  it('archived state is the latest of person_archived / person_restored', () => {
    const arch = ev('person_archived', { personId: 'a' }, D2);
    const rest = ev('person_restored', { personId: 'a' }, D3);
    expect(one([added('a'), arch]).archived).toBe(true);
    expect(one([added('a'), arch, rest]).archived).toBe(false);
    expect(one([added('a'), arch, rest, ev('person_archived', { personId: 'a' }, D4)]).archived).toBe(true);
    expect(pendingIds(one([added('a'), arch, rest]))).toHaveLength(6);
  });

  it('phone: initial from person_added, latest person_updated wins, empty number clears', () => {
    const phone = { country: '+84', number: '912345678' };
    expect(one([added('a', D1, { phone })]).phone).toEqual(phone);
    const upd = ev('person_updated', { personId: 'a', phone: { country: '+1', number: '5551234' } }, D2);
    expect(one([added('a', D1, { phone }), upd]).phone).toEqual({ country: '+1', number: '5551234' });
    const clear = ev('person_updated', { personId: 'a', phone: { country: '+1', number: '' } }, D3);
    expect(one([added('a', D1, { phone }), upd, clear]).phone).toBeNull();
    expect(one([added('a')]).phone).toBeNull();
  });

  it('validatePhone applies country, digits and length rules', () => {
    expect(validatePhone('+84', '912 345 678', CONFIG)).toEqual({ ok: true, phone: { country: '+84', number: '912345678' } });
    expect(validatePhone('+84', '', CONFIG)).toEqual({ ok: true, phone: null });
    expect(validatePhone('+84', '   ', CONFIG)).toEqual({ ok: true, phone: null });
    expect(validatePhone('+999', '123456', CONFIG)).toEqual({ ok: false, reason: 'unknown_country' });
    expect(validatePhone('+84', '12a456', CONFIG)).toEqual({ ok: false, reason: 'not_digits' });
    expect(validatePhone('+84', '+84123456', CONFIG)).toEqual({ ok: false, reason: 'not_digits' });
    expect(validatePhone('+84', '12345', CONFIG)).toEqual({ ok: false, reason: 'bad_length' });
    expect(validatePhone('+84', '123456', CONFIG).ok).toBe(true);
    expect(validatePhone('+84', '123456789012345', CONFIG).ok).toBe(true);
    expect(validatePhone('+84', '1234567890123456', CONFIG)).toEqual({ ok: false, reason: 'bad_length' });
  });
});

describe('event store compatibility', () => {
  const raw = (type: string, payload: Record<string, unknown>) => ({
    id: 'x', type, timestamp: D1, userId: 'u', schemaVersion: 1, payload, syncedAt: null,
  });

  it('knows person_restored and still parses old events', () => {
    expect(EVENT_TYPES).toContain('person_restored');
    expect(parseStoredEvent(raw('person_restored', { personId: 'a' }))?.type).toBe('person_restored');
    expect(parseStoredEvent(raw('person_stage_changed', { personId: 'a', from: 'x', to: 'y', xp: 5 }))).not.toBeNull();
  });

  it('accepts the new taskId and phone payload fields', () => {
    expect(parseStoredEvent(raw('activity_logged', { activityType: 'demo', taskId: 'demo', xp: 10, personId: 'a' }))).not.toBeNull();
    expect(parseStoredEvent(raw('person_added', { personId: 'a', name: 'A', phone: { country: '+84', number: '912345' } }))).not.toBeNull();
  });
});
