/**
 * Con đường stages (story 006): config validation, stage selection,
 * progress percentage, sequential unlock, milestones, acknowledgement.
 * Fixed data only: no clock, no randomness.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { computeProgress } from '../../../src/domain/progress';
import {
  computeStageProgress,
  countActivities,
  lastAcknowledgedStageId,
  parseStageConfig,
  shouldCelebrate,
} from '../../../src/domain/stages';

const STAGES = parseStageConfig(gameConfig.stages).stages;
const NEW_CUSTOMER = 'new_customer';

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp = '2026-01-01T00:00:00.000Z'): LogEvent {
  counter += 1;
  return { id: `e${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
function customers(n: number): LogEvent[] {
  return Array.from({ length: n }, () => ev('activity_logged', { activityType: NEW_CUSTOMER, xp: 0 }));
}
function currentId(xp: number, events: LogEvent[] = []): string | undefined {
  return computeStageProgress(events, xp, STAGES).current?.id;
}

describe('parseStageConfig', () => {
  it('accepts the default game-config stages with no problems', () => {
    const result = parseStageConfig(gameConfig.stages);
    expect(result.problems).toEqual([]);
    expect(result.stages.map((s) => s.name)).toEqual(['Khởi động', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond']);
    expect(result.stages[5]?.milestones[0]).toMatchObject({ activityType: NEW_CUSTOMER, count: 15 });
  });

  it.each([undefined, null, 'x', {}, []])('returns an empty list and a problem for %j', (raw) => {
    const result = parseStageConfig(raw);
    expect(result.stages).toEqual([]);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it('skips malformed stages and reports them without throwing', () => {
    const result = parseStageConfig([
      { id: 'a', name: 'A', xp: 0 },
      null,
      { id: 'b', name: 'B', xp: 'ten' },
      { id: 'c', name: '', xp: 5 },
      { id: 'd', name: 'D', xp: 10, milestones: [{ activityType: 'x', count: 0, label: 'l' }] },
      { id: 'e', name: 'E', xp: 20 },
    ]);
    expect(result.stages.map((s) => s.id)).toEqual(['a', 'e']);
    expect(result.problems).toHaveLength(4);
  });

  it('skips duplicate ids and unsorted stages', () => {
    const result = parseStageConfig([
      { id: 'a', name: 'A', xp: 0 },
      { id: 'b', name: 'B', xp: 100 },
      { id: 'a', name: 'A2', xp: 200 },
      { id: 'c', name: 'C', xp: 50 },
    ]);
    expect(result.stages.map((s) => s.id)).toEqual(['a', 'b']);
    expect(result.problems).toHaveLength(2);
  });
});

describe('stage selection at XP boundaries', () => {
  it.each([
    [0, 'start'],
    [299, 'start'],
    [300, 'silver'],
    [899, 'silver'],
    [900, 'gold'],
    [1999, 'gold'],
    [2000, 'platinum'],
    [3999, 'platinum'],
  ])('%i XP -> %s', (xp, id) => {
    expect(currentId(xp)).toBe(id);
  });

  it('4000 XP needs the Emerald milestone', () => {
    expect(currentId(4000, customers(4))).toBe('platinum');
    expect(currentId(4000, customers(5))).toBe('emerald');
  });

  it('7500 XP needs the Diamond milestone', () => {
    expect(currentId(7500, customers(5))).toBe('emerald');
    expect(currentId(7500, customers(14))).toBe('emerald');
    expect(currentId(7500, customers(15))).toBe('diamond');
  });

  it('has no current stage with an empty stage list', () => {
    const p = computeStageProgress([], 100, []);
    expect(p.current).toBeNull();
    expect(p.currentIndex).toBe(-1);
  });
});

describe('percentage toward the next stage', () => {
  it('is XP-based between the current and next thresholds', () => {
    const p = computeStageProgress([], 600, STAGES);
    expect(p.next?.id).toBe('gold');
    expect(p.percentToNext).toBe(50);
    expect(p.xpToNext).toBe(300);
    expect(p.blockedByMilestones).toBe(false);
  });

  it('is 0 at the start of a stage and clamped to 0..100', () => {
    expect(computeStageProgress([], 0, STAGES).percentToNext).toBe(0);
    expect(computeStageProgress([], -50, STAGES).percentToNext).toBe(0);
  });

  it('XP met but milestone missing is 100% and flagged, not reached', () => {
    const p = computeStageProgress(customers(3), 4000, STAGES);
    expect(p.current?.id).toBe('platinum');
    expect(p.next?.id).toBe('emerald');
    expect(p.percentToNext).toBe(100);
    expect(p.blockedByMilestones).toBe(true);
    expect(p.missingMilestones.map((m) => [m.current, m.count])).toEqual([[3, 5]]);
  });

  it('is clamped to 100 above the threshold and 100 with no next stage', () => {
    expect(computeStageProgress(customers(20), 99999, STAGES).percentToNext).toBe(100);
    expect(computeStageProgress(customers(20), 99999, STAGES).next).toBeNull();
  });
});

describe('sequential unlock', () => {
  it('a higher stage never unlocks before a lower one', () => {
    // Plenty of XP for Diamond, only 3 customers: Emerald blocks Diamond too.
    const p = computeStageProgress(customers(3), 10000, STAGES);
    expect(p.current?.id).toBe('platinum');
    expect(p.stages.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'locked', 'locked']);
    expect(p.stages[5]?.conditionsMet).toBe(false);
  });

  it('marks earlier stages done and reports XP shortfall of locked stages', () => {
    const p = computeStageProgress([], 1000, STAGES);
    expect(p.stages.map((s) => s.state)).toEqual(['done', 'done', 'current', 'locked', 'locked', 'locked']);
    expect(p.stages[3]?.xpMissing).toBe(1000);
  });
});

describe('milestone counting', () => {
  it('ignores compensated activities and the compensating events', () => {
    const logged = customers(5);
    const undo = ev('activity_logged', { compensates: logged[0]?.id });
    const counts = countActivities([...logged, undo]);
    expect(counts.get(NEW_CUSTOMER)).toBe(4);
    expect(currentId(4000, [...logged, undo])).toBe('platinum');
  });

  it('counts only activity_logged events of the matching type', () => {
    const events = [
      ev('lesson_completed', { activityType: NEW_CUSTOMER, xp: 10 }),
      ev('activity_logged', { activityType: 'demo', xp: 15 }),
      ev('activity_logged', { xp: 5 }),
    ];
    expect(countActivities(events).get(NEW_CUSTOMER)).toBeUndefined();
  });
});

describe('acknowledgement', () => {
  it('does not celebrate a first-time user at the starting stage', () => {
    expect(shouldCelebrate(null, 0, STAGES)).toBe(false);
  });

  it('celebrates a first-time user already above the starting stage', () => {
    expect(shouldCelebrate(null, 1, STAGES)).toBe(true);
  });

  it('celebrates only a stage higher than the acknowledged one', () => {
    expect(shouldCelebrate('silver', 2, STAGES)).toBe(true);
    expect(shouldCelebrate('silver', 1, STAGES)).toBe(false);
    expect(shouldCelebrate('gold', 1, STAGES)).toBe(false);
  });

  it('treats an unknown acknowledged id like none and never celebrates without a stage', () => {
    expect(shouldCelebrate('nope', 0, STAGES)).toBe(false);
    expect(shouldCelebrate('nope', 2, STAGES)).toBe(true);
    expect(shouldCelebrate(null, -1, STAGES)).toBe(false);
  });

  it('reads the latest stageAcknowledged from settings_changed events', () => {
    const events = [
      ev('settings_changed', { stageAcknowledged: 'silver' }, '2026-01-01T00:00:00.000Z'),
      ev('settings_changed', { other: true }, '2026-01-03T00:00:00.000Z'),
      ev('settings_changed', { stageAcknowledged: 'gold' }, '2026-01-02T00:00:00.000Z'),
    ];
    expect(lastAcknowledgedStageId(events)).toBe('gold');
    expect(lastAcknowledgedStageId([])).toBeNull();
  });

  it('a settings_changed acknowledgement does not change XP totals', () => {
    const base = [ev('activity_logged', { activityType: 'demo', xp: 15 })];
    const withAck = [...base, ev('settings_changed', { stageAcknowledged: 'silver' })];
    const now = new Date('2026-01-01T12:00:00.000Z');
    const xp = (events: LogEvent[]) => computeProgress(events, now, { dailyXpGoal: 30 }, 'UTC').totalXp;
    expect(xp(withAck)).toBe(xp(base));
  });
});
