/**
 * Backup and restore by file (story 011; design/gdd/crm.md, Core Rules "Sao lưu", AC-8..AC-10).
 * Pure functions: no I/O, no clock (the caller injects `now`). Import is a merge that
 * dedupes by event id and never deletes.
 */
import { parseStoredEvent } from './event-store';
import type { LogEvent } from './event-store';

/** Value of the `format` field of every backup file. */
export const BACKUP_FORMAT = 'diamond-challenge-backup';
/** The only backup file version this app reads and writes. */
export const BACKUP_FORMAT_VERSION = 1;

/** The backup file content. */
export interface BackupFile {
  readonly format: typeof BACKUP_FORMAT;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  /** ISO UTC instant of the export. */
  readonly exportedAt: string;
  /** The whole log, oldest first. */
  readonly events: readonly LogEvent[];
}

/** Why a whole file was rejected. */
export type BackupRejectReason = 'not-json' | 'not-object' | 'wrong-format' | 'unknown-version' | 'events-not-array';

/** Result of {@link parseBackup}. */
export type ParseBackupResult =
  | { readonly ok: true; readonly events: LogEvent[]; readonly invalid: number }
  | { readonly ok: false; readonly reason: BackupRejectReason };

/** Builds the backup object from the log (kept in the given order, which `list()` makes oldest first). */
export function buildBackup(events: readonly LogEvent[], now: Date): BackupFile {
  return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), events: [...events] };
}

/** `diamond-challenge-backup-YYYY-MM-DD.json` with the local date of `now`. */
export function backupFileName(now: Date): string {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `diamond-challenge-backup-${y}-${m}-${d}.json`;
}

/**
 * Parses backup file text. Never throws. Rejects the whole file for a structural problem;
 * otherwise every element goes through `parseStoredEvent` and corrupt ones are counted in `invalid`.
 */
export function parseBackup(text: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, reason: 'not-object' };
  const o = data as Record<string, unknown>;
  if (o.format !== BACKUP_FORMAT) return { ok: false, reason: 'wrong-format' };
  if (o.formatVersion !== BACKUP_FORMAT_VERSION) return { ok: false, reason: 'unknown-version' };
  if (!Array.isArray(o.events)) return { ok: false, reason: 'events-not-array' };
  const events: LogEvent[] = [];
  let invalid = 0;
  for (const raw of o.events as unknown[]) {
    const e = parseStoredEvent(raw);
    if (e === null) invalid += 1;
    else events.push(e);
  }
  return { ok: true, events, invalid };
}

/** Result of {@link planMerge}. */
export interface MergePlan {
  /** Incoming events whose id is not local yet (first occurrence only), in file order. */
  readonly toAdd: LogEvent[];
  readonly added: number;
  /** Duplicates: ids already local or repeated inside the file. */
  readonly skipped: number;
}

/** Decides which incoming events are new, by id. `existing` may be events or a set of ids. */
export function planMerge(existing: readonly LogEvent[] | ReadonlySet<string>, incoming: readonly LogEvent[]): MergePlan {
  const known = new Set<string>(existing instanceof Set ? (existing as ReadonlySet<string>) : (existing as readonly LogEvent[]).map((e) => e.id));
  const toAdd: LogEvent[] = [];
  let skipped = 0;
  for (const e of incoming) {
    if (known.has(e.id)) {
      skipped += 1;
    } else {
      known.add(e.id);
      toAdd.push(e);
    }
  }
  return { toAdd, added: toAdd.length, skipped };
}
