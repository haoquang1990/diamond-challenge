/**
 * Rows of the Thành tích screen (story 018). Fixed dates, UTC.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { parseAchievementsConfig } from '../../../src/domain/achievements';
import type { AchievementDeps, AchievementsConfig } from '../../../src/domain/achievements';
import { parsePeopleConfig } from '../../../src/domain/people';
import { parseStageConfig } from '../../../src/domain/stages';
import { buildAchievementRows, formatEarnedDate } from '../../../src/ui/achievements-helpers';

const TZ = 'UTC';
const NOW = new Date('2026-03-10T12:00:00.000Z');
const PEOPLE = parsePeopleConfig(gameConfig);
const STAGES = parseStageConfig(gameConfig.stages).stages;
const CFG: AchievementsConfig = parseAchievementsConfig(gameConfig.achievements, PEOPLE.targets, STAGES.map((s) => s.id));
const DEPS: AchievementDeps = { stages: STAGES, people: PEOPLE, progress: { dailyXpGoal: gameConfig.dailyXpGoal } };

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp = '2026-03-10T09:00:00.000Z'): LogEvent {
  counter += 1;
  return { id: `r${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const ack = (id: string, ts: string, extra: Record<string, unknown> = {}): LogEvent =>
  ev('settings_changed', { achievementAcknowledged: id, ...extra }, ts);
const rows = (events: LogEvent[], config = CFG) => buildAchievementRows(events, config, NOW, TZ, DEPS);
const row = (events: LogEvent[], id: string, config = CFG) => {
  const found = rows(events, config).find((r) => r.id === id);
  if (found === undefined) throw new Error(`no row ${id}`);
  return found;
};

describe('buildAchievementRows', () => {
  it('lists every config item in config order', () => {
    expect(rows([]).map((r) => r.id)).toEqual(CFG.items.map((i) => i.id));
    expect(rows([]).every((r) => !r.earned)).toBe(true);
  });

  it('earned item has the date of its earliest acknowledgement and no progress text', () => {
    const r = row([ack('streak:7', '2026-03-05T08:00:00.000Z'), ack('streak:7', '2026-03-02T08:00:00.000Z')], 'streak:7');
    expect(r).toMatchObject({ earned: true, earnedAt: '2026-03-02T08:00:00.000Z', progressText: null });
  });

  it('silent acknowledgement shows "before" instead of a date', () => {
    expect(row([ack('streak:7', '2026-03-05T08:00:00.000Z', { silent: true })], 'streak:7').earnedAt).toBe('before');
  });

  it('a stage acknowledgement covers the lower stages', () => {
    const events = [ev('settings_changed', { stageAcknowledged: 'gold' }, '2026-03-04T08:00:00.000Z')];
    expect(row(events, 'stage:silver')).toMatchObject({ earned: true, earnedAt: '2026-03-04T08:00:00.000Z' });
    expect(row(events, 'stage:gold').earned).toBe(true);
    expect(row(events, 'stage:platinum').earned).toBe(false);
  });

  it('an undone (compensated) acknowledgement does not count', () => {
    const a = ack('streak:7', '2026-03-05T08:00:00.000Z');
    expect(row([a, ev('settings_changed', { compensates: a.id })], 'streak:7').earned).toBe(false);
  });

  it('stays earned when the live number drops (undone activity)', () => {
    const person = ev('person_added', { personId: 'p1', name: 'A' });
    const events = [person, ack('people:first_customer', '2026-03-06T08:00:00.000Z')];
    expect(row(events, 'people:first_customer')).toMatchObject({ earned: true, earnedAt: '2026-03-06T08:00:00.000Z' });
  });

  it('not-earned progress text per kind', () => {
    const events = [ev('person_added', { personId: 'p1', name: 'A' }), ev('person_added', { personId: 'p2', name: 'B' })];
    expect(row(events, 'streak:7').progressText).toBe('Streak 0/7');
    expect(row(events, 'people:contacts_target').progressText).toBe('Liên hệ 2/250');
    expect(row(events, 'people:first_customer').progressText).toBe('Khách hàng 0/1');
    expect(row(events, 'people:customers_target').progressText).toBe('Khách hàng 0/30');
    expect(row(events, 'people:f1_target').progressText).toBe('NPP F1 0/30');
    expect(row(events, 'people:achieved_30x30').progressText).toBe('Khách hàng 0/30 · NPP F1 0/30');
    expect(row(events, 'stage:silver').progressText).toMatch(/^Còn \d+ XP/);
  });

  it('counts distinct daily goal days in one row', () => {
    const events = [
      ack('daily_goal:2026-03-01', '2026-03-01T20:00:00.000Z'),
      ack('daily_goal:2026-03-01', '2026-03-01T21:00:00.000Z'),
      ack('daily_goal:2026-03-02', '2026-03-02T20:00:00.000Z'),
      ack('daily_goal:2026-03-03', '2026-03-03T20:00:00.000Z', { silent: true }),
    ];
    expect(row(events, 'daily_goal')).toMatchObject({ earned: true, earnedAt: null, progressText: 'Đã đạt mục tiêu ngày 3 lần' });
    expect(row([], 'daily_goal')).toMatchObject({ earned: false, progressText: 'Chưa đạt mục tiêu ngày nào' });
  });

  it('a new config item appears without code changes', () => {
    const extra = parseAchievementsConfig(
      { ...gameConfig.achievements, items: [...gameConfig.achievements.items, { id: 'streak:365', kind: 'streak', days: 365, name: 'Streak 365 ngày' }] },
      PEOPLE.targets,
      STAGES.map((s) => s.id),
    );
    const last = rows([], extra).at(-1);
    expect(last).toMatchObject({ id: 'streak:365', earned: false, progressText: 'Streak 0/365' });
  });
});

describe('formatEarnedDate', () => {
  it('formats dd/mm/yyyy in the given zone and tolerates bad input', () => {
    expect(formatEarnedDate('2026-03-02T23:30:00.000Z', 'UTC')).toBe('02/03/2026');
    expect(formatEarnedDate('2026-03-02T23:30:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('03/03/2026');
    expect(formatEarnedDate('nope', 'UTC')).toBe('');
  });
});
