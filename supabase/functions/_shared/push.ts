/**
 * Pure parts of the push notifications (story 057), shared by the notify-cheer Edge Function and
 * covered by Vitest from tests/unit/push/. No Deno or network APIs here.
 */

/** The cheer row fields that decide who is notified. */
export interface CheerForPush {
  readonly sent_by: string;
  /** Spouse cheer: the one member it is for; null for a sponsor cheer to the whole code. */
  readonly to_user_id: string | null;
}

/** Who gets the notification: the named member, else every member of the code; never the sender. */
export function cheerRecipients(cheer: CheerForPush, memberIds: readonly string[]): string[] {
  const to = cheer.to_user_id === null ? memberIds : memberIds.filter((id) => id === cheer.to_user_id);
  return to.filter((id) => id !== cheer.sent_by);
}

/** What the service worker shows. */
export interface PushPayload {
  readonly title: string;
  readonly body: string;
  /** Opened on tap, relative to the app. */
  readonly url: string;
  /** Replaces an older notification of the same kind. */
  readonly tag: string;
}

/** Longest notification body; longer cheers are cut with "…". */
export const PUSH_BODY_MAX = 160;

/** "💎 Chị Hoa cổ vũ bạn" + the message. */
export function cheerPushPayload(senderName: string | null, message: string): PushPayload {
  const name = senderName?.trim() ?? '';
  const text = message.trim();
  return {
    title: name === '' ? '💎 Bạn vừa được cổ vũ' : `💎 ${name} cổ vũ bạn`,
    body: text.length > PUSH_BODY_MAX ? `${text.slice(0, PUSH_BODY_MAX - 1)}…` : text,
    url: './?tab=today',
    tag: 'cheer',
  };
}

/** True when the push service says the subscription no longer exists (it is then deleted). */
export function isGoneSubscription(status: number): boolean {
  return status === 404 || status === 410;
}
