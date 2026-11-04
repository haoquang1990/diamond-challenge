import { describe, expect, it } from 'vitest';
import type { LogEvent } from '../../../src/data/event-store';
import { UNKNOWN_PERSON_ID } from '../../../src/domain/people';
import type { PeopleConfig, Person } from '../../../src/domain/people';
import { groupPeopleByStage, listUnassignedActivities, suggestStageChange } from '../../../src/ui/people-helpers';

const CONFIG: PeopleConfig = {
  stages: [
    { id: 'a', name: 'A', xp: 0 },
    { id: 'b', name: 'B', xp: 5 },
    { id: 'c', name: 'C', xp: 10 },
  ],
  targets: { contactsTarget: 1, customersTarget: 1, f1Target: 1 },
};

function person(over: Partial<Person>): Person {
  return { personId: 'p', name: 'P', note: '', archived: false, stageId: 'a', stageXpAwarded: [], ...over };
}

function activity(id: string, timestamp: string): LogEvent {
  return { id, type: 'activity_logged', timestamp, userId: 'u', schemaVersion: 1, payload: {}, syncedAt: null };
}

describe('groupPeopleByStage', () => {
  it('orders by config, skips empty stages and archived people', () => {
    const groups = groupPeopleByStage(
      [person({ personId: '1', stageId: 'c' }), person({ personId: '2', stageId: 'a' }), person({ personId: '3', stageId: 'a', archived: true })],
      CONFIG,
    );
    expect(groups.map((g) => [g.stage.id, g.people.length])).toEqual([['a', 1], ['c', 1]]);
  });
});

describe('suggestStageChange', () => {
  it('gives XP for the next stage', () => {
    expect(suggestStageChange(person({}), 'b', CONFIG)).toEqual({ stage: CONFIG.stages[1], xp: 5 });
  });
  it('suggests a skip with 0 XP', () => {
    expect(suggestStageChange(person({}), 'c', CONFIG)?.xp).toBe(0);
  });
  it('returns null for same, behind, unknown or missing stage', () => {
    expect(suggestStageChange(person({ stageId: 'b' }), 'b', CONFIG)).toBeNull();
    expect(suggestStageChange(person({ stageId: 'c' }), 'a', CONFIG)).toBeNull();
    expect(suggestStageChange(person({}), 'zzz', CONFIG)).toBeNull();
    expect(suggestStageChange(person({}), undefined, CONFIG)).toBeNull();
  });
});

describe('listUnassignedActivities', () => {
  it('lists legacy and unknown-owner activities, newest first', () => {
    const events = [activity('1', '2026-01-01T00:00:00.000Z'), activity('2', '2026-01-02T00:00:00.000Z'), activity('3', '2026-01-03T00:00:00.000Z')];
    const owners = new Map<string, string | null>([['1', null], ['2', UNKNOWN_PERSON_ID], ['3', 'p']]);
    const result = listUnassignedActivities(events, owners);
    expect(result.map((r) => [r.event.id, r.unknownOwner])).toEqual([['2', true], ['1', false]]);
  });
});
