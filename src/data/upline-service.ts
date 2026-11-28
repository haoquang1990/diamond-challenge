/**
 * Upline requests (story 073): a household without a tuyến trên asks one by Amway code; a member of
 * that household accepts or declines in Nhóm. A request never tells whether the code exists.
 * Story 074: the new code of an F1 whose code was replaced.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** My household's pending request: only the code I typed. */
export interface MyUplineRequest {
  readonly code: string;
  readonly since: string;
}

/** A request sent to my household. */
export interface UplineInvite {
  readonly id: string;
  readonly householdId: string;
  /** Members of the asking household, "A & B"; null when unreadable. */
  readonly names: string | null;
  readonly code: string | null;
  readonly since: string;
}

/** Answers of the upline functions. */
export type UplineResult = 'sent' | 'invalid' | 'has_upline' | 'no_household' | 'ok' | 'not_found' | 'cycle' | 'failed';

const RESULTS: readonly string[] = ['sent', 'invalid', 'has_upline', 'no_household', 'ok', 'not_found', 'cycle'];

/** A server answer as an {@link UplineResult}; anything else is 'failed'. Pure. */
export function parseUplineResult(raw: unknown): UplineResult {
  return typeof raw === 'string' && RESULTS.includes(raw) ? (raw as UplineResult) : 'failed';
}

/** Rows of `my_upline_request()` as my pending request, or null. Pure. */
export function parseMyUplineRequest(raw: unknown): MyUplineRequest | null {
  const r = Array.isArray(raw) ? (raw[0] as Record<string, unknown> | undefined) : undefined;
  return r !== undefined && typeof r.code === 'string' ? { code: r.code, since: typeof r.created_at === 'string' ? r.created_at : '' } : null;
}

/** Rows of `upline_invites()`, newest first; malformed rows are dropped. Pure. */
export function parseUplineInvites(raw: unknown): UplineInvite[] {
  if (!Array.isArray(raw)) return [];
  const out: UplineInvite[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (typeof r !== 'object' || r === null || typeof r.id !== 'string' || typeof r.household_id !== 'string') continue;
    out.push({
      id: r.id,
      householdId: r.household_id,
      names: typeof r.names === 'string' && r.names.trim() !== '' ? r.names : null,
      code: typeof r.code === 'string' ? r.code : null,
      since: typeof r.created_at === 'string' ? r.created_at : '',
    });
  }
  return out.sort((a, b) => (a.since < b.since ? 1 : a.since > b.since ? -1 : 0));
}

async function call(client: Pick<SupabaseClient, 'rpc'>, fn: string, args?: Record<string, unknown>): Promise<UplineResult> {
  try {
    const { data, error } = await client.rpc(fn, args);
    return error === null ? parseUplineResult(data) : 'failed';
  } catch {
    return 'failed';
  }
}

/** Asks the household holding `code` to be my tuyến trên. */
export const requestUplineByCode = (client: Pick<SupabaseClient, 'rpc'>, code: string) => call(client, 'request_upline_by_code', { p_code: code });
/** Withdraws my pending request. */
export const cancelUplineRequest = (client: Pick<SupabaseClient, 'rpc'>) => call(client, 'cancel_upline_request');
/** Accepts or declines a request sent to my household. */
export const respondUpline = (client: Pick<SupabaseClient, 'rpc'>, id: string, accept: boolean) => call(client, 'respond_upline', { p_id: id, p_accept: accept });

/** My pending request, null when none, undefined when it cannot be read. */
export async function loadMyUplineRequest(client: Pick<SupabaseClient, 'rpc'>): Promise<MyUplineRequest | null | undefined> {
  try {
    const { data, error } = await client.rpc('my_upline_request');
    return error === null ? parseMyUplineRequest(data) : undefined;
  } catch {
    return undefined;
  }
}

/** Requests sent to my household, or null when they cannot be read (offline, older server). */
export async function loadUplineInvites(client: Pick<SupabaseClient, 'rpc'>): Promise<UplineInvite[] | null> {
  try {
    const { data, error } = await client.rpc('upline_invites');
    return error === null ? parseUplineInvites(data) : null;
  } catch {
    return null;
  }
}

/** Whether my household has a tuyến trên; null when it cannot be read. */
export async function loadHasSponsor(client: Pick<SupabaseClient, 'from'>, accountId: string): Promise<boolean | null> {
  try {
    const own = await client.from('household_members').select('household_id').eq('user_id', accountId).is('left_at', null).maybeSingle();
    const id = (own.data as { household_id?: string } | null)?.household_id;
    if (own.error || id === undefined) return null;
    const h = await client.from('households').select('sponsor_household_id').eq('id', id).maybeSingle();
    if (h.error) return null;
    return (h.data as { sponsor_household_id?: string | null } | null)?.sponsor_household_id != null;
  } catch {
    return null;
  }
}

/** Story 074: old code → new code of my F1 households whose code was replaced; empty when unreadable. */
export async function loadDownlineCodeChanges(client: Pick<SupabaseClient, 'rpc'>): Promise<ReadonlyMap<string, string>> {
  try {
    const { data, error } = await client.rpc('downline_code_changes');
    if (error !== null || !Array.isArray(data)) return new Map();
    const out = new Map<string, string>();
    for (const r of data as Record<string, unknown>[]) if (typeof r.old_code === 'string' && typeof r.new_code === 'string') out.set(r.old_code, r.new_code);
    return out;
  } catch {
    return new Map();
  }
}
