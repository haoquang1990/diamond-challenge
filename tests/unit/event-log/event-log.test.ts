/**
 * Event log storage (story 001): IndexedDB store via fake-indexeddb, plus the
 * in-memory store. Each test opens its own uniquely named database.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENT_SCHEMA_VERSION } from '../../../src/data/event-store';
import { IndexedDbEventStore } from '../../../src/data/indexeddb-event-store';
import { MemoryEventStore } from '../../../src/data/memory-event-store';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_1 = '2026-11-01T10:00:00.000Z';
const DAY_2 = '2026-11-02T10:00:00.000Z';

let dbCounter = 0;
/** A database name no other test uses. */
function uniqueDbName(): string {
  dbCounter += 1;
  return `event-log-test-${dbCounter}`;
}

/** Opens a store and appends one activity (day 1) and one lesson (day 2). */
async function seededStore(dbName: string): Promise<IndexedDbEventStore> {
  const store = new IndexedDbEventStore(dbName);
  await store.append({ type: 'activity_logged', payload: { activityType: 'demo', xp: 10 }, timestamp: DAY_1 });
  await store.append({ type: 'lesson_completed', payload: { xp: 5 }, timestamp: DAY_2 });
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IndexedDbEventStore', () => {
  it('append fills id (UUID), userId, schemaVersion and syncedAt', async () => {
    const store = new IndexedDbEventStore(uniqueDbName());
    const userId = await store.getUserId();
    const event = await store.append({ type: 'activity_logged', payload: { xp: 10 }, timestamp: DAY_1 });
    expect(event.id).toMatch(UUID_PATTERN);
    expect(event.userId).toBe(userId);
    expect(event.schemaVersion).toBe(EVENT_SCHEMA_VERSION);
    expect(event.syncedAt).toBeNull();
    expect(event.timestamp).toBe(DAY_1);
  });

  it('keeps the same userId across a reopen', async () => {
    const dbName = uniqueDbName();
    const first = await new IndexedDbEventStore(dbName).getUserId();
    const reopened = await new IndexedDbEventStore(dbName).getUserId();
    expect(reopened).toBe(first);
  });

  it('persists events across a reopen', async () => {
    const dbName = uniqueDbName();
    await seededStore(dbName);
    const events = await new IndexedDbEventStore(dbName).list();
    expect(events.map((e) => e.timestamp)).toEqual([DAY_1, DAY_2]);
  });

  it('filters by a lower bound', async () => {
    const store = await seededStore(uniqueDbName());
    const events = await store.list({ from: '2026-11-02T00:00:00.000Z' });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('lesson_completed');
  });

  it('returns nothing for an inverted range', async () => {
    const store = await seededStore(uniqueDbName());
    const events = await store.list({ from: '2026-11-03T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' });
    expect(events).toEqual([]);
  });

  it('skips a record with an unknown schemaVersion without throwing', async () => {
    const dbName = uniqueDbName();
    const store = await seededStore(dbName);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(dbName, 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').add({ schemaVersion: 99, timestamp: '2026-11-02T11:00:00.000Z' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    await expect(store.list()).resolves.toHaveLength(2);
    expect(warn).toHaveBeenCalled();
  });
});

describe('MemoryEventStore', () => {
  it('lists events oldest first regardless of append order', async () => {
    const store = new MemoryEventStore('test-user');
    await store.append({ type: 'activity_logged', payload: {}, timestamp: DAY_2 });
    await store.append({ type: 'activity_logged', payload: {}, timestamp: DAY_1 });
    const events = await store.list();
    expect(events.map((e) => e.timestamp)).toEqual([DAY_1, DAY_2]);
  });
});
