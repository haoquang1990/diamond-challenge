// Story 058: the server sends the daily reminder by push. When is one due, and what does it say.
import { describe, expect, it } from 'vitest';
import { localDateTime, reminderDue, reminderPushPayload } from '../../../supabase/functions/_shared/reminder';

const VN = 'Asia/Ho_Chi_Minh';
// 2026-11-27 12:00 UTC = 19:00 in Việt Nam.
const NOW = new Date('2026-11-27T12:00:00.000Z');
const base = { timeZone: VN, time: '18:45', lastRemindedOn: null as string | null, statsDay: '2026-11-27' as string | null, goalToday: false };

describe('localDateTime', () => {
  it('gives the local date and minutes of the day', () => {
    expect(localDateTime(NOW, VN)).toEqual({ date: '2026-11-27', minutes: 19 * 60 });
  });
});

describe('reminderDue', () => {
  it('is due after the reminder time on a day not yet reminded and not yet met', () => {
    expect(reminderDue(NOW, base)).toEqual({ due: true, localDate: '2026-11-27' });
  });

  it('waits until the time, and gives up 3 hours after it', () => {
    expect(reminderDue(NOW, { ...base, time: '19:30' }).due).toBe(false);
    expect(reminderDue(NOW, { ...base, time: '15:30' }).due).toBe(false);
  });

  it('sends once a day', () => {
    expect(reminderDue(NOW, { ...base, lastRemindedOn: '2026-11-27' }).due).toBe(false);
    expect(reminderDue(NOW, { ...base, lastRemindedOn: '2026-11-26' }).due).toBe(true);
  });

  it('stays quiet when today\'s goal is met; numbers from another day do not count as met', () => {
    expect(reminderDue(NOW, { ...base, goalToday: true }).due).toBe(false);
    expect(reminderDue(NOW, { ...base, goalToday: true, statsDay: '2026-11-26' }).due).toBe(true);
  });

  it('refuses a bad time or time zone', () => {
    expect(reminderDue(NOW, { ...base, time: '25:00' }).due).toBe(false);
    expect(reminderDue(NOW, { ...base, timeZone: 'Not/AZone' }).due).toBe(false);
  });
});

describe('reminderPushPayload', () => {
  it('mentions the streak when there is one, and replaces the app\'s own reminder', () => {
    expect(reminderPushPayload(5)).toEqual({ title: '🔥 Giữ chuỗi 5 ngày nhé!', body: 'Hôm nay bạn chưa đạt mục tiêu. Học 1 bài, làm 1 việc là kịp.', url: './?tab=today', tag: 'daily-reminder' });
    expect(reminderPushPayload(0).title).toBe('💎 Hôm nay bạn chưa đạt mục tiêu');
  });
});
