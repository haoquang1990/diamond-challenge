/**
 * The account's notification settings on the server (story 058): cheer pushes on/off and the
 * daily reminder (on/off, time, time zone), so the server can push the reminder while the app is
 * closed. Owner-only `notification_prefs`; each kind of setting is sent only when it changed since
 * the last successful send (remembered per account on the device).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** What can be saved; fields left out stay as they are on the server. */
export interface PrefsChange {
  readonly cheers?: boolean;
  readonly reminder?: { readonly enabled: boolean; readonly time: string };
  readonly timeZone?: string;
}

/** The `notification_prefs` upsert row for a change. Pure. */
export function prefsRow(accountId: string, change: PrefsChange): Record<string, unknown> {
  return {
    user_id: accountId,
    ...(change.cheers === undefined ? {} : { cheers: change.cheers }),
    ...(change.reminder === undefined ? {} : { reminder_enabled: change.reminder.enabled, reminder_time: change.reminder.time }),
    ...(change.timeZone === undefined ? {} : { time_zone: change.timeZone }),
  };
}

/** Inputs of {@link createPrefsSync}. */
export interface PrefsSyncDeps {
  readonly client: { from(table: string): { upsert(row: Record<string, unknown>, opts?: { onConflict?: string }): PromiseLike<{ error: unknown }> } } | Pick<SupabaseClient, 'from'>;
  readonly accountId: string;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

/** Saves notification settings when they differ from the last send. */
export interface PrefsSync {
  save(change: PrefsChange): Promise<'sent' | 'unchanged' | 'failed'>;
}

const PREFIX = 'diamond.notificationPrefs.';

/** Creates the sender for one account. */
export function createPrefsSync(deps: PrefsSyncDeps): PrefsSync {
  const storage = deps.storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : deps.storage;
  const key = PREFIX + deps.accountId;
  const read = (): Record<string, unknown> => {
    try {
      const raw = storage?.getItem(key);
      return typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };
  return {
    async save(change) {
      const row = prefsRow(deps.accountId, change);
      const last = read();
      const fresh = Object.entries(row).some(([k, v]) => k !== 'user_id' && JSON.stringify(last[k]) !== JSON.stringify(v));
      if (!fresh) return 'unchanged';
      try {
        const { error } = await (deps.client as Pick<SupabaseClient, 'from'>).from('notification_prefs').upsert(row, { onConflict: 'user_id' });
        if (error) return 'failed';
        try {
          storage?.setItem(key, JSON.stringify({ ...last, ...row }));
        } catch {
          // Best effort: without it the next launch sends once more.
        }
        return 'sent';
      } catch (error) {
        console.warn('[notification-prefs] not saved', error);
        return 'failed';
      }
    },
  };
}

/** My cheer-notification switch on the server; on when there is no row yet or it cannot be read. */
export async function loadCheersPref(client: Pick<SupabaseClient, 'from'>): Promise<boolean> {
  try {
    const { data, error } = await client.from('notification_prefs').select('cheers').maybeSingle();
    const v = (data as { cheers?: unknown } | null)?.cheers;
    return error === null && typeof v === 'boolean' ? v : true;
  } catch {
    return true;
  }
}
