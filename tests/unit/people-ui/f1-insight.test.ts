// Story 050: an F1 NPP's numbers combined for the sponsor, the reminder line and suggested cheers.
import { describe, expect, it } from 'vitest';
import type { GroupHousehold, MemberProgress } from '../../../src/data/group-service';
import { agoLabel, householdInsight, insightNote, suggestCheers, tasks7dLabel } from '../../../src/ui/group-helpers';

const TODAY = '2026-11-26';
const NOW = new Date('2026-11-26T05:00:00.000Z');
const mp = (over: Partial<MemberProgress> = {}): MemberProgress => ({
  xpTotal: 100,
  xp7d: 20,
  streak: 0,
  updatedAt: NOW.toISOString(),
  statsDay: TODAY,
  goalToday: false,
  activeDays7d: 2,
  tasks7d: { contact: 1 },
  lessonsDistinct: 3,
  lastLessonAt: '2026-11-25T01:00:00.000Z',
  badges7d: 0,
  lastSeenAt: '2026-11-26T01:00:00.000Z',
  ...over,
});
const house = (...members: { progress: MemberProgress | null; activated?: boolean }[]): GroupHousehold =>
  ({
    householdId: 'h',
    code: '1',
    lastActivityAt: null,
    numbers: null,
    cheeredToday: false,
    memberCount: members.length,
    members: members.map((m, i) => ({
      userId: `u${i}`,
      displayName: null,
      phone: null,
      ...m,
    })),
  }) as unknown as GroupHousehold;

describe('householdInsight', () => {
  it('adds tasks and badges, keeps the best days, lessons and streak, the latest times', () => {
    const i = householdInsight(
      house(
        {
          progress: mp({
            tasks7d: { contact: 1, demo: 2 },
            badges7d: 1,
            streak: 4,
          }),
        },
        {
          progress: mp({
            tasks7d: { contact: 3 },
            activeDays7d: 5,
            lessonsDistinct: 9,
            lastSeenAt: '2026-11-26T04:00:00.000Z',
          }),
        },
      ),
      TODAY,
    );
    expect(i).toMatchObject({
      activeDays7d: 5,
      tasks7d: { contact: 4, demo: 2 },
      lessonsDistinct: 9,
      badges7d: 1,
      lastSeenAt: '2026-11-26T04:00:00.000Z',
      streak: 4,
      notActivated: false,
    });
  });

  it("counts today's goal only when the numbers are from today", () => {
    expect(householdInsight(house({ progress: mp({ goalToday: true, statsDay: '2026-11-25' }) }), TODAY)?.goalToday).toBe(false);
    expect(householdInsight(house({ progress: mp({ goalToday: true }) }), TODAY)?.goalToday).toBe(true);
  });

  it('is null without numbers, but still reports a never-activated account', () => {
    expect(householdInsight(house({ progress: null }), TODAY)).toBeNull();
    expect(householdInsight(house({ progress: null, activated: false }), TODAY)?.notActivated).toBe(true);
  });
});

describe('reminder line and suggestions', () => {
  it('picks the most useful reminder', () => {
    const base = householdInsight(house({ progress: mp() }), TODAY)!;
    expect(insightNote({ ...base, notActivated: true })).toBe('Chưa đăng nhập tài khoản');
    expect(insightNote({ ...base, streak: 5 })).toBe('Chuỗi 5 ngày sắp đứt');
    expect(insightNote({ ...base, goalToday: true })).toBe('Hôm nay đã đạt mục tiêu');
    expect(insightNote({ ...base, activeDays7d: 0 })).toBe('7 ngày qua chưa hoạt động');
    expect(insightNote(base)).toBeNull();
  });

  it('suggests cheers that match the numbers', () => {
    const base = householdInsight(house({ progress: mp() }), TODAY)!;
    expect(suggestCheers({ ...base, badges7d: 2, tasks7d: { demo: 3, new_customer: 1 } }, NOW)).toEqual([
      'Chúc mừng bạn có thêm huy hiệu mới!',
      'Chúc mừng có khách hàng mới tuần này!',
      'Tuần này đã 3 buổi demo, giỏi quá!',
    ]);
    expect(suggestCheers({ ...base, streak: 6 }, NOW)).toContain('Giữ chuỗi 6 ngày nhé, hôm nay vẫn còn kịp!');
    expect(suggestCheers({ ...base, activeDays7d: 0, lastLessonAt: null }, NOW)).toEqual(['Lâu rồi chưa thấy bạn hoạt động, cần mình hỗ trợ gì không?', 'Dành 2 phút học một bài hôm nay nhé!']);
    expect(suggestCheers(null, NOW)).toEqual([]);
  });

  it('formats the task line and times', () => {
    expect(tasks7dLabel({ contact: 5, demo: 2 })).toBe('Liên hệ 5 · Demo 2 · OPP 0 · Bán hàng 0 · Bảo trợ 0');
    expect(agoLabel('2026-11-26T01:00:00.000Z', NOW)).toBe('hôm nay');
    expect(agoLabel('2026-11-25T01:00:00.000Z', NOW)).toBe('hôm qua');
    expect(agoLabel('2026-11-20T01:00:00.000Z', NOW)).toBe('6 ngày trước');
    expect(agoLabel(null, NOW)).toBeNull();
  });
});
