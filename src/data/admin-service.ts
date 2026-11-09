import type { SupabaseClient } from '@supabase/supabase-js';
import { EDGE_FUNCTION_TIMEOUT_MS, readFunctionError } from './account-service';

/**
 * Reads the signed-in account's own `profiles.role`. True only for `admin`; any read error
 * (offline, no row) is false, so the "Quản trị" entry stays hidden. The server enforces admin
 * rights on its own; this only decides whether the entry is shown.
 *
 * @example
 * const admin = await loadIsAdmin(client, account.accountId);
 */
export async function loadIsAdmin(client: SupabaseClient, accountId: string): Promise<boolean> {
  const { data, error } = await client.from('profiles').select('role').eq('id', accountId).maybeSingle();
  return error === null && (data as { role?: unknown } | null)?.role === 'admin';
}

/** A member of a household found by the admin search. */
export interface AdminMember {
  readonly userId: string;
  readonly phone: string | null;
  readonly displayName: string | null;
}

/** A cancelled Amway code of a household. */
export interface AdminCancelledCode {
  readonly code: string;
  /** ISO timestamp of the cancellation. */
  readonly cancelledAt: string;
  readonly reason: string | null;
}

/** One household in the admin search result. */
export interface AdminHousehold {
  readonly householdId: string;
  readonly members: readonly AdminMember[];
  /** The active code, or null when the household has none. */
  readonly activeCode: string | null;
  /** Cancelled codes, newest first. */
  readonly cancelledCodes: readonly AdminCancelledCode[];
}

/** What to search by: a member's normalized E.164 phone, or an Amway code (digits only). */
export type AdminQuery = { readonly kind: 'phone'; readonly phone: string } | { readonly kind: 'code'; readonly code: string };

/** Outcome of {@link searchHouseholds}. `error` covers any failed read (offline included). */
export type AdminSearchResult =
  | { readonly ok: true; readonly households: readonly AdminHousehold[] }
  | { readonly ok: false; readonly error: 'network' | 'unknown' };

function readFailure(): 'network' | 'unknown' {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'network' : 'unknown';
}

/**
 * Loads households by id: current members (profiles) and all their codes, through the admin's
 * RLS access. Never reads `contact_events`.
 *
 * @example
 * const r = await loadAdminHouseholds(client, [householdId]);
 */
export async function loadAdminHouseholds(client: SupabaseClient, householdIds: readonly string[]): Promise<AdminSearchResult> {
  if (householdIds.length === 0) return { ok: true, households: [] };
  const [memberRows, codeRows] = await Promise.all([
    client.from('household_members').select('household_id, user_id').in('household_id', householdIds as string[]).is('left_at', null),
    client.from('household_codes').select('household_id, code, status, cancelled_at, cancel_reason').in('household_id', householdIds as string[]),
  ]);
  if (memberRows.error || codeRows.error) return { ok: false, error: readFailure() };
  const members = (memberRows.data ?? []) as { household_id: string; user_id: string }[];
  const codes = (codeRows.data ?? []) as { household_id: string; code: string; status: string; cancelled_at: string | null; cancel_reason: string | null }[];
  let profiles: { id: string; phone: string | null; display_name: string | null }[] = [];
  if (members.length > 0) {
    const rows = await client.from('profiles').select('id, phone, display_name').in('id', members.map((m) => m.user_id));
    if (rows.error) return { ok: false, error: readFailure() };
    profiles = (rows.data ?? []) as typeof profiles;
  }
  const households = householdIds.map((householdId): AdminHousehold => {
    const own = codes.filter((c) => c.household_id === householdId);
    return {
      householdId,
      members: members
        .filter((m) => m.household_id === householdId)
        .map((m) => {
          const p = profiles.find((x) => x.id === m.user_id);
          return { userId: m.user_id, phone: p?.phone ?? null, displayName: p?.display_name ?? null };
        }),
      activeCode: own.find((c) => c.status === 'active')?.code ?? null,
      cancelledCodes: own
        .filter((c) => c.status === 'cancelled' && c.cancelled_at !== null)
        .map((c) => ({ code: c.code, cancelledAt: c.cancelled_at as string, reason: c.cancel_reason }))
        .sort((a, b) => b.cancelledAt.localeCompare(a.cancelledAt)),
    };
  });
  return { ok: true, households };
}

/**
 * Finds households by a member's phone (E.164, current members only) or by an Amway code (active or
 * cancelled). Returns each household with its members, active code and cancelled codes.
 *
 * @example
 * const r = await searchHouseholds(client, { kind: 'code', code: '7004053634' });
 */
export async function searchHouseholds(client: SupabaseClient, query: AdminQuery): Promise<AdminSearchResult> {
  let ids: string[];
  if (query.kind === 'phone') {
    const profile = await client.from('profiles').select('id').eq('phone', query.phone).maybeSingle();
    if (profile.error) return { ok: false, error: readFailure() };
    const userId = (profile.data as { id?: string } | null)?.id;
    if (userId === undefined) return { ok: true, households: [] };
    const rows = await client.from('household_members').select('household_id').eq('user_id', userId).is('left_at', null);
    if (rows.error) return { ok: false, error: readFailure() };
    ids = ((rows.data ?? []) as { household_id: string }[]).map((r) => r.household_id);
  } else {
    const rows = await client.from('household_codes').select('household_id').eq('code', query.code);
    if (rows.error) return { ok: false, error: readFailure() };
    ids = ((rows.data ?? []) as { household_id: string }[]).map((r) => r.household_id);
  }
  return loadAdminHouseholds(client, [...new Set(ids)]);
}

/** Error keys of the `reset-password` Edge Function that the UI tells apart. */
export type ResetPasswordError = 'not_found' | 'admin_only' | 'network' | 'other';

/** Outcome of {@link resetPassword}. */
export type ResetPasswordResult = { readonly ok: true } | { readonly ok: false; readonly error: ResetPasswordError };

const KNOWN_RESET_ERRORS: ReadonlySet<string> = new Set(['admin_only', 'not_found', 'invalid_password', 'invalid_phone', 'reset_failed']);

/**
 * Calls the Edge Function `reset-password` with `{ userId, password }` (admin only; the server
 * makes the person change the password at the next sign-in). The password is only sent to the
 * function; it is never logged or stored here.
 *
 * @example
 * const r = await resetPassword(client, { userId, password: generateTempPassword() });
 */
export async function resetPassword(client: SupabaseClient, input: { readonly userId: string; readonly password: string }): Promise<ResetPasswordResult> {
  const { error } = await client.functions.invoke('reset-password', { body: { userId: input.userId, password: input.password }, timeout: EDGE_FUNCTION_TIMEOUT_MS });
  if (error === null || error === undefined) return { ok: true };
  const key = await readFunctionError(error, KNOWN_RESET_ERRORS);
  return { ok: false, error: key === 'not_found' || key === 'admin_only' || key === 'network' ? key : 'other' };
}

/** Why {@link setHouseholdCode} failed. */
export type SetCodeError = 'invalid_code' | 'code_taken' | 'not_admin' | 'network' | 'other';

/** Outcome of {@link setHouseholdCode}. */
export type SetCodeResult = { readonly ok: true } | { readonly ok: false; readonly error: SetCodeError };

/**
 * Calls the RPC `set_household_code` (admin only): the old active code becomes cancelled with reason
 * "replaced" and the new one becomes active. Postgres errors map as 22023 to `invalid_code`,
 * 23505 (the code is active in another household) to `code_taken`, 42501 to `not_admin`; a
 * transport failure is `network`. Nothing changes on any error.
 *
 * @example
 * const r = await setHouseholdCode(client, householdId, '1234567');
 */
export async function setHouseholdCode(client: SupabaseClient, householdId: string, code: string): Promise<SetCodeResult> {
  try {
    const { error } = await client.rpc('set_household_code', { p_household: householdId, p_code: code });
    if (error === null) return { ok: true };
    const e = error as { code?: string; message?: string };
    if (e.code === '22023') return { ok: false, error: 'invalid_code' };
    if (e.code === '23505') return { ok: false, error: 'code_taken' };
    if (e.code === '42501' || /admin only/i.test(e.message ?? '')) return { ok: false, error: 'not_admin' };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'network' };
    if (e.code === undefined && /fetch|network/i.test(e.message ?? '')) return { ok: false, error: 'network' };
    return { ok: false, error: 'other' };
  } catch {
    return { ok: false, error: 'network' };
  }
}
