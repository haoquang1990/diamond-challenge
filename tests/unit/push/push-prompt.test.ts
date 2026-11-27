/**
 * Hôm nay "Bật thông báo" card (story 063): which variant shows, "Để sau" for a few days,
 * "Đã hiểu" for good, and turning the daily reminder on with push.
 */
import { describe, expect, it } from 'vitest';
import { PUSH_PROMPT, parsePushPromptMemo, pushPromptView, reminderOnPayload, snoozePushPrompt } from '../../../src/domain/push-prompt';

const NOW = Date.parse('2026-11-27T10:00:00Z');
const DAY = 86_400_000;

describe('pushPromptView', () => {
  it('asks when push is ready and this browser is not subscribed', () => {
    expect(pushPromptView('ready', false, {}, NOW)).toBe('ask');
  });

  it('hides once this browser has a subscription', () => {
    expect(pushPromptView('ready', true, {}, NOW)).toBe('hidden');
  });

  it('shows the home-screen steps on an iPhone browser tab', () => {
    expect(pushPromptView('needs_install', false, {}, NOW)).toBe('install');
  });

  it('explains how to unblock when notifications are blocked', () => {
    expect(pushPromptView('denied', false, {}, NOW)).toBe('blocked');
  });

  it('shows nothing where push cannot work or is not set up', () => {
    expect(pushPromptView('unsupported', false, {}, NOW)).toBe('hidden');
    expect(pushPromptView('not_configured', false, {}, NOW)).toBe('hidden');
  });

  it('stays hidden while snoozed and comes back after', () => {
    const memo = snoozePushPrompt({}, NOW);
    expect(pushPromptView('ready', false, memo, NOW + PUSH_PROMPT.snoozeDays * DAY - 1)).toBe('hidden');
    expect(pushPromptView('ready', false, memo, NOW + PUSH_PROMPT.snoozeDays * DAY)).toBe('ask');
  });

  it('stays hidden for good after "Đã hiểu"', () => {
    expect(pushPromptView('denied', false, { dismissed: true }, NOW + 365 * DAY)).toBe('hidden');
  });
});

describe('parsePushPromptMemo', () => {
  it('reads a stored memo and ignores junk', () => {
    expect(parsePushPromptMemo(JSON.stringify({ snoozedUntil: 5, dismissed: true }))).toEqual({ snoozedUntil: 5, dismissed: true });
    expect(parsePushPromptMemo('not json')).toEqual({});
    expect(parsePushPromptMemo(null)).toEqual({});
    expect(parsePushPromptMemo(JSON.stringify({ snoozedUntil: 'x', dismissed: 1 }))).toEqual({});
  });
});

describe('reminderOnPayload', () => {
  it('turns the daily reminder on, keeping its time', () => {
    expect(reminderOnPayload({ enabled: false, time: '21:30' })).toEqual({ reminder: { enabled: true, time: '21:30' } });
  });

  it('writes nothing when it is already on', () => {
    expect(reminderOnPayload({ enabled: true, time: '20:00' })).toBeNull();
  });
});
