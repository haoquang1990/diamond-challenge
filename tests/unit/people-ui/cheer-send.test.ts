// Story 049: the chosen or typed cheer is sent as is, a spouse cheer names its receiver, and a
// member only sees the cheers meant for them.
import { describe, expect, it } from 'vitest';
import { cheersForMe, cleanCheerMessage, sendCheer } from '../../../src/data/group-service';

function fake(error: { code: string } | null = null) {
  const rows: unknown[] = [];
  return { rows, client: { from: () => ({ insert: async (row: unknown) => { rows.push(row); return { error }; } }) } as never };
}

describe('sendCheer', () => {
  it('sends the chosen text, and the receiver for a spouse cheer', async () => {
    const f = fake();
    expect(await sendCheer(f.client, { fromHouseholdId: 'h', toHouseholdId: 'h', toUserId: 'u2', message: '  Anh giỏi lắm!  ', messages: ['x'] })).toEqual({ ok: true });
    expect(f.rows).toEqual([{ from_household_id: 'h', to_household_id: 'h', to_user_id: 'u2', message: 'Anh giỏi lắm!' }]);
  });

  it('keeps sponsor cheers without a receiver and refuses an empty or too long text', async () => {
    const f = fake();
    await sendCheer(f.client, { fromHouseholdId: 'a', toHouseholdId: 'b', message: 'Cố lên', messages: [] });
    expect(f.rows[0]).toEqual({ from_household_id: 'a', to_household_id: 'b', message: 'Cố lên' });
    expect(await sendCheer(f.client, { fromHouseholdId: 'a', toHouseholdId: 'b', message: '   ', messages: [] })).toEqual({ ok: false, error: 'no_message' });
    expect(await sendCheer(f.client, { fromHouseholdId: 'a', toHouseholdId: 'b', message: 'x'.repeat(201), messages: [] })).toEqual({ ok: false, error: 'no_message' });
  });

  it('maps the daily limit and a refusal', async () => {
    expect(await sendCheer(fake({ code: '23505' }).client, { fromHouseholdId: 'a', toHouseholdId: 'b', message: 'Hi', messages: [] })).toEqual({ ok: false, error: 'already' });
    expect(await sendCheer(fake({ code: '42501' }).client, { fromHouseholdId: 'a', toHouseholdId: 'b', message: 'Hi', messages: [] })).toEqual({ ok: false, error: 'not_allowed' });
  });
});

describe('cleanCheerMessage', () => {
  it('trims and keeps 1-200 characters', () => {
    expect(cleanCheerMessage(' Cố lên ')).toBe('Cố lên');
    expect(cleanCheerMessage('x'.repeat(200))).toHaveLength(200);
    expect(cleanCheerMessage('')).toBeNull();
  });
});

describe('cheersForMe', () => {
  it('keeps sponsor cheers and spouse cheers to me, drops the ones I sent my spouse', () => {
    const rows = [{ id: 'a', toUserId: null }, { id: 'b', toUserId: 'me' }, { id: 'c', toUserId: 'spouse' }];
    expect(cheersForMe(rows, 'me').map((r) => r.id)).toEqual(['a', 'b']);
  });
});
