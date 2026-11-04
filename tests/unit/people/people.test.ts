/**
 * People model (story 008): config validation, derivation from the log,
 * stage-change XP rules, ownership, 30x30 stats and backward compatibility.
 * Fixed data only: no clock, no randomness.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import { EVENT_TYPES, parseStoredEvent } from '../../../src/data/event-store';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import {
  UNKNOWN_PERSON_ID,
  buildStageChangeEvent,
  computePeopleStats,
  deriveActivityOwners,
  derivePeople,
  findDuplicateNames,
  parsePeopleConfig,
  planStageChange,
  validatePersonName,
} from '../../../src/domain/people';
import type { PeopleConfig, Person } from '../../../src/domain/people';
import { computeProgress } from '../../../src/domain/progress';

const CONFIG: PeopleConfig = parsePeopleConfig(gameConfig);
const STAGE_IDS = CONFIG.stages.map((s) => s.id);
const xpOf = (id: string): number => CONFIG.stages.find((s) => s.id === id)?.xp ?? -1;
const NOW = new Date('2026-03-10T12:00:00.000Z');
const PROGRESS_CONFIG = { dailyXpGoal: gameConfig.dailyXpGoal };

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp = '2026-03-01T00:00:00.000Z'): LogEvent {
  counter += 1;
  return { id: `e${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const added = (personId: string, name = personId, ts?: string): LogEvent => ev('person_added', { personId, name }, ts);
const moved = (personId: string, from: string, to: string, xp: number, ts?: string): LogEvent =>
  ev('person_stage_changed', { personId, from, to, xp }, ts);
const undo = (target: LogEvent): LogEvent => ev('person_stage_changed', { compensates: target.id });
function personAt(stageId: string, awarded: string[] = []): Person {
  return { personId: 'p', name: 'P', note: '', archived: false, stageId, stageXpAwarded: awarded };
}
function totalXp(events: LogEvent[]): number {
  return computeProgress(events, NOW, PROGRESS_CONFIG, 'UTC').totalXp;
}

describe('parsePeopleConfig', () => {
  it('accepts the default game-config with no problems', () => {
    const result = parsePeopleConfig(gameConfig);
    expect(result.problems).toEqual([]);
    expect(STAGE_IDS).toEqual(['acquaintance', 'contacted', 'demoed', 'heard_opp', 'customer', 'downline']);
    expect(result.stages[5]?.name).toBe('NPP tuyến dưới');
    expect(result.targets).toEqual({ contactsTarget: 250, customersTarget: 30, f1Target: 30 });
  });

  it.each([undefined, null, 'x', 5, {}, { personStages: [], target30x30: 3 }])(
    'falls back safely and reports problems for %j without throwing',
    (raw) => {
      const result = parsePeopleConfig(raw);
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.stages).toHaveLength(1);
      expect(result.stages[0]?.xp).toBe(0);
      expect(result.targets.customersTarget).toBeGreaterThan(0);
    },
  );

  it('rejects duplicate ids, negative or fractional xp and a first stage with xp > 0', () => {
    const base = { target30x30: gameConfig.target30x30 };
    expect(parsePeopleConfig({ ...base, personStages: [{ id: 'a', name: 'A', xp: 0 }, { id: 'a', name: 'B', xp: 1 }] }).problems).not.toEqual([]);
    expect(parsePeopleConfig({ ...base, personStages: [{ id: 'a', name: 'A', xp: 0 }, { id: 'b', name: 'B', xp: -1 }] }).problems).not.toEqual([]);
    expect(parsePeopleConfig({ ...base, personStages: [{ id: 'a', name: 'A', xp: 0 }, { id: 'b', name: 'B', xp: 1.5 }] }).problems).not.toEqual([]);
    expect(parsePeopleConfig({ ...base, personStages: [{ id: 'a', name: 'A', xp: 5 }] }).problems).not.toEqual([]);
  });

  it('falls back per target field when only one is invalid', () => {
    const result = parsePeopleConfig({
      personStages: gameConfig.personStages,
      target30x30: { contactsTarget: 250, customersTarget: 0, f1Target: 30 },
    });
    expect(result.problems).toHaveLength(1);
    expect(result.stages).toHaveLength(6);
    expect(result.targets.contactsTarget).toBe(250);
    expect(result.targets.f1Target).toBe(30);
    expect(result.targets.customersTarget).toBeGreaterThan(30);
  });
});

describe('derivePeople', () => {
  it('returns no people for a log without person events', () => {
    const events = [ev('activity_logged', { activityType: 'demo', xp: 15 }), ev('lesson_completed', { xp: 10 })];
    expect(derivePeople(events, CONFIG)).toEqual([]);
  });

  it('starts a new person at the first configured stage', () => {
    const [person] = derivePeople([ev('person_added', { personId: 'a', name: 'Lan', note: 'bạn cũ' })], CONFIG);
    expect(person).toMatchObject({
      personId: 'a',
      name: 'Lan',
      note: 'bạn cũ',
      archived: false,
      stageId: 'acquaintance',
      stageXpAwarded: [],
    });
  });

  it('latest name and note win; equal timestamps follow array order', () => {
    const events = [
      added('a', 'Lan'),
      ev('person_updated', { personId: 'a', name: 'Lan Anh' }, '2026-03-02T00:00:00.000Z'),
      ev('person_updated', { personId: 'a', note: 'first' }, '2026-03-03T00:00:00.000Z'),
      ev('person_updated', { personId: 'a', note: 'second' }, '2026-03-03T00:00:00.000Z'),
    ];
    const [person] = derivePeople(events, CONFIG);
    expect(person?.name).toBe('Lan Anh');
    expect(person?.note).toBe('second');
  });

  it('orders by timestamp even when the array is out of order', () => {
    const events = [
      ev('person_updated', { personId: 'a', name: 'Late' }, '2026-03-05T00:00:00.000Z'),
      added('a', 'Early', '2026-03-01T00:00:00.000Z'),
      ev('person_updated', { personId: 'a', name: 'Mid' }, '2026-03-03T00:00:00.000Z'),
    ];
    expect(derivePeople(events, CONFIG)[0]?.name).toBe('Late');
  });

  it('marks a person archived and keeps them in the list', () => {
    const people = derivePeople([added('a'), ev('person_archived', { personId: 'a' })], CONFIG);
    expect(people).toHaveLength(1);
    expect(people[0]?.archived).toBe(true);
  });

  it('a compensated archive event restores the person', () => {
    const archive = ev('person_archived', { personId: 'a' });
    const people = derivePeople([added('a'), archive, undo(archive)], CONFIG);
    expect(people[0]?.archived).toBe(false);
  });

  it('current stage is the target of the latest stage change', () => {
    const events = [
      added('a'),
      moved('a', 'acquaintance', 'contacted', xpOf('contacted'), '2026-03-02T00:00:00.000Z'),
      moved('a', 'contacted', 'demoed', xpOf('demoed'), '2026-03-03T00:00:00.000Z'),
    ];
    const [person] = derivePeople(events, CONFIG);
    expect(person?.stageId).toBe('demoed');
    expect(person?.stageXpAwarded).toEqual(['contacted', 'demoed']);
  });

  it('a compensated stage change reverts the stage and the awarded XP', () => {
    const first = moved('a', 'acquaintance', 'contacted', xpOf('contacted'), '2026-03-02T00:00:00.000Z');
    const second = moved('a', 'contacted', 'demoed', xpOf('demoed'), '2026-03-03T00:00:00.000Z');
    const [person] = derivePeople([added('a'), first, second, undo(second)], CONFIG);
    expect(person?.stageId).toBe('contacted');
    expect(person?.stageXpAwarded).toEqual(['contacted']);
  });

  it('ignores events for unknown personIds, malformed payloads and unknown stages', () => {
    const events = [
      ev('person_updated', { personId: 'ghost', name: 'X' }),
      ev('person_archived', { personId: 'ghost' }),
      moved('ghost', 'acquaintance', 'contacted', 5),
      ev('person_added', { personId: 'b', name: '   ' }),
      ev('person_added', { name: 'No id' }),
      added('a'),
      moved('a', 'acquaintance', 'nonexistent', 5),
    ];
    const people = derivePeople(events, CONFIG);
    expect(people.map((p) => p.personId)).toEqual(['a']);
    expect(people[0]?.stageId).toBe('acquaintance');
  });
});

describe('planStageChange', () => {
  it('awards the stage XP for the stage immediately after the current one', () => {
    expect(planStageChange(personAt('acquaintance'), 'contacted', CONFIG)).toEqual({ ok: true, xp: xpOf('contacted') });
    expect(planStageChange(personAt('heard_opp'), 'customer', CONFIG)).toEqual({ ok: true, xp: xpOf('customer') });
  });

  it('skipping a stage gives 0 XP', () => {
    expect(planStageChange(personAt('acquaintance'), 'demoed', CONFIG)).toEqual({ ok: true, xp: 0 });
  });

  it('moving backward gives 0 XP', () => {
    expect(planStageChange(personAt('demoed', ['contacted', 'demoed']), 'contacted', CONFIG)).toEqual({ ok: true, xp: 0 });
  });

  it('staying on the same stage gives 0 XP', () => {
    expect(planStageChange(personAt('contacted'), 'contacted', CONFIG)).toEqual({ ok: true, xp: 0 });
  });

  it('entering a stage a second time gives 0 XP', () => {
    const person = personAt('acquaintance', ['contacted']);
    expect(planStageChange(person, 'contacted', CONFIG)).toEqual({ ok: true, xp: 0 });
  });

  it('XP becomes available again after the first earning change is compensated', () => {
    const first = moved('a', 'acquaintance', 'contacted', xpOf('contacted'), '2026-03-02T00:00:00.000Z');
    const events = [added('a'), first, undo(first)];
    const [person] = derivePeople(events, CONFIG);
    expect(person?.stageId).toBe('acquaintance');
    expect(person && planStageChange(person, 'contacted', CONFIG)).toEqual({ ok: true, xp: xpOf('contacted') });
  });

  it('a 0-XP re-entry does not count as having earned XP', () => {
    const events = [
      added('a'),
      moved('a', 'acquaintance', 'demoed', 0, '2026-03-02T00:00:00.000Z'),
      moved('a', 'demoed', 'acquaintance', 0, '2026-03-03T00:00:00.000Z'),
    ];
    const [person] = derivePeople(events, CONFIG);
    expect(person?.stageXpAwarded).toEqual([]);
    expect(person && planStageChange(person, 'contacted', CONFIG)).toEqual({ ok: true, xp: xpOf('contacted') });
  });

  it('rejects an unknown stage', () => {
    expect(planStageChange(personAt('acquaintance'), 'nope', CONFIG)).toEqual({ ok: false, reason: 'unknown_stage' });
  });
});

describe('buildStageChangeEvent', () => {
  it('builds the event with from, to and the planned xp', () => {
    const result = buildStageChangeEvent(personAt('acquaintance'), 'contacted', CONFIG, '2026-03-02T00:00:00.000Z');
    expect(result).toEqual({
      ok: true,
      xp: xpOf('contacted'),
      event: {
        type: 'person_stage_changed',
        payload: { personId: 'p', from: 'acquaintance', to: 'contacted', xp: xpOf('contacted') },
        timestamp: '2026-03-02T00:00:00.000Z',
      },
    });
  });

  it('returns the 0 XP the caller must record for a skip, and no timestamp when none is given', () => {
    const result = buildStageChangeEvent(personAt('acquaintance'), 'customer', CONFIG);
    expect(result.ok && result.xp).toBe(0);
    expect(result.ok && 'timestamp' in result.event).toBe(false);
  });

  it('returns a rejection and no event for an unknown stage', () => {
    expect(buildStageChangeEvent(personAt('acquaintance'), 'nope', CONFIG)).toEqual({ ok: false, reason: 'unknown_stage' });
  });
});

describe('computeProgress integration', () => {
  it('totals include stage-change XP', () => {
    const events = [
      ev('activity_logged', { activityType: 'demo', xp: 15 }),
      added('a'),
      moved('a', 'acquaintance', 'contacted', xpOf('contacted')),
      moved('a', 'contacted', 'demoed', xpOf('demoed')),
    ];
    expect(totalXp(events)).toBe(15 + xpOf('contacted') + xpOf('demoed'));
  });

  it('a compensated stage change removes its XP', () => {
    const change = moved('a', 'acquaintance', 'contacted', xpOf('contacted'));
    expect(totalXp([added('a'), change])).toBe(xpOf('contacted'));
    expect(totalXp([added('a'), change, undo(change)])).toBe(0);
  });

  it('person events without xp add nothing', () => {
    const events = [added('a'), ev('person_updated', { personId: 'a', name: 'B' }), ev('person_archived', { personId: 'a' })];
    expect(totalXp(events)).toBe(0);
  });
});

describe('validatePersonName and findDuplicateNames', () => {
  it.each(['', '   ', '\t\n'])('rejects the empty name %j', (name) => {
    expect(validatePersonName(name)).toEqual({ ok: false, reason: 'empty' });
  });

  it('returns the trimmed name', () => {
    expect(validatePersonName('  Nguyễn Lan ')).toEqual({ ok: true, name: 'Nguyễn Lan' });
  });

  it('warns about duplicates case-insensitively and trimmed, among non-archived people only', () => {
    const people = derivePeople(
      [added('a', 'Nguyễn Lan'), added('b', 'Minh'), added('c', 'Hoa'), ev('person_archived', { personId: 'c' })],
      CONFIG,
    );
    expect(findDuplicateNames(people, '  nguyễn lan ').duplicate).toBe(true);
    expect(findDuplicateNames(people, 'nguyễn lan').matches.map((p) => p.personId)).toEqual(['a']);
    expect(findDuplicateNames(people, 'Hoa').duplicate).toBe(false);
    expect(findDuplicateNames(people, 'Tuấn').duplicate).toBe(false);
  });

  it('does not match a person against themselves when renaming', () => {
    const people = derivePeople([added('a', 'Lan')], CONFIG);
    expect(findDuplicateNames(people, 'Lan', 'a').duplicate).toBe(false);
  });

  it('allows duplicate names to be added (no rejection in derivation)', () => {
    expect(derivePeople([added('a', 'Lan'), added('b', 'Lan')], CONFIG)).toHaveLength(2);
  });
});

describe('deriveActivityOwners', () => {
  it('old activities without personId have no owner', () => {
    const old = ev('activity_logged', { activityType: 'demo', xp: 15 });
    expect(deriveActivityOwners([old]).get(old.id)).toBeNull();
  });

  it('uses payload.personId of the activity', () => {
    const act = ev('activity_logged', { activityType: 'demo', xp: 15, personId: 'a' });
    expect(deriveActivityOwners([added('a'), act]).get(act.id)).toBe('a');
  });

  it('the latest non-compensated reassignment overrides the owner', () => {
    const act = ev('activity_logged', { activityType: 'demo', xp: 15 });
    const toA = ev('activity_reassigned', { activityId: act.id, personId: 'a' }, '2026-03-02T00:00:00.000Z');
    const toB = ev('activity_reassigned', { activityId: act.id, personId: 'b' }, '2026-03-03T00:00:00.000Z');
    const base = [added('a'), added('b'), act, toA, toB];
    expect(deriveActivityOwners(base).get(act.id)).toBe('b');
    expect(deriveActivityOwners([...base, ev('activity_reassigned', { compensates: toB.id })]).get(act.id)).toBe('a');
  });

  it('resolves an activity pointing to a missing person to the unknown marker', () => {
    const act = ev('activity_logged', { activityType: 'demo', xp: 15, personId: 'ghost' });
    expect(deriveActivityOwners([act]).get(act.id)).toBe(UNKNOWN_PERSON_ID);
  });

  it('resolves a reassignment to a missing person to the unknown marker', () => {
    const act = ev('activity_logged', { activityType: 'demo', xp: 15 });
    const re = ev('activity_reassigned', { activityId: act.id, personId: 'ghost' }, '2026-03-02T00:00:00.000Z');
    expect(deriveActivityOwners([act, re]).get(act.id)).toBe(UNKNOWN_PERSON_ID);
  });

  it('ignores reassignments of unknown activities and leaves compensated activities out', () => {
    const act = ev('activity_logged', { activityType: 'demo', xp: 15 });
    const owners = deriveActivityOwners([
      added('a'),
      act,
      ev('activity_logged', { compensates: act.id }),
      ev('activity_reassigned', { activityId: 'nope', personId: 'a' }),
    ]);
    expect(owners.size).toBe(0);
  });

  it('reassignment does not change XP totals', () => {
    const act = ev('activity_logged', { activityType: 'demo', xp: 15 });
    const before = [added('a'), act];
    const after = [...before, ev('activity_reassigned', { activityId: act.id, personId: 'a' })];
    expect(totalXp(after)).toBe(totalXp(before));
    expect(totalXp(after)).toBe(15);
  });
});

describe('computePeopleStats', () => {
  /** Builds n non-archived people all at `stageId`. */
  function crowd(prefix: string, stageId: string, n: number): LogEvent[] {
    const events: LogEvent[] = [];
    for (let i = 0; i < n; i++) {
      const id = `${prefix}${i}`;
      events.push(added(id));
      if (stageId !== 'acquaintance') events.push(moved(id, 'acquaintance', stageId, 0, '2026-03-02T00:00:00.000Z'));
    }
    return events;
  }
  const stats = (events: LogEvent[]) => computePeopleStats(derivePeople(events, CONFIG), CONFIG);

  it('is all zeros and not achieved with no people', () => {
    expect(stats([])).toEqual({ customers: 0, f1: 0, contacts: 0, achieved: false, contactsMet: false });
  });

  it('achieved needs both customers and f1 at their targets (30 vs 29)', () => {
    const at30 = stats([...crowd('c', 'customer', 30), ...crowd('d', 'downline', 30)]);
    expect(at30).toMatchObject({ customers: 30, f1: 30, achieved: true });
    expect(stats([...crowd('c', 'customer', 29), ...crowd('d', 'downline', 30)]).achieved).toBe(false);
    expect(stats([...crowd('c', 'customer', 30), ...crowd('d', 'downline', 29)]).achieved).toBe(false);
  });

  it('excludes archived people from every count', () => {
    const events = [...crowd('c', 'customer', 30), ...crowd('d', 'downline', 30)];
    const archived = [...events, ev('person_archived', { personId: 'c0' })];
    const result = stats(archived);
    expect(result).toMatchObject({ customers: 29, f1: 30, contacts: 59, achieved: false });
  });

  it('a backward move of an NPP lowers f1', () => {
    const events = [...crowd('c', 'customer', 30), ...crowd('d', 'downline', 30)];
    const back = moved('d0', 'downline', 'customer', 0, '2026-03-05T00:00:00.000Z');
    const result = stats([...events, back]);
    expect(result).toMatchObject({ customers: 31, f1: 29, achieved: false });
  });

  it('contacts counts people at every stage, with the contacts target as boundary', () => {
    const everyStage = STAGE_IDS.flatMap((id) => crowd(`s-${id}-`, id, 1));
    expect(stats(everyStage).contacts).toBe(STAGE_IDS.length);
    expect(stats(crowd('x', 'acquaintance', 249))).toMatchObject({ contacts: 249, contactsMet: false });
    expect(stats(crowd('x', 'acquaintance', 250))).toMatchObject({ contacts: 250, contactsMet: true });
  });

  it('reads thresholds from the config', () => {
    const small = parsePeopleConfig({
      personStages: gameConfig.personStages,
      target30x30: { contactsTarget: 2, customersTarget: 1, f1Target: 1 },
    });
    const people = derivePeople([...crowd('c', 'customer', 1), ...crowd('d', 'downline', 1)], small);
    expect(computePeopleStats(people, small)).toMatchObject({ achieved: true, contactsMet: true });
  });
});

describe('backward compatibility', () => {
  const stored = (type: string, payload: Record<string, unknown>): unknown => ({
    id: 'old-1',
    type,
    timestamp: '2025-12-01T00:00:00.000Z',
    userId: 'u',
    schemaVersion: 1,
    payload,
    syncedAt: null,
  });

  it.each([
    ['activity_logged', { activityType: 'demo', xp: 15 }],
    ['lesson_completed', { lessonId: 'l1', xp: 10 }],
    ['settings_changed', { reminderEnabled: true }],
  ])('still parses an old %s event', (type, payload) => {
    expect(parseStoredEvent(stored(type, payload))?.type).toBe(type);
  });

  it.each(['person_added', 'person_updated', 'person_archived', 'person_stage_changed', 'activity_reassigned'])(
    'accepts the new type %s',
    (type) => {
      expect(EVENT_TYPES).toContain(type);
      expect(parseStoredEvent(stored(type, {}))?.type).toBe(type);
    },
  );

  it('still rejects unknown types and unknown schema versions', () => {
    expect(parseStoredEvent(stored('bogus', {}))).toBeNull();
    expect(parseStoredEvent({ ...(stored('person_added', {}) as object), schemaVersion: 2 })).toBeNull();
  });

  it('an activity_logged with personId still parses', () => {
    expect(parseStoredEvent(stored('activity_logged', { activityType: 'demo', xp: 15, personId: 'a' }))).not.toBeNull();
  });
});
