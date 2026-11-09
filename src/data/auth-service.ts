import type { SupabaseClient, User } from '@supabase/supabase-js';
import { MIN_PASSWORD_LENGTH, normalizePhone, phoneToEmail } from '../../supabase/functions/_shared/phone';
import type { EventStore } from './event-store';

/** Longest display name the server accepts (after trimming). */
export const MAX_DISPLAY_NAME_LENGTH = 60;

/** The signed-in account as the UI shows it. Never carries a password or token. */
export interface AccountInfo {
  /** Supabase Auth user id. */
  readonly accountId: string;
  /** E.164 phone (`+84912345678`) recovered from the internal login email, or null if unreadable. */
  readonly phone: string | null;
  /** Display name from `profiles`, or null when not set. */
  readonly displayName: string | null;
  /** True until the user has replaced the temporary password. */
  readonly mustChangePassword: boolean;
}

/** Why an auth call failed. Deliberately says nothing about whether a phone number exists. */
export type AuthFailure = 'invalid-phone' | 'bad-credentials' | 'network' | 'server' | 'same-password';

/** Outcome of a call that returns nothing on success. */
export type AuthResult = { readonly ok: true } | { readonly ok: false; readonly reason: AuthFailure };

/** Outcome of {@link signInWithPhone}. */
export type SignInResult = { readonly ok: true; readonly account: AccountInfo } | { readonly ok: false; readonly reason: AuthFailure };

/** Why a new password was rejected on the client. */
export type PasswordProblem = 'too-short' | 'mismatch' | 'same-as-temporary';

/**
 * Checks a new password before it is sent. `temporary` is the password typed at sign-in
 * (null when unknown, e.g. after a reload; the server then rejects an identical one).
 *
 * @example
 * validateNewPassword('abcdefgh', 'abcdefgh', 'temp1234'); // null
 */
export function validateNewPassword(password: string, confirmation: string, temporary: string | null): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too-short';
  if (password !== confirmation) return 'mismatch';
  if (temporary !== null && password === temporary) return 'same-as-temporary';
  return null;
}

/** Trims a display name; returns null when it is empty or longer than {@link MAX_DISPLAY_NAME_LENGTH}. */
export function validateDisplayName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_DISPLAY_NAME_LENGTH ? name : null;
}

interface ErrorLike {
  readonly name?: string;
  readonly message?: string;
  readonly status?: number;
  readonly code?: string;
}

/** Maps a Supabase/PostgREST error to a failure reason. */
function classify(error: ErrorLike): AuthFailure {
  if (error.code === 'same_password') return 'same-password';
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline || error.name === 'AuthRetryableFetchError' || error.status === 0 || /fetch|network/i.test(error.message ?? '')) {
    return 'network';
  }
  if (error.status === 400 || error.status === 401 || error.code === 'invalid_credentials') return 'bad-credentials';
  return 'server';
}

function phoneFromUser(user: User): string | null {
  const local = user.email?.split('@')[0] ?? '';
  return /^[0-9]+$/.test(local) ? `+${local}` : null;
}

/**
 * Reads the signed-in user's own `profiles` row. When the row cannot be read (offline),
 * falls back to session data only, so the phone still shows and the app stays usable.
 */
async function toAccount(client: SupabaseClient, user: User): Promise<AccountInfo> {
  const base = { accountId: user.id, phone: phoneFromUser(user) };
  const { data, error } = await client.from('profiles').select('must_change_password, display_name').eq('id', user.id).maybeSingle();
  if (error !== null || data === null) {
    console.error('[auth] could not read the profile', error);
    return { ...base, displayName: null, mustChangePassword: false };
  }
  const row = data as { must_change_password?: unknown; display_name?: unknown };
  return {
    ...base,
    displayName: typeof row.display_name === 'string' && row.display_name.trim() !== '' ? row.display_name : null,
    mustChangePassword: row.must_change_password === true,
  };
}

/**
 * Signs in with country code + phone + password (internal email, see `phoneToEmail`).
 * The password is only passed to Supabase; it is never logged or stored here.
 *
 * @example
 * const r = await signInWithPhone(client, { countryCode: '+84', number: '0912345678', password });
 * if (r.ok && r.account.mustChangePassword) showChangePassword();
 */
export async function signInWithPhone(
  client: SupabaseClient,
  input: { readonly countryCode: string; readonly number: string; readonly password: string },
): Promise<SignInResult> {
  const e164 = normalizePhone(`${input.countryCode}${input.number}`);
  if (e164 === null) return { ok: false, reason: 'invalid-phone' };
  const { data, error } = await client.auth.signInWithPassword({ email: phoneToEmail(e164), password: input.password });
  if (error !== null || data.user === null) return { ok: false, reason: classify(error ?? { status: 500 }) };
  return { ok: true, account: await toAccount(client, data.user) };
}

/** The account of the persisted session, or null when signed out. Works offline from local storage. */
export async function loadAccount(client: SupabaseClient): Promise<AccountInfo | null> {
  const { data } = await client.auth.getSession();
  return data.session === null ? null : toAccount(client, data.session.user);
}

/** Signs out on this device only. Does not touch the local event log. */
export async function signOut(client: SupabaseClient): Promise<AuthResult> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  return error === null ? { ok: true } : { ok: false, reason: classify(error) };
}

/**
 * Replaces the temporary password, then calls `mark_password_changed()`.
 * Validate with {@link validateNewPassword} first.
 */
export async function changePassword(client: SupabaseClient, newPassword: string): Promise<AuthResult> {
  const update = await client.auth.updateUser({ password: newPassword });
  if (update.error !== null) return { ok: false, reason: classify(update.error) };
  const marked = await client.rpc('mark_password_changed');
  return marked.error === null ? { ok: true } : { ok: false, reason: classify(marked.error) };
}

/** Saves the display name through `set_display_name`. `name` must pass {@link validateDisplayName}. */
export async function saveDisplayName(client: SupabaseClient, name: string): Promise<AuthResult> {
  const { error } = await client.rpc('set_display_name', { p_name: name });
  return error === null ? { ok: true } : { ok: false, reason: classify(error) };
}

/**
 * Appends ONE personal `settings_changed { accountLinked: { localUserId, accountId } }` event
 * (no `xp`, never sent to the server) unless the same pair is already in the log.
 * Returns true when an event was appended.
 */
export async function ensureAccountLinked(eventStore: EventStore, accountId: string): Promise<boolean> {
  const localUserId = await eventStore.getUserId();
  const events = await eventStore.list();
  const linked = events.some((e) => {
    if (e.type !== 'settings_changed') return false;
    const link = (e.payload as { accountLinked?: { localUserId?: unknown; accountId?: unknown } }).accountLinked;
    return link !== undefined && link !== null && link.localUserId === localUserId && link.accountId === accountId;
  });
  if (linked) return false;
  await eventStore.append({ type: 'settings_changed', payload: { accountLinked: { localUserId, accountId } } });
  return true;
}
