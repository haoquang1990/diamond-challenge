import { createEvent, parseStoredEvent } from './event-store';
import type { EventRange, EventStore, LogEvent, NewEvent, SyncStateStore } from './event-store';

const DB_VERSION = 1;
const EVENTS_STORE = 'events';
const META_STORE = 'meta';
const TIMESTAMP_INDEX = 'timestamp';
const USER_ID_KEY = 'userId';
const SYNC_CURSOR_PREFIX = 'syncCursor:';
const MEMBERS_PREFIX = 'members:';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * IndexedDB-backed `EventStore` using the browser's native API.
 * Append-only: no method deletes an event; only `markSynced` sets a null `syncedAt`. Data
 * survives page reloads. Sync cursors live in the `meta` store.
 *
 * Events use an auto-increment key, so events with equal timestamps list in
 * insertion order. The local userId is generated once inside a readwrite
 * transaction (safe across tabs) and persisted in a `meta` store.
 *
 * @example
 * const store = new IndexedDbEventStore('diamond-challenge');
 * await store.append({ type: 'lesson_completed', payload: { lessonId: 'l1' } });
 * const all = await store.list();
 */
export class IndexedDbEventStore implements EventStore, SyncStateStore {
  private readonly dbPromise: Promise<IDBDatabase>;
  private userIdPromise: Promise<string> | null = null;

  /** @param dbName IndexedDB database name (use a unique name per test). */
  constructor(dbName: string) {
    this.dbPromise = new Promise((resolve, reject) => {
      const open = indexedDB.open(dbName, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        const events = db.createObjectStore(EVENTS_STORE, { autoIncrement: true });
        events.createIndex(TIMESTAMP_INDEX, TIMESTAMP_INDEX);
        db.createObjectStore(META_STORE);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }

  /** @inheritdoc */
  getUserId(): Promise<string> {
    this.userIdPromise ??= this.loadOrCreateUserId();
    return this.userIdPromise;
  }

  /** @inheritdoc */
  async append(event: NewEvent): Promise<LogEvent> {
    const stored = createEvent(event, await this.getUserId());
    const db = await this.dbPromise;
    const tx = db.transaction(EVENTS_STORE, 'readwrite');
    tx.objectStore(EVENTS_STORE).add(stored);
    await transactionDone(tx);
    return stored;
  }

  /** @inheritdoc */
  async list(range: EventRange = {}): Promise<LogEvent[]> {
    const db = await this.dbPromise;
    const index = db.transaction(EVENTS_STORE, 'readonly').objectStore(EVENTS_STORE).index(TIMESTAMP_INDEX);
    const { from, to } = range;
    let keyRange: IDBKeyRange | undefined;
    if (from !== undefined && to !== undefined) {
      // Inverted range matches nothing (IDBKeyRange.bound would throw).
      if (from > to) return [];
      keyRange = IDBKeyRange.bound(from, to);
    } else if (from !== undefined) {
      keyRange = IDBKeyRange.lowerBound(from);
    } else if (to !== undefined) {
      keyRange = IDBKeyRange.upperBound(to);
    }
    const rows: unknown[] = await requestToPromise(index.getAll(keyRange));
    return rows.map((raw) => parseStoredEvent(raw)).filter((e): e is LogEvent => e !== null);
  }

  /** @inheritdoc */
  async importEvents(events: readonly LogEvent[]): Promise<{ added: number; skipped: number }> {
    const db = await this.dbPromise;
    const tx = db.transaction(EVENTS_STORE, 'readwrite');
    const store = tx.objectStore(EVENTS_STORE);
    const existing: unknown[] = await requestToPromise(store.getAll());
    const known = new Set<string>();
    for (const raw of existing) {
      const id = (raw as { id?: unknown } | null)?.id;
      if (typeof id === 'string') known.add(id);
    }
    let added = 0;
    let skipped = 0;
    for (const event of events) {
      if (known.has(event.id)) {
        skipped += 1;
        continue;
      }
      known.add(event.id);
      store.add(event);
      added += 1;
    }
    await transactionDone(tx);
    return { added, skipped };
  }

  /** @inheritdoc */
  async markSynced(ids: readonly string[], syncedAt: string): Promise<number> {
    const wanted = new Set(ids);
    const db = await this.dbPromise;
    const tx = db.transaction(EVENTS_STORE, 'readwrite');
    const request = tx.objectStore(EVENTS_STORE).openCursor();
    let marked = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor === null) return;
      const value = cursor.value as { id?: unknown; syncedAt?: unknown } | null;
      if (value !== null && typeof value.id === 'string' && wanted.has(value.id) && value.syncedAt === null) {
        cursor.update({ ...value, syncedAt });
        marked += 1;
      }
      cursor.continue();
    };
    await transactionDone(tx);
    return marked;
  }

  /** @inheritdoc */
  async readSyncCursor(householdId: string): Promise<number | null> {
    const db = await this.dbPromise;
    const value: unknown = await requestToPromise(db.transaction(META_STORE, 'readonly').objectStore(META_STORE).get(SYNC_CURSOR_PREFIX + householdId));
    return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
  }

  /** @inheritdoc */
  async writeSyncCursor(householdId: string, seq: number): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(seq, SYNC_CURSOR_PREFIX + householdId);
    await transactionDone(tx);
  }

  /** @inheritdoc */
  async writeMemberIds(householdId: string, ids: readonly string[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put([...ids], MEMBERS_PREFIX + householdId);
    await transactionDone(tx);
  }

  /** @inheritdoc */
  async readMemberIds(): Promise<ReadonlySet<string>> {
    const db = await this.dbPromise;
    const range = IDBKeyRange.bound(MEMBERS_PREFIX, `${MEMBERS_PREFIX}\uffff`);
    const lists: unknown[] = await requestToPromise(db.transaction(META_STORE, 'readonly').objectStore(META_STORE).getAll(range));
    const ids = new Set<string>();
    for (const list of lists) if (Array.isArray(list)) for (const id of list as unknown[]) if (typeof id === 'string') ids.add(id);
    return ids;
  }

  private async loadOrCreateUserId(): Promise<string> {
    const db = await this.dbPromise;
    const tx = db.transaction(META_STORE, 'readwrite');
    const meta = tx.objectStore(META_STORE);
    const existing: unknown = await requestToPromise(meta.get(USER_ID_KEY));
    if (typeof existing === 'string') return existing;
    const created = crypto.randomUUID();
    meta.put(created, USER_ID_KEY);
    await transactionDone(tx);
    return created;
  }
}
