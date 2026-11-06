/**
 * Phone helpers shared by the account Edge Functions (story 019). Pure: no Deno or
 * network APIs, so Vitest covers them from tests/unit/supabase/.
 */

/** Domain of the internal login email built from a phone number. Never receives mail. */
export const PHONE_EMAIL_DOMAIN = 'phone.diamond-challenge.app';

/** Country code assumed for numbers written without one (a leading 0). */
export const DEFAULT_COUNTRY_CODE = '84';

/** Minimum length of a temporary password. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Normalizes a phone number to E.164 (`+84912345678`), or returns null when it is not one.
 * Accepts spaces, dots, dashes and brackets; `0…` and `84…` become `+84…`; any other
 * country needs a leading `+`. The full number has 9–15 digits.
 */
export function normalizePhone(input: string): string | null {
  const compact = input.trim().replace(/[\s.\-()]/g, '');
  let digits: string;
  if (compact.startsWith('+')) digits = compact.slice(1);
  else if (compact.startsWith('00')) digits = compact.slice(2);
  else if (compact.startsWith('0')) digits = DEFAULT_COUNTRY_CODE + compact.slice(1);
  else if (compact.startsWith(DEFAULT_COUNTRY_CODE)) digits = compact;
  else return null;
  // `+84 0912…`: drop the trunk 0 written after the country code.
  if (digits.startsWith(`${DEFAULT_COUNTRY_CODE}0`)) digits = DEFAULT_COUNTRY_CODE + digits.slice(DEFAULT_COUNTRY_CODE.length + 1);
  return /^[1-9][0-9]{8,14}$/.test(digits) ? `+${digits}` : null;
}

/** The internal Supabase Auth email for an E.164 phone: `84912345678@phone.diamond-challenge.app`. */
export function phoneToEmail(e164: string): string {
  return `${e164.replace(/^\+/, '')}@${PHONE_EMAIL_DOMAIN}`;
}

/** True when a temporary password is long enough. */
export function isValidTempPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= 72;
}
