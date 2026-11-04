/** Backup / restore logic (story 011). Fixed data only: no real clock, no randomness. */
import { describe, expect, it, vi } from 'vitest';
import gameConfig from '../../../src/config/game-config.json';
import { backupFileName, buildBackup, parseBackup, planMerge } from '../../../src/data/backup';
import type { EventType, LogEvent } from '../../../src/data/event-store';
import { MemoryEventStore } from '../../../src/data/memory-event-store';
import { derivePeople, parsePeopleConfig } from '../../../src/domain/people';
import { computeProgress } from '../../../src/domain/progress';

const CONFIG = parsePeopleConfig(gameConfig);
const NOW = new Date(2026, 2, 10, 12, 0, 0);

function ev(id: string, type: EventType, payload: Record<string, unknown>, timestamp: string): LogEvent {
  return { id, type, timestamp, userId: 'u', schemaVersion: 1, payload, syncedAt: null };
}
const T = (n: number): string => `2026-03-0${n}T08:00:00.000Z`;
function tenEvents(): LogEvent[] {
  return Array.from({ length: 10 }, (_, i) => ev(`e${i}`, 'activity_logged', { activityType: 'a', xp: 10 }, T(1)));
}
const file = (events: unknown[]): string =>
  JSON.stringify({ format: 'diamond-challenge-backup', formatVersion: 1, exportedAt: 'x', events });

describe('buildBackup', () => {
  it('has the documented shape and local-date file name', () => {
    const events = tenEvents();
    const b = buildBackup(events, NOW);
    expect(b.format).toBe('diamond-challenge-backup');
    expect(b.formatVersion).toBe(1);
    expect(b.exportedAt).toBe(NOW.toISOString());
    expect(b.events).toEqual(events);
    expect(backupFileName(NOW)).toBe('diamond-challenge-backup-2026-03-10.json');
  });
});

describe('parseBackup', () => {
  it('rejects whole files with a reason', () => {
    expect(parseBackup('nope{')).toEqual({ ok: false, reason: 'not-json' });
    expect(parseBackup('[1]')).toEqual({ ok: false, reason: 'not-object' });
    expect(parseBackup('null')).toEqual({ ok: false, reason: 'not-object' });
    expect(parseBackup('{"format":"other","formatVersion":1,"events":[]}')).toEqual({ ok: false, reason: 'wrong-format' });
    expect(parseBackup('{"formatVersion":1,"events":[]}')).toEqual({ ok: false, reason: 'wrong-format' });
    expect(parseBackup('{"format":"diamond-challenge-backup","formatVersion":2,"events":[]}')).toEqual({ ok: false, reason: 'unknown-version' });
    expect(parseBackup('{"format":"diamond-challenge-backup","formatVersion":1,"events":{}}')).toEqual({ ok: false, reason: 'events-not-array' });
  });

  it('keeps 9 of 10 and counts the corrupt one', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const raw: unknown[] = tenEvents();
    raw[4] = { id: 'bad', type: 'nonsense' };
    const r = parseBackup(file(raw));
    expect(r.ok && r.events.length).toBe(9);
    expect(r.ok && r.invalid).toBe(1);
    vi.restoreAllMocks();
  });

  it('round trips build -> parse', () => {
    const events = tenEvents();
    const r = parseBackup(JSON.stringify(buildBackup(events, NOW)));
    expect(r).toEqual({ ok: true, events, invalid: 0 });
  });
});

describe('planMerge', () => {
  it('skips known ids and dedupes inside the file', () => {
    const [a, b, c] = tenEvents();
    const plan = planMerge([a], [a, b, b, c]);
    expect(plan.toAdd.map((e) => e.id)).toEqual([b.id, c.id]);
    expect(plan.added).toBe(2);
    expect(plan.skipped).toBe(2);
    expect(planMerge(new Set([a.id]), [a]).added).toBe(0);
  });
});

describe('MemoryEventStore.importEvents', () => {
  it('adds new, skips existing, never deletes; second import adds 0', async () => {
    const store = new MemoryEventStore('u');
    const local = await store.append({ type: 'settings_changed', payload: { x: 1 }, timestamp: T(5) });
    const events = tenEvents();
    expect(await store.importEvents(events)).toEqual({ added: 10, skipped: 0 });
    expect(await store.importEvents(events)).toEqual({ added: 0, skipped: 10 });
    expect(await store.importEvents([local, events[0]])).toEqual({ added: 0, skipped: 2 });
    const all = await store.list();
    expect(all).toHaveLength(11);
    expect(all.slice(0, 10).map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect(all[10]).toEqual(local);
  });
});

describe('restore with story-012 event types', () => {
  it('rebuilds the same people and progress after import into an empty store', async () => {
    const log: LogEvent[] = [
      ev('p1', 'person_added', { personId: 'a', name: 'An', phone: { country: '+84', number: '912345678' } }, T(1)),
      ev('p2', 'person_added', { personId: 'b', name: 'Binh' }, T(1)),
      ev('t1', 'activity_logged', { activityType: 'contact', xp: 5, personId: 'a', taskId: 'contact' }, T(2)),
      ev('p3', 'person_stage_changed', { personId: 'b', from: 'x', to: 'customer', xp: 50 }, T(2)),
      ev('p4', 'person_archived', { personId: 'b' }, T(3)),
      ev('p5', 'person_restored', { personId: 'b' }, T(4)),
    ];
    const parsed = parseBackup(JSON.stringify(buildBackup(log, NOW)));
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.invalid).toBe(0);
    const store = new MemoryEventStore('u2');
    await store.importEvents(parsed.events);
    const restored = await store.list();
    const pc = { dailyXpGoal: gameConfig.dailyXpGoal };
    expect(derivePeople(restored, CONFIG)).toEqual(derivePeople(log, CONFIG));
    expect(computeProgress(restored, NOW, pc, 'UTC')).toEqual(computeProgress(log, NOW, pc, 'UTC'));
  });
});
