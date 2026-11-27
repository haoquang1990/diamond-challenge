// Story 057: web push for cheers. Pure parts of the app side and of the notify-cheer function.
import { describe, expect, it } from 'vitest';
import { pushSupport, urlBase64ToUint8Array } from '../../../src/notifications/push';
import { cheerPushPayload, cheerRecipients, isGoneSubscription } from '../../../supabase/functions/_shared/push';

describe('app side', () => {
  it('decodes the VAPID public key', () => {
    expect([...urlBase64ToUint8Array('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
  });

  it('tells what the device can do', () => {
    const base = { hasPush: true, hasServiceWorker: true, permission: 'default' as const, ios: false, standalone: false, configured: true };
    expect(pushSupport(base)).toBe('ready');
    expect(pushSupport({ ...base, configured: false })).toBe('not_configured');
    expect(pushSupport({ ...base, ios: true })).toBe('needs_install');
    expect(pushSupport({ ...base, ios: true, standalone: true })).toBe('ready');
    expect(pushSupport({ ...base, hasPush: false })).toBe('unsupported');
    expect(pushSupport({ ...base, permission: 'denied' })).toBe('denied');
  });
});

describe('notify-cheer', () => {
  const members = ['me', 'spouse'];
  it('sends a sponsor cheer to every member of the cheered code, a spouse cheer to that person only', () => {
    expect(cheerRecipients({ sent_by: 'sponsor', to_user_id: null }, members)).toEqual(['me', 'spouse']);
    expect(cheerRecipients({ sent_by: 'spouse', to_user_id: 'me' }, members)).toEqual(['me']);
    expect(cheerRecipients({ sent_by: 'me', to_user_id: null }, members)).toEqual(['spouse']); // never to the sender
  });

  it('builds a short notification that opens Hôm nay', () => {
    expect(cheerPushPayload('Chị Hoa Thử', 'Tuần này chốt thêm 1 khách nhé!')).toEqual({
      title: '💎 Chị Hoa Thử cổ vũ bạn',
      body: 'Tuần này chốt thêm 1 khách nhé!',
      url: './?tab=today',
      tag: 'cheer',
    });
    expect(cheerPushPayload(null, 'x'.repeat(300)).body.length).toBeLessThanOrEqual(160);
    expect(cheerPushPayload(null, 'Cố lên').title).toBe('💎 Bạn vừa được cổ vũ');
  });

  it('drops subscriptions the push service says are gone', () => {
    expect(isGoneSubscription(404)).toBe(true);
    expect(isGoneSubscription(410)).toBe(true);
    expect(isGoneSubscription(500)).toBe(false);
  });
});
