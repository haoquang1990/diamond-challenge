// Story 059: the sponsor's contact and the F1 account stay linked (phone, names).
import { describe, expect, it } from 'vitest';
import { accountPhoneDiffers, splitE164 } from '../../../src/ui/people-helpers';
import { f1LoginName } from '../../../src/ui/group-helpers';

const CODES = [{ code: '+84', name: 'Việt Nam' }, { code: '+1', name: 'Hoa Kỳ' }, { code: '+44', name: 'Anh' }];

describe('splitE164', () => {
  it('splits an account phone into the country code and national number', () => {
    expect(splitE164('+84912345678', CODES)).toEqual({ country: '+84', number: '912345678' });
    expect(splitE164('+14155550100', CODES)).toEqual({ country: '+1', number: '4155550100' });
    expect(splitE164('+999123', CODES)).toBeNull();
  });
});

describe('accountPhoneDiffers', () => {
  it('compares the contact phone with the account phone, old trunk 0 included', () => {
    expect(accountPhoneDiffers({ country: '+84', number: '0912345678' }, '+84912345678', CODES)).toBe(false);
    expect(accountPhoneDiffers({ country: '+84', number: '912345001' }, '+84912345678', CODES)).toBe(true);
    expect(accountPhoneDiffers(null, '+84912345678', CODES)).toBe(true);
    expect(accountPhoneDiffers({ country: '+84', number: '912345001' }, null, CODES)).toBe(false);
  });
});

describe('f1LoginName', () => {
  it('names each login by my contact name for that account, else its own name, else nothing', () => {
    expect(f1LoginName({ userId: 'a', displayName: 'Uyên', phone: '+84912345678' }, new Map([['a', 'Chị Uyên Thử']]))).toBe('Chị Uyên Thử');
    expect(f1LoginName({ userId: 'b', displayName: 'Khoa', phone: '+84912345679' }, new Map())).toBe('Khoa');
    expect(f1LoginName({ userId: 'c', displayName: null, phone: '+84912345679' }, new Map())).toBeNull();
  });
});
