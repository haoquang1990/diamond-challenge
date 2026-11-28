/** Story 072: the admin's sponsor preview and the answer of "Đổi tuyến trên". Fixed data only. */
import { describe, expect, it } from 'vitest';
import { adminHouseholdNames, parseSponsorResult } from '../../../src/data/admin-service';

describe('adminHouseholdNames', () => {
  it('joins the members by name, falling back to the phone', () => {
    expect(adminHouseholdNames([{ userId: 'a', displayName: 'Anh Hùng Thử', phone: '+84911111111' }, { userId: 'b', displayName: null, phone: '+84922222222' }])).toBe('Anh Hùng Thử & +84 922 222 222');
    expect(adminHouseholdNames([])).toBe('');
  });
});

describe('parseSponsorResult', () => {
  it('keeps the known answers and reads anything else as failed', () => {
    for (const r of ['ok', 'not_found', 'self', 'cycle'] as const) expect(parseSponsorResult(r)).toBe(r);
    expect(parseSponsorResult('boom')).toBe('failed');
    expect(parseSponsorResult(null)).toBe('failed');
  });
});
