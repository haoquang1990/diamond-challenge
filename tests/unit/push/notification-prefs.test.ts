// Story 058: the app keeps the server's notification settings in step with the reminder settings.
import { describe, expect, it } from 'vitest';
import { createPrefsSync, prefsRow } from '../../../src/data/notification-prefs';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
function fakeClient(error: unknown = null) {
  const rows: Record<string, unknown>[] = [];
  return { rows, client: { from: () => ({ upsert: async (row: Record<string, unknown>) => (rows.push(row), { error }) }) } };
}

describe('prefsRow', () => {
  it('writes only the fields given, with the account and HH:MM time', () => {
    expect(prefsRow('me', { reminder: { enabled: true, time: '18:49' }, timeZone: 'Asia/Ho_Chi_Minh' })).toEqual({ user_id: 'me', reminder_enabled: true, reminder_time: '18:49', time_zone: 'Asia/Ho_Chi_Minh' });
    expect(prefsRow('me', { cheers: false })).toEqual({ user_id: 'me', cheers: false });
  });
});

describe('createPrefsSync', () => {
  it('sends a change once and skips the same settings later (also after a restart)', async () => {
    const storage = memory();
    const a = fakeClient();
    const s = createPrefsSync({ client: a.client, accountId: 'me', storage });
    expect(await s.save({ reminder: { enabled: true, time: '18:49' }, timeZone: 'Asia/Ho_Chi_Minh' })).toBe('sent');
    expect(await s.save({ reminder: { enabled: true, time: '18:49' }, timeZone: 'Asia/Ho_Chi_Minh' })).toBe('unchanged');
    const b = fakeClient();
    expect(await createPrefsSync({ client: b.client, accountId: 'me', storage }).save({ reminder: { enabled: true, time: '18:49' }, timeZone: 'Asia/Ho_Chi_Minh' })).toBe('unchanged');
    expect(a.rows).toHaveLength(1);
    expect(b.rows).toHaveLength(0);
  });

  it('tries again next time after a failure', async () => {
    const storage = memory();
    const bad = fakeClient({ message: 'offline' });
    expect(await createPrefsSync({ client: bad.client, accountId: 'me', storage }).save({ cheers: false })).toBe('failed');
    const good = fakeClient();
    expect(await createPrefsSync({ client: good.client, accountId: 'me', storage }).save({ cheers: false })).toBe('sent');
  });
});
