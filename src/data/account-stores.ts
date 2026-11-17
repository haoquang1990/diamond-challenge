import { IndexedDbEventStore } from './indexeddb-event-store';

/**
 * Per-account local stores (story 030). Each signed-in account owns one IndexedDB database,
 * `diamond-challenge:<accountId>`. The phase-1 shared database, `diamond-challenge`, is the
 * "legacy store": it is copied once into the first eligible account and is never modified
 * or deleted by this module (it stays as a fallback).
 */

/** Name of the phase-1 shared database. Read-only for this module. */
export const LEGACY_DB_NAME = 'diamond-challenge';

const MARKER_KEY = 'diamond-challenge:legacy-migrated-to';
const DEVICE_ACCOUNT_KEY = 'diamond-challenge:device-account';
const EVENTS_STORE = 'events';
const META_STORE = 'meta';

/** Name of the database that holds one account's data. */
export function accountDbName(accountId: string): string {
  return `${LEGACY_DB_NAME}:${accountId}`;
}

/** Opens (creating it when new) the store of one account. */
export function openAccountStore(accountId: string): IndexedDbEventStore {
  return new IndexedDbEventStore(accountDbName(accountId));
}

/**
 * Deletes the database of ONE account (erase on this device). Never the legacy database:
 * the name always carries the account id. Resolves when the browser reports it deleted.
 */
export function deleteAccountStore(accountId: string): Promise<void> {
  if (accountId.trim() === '') return Promise.reject(new Error('account id required'));
  return deleteDatabase(accountDbName(accountId));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * "Đăng xuất và xoá dữ liệu trên máy này": deletes the store of `accountId` and, when the
 * device's legacy store was given to this same account, the legacy database too (it holds the
 * same contacts and progress, so leaving it would break the promise of the button). The
 * legacy database is kept when it was given to another account or never migrated. The marker
 * stays, so the legacy data is never looked for again.
 */
export async function eraseAccountData(accountId: string, marker: MigrationMarker = localStorageMarker()): Promise<void> {
  await deleteAccountStore(accountId);
  if (marker.read() === accountId) await deleteDatabase(LEGACY_DB_NAME);
}

// ---------------------------------------------------------------------------
// Legacy migration
// ---------------------------------------------------------------------------

/** What happened when an account's store was prepared. */
export type MigrationOutcome =
  | 'copied' // legacy events and meta were copied into the account's store
  | 'already-migrated' // the device already gave its legacy data to an account
  | 'nothing-to-migrate' // no legacy database, or it holds no events
  | 'linked-to-other'; // the legacy log is linked to other account(s) only; left for them

/** Where "migrated to X" is remembered. Injected so tests need no browser storage. */
export interface MigrationMarker {
  /** Account id that received the legacy data, or null when not migrated yet. */
  read(): string | null;
  /** Records the account that received the legacy data. */
  write(accountId: string): void;
}

/** Minimal key-value storage (the `localStorage` subset used here). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `localStorage`, or null when it is unavailable or blocked. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The marker in `localStorage` (a missing/blocked storage reads as "not migrated"). */
export function localStorageMarker(storage: KeyValueStorage | null = browserStorage()): MigrationMarker {
  return {
    read() {
      try {
        return storage?.getItem(MARKER_KEY) ?? null;
      } catch {
        return null;
      }
    },
    write(accountId) {
      try {
        storage?.setItem(MARKER_KEY, accountId);
      } catch (error) {
        console.error('[account-stores] could not record the migration', error);
      }
    },
  };
}

/** A read-only copy of the legacy database. */
export interface LegacySnapshot {
  /** Raw event rows in storage (insertion) order. */
  readonly rows: readonly unknown[];
  /** Every meta entry (local userId, sync cursors, member ids). */
  readonly meta: ReadonlyMap<string, unknown>;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * Reads the legacy database without changing it. Returns null when it does not exist (the
 * open is aborted, so no empty database is created on a fresh device).
 */
export async function readLegacySnapshot(): Promise<LegacySnapshot | null> {
  const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
    const open = indexedDB.open(LEGACY_DB_NAME);
    let created = false;
    open.onupgradeneeded = () => {
      created = true;
      open.transaction?.abort();
    };
    open.onsuccess = () => resolve(created ? null : open.result);
    open.onerror = () => (created ? resolve(null) : reject(open.error));
    open.onblocked = () => reject(new Error('legacy store blocked'));
  });
  if (db === null) return null;
  try {
    if (!db.objectStoreNames.contains(EVENTS_STORE) || !db.objectStoreNames.contains(META_STORE)) return null;
    const tx = db.transaction([EVENTS_STORE, META_STORE], 'readonly');
    const rows = await request(tx.objectStore(EVENTS_STORE).getAll());
    const meta = new Map<string, unknown>();
    const metaStore = tx.objectStore(META_STORE);
    const keys = await request(metaStore.getAllKeys());
    for (const key of keys) if (typeof key === 'string') meta.set(key, await request(metaStore.get(key)));
    return { rows: rows as unknown[], meta };
  } finally {
    db.close();
  }
}

/** Account ids named by `settings_changed { accountLinked }` rows (story 021) of a legacy log. */
export function linkedAccountIds(rows: readonly unknown[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const r = row as { type?: unknown; payload?: { accountLinked?: { accountId?: unknown } | null } } | null;
    if (r === null || typeof r !== 'object' || r.type !== 'settings_changed') continue;
    const id = r.payload?.accountLinked?.accountId;
    if (typeof id === 'string' && id !== '') ids.add(id);
  }
  return ids;
}

/**
 * Pure decision for the first sign-in of `accountId` on a device. `migratedTo` is the marker.
 * A legacy log linked to accounts that do not include this one is NOT transferred and the
 * device stays unmigrated, so the linked account can still receive it later.
 */
export function decideLegacyMigration(input: {
  readonly migratedTo: string | null;
  readonly accountId: string;
  readonly legacyEventCount: number;
  readonly linked: ReadonlySet<string>;
}): MigrationOutcome {
  if (input.migratedTo !== null) return 'already-migrated';
  if (input.legacyEventCount === 0) return 'nothing-to-migrate';
  if (input.linked.size > 0 && !input.linked.has(input.accountId)) return 'linked-to-other';
  return 'copied';
}

/**
 * Brings the legacy data into `target` (the store of `accountId`) when the device has not
 * migrated yet and the rules in {@link decideLegacyMigration} allow it, then records
 * "migrated to X". Events keep their ids, timestamps, userId, syncedAt and payload; the
 * legacy meta (local userId, cursors, member ids) is copied with them. The legacy database
 * is only read. Throws on failure BEFORE the marker is written, so it can be retried.
 */
export async function migrateLegacyStore(
  accountId: string,
  target: IndexedDbEventStore,
  marker: MigrationMarker = localStorageMarker(),
): Promise<MigrationOutcome> {
  if (marker.read() !== null) return 'already-migrated';
  const snapshot = await readLegacySnapshot();
  const outcome = decideLegacyMigration({
    migratedTo: marker.read(),
    accountId,
    legacyEventCount: snapshot?.rows.length ?? 0,
    linked: snapshot === null ? new Set() : linkedAccountIds(snapshot.rows),
  });
  if (outcome !== 'copied' || snapshot === null) return outcome;
  const copied = await target.seedFrom(snapshot.rows, snapshot.meta);
  if (copied === 0) console.warn('[account-stores] the account store already held events; legacy data was not copied');
  marker.write(accountId);
  return 'copied';
}

/**
 * Opens the store of `accountId`, first migrating the legacy store into it when due.
 * Rejects when the copy fails: the caller must not open an empty store in that case.
 */
export async function prepareAccountStore(
  accountId: string,
  marker: MigrationMarker = localStorageMarker(),
): Promise<{ readonly store: IndexedDbEventStore; readonly outcome: MigrationOutcome }> {
  const store = openAccountStore(accountId);
  const outcome = await migrateLegacyStore(accountId, store, marker);
  return { store, outcome };
}

// ---------------------------------------------------------------------------
// Last-account cache (offline start)
// ---------------------------------------------------------------------------

/** What is kept on the device about the LAST signed-in account so the app opens offline. */
export interface DeviceAccount {
  readonly accountId: string;
  readonly phone: string | null;
  readonly displayName: string | null;
  readonly isAdmin: boolean;
  /** Consent text version this account agreed to on the server, or null when unknown/not agreed. */
  readonly consentVersion: number | null;
}

/** Reads the cached last account; null when absent or unreadable. Never holds a password or token. */
export function readDeviceAccount(storage: KeyValueStorage | null = browserStorage()): DeviceAccount | null {
  try {
    const raw = storage?.getItem(DEVICE_ACCOUNT_KEY);
    if (raw === null || raw === undefined) return null;
    const v = JSON.parse(raw) as Partial<Record<keyof DeviceAccount, unknown>> | null;
    if (v === null || typeof v !== 'object' || typeof v.accountId !== 'string' || v.accountId === '') return null;
    return {
      accountId: v.accountId,
      phone: typeof v.phone === 'string' ? v.phone : null,
      displayName: typeof v.displayName === 'string' ? v.displayName : null,
      isAdmin: v.isAdmin === true,
      consentVersion: typeof v.consentVersion === 'number' && Number.isFinite(v.consentVersion) ? v.consentVersion : null,
    };
  } catch {
    return null;
  }
}

/**
 * Merges `patch` into the cache for `accountId`. Another account's cache is replaced
 * (only the last account is kept).
 */
export function updateDeviceAccount(
  accountId: string,
  patch: Partial<Omit<DeviceAccount, 'accountId'>>,
  storage: KeyValueStorage | null = browserStorage(),
): void {
  const current = readDeviceAccount(storage);
  const base: DeviceAccount =
    current !== null && current.accountId === accountId
      ? current
      : { accountId, phone: null, displayName: null, isAdmin: false, consentVersion: null };
  try {
    storage?.setItem(DEVICE_ACCOUNT_KEY, JSON.stringify({ ...base, ...patch }));
  } catch (error) {
    console.error('[account-stores] could not cache the account', error);
  }
}

/** Forgets the cached last account (after "xoá dữ liệu trên máy này"). */
export function clearDeviceAccount(storage: KeyValueStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(DEVICE_ACCOUNT_KEY);
  } catch {
    /* storage blocked: nothing to clear */
  }
}
