// Story 054: one way to write a phone, "+84 912 345 678" (no trunk 0), and the Vietnamese mobile rule.
import { describe, expect, it } from 'vitest';
import { formatE164, formatPhoneParts, isVnMobileE164, phoneKey, tidyNationalNumber, validatePhone } from '../../../src/domain/people';
import type { PeopleConfig } from '../../../src/domain/people';
import { normalizePhone, isAllowedNewAccountPhone } from '../../../supabase/functions/_shared/phone';

const CONFIG: PeopleConfig = {
  stages: [{ id: 'a', name: 'A', xp: 0 }],
  targets: { contactsTarget: 1, customersTarget: 1, f1Target: 1 },
  countryCodes: [{ code: '+84', name: 'Việt Nam' }, { code: '+1', name: 'Hoa Kỳ' }],
};

describe('validatePhone (+84)', () => {
  it('stores 9 digits without the trunk 0, typed either way', () => {
    expect(validatePhone('+84', '0912 345 678', CONFIG)).toEqual({ ok: true, phone: { country: '+84', number: '912345678' } });
    expect(validatePhone('+84', '912345678', CONFIG)).toEqual({ ok: true, phone: { country: '+84', number: '912345678' } });
  });

  it('refuses a Vietnamese number that is not a mobile number', () => {
    expect(validatePhone('+84', '091234567', CONFIG)).toEqual({ ok: false, reason: 'bad_vn' }); // one digit short
    expect(validatePhone('+84', '09123456781', CONFIG)).toEqual({ ok: false, reason: 'bad_vn' }); // one too many
    expect(validatePhone('+84', '0212345678', CONFIG)).toEqual({ ok: false, reason: 'bad_vn' }); // 02x is not mobile
  });

  it('keeps the old rule for other countries', () => {
    expect(validatePhone('+1', '4155550100', CONFIG)).toEqual({ ok: true, phone: { country: '+1', number: '4155550100' } });
  });
});

describe('display', () => {
  it('writes +84 numbers as +84 912 345 678, old stored 0… included', () => {
    expect(formatPhoneParts('+84', '912345678')).toBe('+84 912 345 678');
    expect(formatPhoneParts('+84', '0912345678')).toBe('+84 912 345 678');
    expect(formatPhoneParts('+1', '4155550100')).toBe('+1 4155550100');
    expect(formatE164('+84912345678')).toBe('+84 912 345 678');
    expect(formatE164('+14155550100')).toBe('+14155550100');
  });

  it('tidies the number box on blur', () => {
    expect(tidyNationalNumber('+84', '0912345678')).toBe('912 345 678');
    expect(tidyNationalNumber('+84', '91234')).toBe('91234');
    expect(tidyNationalNumber('+1', '4155550100')).toBe('4155550100');
  });

  it('still compares old and new numbers as the same', () => {
    expect(phoneKey({ country: '+84', number: '0912345678' })).toBe(phoneKey({ country: '+84', number: '912345678' }));
  });
});

describe('server rule for new accounts', () => {
  it('only lets new +84 accounts use a mobile number; other countries as before', () => {
    expect(isVnMobileE164('+84912345678')).toBe(true);
    expect(isAllowedNewAccountPhone('+84912345678')).toBe(true);
    expect(isAllowedNewAccountPhone('+84212345678')).toBe(false);
    expect(isAllowedNewAccountPhone('+8491234567')).toBe(false);
    expect(isAllowedNewAccountPhone('+14155550100')).toBe(true);
  });

  it('login normalisation is unchanged (old accounts keep signing in)', () => {
    expect(normalizePhone('0912345678')).toBe('+84912345678');
    expect(normalizePhone('+84 212 345 678')).toBe('+84212345678');
  });
});
