/**
 * Story 044: the progress sender writes only its own row, only when ready, online and changed.
 */
import { describe, expect, it } from 'vitest';
import { createMemberProgressSync, shareProgressChanged } from '../../../src/data/member-progress-sync';
import type { ShareProgress } from '../../../src/domain/progress';

function fakeClient(error: unknown = null) {
  const calls: { table: string; row: Record<string, unknown> }[] = [];
  const client = {
    from: (table: string) => ({
      upsert: async (row: Record<string, unknown>) => {
        calls.push({ table, row });
        return { error };
      },
    }),
  };
  return { client: client as never, calls };
}
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const P = (xpTotal: number, xp7d: number, streak: number): ShareProgress => ({
  xpTotal, xp7d, streak, statsDay: '2026-11-26', goalToday: false, activeDays7d: 1,
  tasks7d: { contact: 0, demo: 0, opp: 0, new_customer: 0, new_npp: 0 }, lessonsDistinct: 0, lastLessonAt: null, badges7d: 0, goalXp: 30, xpWeek: 1, weekStart: '2026-11-23',
});

describe('createMemberProgressSync', () => {
  it('sends its own row once, then nothing until a number changes', async () => {
    const { client, calls } = fakeClient();
    let value = P(100, 30, 2);
    const s = createMemberProgressSync({ client, accountId: 'me', compute: async () => value, debounceMs: 0, isReady: () => true, storage: memory(), isOnline: () => true });
    expect(await s.flush()).toBe('sent');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'member_progress', row: { user_id: 'me', xp_total: 100, xp_7d: 30, streak: 2, stats_day: '2026-11-26', goal_today: false, active_days_7d: 1 } });
    expect(await s.flush()).toBe('unchanged');
    value = P(110, 40, 2);
    expect(await s.flush()).toBe('sent');
    expect(calls).toHaveLength(2);
  });

  it('waits until ready and online, and retries after a failure', async () => {
    let ready = false;
    let online = false;
    const failing = fakeClient({ message: 'boom' });
    const s = createMemberProgressSync({ client: failing.client, accountId: 'me', compute: async () => P(1, 1, 0), debounceMs: 0, isReady: () => ready, storage: memory(), isOnline: () => online });
    expect(await s.flush()).toBe('offline');
    online = true;
    expect(await s.flush()).toBe('not_ready');
    ready = true;
    expect(await s.flush()).toBe('failed');
    expect(await s.flush()).toBe('failed');
    expect(failing.calls).toHaveLength(8); // each failure retries without the week (story 071), without goal_xp (056), then with the 044 columns
    expect(failing.calls[0]?.row).toMatchObject({ xp_week: 1, week_start: '2026-11-23' });
    expect(failing.calls[1]?.row).not.toHaveProperty('xp_week');
    expect(failing.calls[1]?.row).toHaveProperty('goal_xp');
    expect(failing.calls[2]?.row).not.toHaveProperty('goal_xp');
    expect(failing.calls[3]?.row).toEqual({ user_id: 'me', xp_total: 1, xp_7d: 1, streak: 0 });
  });

  it('remembers the last send across instances (no resend after a restart)', async () => {
    const storage = memory();
    const first = fakeClient();
    await createMemberProgressSync({ client: first.client, accountId: 'me', compute: async () => P(5, 5, 1), debounceMs: 0, isReady: () => true, storage, isOnline: () => true }).flush();
    const second = fakeClient();
    const again = createMemberProgressSync({ client: second.client, accountId: 'me', compute: async () => P(5, 5, 1), debounceMs: 0, isReady: () => true, storage, isOnline: () => true });
    expect(await again.flush()).toBe('unchanged');
    expect(second.calls).toHaveLength(0);
  });
});

describe('shareProgressChanged', () => {
  it('is true for a first send or any different number', () => {
    expect(shareProgressChanged(null, P(0, 0, 0))).toBe(true);
    expect(shareProgressChanged(P(1, 1, 1), P(1, 1, 1))).toBe(false);
    expect(shareProgressChanged(P(1, 1, 1), P(1, 1, 2))).toBe(true);
  });
});
