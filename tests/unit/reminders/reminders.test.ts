/**
 * Daily reminders (story 007, option P1): settings from the log, due check,
 * next reminder instant (midnight, DST, Asia/Ho_Chi_Minh), message text,
 * independence from XP and stage acknowledgement, and the best-effort
 * scheduler against a fake notification platform.
 * Fixed instants only: no real clock, no real timers.
 */
import { describe, expect, it } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { MemoryEventStore } from '../../../src/data/memory-event-store';
import { computeProgress } from '../../../src/domain/progress';
import {
  nextReminderAt,
  parseReminderConfig,
  parseReminderTime,
  readReminderSettings,
  reminderMissing,
  shouldShowReminder,
} from '../../../src/domain/reminders';
import type { ReminderSettings } from '../../../src/domain/reminders';
import { lastAcknowledgedStageId } from '../../../src/domain/stages';
import { createReminderScheduler } from '../../../src/notifications/reminders';
import type { NotificationPlatform, ReminderNotification, ReminderPermission } from '../../../src/notifications/reminders';
import { reminderMessage } from '../../../src/ui/strings';

const VN = 'Asia/Ho_Chi_Minh';
const NEW_YORK = 'America/New_York';
const CONFIG = parseReminderConfig(gameConfig.reminder);
const PROGRESS_CONFIG = { dailyXpGoal: 30 };
const ON_20: ReminderSettings = { enabled: true, time: '20:00' };

let counter = 0;
function ev(type: EventType, payload: Record<string, unknown>, timestamp = '2026-11-03T01:00:00.000Z'): LogEvent {
  counter += 1;
  return { id: `r${counter}`, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
function reminderEvent(reminder: unknown, timestamp?: string): LogEvent {
  return ev('settings_changed', { reminder }, timestamp);
}
const iso = (d: Date | null): string | null => (d === null ? null : d.toISOString());

describe('parseReminderConfig / parseReminderTime', () => {
  it('reads the game-config defaults', () => {
    expect(CONFIG).toEqual({ defaultTime: '20:00', enabledByDefault: false });
  });
  it('falls back per field on bad config', () => {
    expect(parseReminderConfig(undefined)).toEqual({ defaultTime: '20:00', enabledByDefault: false });
    expect(parseReminderConfig({ defaultTime: '25:00', enabledByDefault: true })).toEqual({ defaultTime: '20:00', enabledByDefault: true });
  });
  it('accepts 00:00..23:59 and rejects anything else', () => {
    expect(parseReminderTime('00:00')).toBe(0);
    expect(parseReminderTime('23:59')).toBe(23 * 60 + 59);
    for (const bad of ['24:00', '7:30', '07:60', '07:30:00', '', 730, null]) expect(parseReminderTime(bad)).toBeNull();
  });
});

describe('readReminderSettings', () => {
  it('uses config defaults with no reminder event', () => {
    expect(readReminderSettings([], CONFIG)).toEqual({ enabled: false, time: '20:00' });
    expect(readReminderSettings([], { defaultTime: '07:15', enabledByDefault: true })).toEqual({ enabled: true, time: '07:15' });
  });
  it('latest timestamp wins, regardless of array order', () => {
    const events = [
      reminderEvent({ enabled: true, time: '21:00' }, '2026-11-03T02:00:00.000Z'),
      reminderEvent({ enabled: false, time: '06:30' }, '2026-11-03T01:00:00.000Z'),
    ];
    expect(readReminderSettings(events, CONFIG)).toEqual({ enabled: true, time: '21:00' });
  });
  it('ties go to the later event in the array', () => {
    const t = '2026-11-03T02:00:00.000Z';
    const events = [reminderEvent({ enabled: true, time: '21:00' }, t), reminderEvent({ enabled: false, time: '22:00' }, t)];
    expect(readReminderSettings(events, CONFIG)).toEqual({ enabled: false, time: '22:00' });
  });
  it('ignores invalid reminder payloads (the previous valid choice stays)', () => {
    const events = [
      reminderEvent({ enabled: true, time: '21:00' }, '2026-11-03T01:00:00.000Z'),
      reminderEvent({ enabled: 'yes', time: '22:00' }, '2026-11-03T02:00:00.000Z'),
      reminderEvent({ enabled: false, time: '9pm' }, '2026-11-03T03:00:00.000Z'),
      reminderEvent('on', '2026-11-03T04:00:00.000Z'),
      ev('settings_changed', { stageAcknowledged: 'silver' }, '2026-11-03T05:00:00.000Z'),
    ];
    expect(readReminderSettings(events, CONFIG)).toEqual({ enabled: true, time: '21:00' });
  });
  it('only invalid events → defaults', () => {
    expect(readReminderSettings([reminderEvent({ time: '21:00' })], CONFIG)).toEqual({ enabled: false, time: '20:00' });
  });
  it('skips compensated settings events', () => {
    const on = reminderEvent({ enabled: true, time: '21:00' }, '2026-11-03T02:00:00.000Z');
    const undo = ev('settings_changed', { compensates: on.id }, '2026-11-03T03:00:00.000Z');
    expect(readReminderSettings([on, undo], CONFIG)).toEqual({ enabled: false, time: '20:00' });
  });
});

describe('shouldShowReminder (Asia/Ho_Chi_Minh, UTC+7, reminder 20:00 = 13:00Z)', () => {
  it('false before, true at and after the reminder time', () => {
    expect(shouldShowReminder(ON_20, new Date('2026-11-03T12:59:00.000Z'), VN, false)).toBe(false);
    expect(shouldShowReminder(ON_20, new Date('2026-11-03T13:00:00.000Z'), VN, false)).toBe(true);
    expect(shouldShowReminder(ON_20, new Date('2026-11-03T16:59:00.000Z'), VN, false)).toBe(true);
  });
  it('false again after local midnight (a new day before its reminder time)', () => {
    expect(shouldShowReminder(ON_20, new Date('2026-11-03T17:30:00.000Z'), VN, false)).toBe(false);
  });
  it('false when today’s goal is met', () => {
    expect(shouldShowReminder(ON_20, new Date('2026-11-03T15:00:00.000Z'), VN, true)).toBe(false);
  });
  it('false when disabled', () => {
    expect(shouldShowReminder({ enabled: false, time: '20:00' }, new Date('2026-11-03T15:00:00.000Z'), VN, false)).toBe(false);
  });
  it('uses the given time zone, not UTC', () => {
    // 13:30Z is 08:30 in New York: before a 20:00 reminder there.
    expect(shouldShowReminder(ON_20, new Date('2026-11-03T13:30:00.000Z'), NEW_YORK, false)).toBe(false);
  });
});

describe('nextReminderAt', () => {
  it('Asia/Ho_Chi_Minh: today when still ahead, tomorrow once reached', () => {
    expect(iso(nextReminderAt(ON_20, new Date('2026-11-03T12:00:00.000Z'), VN))).toBe('2026-11-03T13:00:00.000Z');
    expect(iso(nextReminderAt(ON_20, new Date('2026-11-03T13:00:00.000Z'), VN))).toBe('2026-11-04T13:00:00.000Z');
  });
  it('across local midnight', () => {
    const early: ReminderSettings = { enabled: true, time: '00:15' };
    // 23:50 on Nov 3 local → 00:15 on Nov 4 local.
    expect(iso(nextReminderAt(early, new Date('2026-11-03T16:50:00.000Z'), VN))).toBe('2026-11-03T17:15:00.000Z');
    // 00:30 on Nov 4 local → 00:15 on Nov 5 local.
    expect(iso(nextReminderAt(early, new Date('2026-11-03T17:30:00.000Z'), VN))).toBe('2026-11-04T17:15:00.000Z');
  });
  it('across month/year end', () => {
    expect(iso(nextReminderAt(ON_20, new Date('2026-12-31T14:00:00.000Z'), VN))).toBe('2027-01-01T13:00:00.000Z');
  });
  it('skipToday starts from tomorrow', () => {
    expect(iso(nextReminderAt(ON_20, new Date('2026-11-03T12:00:00.000Z'), VN, true))).toBe('2026-11-04T13:00:00.000Z');
  });
  it('null for an invalid time', () => {
    expect(nextReminderAt({ enabled: true, time: 'xx' }, new Date('2026-11-03T12:00:00.000Z'), VN)).toBeNull();
  });

  describe('America/New_York DST', () => {
    it('spring forward 2026-03-08: 20:00 the day after the switch is 20:00 EDT (UTC-4)', () => {
      // 22:00 EST on Mar 7.
      expect(iso(nextReminderAt(ON_20, new Date('2026-03-08T03:00:00.000Z'), NEW_YORK))).toBe('2026-03-09T00:00:00.000Z');
    });
    it('spring forward 2026-03-08: a skipped time (02:30) moves forward to 03:30 EDT', () => {
      // 00:00 EST on Mar 8.
      const at = nextReminderAt({ enabled: true, time: '02:30' }, new Date('2026-03-08T05:00:00.000Z'), NEW_YORK);
      expect(iso(at)).toBe('2026-03-08T07:30:00.000Z');
    });
    it('fall back 2026-11-01: 20:00 the day of the switch is 20:00 EST (UTC-5)', () => {
      // Exactly 20:00 EDT on Oct 31 → reached → tomorrow.
      expect(iso(nextReminderAt(ON_20, new Date('2026-11-01T00:00:00.000Z'), NEW_YORK))).toBe('2026-11-02T01:00:00.000Z');
    });
    it('fall back 2026-11-01: a repeated time (01:30) takes the first occurrence (EDT)', () => {
      // 00:00 EDT on Nov 1.
      const at = nextReminderAt({ enabled: true, time: '01:30' }, new Date('2026-11-01T04:00:00.000Z'), NEW_YORK);
      expect(iso(at)).toBe('2026-11-01T05:30:00.000Z');
    });
    it('fall back 2026-11-01: after the first 01:30 has passed, the next one is tomorrow', () => {
      // 01:45 EDT (first pass) on Nov 1.
      const at = nextReminderAt({ enabled: true, time: '01:30' }, new Date('2026-11-01T05:45:00.000Z'), NEW_YORK);
      expect(iso(at)).toBe('2026-11-02T06:30:00.000Z');
    });
  });
});

describe('reminderMessage', () => {
  it('mentions the streak and what is missing', () => {
    expect(reminderMessage(5, { xp: 0, lesson: true, activity: true })).toBe('Giữ chuỗi 5 ngày nhé! Còn 1 bài Học và 1 việc Làm.');
    expect(reminderMessage(2, { xp: 12, lesson: false, activity: true })).toBe('Giữ chuỗi 2 ngày nhé! Còn 1 việc Làm và 12 XP.');
    expect(reminderMessage(3, { xp: 5, lesson: true, activity: true })).toBe('Giữ chuỗi 3 ngày nhé! Còn 1 bài Học, 1 việc Làm và 5 XP.');
  });
  it('with no streak invites to start one', () => {
    expect(reminderMessage(0, { xp: 30, lesson: true, activity: true })).toContain('Bắt đầu chuỗi ngày');
  });
  it('reminderMissing derives the gaps from the daily-goal status', () => {
    const p = computeProgress([ev('lesson_completed', { xp: 10 }, '2026-11-03T02:00:00.000Z')], new Date('2026-11-03T14:00:00.000Z'), PROGRESS_CONFIG, VN);
    expect(reminderMissing(p.dailyGoal)).toEqual({ xp: 20, lesson: false, activity: true });
  });
});

describe('settings_changed {reminder} is independent of progress and stages', () => {
  it('does not change XP, streak or stage acknowledgement', () => {
    const base = [
      ev('lesson_completed', { xp: 10 }, '2026-11-03T02:00:00.000Z'),
      ev('activity_logged', { xp: 20, activityType: 'opp' }, '2026-11-03T03:00:00.000Z'),
      ev('settings_changed', { stageAcknowledged: 'start' }, '2026-11-03T03:30:00.000Z'),
    ];
    const withReminder = [...base, reminderEvent({ enabled: true, time: '20:00' }, '2026-11-03T04:00:00.000Z')];
    const now = new Date('2026-11-03T14:00:00.000Z');
    expect(computeProgress(withReminder, now, PROGRESS_CONFIG, VN)).toEqual(computeProgress(base, now, PROGRESS_CONFIG, VN));
    expect(lastAcknowledgedStageId(withReminder)).toBe('start');
  });
});

// --- Scheduler (src/notifications/reminders.ts) with a fake platform ---

interface FakePlatform extends NotificationPlatform {
  readonly shown: ReminderNotification[];
  readonly timers: Map<number, { callback: () => void; delayMs: number }>;
  closed: number;
}

function fakePlatform(permission: ReminderPermission, triggers: boolean): FakePlatform {
  let nextId = 1;
  const platform: FakePlatform = {
    shown: [],
    timers: new Map(),
    closed: 0,
    permission: () => permission,
    requestPermission: () => Promise.resolve(permission),
    supportsTriggers: () => triggers,
    show: (n) => {
      platform.shown.push(n);
      return Promise.resolve();
    },
    pending: () => Promise.resolve(platform.shown.map(() => ({ close: () => void (platform.closed += 1) }))),
    setTimer: (callback, delayMs) => {
      const id = nextId++;
      platform.timers.set(id, { callback, delayMs });
      return id;
    },
    clearTimer: (id) => void platform.timers.delete(id),
  };
  return platform;
}

async function setup(permission: ReminderPermission, triggers: boolean, settings: unknown, nowIso: string) {
  const store = new MemoryEventStore('u');
  await store.append({ type: 'settings_changed', payload: { reminder: settings }, timestamp: '2026-11-03T01:00:00.000Z' });
  await store.append({ type: 'activity_logged', payload: { xp: 20, activityType: 'opp' }, timestamp: '2026-11-03T02:00:00.000Z' });
  const clock = { now: new Date(nowIso) };
  const platform = fakePlatform(permission, triggers);
  const scheduler = createReminderScheduler({ eventStore: store, platform, now: () => clock.now, timeZone: VN, progressConfig: PROGRESS_CONFIG, reminderConfig: CONFIG });
  return { store, clock, platform, scheduler };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('createReminderScheduler', () => {
  it('timer path: waits until the reminder time, then notifies with the streak text', async () => {
    const { clock, platform, scheduler } = await setup('granted', false, { enabled: true, time: '20:00' }, '2026-11-03T12:00:00.000Z');
    await scheduler.refresh();
    const [timer] = [...platform.timers.values()];
    expect(timer?.delayMs).toBe(60 * 60_000);
    clock.now = new Date('2026-11-03T13:00:00.000Z');
    timer?.callback();
    await flush();
    expect(platform.shown).toHaveLength(1);
    expect(platform.shown[0]?.body).toBe(reminderMessage(0, { xp: 10, lesson: true, activity: false }));
    expect(platform.shown[0]?.showAt).toBeUndefined();
    // Re-armed for tomorrow (the newest timer; the fired one stays in the fake's map).
    expect([...platform.timers.values()].at(-1)?.delayMs).toBe(24 * 60 * 60_000);
  });

  it('timer path: does not notify if the goal was met before the timer fired', async () => {
    const { store, clock, platform, scheduler } = await setup('granted', false, { enabled: true, time: '20:00' }, '2026-11-03T12:00:00.000Z');
    await scheduler.refresh();
    const [timer] = [...platform.timers.values()];
    expect(timer).toBeDefined();
    await store.append({ type: 'lesson_completed', payload: { xp: 10 }, timestamp: '2026-11-03T12:30:00.000Z' });
    clock.now = new Date('2026-11-03T13:00:00.000Z');
    timer?.callback();
    await flush();
    expect(platform.shown).toHaveLength(0);
  });

  it('trigger path: schedules one notification at the next reminder instant and replaces the old one', async () => {
    const { platform, scheduler } = await setup('granted', true, { enabled: true, time: '20:00' }, '2026-11-03T12:00:00.000Z');
    await scheduler.refresh();
    expect(platform.shown).toHaveLength(1);
    expect(platform.shown[0]?.showAt).toBe(Date.parse('2026-11-03T13:00:00.000Z'));
    expect(platform.timers.size).toBe(0);
    await scheduler.refresh();
    expect(platform.closed).toBe(1);
  });

  it('goal already met today: cancels pending and schedules from tomorrow', async () => {
    const { store, platform, scheduler } = await setup('granted', true, { enabled: true, time: '20:00' }, '2026-11-03T12:00:00.000Z');
    await store.append({ type: 'lesson_completed', payload: { xp: 10 }, timestamp: '2026-11-03T03:00:00.000Z' });
    await scheduler.refresh();
    expect(platform.shown[0]?.showAt).toBe(Date.parse('2026-11-04T13:00:00.000Z'));
  });

  it('nothing is scheduled when disabled or when permission is not granted', async () => {
    for (const [permission, settings] of [
      ['granted', { enabled: false, time: '20:00' }],
      ['denied', { enabled: true, time: '20:00' }],
      ['default', { enabled: true, time: '20:00' }],
      ['unsupported', { enabled: true, time: '20:00' }],
    ] as const) {
      const { platform, scheduler } = await setup(permission, false, settings, '2026-11-03T12:00:00.000Z');
      await scheduler.refresh();
      expect(platform.timers.size).toBe(0);
      expect(platform.shown).toHaveLength(0);
    }
  });
});
