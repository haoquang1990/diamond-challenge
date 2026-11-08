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
  const err = error as { name?: string; context?: unknown };
  if (err.name === 'FunctionsHttpError' && err.context instanceof Response) {
    try {
      const body = (await err.context.json()) as { error?: unknown };
      if (typeof body.error === 'string' && KNOWN_ERRORS.has(body.error)) return { ok: false, error: body.error as CreateAccountError };
    } catch {
      // unreadable body: fall through to unknown
    }
    return { ok: false, error: 'unknown' };
  }
  return { ok: false, error: 'network' };
}
