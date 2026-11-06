import { describe, expect, it } from 'vitest';
import { isValidTempPassword, normalizePhone, phoneToEmail } from '../../../supabase/functions/_shared/phone';

describe('normalizePhone', () => {
  it.each([
    ['0912345678', '+84912345678'],
    ['0912 345 678', '+84912345678'],
    ['091.234.5678', '+84912345678'],
    ['84912345678', '+84912345678'],
    ['+84 912-345-678', '+84912345678'],
    ['+84 0912 345 678', '+84912345678'],
    ['0084912345678', '+84912345678'],
    ['+1 (415) 555-0123', '+14155550123'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', '12345', '0912', 'abc0912345678', '+0912345678', '4155550123', '+8491234567890123'])(
    'rejects %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('phoneToEmail', () => {
  it('builds the internal login email from E.164', () => {
    expect(phoneToEmail('+84912345678')).toBe('84912345678@phone.diamond-challenge.app');
  });
});

describe('isValidTempPassword', () => {
  it('needs 8 to 72 characters', () => {
    expect(isValidTempPassword('1234567')).toBe(false);
    expect(isValidTempPassword('12345678')).toBe(true);
    expect(isValidTempPassword('x'.repeat(73))).toBe(false);
    expect(isValidTempPassword(12345678)).toBe(false);
  });
});
