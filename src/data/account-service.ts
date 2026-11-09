import type { SupabaseClient } from '@supabase/supabase-js';

/** Characters of a temporary password: no look-alikes (0/O, 1/l/I). */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Length of a generated temporary password (the server accepts 8-72). */
export const TEMP_PASSWORD_LENGTH = 12;

/**
 * Generates a temporary password from {@link PASSWORD_ALPHABET} with `crypto.getRandomValues`
 * (rejection sampling, so every character is equally likely). Never stored or logged here.
 *
 * @example
 * generateTempPassword(); // 'k7TmQw3NpXz2'
 */
export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < limit && out.length < length) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    }
  }
  return out;
}

/** Error keys of the `create-f1-account` Edge Function. */
export type CreateAccountError =
  | 'not_signed_in'
  | 'change_password_first'
  | 'invalid_phone'
  | 'invalid_password'
  | 'invalid_code'
  | 'phone_taken'
  | 'code_taken'
  | 'no_household'
  | 'not_allowed'
  | 'household_full_or_inactive'
  | 'create_failed'
  /** No response (offline / network failure). */
  | 'network'
  /** Any other failure, including an unreadable error body. */
  | 'unknown';

/** Outcome of {@link createF1Account}. */
export type CreateAccountResult =
  | { readonly ok: true; readonly userId: string; readonly phone: string }
  | { readonly ok: false; readonly error: CreateAccountError };

/** Input of {@link createF1Account}. */
export interface CreateAccountInput {
  /** Phone with country code, e.g. "+84912345678". */
  readonly phone: string;
  /** Temporary password, 8-72 characters. */
  readonly password: string;
  /** The contact's normalized Amway code. */
  readonly amwayCode: string;
  /** Optional display name. */
  readonly displayName?: string;
}

const KNOWN_ERRORS: ReadonlySet<string> = new Set([
  'not_signed_in',
  'change_password_first',
  'invalid_phone',
  'invalid_password',
  'invalid_code',
  'phone_taken',
  'code_taken',
  'no_household',
  'not_allowed',
  'household_full_or_inactive',
  'create_failed',
]);

/**
 * Reads the error key of a failed `client.functions.invoke`. A `FunctionsHttpError` carries the
 * Response in `context`; its JSON `{ error }` is returned when it is in `known`, else `'unknown'`
 * (also for an unreadable body). Any other error (no response) is `'network'`.
 */
export async function readFunctionError(error: unknown, known: ReadonlySet<string>): Promise<string> {
  const err = error as { name?: string; context?: unknown };
  if (err.name === 'FunctionsHttpError' && err.context instanceof Response) {
    try {
      const body = (await err.context.json()) as { error?: unknown };
      if (typeof body.error === 'string' && known.has(body.error)) return body.error;
    } catch {
      // unreadable body: fall through to unknown
    }
    return 'unknown';
  }
  return 'network';
}

/**
 * Calls the Edge Function `create-f1-account` with `client.functions.invoke`. On an HTTP error
 * supabase-js returns a `FunctionsHttpError` whose `context` is the Response; its JSON `{ error }`
 * is mapped to a {@link CreateAccountError}. An error without a response is `network`.
 * The password is only sent to the function; it is never logged.
 *
 * @example
 * const r = await createF1Account(client, { phone: '+84912345678', password, amwayCode: '123456' });
 */
export async function createF1Account(client: SupabaseClient, input: CreateAccountInput): Promise<CreateAccountResult> {
  const { data, error } = await client.functions.invoke('create-f1-account', { body: input });
  if (error === null || error === undefined) {
    const ok = data as { userId?: unknown; phone?: unknown } | null;
    if (typeof ok?.userId === 'string' && typeof ok.phone === 'string') return { ok: true, userId: ok.userId, phone: ok.phone };
    return { ok: false, error: 'unknown' };
  }
  return { ok: false, error: (await readFunctionError(error, KNOWN_ERRORS)) as CreateAccountError };
}

/** Error keys of the `add-household-member` Edge Function. */
export type AddMemberError =
  | 'not_signed_in'
  | 'change_password_first'
  | 'invalid_phone'
  | 'invalid_password'
  | 'phone_taken'
  | 'no_household'
  | 'household_full_or_inactive'
  | 'not_allowed'
  | 'not_found'
  | 'create_failed'
  /** No response (offline / network failure). */
  | 'network'
  /** Any other failure, including an unreadable error body. */
  | 'unknown';

/** Outcome of {@link addHouseholdMember}. */
export type AddMemberResult =
  | { readonly ok: true; readonly userId: string; readonly householdId: string; readonly phone: string }
  | { readonly ok: false; readonly error: AddMemberError };

/** Input of {@link addHouseholdMember}. */
export interface AddMemberInput {
  /** Phone with country code, e.g. "+84912345678". */
  readonly phone: string;
  /** Temporary password, 8-72 characters. */
  readonly password: string;
  /** Target household; omitted = the caller's own household. */
  readonly householdId?: string;
  /** Optional display name. */
  readonly displayName?: string;
}

const KNOWN_ADD_MEMBER_ERRORS: ReadonlySet<string> = new Set([
  'not_signed_in',
  'change_password_first',
  'invalid_phone',
  'invalid_password',
  'phone_taken',
  'no_household',
  'household_full_or_inactive',
  'not_allowed',
  'not_found',
  'create_failed',
]);

/**
 * Calls the Edge Function `add-household-member` (201 `{ userId, householdId, phone }`). Errors are
 * mapped like {@link createF1Account}. The password is only sent to the function; never logged.
 *
 * @example
 * const r = await addHouseholdMember(client, { phone: '+84912345678', password });
 */
export async function addHouseholdMember(client: SupabaseClient, input: AddMemberInput): Promise<AddMemberResult> {
  const { data, error } = await client.functions.invoke('add-household-member', { body: input });
  if (error === null || error === undefined) {
    const ok = data as { userId?: unknown; householdId?: unknown; phone?: unknown } | null;
    if (typeof ok?.userId === 'string' && typeof ok.householdId === 'string' && typeof ok.phone === 'string') {
      return { ok: true, userId: ok.userId, householdId: ok.householdId, phone: ok.phone };
    }
    return { ok: false, error: 'unknown' };
  }
  return { ok: false, error: (await readFunctionError(error, KNOWN_ADD_MEMBER_ERRORS)) as AddMemberError };
}

/** A member of the caller's household. */
export interface HouseholdMemberInfo {
  readonly userId: string;
  readonly phone: string | null;
  readonly displayName: string | null;
}

/** The caller's household as shown on "Hộ của tôi". */
export interface HouseholdInfo {
  /** Null when the account belongs to no household. */
  readonly householdId: string | null;
  /** Active Amway code, or null ("Chưa có mã"). */
  readonly code: string | null;
  readonly members: readonly HouseholdMemberInfo[];
  /** Member limit from `app_config.max_household_members`. */
  readonly maxMembers: number;
}

/**
 * Reads the caller's own household through RLS: household id, active code, members (with
 * profiles) and the member limit (`fallbackMax` when unreadable). Any read error gives `null`.
 * Do not use `fetchHouseholdMembers` for this: it also returns downline households.
 *
 * @example
 * const info = await loadHousehold(client, accountId, 2);
 */
export async function loadHousehold(client: SupabaseClient, accountId: string, fallbackMax: number): Promise<HouseholdInfo | null> {
  const own = await client.from('household_members').select('household_id').eq('user_id', accountId).is('left_at', null).maybeSingle();
  if (own.error) return null;
  const maxRow = await client.from('app_config').select('value').eq('key', 'max_household_members').maybeSingle();
  const value = (maxRow.data as { value?: unknown } | null)?.value;
  const maxMembers = !maxRow.error && typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallbackMax;
  const householdId = (own.data as { household_id?: string } | null)?.household_id;
  if (householdId === undefined) return { householdId: null, code: null, members: [], maxMembers };

  const [codeRow, memberRows] = await Promise.all([
    client.from('household_codes').select('code').eq('household_id', householdId).eq('status', 'active').maybeSingle(),
    client.from('household_members').select('user_id').eq('household_id', householdId).is('left_at', null),
  ]);
  if (codeRow.error || memberRows.error) return null;
  const userIds = ((memberRows.data ?? []) as { user_id: string }[]).map((r) => r.user_id);
  let profiles: { id: string; phone: string | null; display_name: string | null }[] = [];
  if (userIds.length > 0) {
    const rows = await client.from('profiles').select('id, phone, display_name').in('id', userIds);
    if (rows.error) return null;
    profiles = (rows.data ?? []) as typeof profiles;
  }
  const members = userIds.map((userId) => {
    const p = profiles.find((x) => x.id === userId);
    return { userId, phone: p?.phone ?? null, displayName: p?.display_name ?? null };
  });
  return { householdId, code: (codeRow.data as { code?: string } | null)?.code ?? null, members, maxMembers };
}
