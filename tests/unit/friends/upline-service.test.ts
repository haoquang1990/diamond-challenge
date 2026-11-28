/** Story 073: reading upline requests (mine and the ones sent to my household). Fixed data only. */
import { describe, expect, it } from 'vitest';
import { parseMyUplineRequest, parseUplineInvites, parseUplineResult } from '../../../src/data/upline-service';

describe('parseMyUplineRequest', () => {
  it('reads the code I typed, or null', () => {
    expect(parseMyUplineRequest([{ code: '7001112223', created_at: '2026-11-28T00:00:00Z' }])).toEqual({ code: '7001112223', since: '2026-11-28T00:00:00Z' });
    expect(parseMyUplineRequest([])).toBeNull();
    expect(parseMyUplineRequest(null)).toBeNull();
  });
});

describe('parseUplineInvites', () => {
  it('keeps well-formed requests, newest first', () => {
    const list = parseUplineInvites([
      { id: 'r1', household_id: 'h1', names: 'Chị Mai Thử', code: '7005551234', created_at: '2026-11-27T00:00:00Z' },
      { id: 'r2', household_id: 'h2', names: null, code: null, created_at: '2026-11-28T00:00:00Z' },
      { id: 3 },
    ]);
    expect(list.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(list[1]).toEqual({ id: 'r1', householdId: 'h1', names: 'Chị Mai Thử', code: '7005551234', since: '2026-11-27T00:00:00Z' });
  });
});

describe('parseUplineResult', () => {
  it('keeps known answers and reads the rest as failed', () => {
    for (const r of ['sent', 'invalid', 'has_upline', 'no_household', 'ok', 'not_found', 'cycle'] as const) expect(parseUplineResult(r)).toBe(r);
    expect(parseUplineResult(42)).toBe('failed');
  });
});
