/**
 * Personal progress sync (story 032): two fake-indexeddb stores plus a fake Supabase client that
 * behaves like `personal_events` (insert ignoring duplicates, sync_seq by arrival, RLS by user and
 * consent). Fixed data, no clock, no random.
 */
import 'fake-indexeddb/auto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAcknowledged } from '../../src/domain/achievements';
import { computeProgress } from '../../src/domain/progress';
import { isContactEvent } from '../../src/data/contact-sync';
import type { EventStore, LogEvent, SyncStateStore } from '../../src/data/event-store';
import { IndexedDbEventStore } from '../../src/data/indexeddb-event-store';
import { createProgressSyncController, progressCursorKey, syncProgress } from '../../src/data/progress-sync';
import type { ProgressSyncConfig } from '../../src/data/progress-sync';

type Store = EventStore & SyncStateStore;

const ACCOUNT = 'acc-1';
const OTHER_ACCOUNT = 'acc-2';
const HOUSEHOLD = 'h-1';
const NOW = new Date('2026-11-02T05:00:00.000Z');
const NOW_ISO = NOW.toISOString();
const PROGRESS = { dailyXpGoal: 20 };
const TZ = 'Asia/Ho_Chi_Minh';
const CONFIG: ProgressSyncConfig = { pushBatchSize: 2, pullOverlap: 1, pullPageSize: 2, debounceMs: 10 };

let dbCounter = 0;
const stores: IndexedDbEventStore[] = [];
function newStore(): Store {
  const store = new IndexedDbEventStore(`progress-sync-test-${dbCounter++}`);
  stores.push(store);
  return store;
}
afterEach(() => {
  vi.restoreAllMocks();
});

function ev(id: string, type: LogEvent['type'], timestamp: string, payload: LogEvent['payload'], syncedAt: string | null = null): LogEvent {
  return { id, type, timestamp, userId: 'local-user', schemaVersion: 1, payload, syncedAt };
}

/** Device A's progress: two days, goal met on both, one acknowledged achievement and the seed. */
const deviceA: LogEvent[] = [
  ev('l1', 'lesson_completed', '2026-11-01T01:00:00.000Z', { lessonId: 'lesson-1', xp: 10 }),
  ev('a1', 'activity_logged', '2026-11-01T02:00:00.000Z', { activityType: 'call', xp: 10 }),
  ev('l2', 'lesson_completed', '2026-11-02T01:00:00.000Z', { lessonId: 'lesson-2', xp: 10 }),
  ev('a2', 'activity_logged', '2026-11-02T02:00:00.000Z', { activityType: 'call', xp: 15 }),
  ev('seed', 'settings_changed', '2026-11-02T02:30:00.000Z', { achievementsSeeded: true, silent: true }),
  ev('ack1', 'settings_changed', '2026-11-02T03:00:00.000Z', { achievementAcknowledged: 'streak:2' }),
];

/** Everything the user sees derived from a store, through the existing pure functions. */
async function summary(store: Store) {
  const events = await store.list();
  const progress = computeProgress(events, NOW, PROGRESS, TZ);
  const ack = readAcknowledged(events, []);
  return {
    totalXp: progress.totalXp,
    xpToday: progress.xpToday,
    streak: progress.streak,
    goalMet: progress.dailyGoal.met,
    lessons: events
      .filter((e) => e.type === 'lesson_completed')
      .map((e) => e.payload.lessonId)
      .sort(),
    acknowledged: [...ack.ids].sort(),
    seeded: ack.seeded,
  };
}

interface ServerRow {
  id: string;
  user_id: string;
  type: string;
  occurred_at: string;
  schema_version: number;
  payload: Record<string, unknown>;
  sync_seq: number;
}

/** Fake `personal_events` server. `fail` decides per upsert call (1-based) whether it errors. */
class FakeServer {
  rows: ServerRow[] = [];
  nextSeq = 1;
  consented = true;
  signedInAs: string | null = ACCOUNT;
  upsertCalls = 0;
  selectCalls = 0;
  tablesTouched: string[] = [];
  insertedRaw: unknown[] = [];
  fail: (call: number) => { code?: string; status: number } | null = () => null;
  failSelect: { code?: string; status: number } | null = null;

  get client(): SupabaseClient {
    return { from: (table: string) => this.from(table) } as unknown as SupabaseClient;
  }

  seed(events: readonly LogEvent[], userId = ACCOUNT): void {
    for (const e of events) this.insert({ id: e.id, user_id: userId, type: e.type, occurred_at: e.timestamp, schema_version: e.schemaVersion, payload: { ...e.payload } });
  }

  private insert(row: Omit<ServerRow, 'sync_seq'>): void {
    if (this.rows.some((r) => r.id === row.id)) return; // on conflict (id) do nothing
    this.rows.push({ ...row, sync_seq: this.nextSeq++ });
  }

  private from(table: string) {
    this.tablesTouched.push(table);
    return {
      upsert: (rows: Record<string, unknown>[], opts: { onConflict: string; ignoreDuplicates: boolean }) => {
        this.upsertCalls++;
        this.insertedRaw.push(...rows);
        expect(opts).toEqual({ onConflict: 'id', ignoreDuplicates: true });
        const failure = this.fail(this.upsertCalls);
        if (failure !== null) return Promise.resolve({ data: null, error: { code: failure.code }, status: failure.status });
        const allowed = this.signedInAs !== null && this.consented && rows.every((r) => r.user_id === this.signedInAs);
        if (!allowed) return Promise.resolve({ data: null, error: { code: '42501' }, status: 403 });
        for (const r of rows) this.insert(r as unknown as Omit<ServerRow, 'sync_seq'>);
        return Promise.resolve({ data: null, error: null, status: 201 });
      },
      select: () => {
        const q = { user: '', gt: 0, limit: Infinity };
        const chain = {
          eq: (_col: string, value: string) => {
            q.user = value;
            return chain;
          },
          gt: (_col: string, value: number) => {
            q.gt = value;
            return chain;
          },
          order: () => chain,
          limit: (n: number) => {
            q.limit = n;
            return chain;
          },
          then: (resolve: (v: unknown) => void) => {
            this.selectCalls++;
            if (this.failSelect !== null) return resolve({ data: null, error: { code: this.failSelect.code }, status: this.failSelect.status });
            const visible = this.signedInAs !== null && this.consented ? this.rows : [];
            const data = visible
              .filter((r) => r.user_id === q.user && r.user_id === this.signedInAs && r.sync_seq > q.gt)
              .sort((a, b) => a.sync_seq - b.sync_seq)
              .slice(0, q.limit);
            return resolve({ data, error: null, status: 200 });
          },
        };
        return chain;
      },
    };
  }
}

const run = (server: FakeServer, store: Store, overrides: Partial<{ accountId: string; consented: boolean }> = {}) =>
  syncProgress({ client: server.client, store, accountId: ACCOUNT, consented: true, config: CONFIG, now: () => NOW, ...overrides });

describe('push', () => {
  it('pushes unsynced progress events once with user_id = account, then marks them synced', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);

    const result = await run(server, store);

    expect(result).toEqual({ ok: true, pushed: 6, pulled: 0, at: NOW_ISO });
    expect(server.rows.map((r) => r.id).sort()).toEqual(deviceA.map((e) => e.id).sort());
    expect(server.rows.every((r) => r.user_id === ACCOUNT)).toBe(true);
    expect(server.insertedRaw.every((r) => !('sync_seq' in (r as object)) && !('created_at' in (r as object)))).toBe(true);
    expect((await store.list()).every((e) => e.syncedAt === NOW_ISO)).toBe(true);
    expect(server.tablesTouched.every((t) => t === 'personal_events')).toBe(true);
  });

  it('pushes in batches of pushBatchSize', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    await run(server, store);
    expect(server.upsertCalls).toBe(3); // 6 events, batch 2
  });

  it('does not push an event again on the next sync', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    await run(server, store);
    const second = await run(server, store);
    expect(second).toMatchObject({ ok: true, pushed: 0, pulled: 0 });
    expect(server.upsertCalls).toBe(3);
    expect(server.rows).toHaveLength(6);
  });

  it('pushes nothing without consent and does not touch the server (gate)', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);

    const result = await run(server, store, { consented: false });

    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(server.tablesTouched).toEqual([]);
    expect((await store.list()).every((e) => e.syncedAt === null)).toBe(true);
  });

  it('pushes nothing without a signed-in account', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);

    const result = await run(server, store, { accountId: '' });

    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(server.tablesTouched).toEqual([]);
  });

  it('pushes old data already on the device (unsynced, e.g. copied by story 030) on the first sync, with no special migration', async () => {
    const store = newStore();
    const server = new FakeServer();
    // What story 030 leaves behind: the old shared store's events, userId of the old local user, syncedAt null.
    const copied = [ev('old-l', 'lesson_completed', '2026-10-01T01:00:00.000Z', { lessonId: 'old', xp: 10 }), ev('old-a', 'activity_logged', '2026-10-01T02:00:00.000Z', { xp: 10 })];
    await store.importEvents(copied);

    await run(server, store);

    expect(server.rows.map((r) => r.id).sort()).toEqual(['old-a', 'old-l']);
  });
});

describe('one event, one stream on one device', () => {
  const all: LogEvent[] = [
    ev('lesson', 'lesson_completed', '2026-11-01T01:00:00.000Z', { xp: 10 }),
    ev('contact-add', 'person_added', '2026-11-01T01:01:00.000Z', { personId: 'p1', name: 'An' }),
    ev('contact-act', 'activity_logged', '2026-11-01T01:02:00.000Z', { xp: 5, personId: 'p1' }),
    ev('contact-synced', 'person_updated', '2026-11-01T01:03:00.000Z', { personId: 'p1', name: 'Anh' }, '2026-11-01T02:00:00.000Z'),
    ev('device-setting', 'settings_changed', '2026-11-01T01:04:00.000Z', { reminder: { enabled: true } }),
    ev('progress-synced-elsewhere', 'lesson_completed', '2026-11-01T01:05:00.000Z', { xp: 10 }, '2026-11-01T02:00:00.000Z'),
  ];

  it('pushes only the progress event: not Danh bạ events, not the device setting, not already-synced ones', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(all);

    await run(server, store);

    expect(server.rows.map((r) => r.id)).toEqual(['lesson']);
    const after = new Map((await store.list()).map((e) => [e.id, e]));
    expect(after.get('lesson')?.syncedAt).toBe(NOW_ISO);
    // The Danh bạ stream's events and the device setting were left exactly as they were.
    expect(after.get('contact-add')?.syncedAt).toBeNull();
    expect(after.get('contact-act')?.syncedAt).toBeNull();
    expect(after.get('device-setting')?.syncedAt).toBeNull();
    expect(after.get('contact-synced')?.syncedAt).toBe('2026-11-01T02:00:00.000Z');
  });

  it('after the contact stream marked its events synced, the progress stream still pushes its own and vice versa', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(all);
    const byId = new Map(all.map((e) => [e.id, e]));
    // Simulate syncContacts having run: it marks exactly the contact events.
    await store.markSynced(
      all.filter((e) => isContactEvent(e, byId)).map((e) => e.id),
      '2026-11-01T03:00:00.000Z',
    );

    await run(server, store);

    expect(server.rows.map((r) => r.id)).toEqual(['lesson']);
    const after = new Map((await store.list()).map((e) => [e.id, e]));
    expect(after.get('device-setting')?.syncedAt).toBeNull();
    expect(after.get('contact-add')?.syncedAt).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('pull', () => {
  it('stores pulled events with userId = account and syncedAt set, so they are never pushed back', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.seed(deviceA);

    const result = await run(server, store);

    expect(result).toMatchObject({ ok: true, pushed: 0, pulled: 6 });
    const events = await store.list();
    expect(events.every((e) => e.userId === ACCOUNT && e.syncedAt === NOW_ISO)).toBe(true);
    const upsertsBefore = server.upsertCalls;
    await run(server, store);
    expect(server.upsertCalls).toBe(upsertsBefore);
  });

  it('pulling twice adds nothing', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.seed(deviceA);

    await run(server, store);
    const second = await run(server, store);

    expect(second).toMatchObject({ ok: true, pulled: 0 });
    expect(await store.list()).toHaveLength(6);
  });

  it('pulls page by page and persists the highest sync_seq under the progress cursor key', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.seed(deviceA); // 6 rows, page size 2

    await run(server, store);

    expect(server.selectCalls).toBe(4); // 2 + 2 + 2 + empty
    expect(await store.readSyncCursor(progressCursorKey(ACCOUNT))).toBe(6);
  });

  it('re-reads an overlap below the cursor (a row committed late) without duplicating', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.seed(deviceA.slice(0, 2));
    await run(server, store);
    server.seed(deviceA.slice(2));

    const result = await run(server, store);

    expect(result).toMatchObject({ ok: true, pulled: 4 });
    expect(new Set((await store.list()).map((e) => e.id)).size).toBe(6);
  });

  it('never pulls another account’s rows', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.seed([ev('theirs', 'lesson_completed', '2026-11-01T01:00:00.000Z', { xp: 99 })], OTHER_ACCOUNT);

    await run(server, store);

    expect(await store.list()).toEqual([]);
  });

  it('skips a malformed row but moves the cursor past it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = newStore();
    const server = new FakeServer();
    server.seed([deviceA[0] as LogEvent]);
    server.rows.push({ id: 'bad', user_id: ACCOUNT, type: 'person_added', occurred_at: NOW_ISO, schema_version: 1, payload: {}, sync_seq: server.nextSeq++ });

    const result = await run(server, store);

    expect(result).toMatchObject({ ok: true, pulled: 1 });
    expect(await store.readSyncCursor(progressCursorKey(ACCOUNT))).toBe(2);
  });
});

describe('merge', () => {
  it('a new device gets the same XP, streak, goal, acknowledgements and lessons as the old device', async () => {
    const storeA = newStore();
    const storeB = newStore();
    const server = new FakeServer();
    await storeA.importEvents(deviceA);
    await run(server, storeA);

    const result = await run(server, storeB);

    expect(result).toMatchObject({ ok: true, pushed: 0, pulled: 6 });
    const a = await summary(storeA);
    const b = await summary(storeB);
    expect(b).toEqual(a);
    expect(b).toEqual({ totalXp: 45, xpToday: 25, streak: 2, goalMet: true, lessons: ['lesson-1', 'lesson-2'], acknowledged: ['streak:2'], seeded: true });
  });

  it('device with local progress and a server with other progress end with the same union, no duplicate ids, XP not doubled', async () => {
    const storeA = newStore();
    const storeB = newStore();
    const server = new FakeServer();
    const shared = deviceA[0] as LogEvent; // both devices hold l1 (it was synced from one to the other earlier)
    const onlyA = [ev('a-only', 'activity_logged', '2026-11-02T01:30:00.000Z', { activityType: 'call', xp: 7 })];
    const onlyB = [ev('b-only', 'lesson_completed', '2026-11-02T01:40:00.000Z', { lessonId: 'lesson-b', xp: 3 })];
    await storeA.importEvents([shared, ...onlyA]);
    await storeB.importEvents([shared, ...onlyB]);

    await run(server, storeA);
    await run(server, storeB);
    await run(server, storeA); // A catches up with B's event

    const idsA = (await storeA.list()).map((e) => e.id).sort();
    const idsB = (await storeB.list()).map((e) => e.id).sort();
    expect(idsA).toEqual(['a-only', 'b-only', 'l1']);
    expect(idsB).toEqual(idsA);
    expect(new Set(idsA).size).toBe(idsA.length);
    expect(server.rows.map((r) => r.id).sort()).toEqual(idsA);
    const a = await summary(storeA);
    expect(a).toEqual(await summary(storeB));
    expect(a.totalXp).toBe(10 + 7 + 3);
  });

  it('two offline devices that did the same event ids do not double XP in either order', async () => {
    const run2 = async (order: [Store, Store]) => {
      const server = new FakeServer();
      for (const s of order) await run(server, s);
      for (const s of order) await run(server, s);
      return summary(order[0]);
    };
    const mk = async () => {
      const s1 = newStore();
      const s2 = newStore();
      await s1.importEvents([deviceA[0] as LogEvent, deviceA[1] as LogEvent]);
      await s2.importEvents([deviceA[0] as LogEvent, deviceA[2] as LogEvent]);
      return [s1, s2] as [Store, Store];
    };
    const [a1, a2] = await mk();
    const [b1, b2] = await mk();
    const forward = await run2([a1, a2]);
    const backward = await run2([b2, b1]);
    expect(forward.totalXp).toBe(30); // l1 + a1 + l2, once each
    expect(backward.totalXp).toBe(30);
    expect(forward.lessons).toEqual(['lesson-1', 'lesson-2']);
  });
});

describe('failures', () => {
  it('offline: events stay unsynced, a later sync pushes them exactly once', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    server.fail = () => ({ status: 0 });

    const offline = await run(server, store);

    expect(offline).toEqual({ ok: false, reason: 'network' });
    expect((await store.list()).every((e) => e.syncedAt === null)).toBe(true);
    expect(server.rows).toEqual([]);

    server.fail = () => null;
    const online = await run(server, store);

    expect(online).toMatchObject({ ok: true, pushed: 6 });
    expect(server.rows).toHaveLength(6);
    expect((await store.list()).every((e) => e.syncedAt === NOW_ISO)).toBe(true);
  });

  it('a server error mid-batch marks only the accepted batches; the rest goes up later, once', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    server.fail = (call) => (call === 2 ? { code: 'XX000', status: 500 } : null);

    const result = await run(server, store);

    expect(result).toEqual({ ok: false, reason: 'server' });
    const synced = (await store.list()).filter((e) => e.syncedAt !== null).map((e) => e.id);
    expect(synced).toEqual(['l1', 'a1']); // batch 1 only
    expect(server.rows.map((r) => r.id)).toEqual(['l1', 'a1']);

    server.fail = () => null;
    await run(server, store);

    expect(server.rows.map((r) => r.id).sort()).toEqual(deviceA.map((e) => e.id).sort());
    expect(server.rows).toHaveLength(6);
  });

  it('a lost response (server stored the batch, the app saw an error) re-sends the same ids without duplicating', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA.slice(0, 2));
    server.seed(deviceA.slice(0, 2)); // the batch arrived, the answer did not
    server.fail = (call) => (call === 1 ? { status: 0 } : null);

    await run(server, store);
    await run(server, store);

    expect(server.rows).toHaveLength(2);
    expect(await summary(store)).toMatchObject({ totalXp: 20 });
  });

  it('a pull failure after a successful push keeps the pushed events marked and reports the failure', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA.slice(0, 2));
    server.failSelect = { code: 'XX000', status: 500 };

    const result = await run(server, store);

    expect(result).toEqual({ ok: false, reason: 'server' });
    expect((await store.list()).every((e) => e.syncedAt === NOW_ISO)).toBe(true);
  });

  it.each([
    ['RLS 42501', { code: '42501', status: 403 }],
    ['HTTP 403', { status: 403 }],
    ['HTTP 401', { status: 401 }],
  ])('denied (%s) stops, reports denied and deletes nothing', async (_name, failure) => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    server.fail = () => failure;

    const result = await run(server, store);

    expect(result).toEqual({ ok: false, reason: 'denied' });
    const after = await store.list();
    expect(after).toHaveLength(6);
    expect(after.every((e) => e.syncedAt === null)).toBe(true);
  });

  it('the server refusing for missing consent (RLS) is denied and keeps every local event', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.consented = false;
    await store.importEvents(deviceA);

    const result = await run(server, store);

    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(await store.list()).toHaveLength(6);
  });
});

describe('controller', () => {
  const make = (server: FakeServer, store: Store, consented = true) =>
    createProgressSyncController({ client: server.client, store, accountId: ACCOUNT, consented, config: CONFIG, now: () => NOW });

  it('reports idle, then synced after a run', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    const controller = make(server, store);
    expect(controller.status()).toEqual({ kind: 'idle' });

    await controller.sync(false);

    expect(controller.status()).toEqual({ kind: 'synced', at: NOW_ISO, pulled: 0 });
    controller.dispose();
  });

  it('after denied, automatic syncs do nothing but a manual one retries', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    server.consented = false;
    const controller = make(server, store);

    await controller.sync(false);
    expect(controller.status()).toEqual({ kind: 'failed', reason: 'denied' });
    const calls = server.upsertCalls;
    await controller.sync(false);
    expect(server.upsertCalls).toBe(calls);

    server.consented = true;
    await controller.sync(true);
    expect(controller.status()).toMatchObject({ kind: 'synced' });
    expect(server.rows).toHaveLength(6);
    controller.dispose();
  });

  it('a controller without consent never contacts the server', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    const controller = make(server, store, false);

    await controller.sync(false);
    await controller.sync(true);

    expect(server.tablesTouched).toEqual([]);
    controller.dispose();
  });

  it('a failed run is retried by the next automatic call (back online)', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents(deviceA);
    server.fail = () => ({ status: 0 });
    const controller = make(server, store);

    await controller.sync(false);
    expect(controller.status()).toEqual({ kind: 'failed', reason: 'network' });
    server.fail = () => null;
    await controller.sync(false);

    expect(controller.status()).toMatchObject({ kind: 'synced' });
    controller.dispose();
  });
});

describe('cursor', () => {
  it('the progress cursor does not collide with a household cursor', async () => {
    const store = newStore();
    const server = new FakeServer();
    server.seed(deviceA);
    await store.writeSyncCursor(HOUSEHOLD, 1_000);

    await run(server, store);

    expect(await store.readSyncCursor(HOUSEHOLD)).toBe(1_000);
    expect(await store.readSyncCursor(progressCursorKey(ACCOUNT))).toBe(6);
    // And a household cursor set to the account id itself would not be read as the progress cursor.
    await store.writeSyncCursor(ACCOUNT, 99);
    expect(await store.readSyncCursor(progressCursorKey(ACCOUNT))).toBe(6);
  });

  it('events pushed by this stream carry no xp that was not already in the local event', async () => {
    const store = newStore();
    const server = new FakeServer();
    await store.importEvents([ev('ack', 'settings_changed', '2026-11-01T01:00:00.000Z', { achievementAcknowledged: 'x' })]);

    await run(server, store);

    expect(server.rows.every((r) => !('xp' in r.payload))).toBe(true);
  });
});
