/**
 * Per-account stores and legacy-store migration (story 030). fake-indexeddb, fixed data.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_DB_NAME,
  accountDbName,
  decideLegacyMigration,
  deleteAccountStore,
  eraseAccountData,
  linkedAccountIds,
  migrateLegacyStore,
  openAccountStore,
  readDeviceAccount,
  updateDeviceAccount,
} from '../../../src/data/account-stores';
import type { KeyValueStorage, MigrationMarker } from '../../../src/data/account-stores';
import { IndexedDbEventStore } from '../../../src/data/indexeddb-event-store';
import type { LogEvent } from '../../../src/data/event-store';

const LEGACY_USER = 'legacy-user';
const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';

const legacyEvents: LogEvent[] = [
  { id: 'e1', type: 'lesson_completed', timestamp: '2026-11-01T01:00:00.000Z', userId: LEGACY_USER, schemaVersion: 1, payload: { lessonId: 'l1' }, syncedAt: null },
  { id: 'e2', type: 'activity_logged', timestamp: '2026-11-01T01:00:00.000Z', userId: LEGACY_USER, schemaVersion: 1, payload: { activityType: 'call', xp: 10 }, syncedAt: '2026-11-02T00:00:00.000Z' },
  { id: 'e3', type: 'person_added', timestamp: '2026-11-03T01:00:00.000Z', userId: LEGACY_USER, schemaVersion: 1, payload: { personId: 'p1', name: 'An' }, syncedAt: null },
];

const linkEvent = (accountId: string): LogEvent => ({
  id: `link-${accountId}`,
  type: 'settings_changed',
  timestamp: '2026-11-04T01:00:00.000Z',
  userId: LEGACY_USER,
  schemaVersion: 1,
  payload: { accountLinked: { localUserId: LEGACY_USER, accountId } },
  syncedAt: null,
});

function memoryMarker(initial: string | null = null): MigrationMarker & { value: string | null } {
  const m = {
    value: initial,
    read: () => m.value,
    write: (id: string) => {
      m.value = id;
    },
  };
  return m;
}

/** Writes the legacy database exactly as the phase-1 app did (events + meta userId + a cursor). */
async function seedLegacy(events: readonly LogEvent[]): Promise<void> {
  const store = new IndexedDbEventStore(LEGACY_DB_NAME);
  await store.seedFrom(events, new Map<string, unknown>([['userId', LEGACY_USER], ['syncCursor:h1', 7]]));
}

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((d) => d.name ?? '');
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('decideLegacyMigration', () => {
  const base = { migratedTo: null, accountId: ACCOUNT_A, legacyEventCount: 3, linked: new Set<string>() };

  it('copies when unmigrated and unlinked', () => {
    expect(decideLegacyMigration(base)).toBe('copied');
  });
  it('copies for the linked account', () => {
    expect(decideLegacyMigration({ ...base, linked: new Set([ACCOUNT_A]) })).toBe('copied');
  });
  it('does not copy when linked only to other accounts', () => {
    expect(decideLegacyMigration({ ...base, linked: new Set([ACCOUNT_B]) })).toBe('linked-to-other');
  });
  it('never migrates twice', () => {
    expect(decideLegacyMigration({ ...base, migratedTo: ACCOUNT_B })).toBe('already-migrated');
  });
  it('has nothing to do for an empty legacy log', () => {
    expect(decideLegacyMigration({ ...base, legacyEventCount: 0 })).toBe('nothing-to-migrate');
  });
});

describe('linkedAccountIds', () => {
  it('reads accountLinked entries and ignores everything else', () => {
    expect(linkedAccountIds([...legacyEvents, linkEvent(ACCOUNT_B), null, 'x'])).toEqual(new Set([ACCOUNT_B]));
  });
});

describe('migrateLegacyStore', () => {
  it('copies every event unchanged and the local userId, then marks the device', async () => {
    await seedLegacy(legacyEvents);
    const marker = memoryMarker();
    const target = openAccountStore(ACCOUNT_A);
    expect(await migrateLegacyStore(ACCOUNT_A, target, marker)).toBe('copied');
    expect(await target.list()).toEqual(legacyEvents);
    expect(await target.getUserId()).toBe(LEGACY_USER);
    expect(await target.readSyncCursor('h1')).toBe(7);
    expect(marker.value).toBe(ACCOUNT_A);
  });

  it('leaves the legacy database untouched', async () => {
    await seedLegacy(legacyEvents);
    await migrateLegacyStore(ACCOUNT_A, openAccountStore(ACCOUNT_A), memoryMarker());
    const legacy = new IndexedDbEventStore(LEGACY_DB_NAME);
    expect(await legacy.list()).toEqual(legacyEvents);
    expect(await legacy.getUserId()).toBe(LEGACY_USER);
  });

  it('does not copy twice: the second account gets an empty store', async () => {
    await seedLegacy(legacyEvents);
    const marker = memoryMarker();
    await migrateLegacyStore(ACCOUNT_A, openAccountStore(ACCOUNT_A), marker);
    const second = openAccountStore(ACCOUNT_B);
    expect(await migrateLegacyStore(ACCOUNT_B, second, marker)).toBe('already-migrated');
    expect(await second.list()).toEqual([]);
  });

  it('a legacy log linked to another account is not transferred and the device stays unmigrated', async () => {
    await seedLegacy([...legacyEvents, linkEvent(ACCOUNT_B)]);
    const marker = memoryMarker();
    const other = openAccountStore(ACCOUNT_A);
    expect(await migrateLegacyStore(ACCOUNT_A, other, marker)).toBe('linked-to-other');
    expect(await other.list()).toEqual([]);
    expect(marker.value).toBeNull();
    const linked = openAccountStore(ACCOUNT_B);
    expect(await migrateLegacyStore(ACCOUNT_B, linked, marker)).toBe('copied');
    expect((await linked.list()).map((e) => e.id)).toEqual(['e1', 'e2', 'e3', `link-${ACCOUNT_B}`]);
  });

  it('keeps the order of events with equal timestamps', async () => {
    await seedLegacy(legacyEvents);
    const target = openAccountStore(ACCOUNT_A);
    await migrateLegacyStore(ACCOUNT_A, target, memoryMarker());
    expect((await target.list()).slice(0, 2).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('retrying after a lost marker does not duplicate events', async () => {
    await seedLegacy(legacyEvents);
    const target = openAccountStore(ACCOUNT_A);
    await migrateLegacyStore(ACCOUNT_A, target, memoryMarker());
    await migrateLegacyStore(ACCOUNT_A, target, memoryMarker());
    expect(await target.list()).toHaveLength(legacyEvents.length);
  });

  it('a fresh device (no legacy database) migrates nothing and creates no legacy database', async () => {
    const marker = memoryMarker();
    expect(await migrateLegacyStore(ACCOUNT_A, openAccountStore(ACCOUNT_A), marker)).toBe('nothing-to-migrate');
    expect(marker.value).toBeNull();
    expect(await databaseNames()).not.toContain(LEGACY_DB_NAME);
  });
});

describe('per-account stores', () => {
  it('names databases per account and keeps accounts apart', async () => {
    expect(accountDbName(ACCOUNT_A)).toBe('diamond-challenge:account-a');
    const a = openAccountStore(ACCOUNT_A);
    await a.append({ type: 'lesson_completed', payload: { lessonId: 'l9' } });
    expect(await openAccountStore(ACCOUNT_B).list()).toEqual([]);
    expect(await openAccountStore(ACCOUNT_A).list()).toHaveLength(1);
  });

  it('deleting an account store removes only that database, never the legacy one', async () => {
    await seedLegacy(legacyEvents);
    const a = openAccountStore(ACCOUNT_A);
    await a.append({ type: 'lesson_completed', payload: { lessonId: 'l9' } });
    await deleteAccountStore(ACCOUNT_A);
    const names = await databaseNames();
    expect(names).not.toContain(accountDbName(ACCOUNT_A));
    expect(names).toContain(LEGACY_DB_NAME);
    expect(await openAccountStore(ACCOUNT_A).list()).toEqual([]);
  });

  it('erasing an account that received the legacy store deletes the legacy database too', async () => {
    await seedLegacy(legacyEvents);
    const marker = memoryMarker();
    const a = openAccountStore(ACCOUNT_A);
    expect(await migrateLegacyStore(ACCOUNT_A, a, marker)).toBe('copied');
    await eraseAccountData(ACCOUNT_A, marker);
    const names = await databaseNames();
    expect(names).not.toContain(accountDbName(ACCOUNT_A));
    expect(names).not.toContain(LEGACY_DB_NAME);
    expect(marker.value).toBe(ACCOUNT_A);
  });

  it('erasing another account keeps the legacy database', async () => {
    await seedLegacy(legacyEvents);
    const marker = memoryMarker(ACCOUNT_A);
    await openAccountStore(ACCOUNT_B).append({ type: 'lesson_completed', payload: { lessonId: 'l9' } });
    await eraseAccountData(ACCOUNT_B, marker);
    const names = await databaseNames();
    expect(names).not.toContain(accountDbName(ACCOUNT_B));
    expect(names).toContain(LEGACY_DB_NAME);
  });

  it('erasing when the device never migrated keeps the legacy database', async () => {
    await seedLegacy(legacyEvents);
    await openAccountStore(ACCOUNT_A).append({ type: 'lesson_completed', payload: { lessonId: 'l9' } });
    await eraseAccountData(ACCOUNT_A, memoryMarker());
    expect(await databaseNames()).toContain(LEGACY_DB_NAME);
  });

  it('refuses an empty account id', async () => {
    await expect(deleteAccountStore('')).rejects.toThrow();
  });
});

describe('device account cache', () => {
  function fakeStorage(): KeyValueStorage {
    const data = new Map<string, string>();
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }

  it('merges updates for the same account and replaces another account', () => {
    const storage = fakeStorage();
    updateDeviceAccount(ACCOUNT_A, { displayName: 'An', isAdmin: true }, storage);
    updateDeviceAccount(ACCOUNT_A, { consentVersion: 1 }, storage);
    expect(readDeviceAccount(storage)).toEqual({ accountId: ACCOUNT_A, phone: null, displayName: 'An', isAdmin: true, consentVersion: 1 });
    updateDeviceAccount(ACCOUNT_B, { phone: '+84912345678' }, storage);
    expect(readDeviceAccount(storage)).toEqual({ accountId: ACCOUNT_B, phone: '+84912345678', displayName: null, isAdmin: false, consentVersion: null });
  });

  it('reads garbage or missing storage as no account', () => {
    const storage = fakeStorage();
    storage.setItem('diamond-challenge:device-account', '{oops');
    expect(readDeviceAccount(storage)).toBeNull();
    expect(readDeviceAccount(null)).toBeNull();
  });
});
