/** Story 068: when the app asks for the Amway code, and how a claim answer reads. Fixed data only. */
import { describe, expect, it } from 'vitest';
import { codeRequirement, parseClaimResult } from '../../../src/data/account-service';

describe('codeRequirement', () => {
  it('asks when my household has no active code and no claim waits', () => {
    expect(codeRequirement({ householdId: 'h', code: null, pendingClaim: false })).toBe('missing');
  });
  it('lets me in while the admin checks a claim', () => {
    expect(codeRequirement({ householdId: 'h', code: null, pendingClaim: true })).toBe('pending');
  });
  it('lets me in once the household has a code, or when I have no household (admin)', () => {
    expect(codeRequirement({ householdId: 'h', code: '7001234567', pendingClaim: false })).toBe('ok');
    expect(codeRequirement({ householdId: null, code: null, pendingClaim: false })).toBe('ok');
  });
});

describe('parseClaimResult', () => {
  it('keeps the server answers it knows and reads anything else as other', () => {
    for (const r of ['saved', 'taken', 'already_set', 'invalid', 'no_household'] as const) expect(parseClaimResult(r)).toBe(r);
    expect(parseClaimResult('boom')).toBe('other');
    expect(parseClaimResult(null)).toBe('other');
  });
});
