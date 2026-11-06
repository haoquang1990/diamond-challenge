/**
 * Achievements model (story 016). Fixed dates, fixed time zone, fake random.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import {
  DEFAULT_ENCOURAGEMENT,
  buildSeedEvents,
  buildSilentAcknowledgeEvents,
  buildToast,
  evaluateAchievements,
  newAchievements,
  parseAchievementsConfig,
  pickEncouragement,
  planPopups,
  queueToasts,
  readAcknowledged,
} from '../../../src/domain/achievements';
import type { AchievedItem, AchievementDeps, AchievementsConfig, QueuedToast } from '../../../src/domain/achievements';
import { computePeopleStats, derivePeople, parsePeopleConfig } from '../../../src/domain/people';
import type { PeopleConfig } from '../../../src/domain/people';
import { computeProgress } from '../../../src/domain/progress';
import { computeStageProgress, parseStageConfig } from '../../../src/domain/stages';

const TZ = 'UTC';
const NOW = new Date('2026-03-10T12:00:00.000Z');
const TODAY = '2026-03-10T09:00:00.000Z';
const PEOPLE: PeopleConfig = parsePeopleConfig(gameConfig);
const STAGES = parseStageConfig(gameConfig.stages).stages;
const STAGE_IDS = STAGES.map((s) => s.id);
const CFG: AchievementsConfig = parseAchievementsConfig(gameConfig.achievements, PEOPLE.targets, STAGE_IDS);
const DEPS: AchievementDeps = { stages: STAGES, people: PEOPLE, progress: { dailyXpGoal: gameConfig.dailyXpGoal } };

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp = TODAY): LogEvent {
  counter += 1;
  return { id: `a${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const xpEvent = (xp: number, ts = TODAY): LogEvent => ev('activity_logged', { activityType: 'follow_up', xp }, ts);
const person = (id: string, ts = TODAY): LogEvent => ev('person_added', { personId: id, name: id }, ts);
const taskDone = (personId: string, taskId: string, ts = TODAY): LogEvent =>
  ev('activity_logged', { activityType: taskId, taskId, xp: 0, personId }, ts);
const undo = (target: LogEvent, ts = TODAY): LogEvent => ev('activity_logged', { compensates: target.id }, ts);
const ids = (items: readonly AchievedItem[]): string[] => items.map((i) => i.id);
const evaluate = (events: LogEvent[], config = CFG, deps = DEPS): AchievedItem[] => evaluateAchievements(events, config, NOW, TZ, deps);
const item = (id: string, kind: AchievedItem['kind'] = 'people'): AchievedItem => ({ id, kind, name: id, itemId: id });
/** A day with a lesson and an activity reaching the 30 XP goal. */
const goalDay = (ts: string): LogEvent[] => [ev('lesson_completed', { xp: 10 }, ts), xpEvent(20, ts)];
function fakeRandom(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('parseAchievementsConfig', () => {
  it('parses the real config with every default item and no problems', () => {
    expect(CFG.problems).toEqual([]);
    expect(CFG.toastMs).toBe(2000);
    expect(CFG.maxPopupsPerAction).toBe(3);
    expect(CFG.soundDefault).toBe(true);
    expect(CFG.encouragements.length).toBeGreaterThanOrEqual(8);
    expect(CFG.items.map((i) => i.kind)).toEqual([
      'stage', 'stage', 'stage', 'stage', 'stage', 'daily_goal', 'streak', 'streak', 'streak',
      'people', 'people', 'people', 'people', 'people', 'people',
    ]);
  });

  it('skips invalid and duplicate items and reports problems', () => {
    const raw = {
      ...gameConfig.achievements,
      items: [
        { id: 's7', kind: 'streak', days: 7, name: 'Streak 7' },
        { id: 's7', kind: 'streak', days: 8, name: 'dup' },
        { id: 'bad1', kind: 'streak', days: 0, name: 'x' },
        { id: 'bad2', kind: 'stage', stageId: 'nope', name: 'x' },
        { id: 'bad3', kind: 'people', metric: 'zzz', threshold: 1, name: 'x' },
        { id: 'bad4', kind: 'people', metric: 'f1', threshold: 'many', name: 'x' },
        { id: 'bad5', kind: 'weird', name: 'x' },
        { kind: 'streak', days: 3, name: 'no id' },
        'junk',
        { id: 'ok', kind: 'daily_goal', name: 'Goal' },
      ],
    };
    const cfg = parseAchievementsConfig(raw, PEOPLE.targets, STAGE_IDS);
    expect(cfg.items.map((i) => i.id)).toEqual(['s7', 'ok']);
    expect(cfg.problems).toHaveLength(8);
    expect(cfg.problems.some((p) => p.includes('duplicate id'))).toBe(true);
  });

  it('clamps toastMs and maxPopupsPerAction', () => {
    const low = parseAchievementsConfig({ toastMs: 10, maxPopupsPerAction: 0, soundDefault: false, encouragements: [], items: [] }, PEOPLE.targets, STAGE_IDS);
    expect([low.toastMs, low.maxPopupsPerAction, low.soundDefault]).toEqual([1000, 1, false]);
    const high = parseAchievementsConfig({ toastMs: 99999, maxPopupsPerAction: 50, soundDefault: true, encouragements: [], items: [] }, PEOPLE.targets, STAGE_IDS);
    expect([high.toastMs, high.maxPopupsPerAction]).toEqual([5000, 5]);
  });

  it('falls back to safe defaults for invalid fields and never throws', () => {
    for (const raw of [undefined, null, 'x', 5, [], {}]) {
      const cfg = parseAchievementsConfig(raw, PEOPLE.targets, STAGE_IDS);
      expect(cfg.toastMs).toBe(2000);
      expect(cfg.maxPopupsPerAction).toBe(3);
      expect(cfg.soundDefault).toBe(true);
      expect(cfg.items).toEqual([]);
      expect(cfg.encouragements).toEqual([]);
      expect(cfg.problems.length).toBeGreaterThan(0);
    }
    const partial = parseAchievementsConfig({ toastMs: 'x', soundDefault: 'yes', encouragements: ['ok', 3, ''], items: 'no' }, PEOPLE.targets, STAGE_IDS);
    expect(partial.toastMs).toBe(2000);
    expect(partial.soundDefault).toBe(true);
    expect(partial.encouragements).toEqual(['ok']);
    expect(partial.items).toEqual([]);
  });

  it('skips a "target" threshold when the target is unusable', () => {
    const cfg = parseAchievementsConfig(
      { items: [{ id: 'p', kind: 'people', metric: 'f1', threshold: 'target', name: 'x' }] },
      { contactsTarget: 5, customersTarget: 5, f1Target: Number.NaN },
      STAGE_IDS,
    );
    expect(cfg.items).toEqual([]);
  });
});

describe('evaluateAchievements', () => {
  it('returns nothing for an empty log', () => {
    expect(evaluate([])).toEqual([]);
  });

  it('stage: reached by total XP with the real stage config, lower stages included', () => {
    expect(ids(evaluate([xpEvent(299)]))).toEqual([]);
    expect(ids(evaluate([xpEvent(300)]))).toEqual(['stage:silver']);
    expect(ids(evaluate([xpEvent(900)]))).toEqual(['stage:silver', 'stage:gold']);
    // Emerald needs 4000 XP and 5 new_customer activities, so XP alone stops at platinum.
    expect(ids(evaluate([xpEvent(4000)]))).toEqual(['stage:silver', 'stage:gold', 'stage:platinum']);
  });

  it('stage: ignores a stage id that is not in the injected stage defs', () => {
    const cfg = parseAchievementsConfig(
      { items: [{ id: 'stage:gold', kind: 'stage', stageId: 'gold', name: 'Gold' }] },
      PEOPLE.targets,
      STAGE_IDS,
    );
    const deps = { ...DEPS, stages: STAGES.filter((s) => s.id !== 'gold') };
    expect(evaluate([xpEvent(900)], cfg, deps)).toEqual([]);
  });

  it('daily goal: met today gives id with the local date in the time zone', () => {
    expect(ids(evaluate(goalDay(TODAY)))).toEqual(['daily_goal:2026-03-10']);
    expect(evaluate([xpEvent(30)])).toEqual([]); // no lesson
    // 17:30 UTC on 9 March is already 10 March in Ho Chi Minh (UTC+7).
    const now = new Date('2026-03-09T18:00:00.000Z');
    const events = goalDay('2026-03-09T17:30:00.000Z');
    expect(ids(evaluateAchievements(events, CFG, now, 'Asia/Ho_Chi_Minh', DEPS))).toEqual(['daily_goal:2026-03-10']);
    expect(ids(evaluateAchievements(events, CFG, now, 'UTC', DEPS))).toEqual(['daily_goal:2026-03-09']);
  });

  it('streak: 6 days is not enough, 7 days is', () => {
    const days = (n: number): LogEvent[] =>
      Array.from({ length: n }, (_, i) => goalDay(`2026-03-${String(10 - i).padStart(2, '0')}T09:00:00.000Z`)).flat();
    expect(ids(evaluate(days(6)))).toEqual(['daily_goal:2026-03-10']);
    expect(ids(evaluate(days(7)))).toEqual(['daily_goal:2026-03-10', 'streak:7']);
  });

  it('people: first customer, first NPP', () => {
    const events = [person('a'), person('b'), taskDone('a', 'new_customer'), taskDone('b', 'new_npp')];
    expect(ids(evaluate(events))).toEqual(['people:first_customer', 'people:first_npp']);
    expect(ids(evaluate([person('a'), taskDone('a', 'new_customer')]))).toEqual(['people:first_customer']);
  });

  it('people: "target" reads the injected targets (250 contacts with a small target)', () => {
    const small: PeopleConfig = { ...PEOPLE, targets: { contactsTarget: 3, customersTarget: 2, f1Target: 1 } };
    const deps = { ...DEPS, people: small };
    const cfg = parseAchievementsConfig(gameConfig.achievements, small.targets, STAGE_IDS);
    const two = [person('a'), person('b')];
    expect(ids(evaluate(two, cfg, deps))).toEqual([]);
    expect(ids(evaluate([...two, person('c')], cfg, deps))).toEqual(['people:contacts_target']);
  });

  it('people: achieved30x30 uses stats.achieved', () => {
    const small: PeopleConfig = { ...PEOPLE, targets: { contactsTarget: 3, customersTarget: 1, f1Target: 1 } };
    const deps = { ...DEPS, people: small };
    const cfg = parseAchievementsConfig(gameConfig.achievements, small.targets, STAGE_IDS);
    const events = [person('a'), person('b'), taskDone('a', 'new_customer'), taskDone('b', 'new_npp')];
    expect(ids(evaluate(events, cfg, deps))).toEqual([
      'people:first_customer',
      'people:first_npp',
      'people:customers_target',
      'people:f1_target',
      'people:achieved_30x30',
    ]);
    expect(ids(evaluate(events.slice(0, 3), cfg, deps))).not.toContain('people:achieved_30x30');
  });

  it('a new streak item added only through config is returned (365)', () => {
    const raw = {
      ...gameConfig.achievements,
      items: [...gameConfig.achievements.items, { id: 'streak:2', kind: 'streak', days: 2, name: 'Streak 2 ngày' }],
    };
    const cfg = parseAchievementsConfig(raw, PEOPLE.targets, STAGE_IDS);
    const events = [...goalDay('2026-03-10T09:00:00.000Z'), ...goalDay('2026-03-09T09:00:00.000Z')];
    expect(ids(evaluate(events))).not.toContain('streak:2');
    expect(ids(evaluate(events, cfg))).toContain('streak:2');
    const big = parseAchievementsConfig(
      { items: [{ id: 'streak:365', kind: 'streak', days: 365, name: 'Streak 365 ngày' }] },
      PEOPLE.targets,
      STAGE_IDS,
    );
    expect(evaluate(events, big)).toEqual([]);
  });
});

describe('acknowledgement', () => {
  it('reads achievementAcknowledged ids and the seeded flag', () => {
    const r = readAcknowledged(
      [ev('settings_changed', { achievementAcknowledged: 'streak:7' }), ev('settings_changed', { achievementsSeeded: true }), ev('settings_changed', { sound: { enabled: false } })],
      STAGES,
    );
    expect([...r.ids]).toEqual(['streak:7']);
    expect(r.seeded).toBe(true);
    expect(readAcknowledged([], STAGES)).toEqual({ ids: new Set(), seeded: false });
  });

  it('stageAcknowledged covers that stage and all lower ones', () => {
    const r = readAcknowledged([ev('settings_changed', { stageAcknowledged: 'gold' })], STAGES);
    expect([...r.ids].sort()).toEqual(['stage:gold', 'stage:silver', 'stage:start']);
    expect(readAcknowledged([ev('settings_changed', { stageAcknowledged: 'unknown' })], STAGES).ids.size).toBe(0);
    const achieved = evaluate([xpEvent(900)]);
    expect(ids(newAchievements(achieved, r.ids))).toEqual([]);
  });

  it('ignores compensated acknowledgement events and non-settings events', () => {
    const ack = ev('settings_changed', { achievementAcknowledged: 'streak:7' });
    const comp = ev('settings_changed', { compensates: ack.id });
    expect(readAcknowledged([ack, comp], STAGES).ids.size).toBe(0);
    expect(readAcknowledged([ev('activity_logged', { achievementAcknowledged: 'x' })], STAGES).ids.size).toBe(0);
  });

  it('newAchievements keeps config order', () => {
    const achieved = [item('a'), item('b'), item('c')];
    expect(ids(newAchievements(achieved, new Set(['b'])))).toEqual(['a', 'c']);
  });

  it('undo below a milestone then regain is not new (ack event stays)', () => {
    const first = person('a');
    const done = taskDone('a', 'new_customer');
    const log: LogEvent[] = [first, done];
    const gained = evaluate(log);
    expect(ids(newAchievements(gained, readAcknowledged(log, STAGES).ids))).toEqual(['people:first_customer']);
    log.push(ev('settings_changed', { achievementAcknowledged: 'people:first_customer' }));
    log.push(undo(done));
    expect(evaluate(log)).toEqual([]);
    log.push(taskDone('a', 'new_customer'));
    const regained = evaluate(log);
    expect(ids(regained)).toEqual(['people:first_customer']);
    expect(newAchievements(regained, readAcknowledged(log, STAGES).ids)).toEqual([]);
  });

  it('daily goal: same day regained is not new, next day is', () => {
    const ack = ev('settings_changed', { achievementAcknowledged: 'daily_goal:2026-03-10' });
    const ackIds = readAcknowledged([ack], STAGES).ids;
    expect(newAchievements(evaluate(goalDay(TODAY)), ackIds)).toEqual([]);
    const tomorrow = new Date('2026-03-11T12:00:00.000Z');
    const next = evaluateAchievements(goalDay('2026-03-11T09:00:00.000Z'), CFG, tomorrow, TZ, DEPS);
    expect(ids(newAchievements(next, ackIds))).toEqual(['daily_goal:2026-03-11']);
  });
});

describe('silent seeding', () => {
  const achieved = [item('stage:silver', 'stage'), item('streak:7', 'streak')];

  it('first run: silent acknowledges for every achieved item plus the seeded marker', () => {
    expect(buildSeedEvents(achieved, false)).toEqual([
      { type: 'settings_changed', payload: { achievementAcknowledged: 'stage:silver', silent: true } },
      { type: 'settings_changed', payload: { achievementAcknowledged: 'streak:7', silent: true } },
      { type: 'settings_changed', payload: { achievementsSeeded: true } },
    ]);
  });

  it('first run with nothing achieved still writes the seeded marker', () => {
    expect(buildSeedEvents([], false)).toEqual([{ type: 'settings_changed', payload: { achievementsSeeded: true } }]);
  });

  it('already seeded gives no events', () => {
    expect(buildSeedEvents(achieved, true)).toEqual([]);
  });

  it('skips items already acknowledged and passes a timestamp through', () => {
    const events = buildSeedEvents(achieved, false, new Set(['stage:silver']), '2026-03-10T00:00:00.000Z');
    expect(events.map((e) => e.payload)).toEqual([{ achievementAcknowledged: 'streak:7', silent: true }, { achievementsSeeded: true }]);
    expect(events.every((e) => e.timestamp === '2026-03-10T00:00:00.000Z')).toBe(true);
  });

  it('import helper returns only acknowledge events, none after they are applied', () => {
    const events = buildSilentAcknowledgeEvents(achieved, new Set());
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.payload.silent === true && e.payload.achievementsSeeded === undefined)).toBe(true);
    expect(buildSilentAcknowledgeEvents(achieved, new Set(['stage:silver', 'streak:7']))).toEqual([]);
  });

  it('after seeding nothing is new', () => {
    const log = [xpEvent(300)];
    const now = evaluate(log);
    const seed = buildSeedEvents(now, readAcknowledged(log, STAGES).seeded).map((e) => ev(e.type, { ...e.payload }));
    const after = readAcknowledged([...log, ...seed], STAGES);
    expect(after.seeded).toBe(true);
    expect(newAchievements(now, after.ids)).toEqual([]);
  });
});

describe('planPopups', () => {
  const mk = (n: number): AchievedItem[] => Array.from({ length: n }, (_, i) => item(`p${i}`));

  it('1 item: one single', () => {
    expect(planPopups(mk(1), 3).popups).toEqual([{ kind: 'single', item: mk(1)[0] }]);
  });

  it('3 items with max 3: three singles', () => {
    expect(planPopups(mk(3), 3).popups.map((p) => p.kind)).toEqual(['single', 'single', 'single']);
  });

  it('4 items: two singles then a rest popup with 2', () => {
    const plan = planPopups(mk(4), 3).popups;
    expect(plan.map((p) => p.kind)).toEqual(['single', 'single', 'rest']);
    expect(plan[2]).toEqual({ kind: 'rest', count: 2 });
  });

  it('6 items: two singles then rest with 4', () => {
    const plan = planPopups(mk(6), 3).popups;
    expect(plan[plan.length - 1]).toEqual({ kind: 'rest', count: 4 });
    expect(plan).toHaveLength(3);
  });

  it('sorts stage, daily goal, streak, people and keeps config order inside a kind', () => {
    const input = [item('p1', 'people'), item('s7', 'streak'), item('g', 'stage'), item('d', 'daily_goal'), item('p0', 'people'), item('g2', 'stage')];
    const plan = planPopups(input, 10).popups;
    expect(plan.map((p) => (p.kind === 'single' ? p.item.id : '?'))).toEqual(['g', 'g2', 'd', 's7', 'p1', 'p0']);
  });

  it('max 1 gives only a rest popup when more than one item; empty gives none', () => {
    expect(planPopups(mk(3), 1).popups).toEqual([{ kind: 'rest', count: 3 }]);
    expect(planPopups([], 3).popups).toEqual([]);
  });
});

describe('toasts', () => {
  const nameFor = (e: LogEvent): string => String(e.payload.activityType ?? 'Bài Học');

  it('builds xp and label only for a finite xp > 0', () => {
    expect(buildToast(ev('activity_logged', { activityType: 'demo', xp: 15 }), nameFor)).toEqual({ xp: 15, label: 'demo' });
    expect(buildToast(ev('activity_logged', { xp: 0 }), nameFor)).toBeNull();
    expect(buildToast(ev('activity_logged', { xp: -5 }), nameFor)).toBeNull();
    expect(buildToast(ev('activity_logged', { xp: Number.NaN }), nameFor)).toBeNull();
    expect(buildToast(ev('activity_logged', { xp: '10' }), nameFor)).toBeNull();
    expect(buildToast(ev('settings_changed', { sound: true }), nameFor)).toBeNull();
  });

  it('ignores a compensating event', () => {
    expect(buildToast(ev('activity_logged', { compensates: 'x', xp: 10 }), nameFor)).toBeNull();
  });

  it('queues up to 3 then merges the overflow into the last toast', () => {
    let q: QueuedToast[] = [];
    for (const xp of [10, 20, 30]) q = queueToasts(q, { xp, label: `t${xp}` });
    expect(q.map((t) => t.xp)).toEqual([10, 20, 30]);
    expect(q.every((t) => t.count === 1)).toBe(true);
    q = queueToasts(q, { xp: 5, label: 'x' });
    expect(q).toHaveLength(3);
    expect(q[2]).toEqual({ xp: 35, label: 't30', count: 2 });
    q = queueToasts(q, { xp: 5, label: 'y' });
    expect(q[2]).toEqual({ xp: 40, label: 't30', count: 3 });
    expect(q.slice(0, 2).map((t) => t.xp)).toEqual([10, 20]);
  });

  it('does not mutate the pending queue and honours maxQueue', () => {
    const pending: QueuedToast[] = [{ xp: 1, label: 'a', count: 1 }];
    const next = queueToasts(pending, { xp: 2, label: 'b' }, 1);
    expect(pending).toEqual([{ xp: 1, label: 'a', count: 1 }]);
    expect(next).toEqual([{ xp: 3, label: 'a', count: 2 }]);
  });
});

describe('pickEncouragement', () => {
  const list = ['a', 'b', 'c'];

  it('uses the injected random', () => {
    expect(pickEncouragement(list, null, fakeRandom(0))).toBe('a');
    expect(pickEncouragement(list, null, fakeRandom(0.5))).toBe('b');
    expect(pickEncouragement(list, null, fakeRandom(0.999))).toBe('c');
  });

  it('never repeats the last used sentence when there is more than one', () => {
    for (const r of [0, 0.3, 0.5, 0.7, 0.999]) {
      expect(pickEncouragement(list, 'b', fakeRandom(r))).not.toBe('b');
    }
    expect(pickEncouragement(['a', 'b'], 'a', fakeRandom(0))).toBe('b');
  });

  it('returns the only sentence even if it equals lastUsed', () => {
    expect(pickEncouragement(['solo'], 'solo', fakeRandom(0.4))).toBe('solo');
  });

  it('uses the default sentence for an empty list', () => {
    expect(pickEncouragement([], null, fakeRandom(0))).toBe(DEFAULT_ENCOURAGEMENT);
  });

  it('is safe against out-of-range random values', () => {
    expect(pickEncouragement(list, null, () => 1)).toBe('c');
    expect(pickEncouragement(list, null, () => Number.NaN)).toBe('a');
  });
});

describe('regression: existing computations unchanged', () => {
  const log = [
    ...goalDay('2026-03-09T09:00:00.000Z'),
    ...goalDay(TODAY),
    xpEvent(270),
    person('a'),
    person('b'),
    taskDone('a', 'new_customer'),
  ];

  it('computeProgress, computeStageProgress and computePeopleStats keep their known values', () => {
    const progress = computeProgress(log, NOW, DEPS.progress, TZ);
    expect(progress.totalXp).toBe(330);
    expect(progress.streak).toBe(2);
    expect(progress.dailyGoal.met).toBe(true);
    const stage = computeStageProgress(log, progress.totalXp, STAGES);
    expect(stage.current?.id).toBe('silver');
    expect(stage.currentIndex).toBe(1);
    const stats = computePeopleStats(derivePeople(log, PEOPLE), PEOPLE);
    expect(stats).toEqual({ customers: 1, f1: 0, contacts: 2, achieved: false, contactsMet: false });
  });

  it('evaluating and acknowledging does not change the results', () => {
    const before = [computeProgress(log, NOW, DEPS.progress, TZ), computePeopleStats(derivePeople(log, PEOPLE), PEOPLE)];
    evaluate(log);
    readAcknowledged(log, STAGES);
    const after = [computeProgress(log, NOW, DEPS.progress, TZ), computePeopleStats(derivePeople(log, PEOPLE), PEOPLE)];
    expect(after).toEqual(before);
  });
});
