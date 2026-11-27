/**
 * Hôm nay "Bật thông báo" card (story 063). Notifications cannot be on by default: the phone
 * asks the person once, from a tap. This decides which variant of the card shows and remembers
 * "Để sau" (a few days) and "Đã hiểu" (for good) per account on the device.
 */
import gameConfig from '../config/game-config.json';
import type { EventPayload } from '../data/event-store';
import type { PushSupport } from '../notifications/push';
import type { ReminderSettings } from './reminders';

/** Tuning from `game-config.json` `pushPrompt`. */
export const PUSH_PROMPT: { readonly snoozeDays: number; readonly doneShowMs: number } = gameConfig.pushPrompt;

/** Which card shows: ask to turn on, iPhone home-screen steps, how to unblock, or none. */
export type PushPromptView = 'ask' | 'install' | 'blocked' | 'hidden';

/** What the person chose on this device. */
export interface PushPromptMemo {
  /** Epoch ms until which "Để sau" hides the card. */
  readonly snoozedUntil?: number;
  /** "Đã hiểu": never show again (Cài đặt › Thông báo still works). */
  readonly dismissed?: boolean;
}

/** The card variant. `subscribed`: this browser already has a push subscription. Pure. */
export function pushPromptView(support: PushSupport, subscribed: boolean, memo: PushPromptMemo, nowMs: number): PushPromptView {
  if (memo.dismissed === true) return 'hidden';
  if (memo.snoozedUntil !== undefined && nowMs < memo.snoozedUntil) return 'hidden';
  if (support === 'ready') return subscribed ? 'hidden' : 'ask';
  if (support === 'needs_install') return 'install';
  if (support === 'denied') return 'blocked';
  return 'hidden';
}

/** "Để sau": hide for {@link PUSH_PROMPT}.snoozeDays from now. Pure. */
export function snoozePushPrompt(memo: PushPromptMemo, nowMs: number): PushPromptMemo {
  return { ...memo, snoozedUntil: nowMs + PUSH_PROMPT.snoozeDays * 86_400_000 };
}

/** Reads a stored memo; anything unreadable is an empty memo. Pure. */
export function parsePushPromptMemo(raw: string | null): PushPromptMemo {
  if (raw === null) return {};
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(typeof v.snoozedUntil === 'number' ? { snoozedUntil: v.snoozedUntil } : {}),
      ...(v.dismissed === true ? { dismissed: true } : {}),
    };
  } catch {
    return {};
  }
}

/** The `settings_changed` payload that turns the daily reminder on with push, or null if it is on. Pure. */
export function reminderOnPayload(current: ReminderSettings): EventPayload | null {
  return current.enabled ? null : { reminder: { enabled: true, time: current.time } };
}
