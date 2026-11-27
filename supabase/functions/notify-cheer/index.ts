/**
 * notify-cheer (story 057): sends a web push for the cheer the caller just sent.
 * Body: { toHouseholdId: string, toUserId?: string }. Responds { sent: number }.
 *
 * Finds the caller's latest cheer to that target from the last 10 minutes that was not pushed
 * yet, marks it pushed (`notified_at`, so one cheer is pushed at most once), and pushes it to
 * every browser of its receivers: the named member for a spouse cheer, else every member of the
 * cheered code; never the sender. Subscriptions the push service reports gone are deleted.
 * Needs the VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY function secrets; without them it answers
 * 503 `not_configured` and changes nothing.
 */
import webpush from 'npm:web-push@3.6.7';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { cheerPushPayload, cheerRecipients, isGoneSubscription } from '../_shared/push.ts';

const RECENT_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return json(req, 503, { error: 'not_configured' });

  const admin = adminClient();
  const caller = await getCaller(req, admin);
  if (!caller) return json(req, 401, { error: 'not_signed_in' });
  const body = await req.json().catch(() => null);
  const toHouseholdId = typeof body?.toHouseholdId === 'string' && UUID.test(body.toHouseholdId) ? body.toHouseholdId : null;
  const toUserId = typeof body?.toUserId === 'string' && UUID.test(body.toUserId) ? body.toUserId : null;
  if (!toHouseholdId) return json(req, 400, { error: 'invalid_target' });

  let query = admin
    .from('cheers')
    .select('id, sent_by, to_user_id, message, sender_name')
    .eq('sent_by', caller.id)
    .eq('to_household_id', toHouseholdId)
    .is('notified_at', null)
    .gte('created_at', new Date(Date.now() - RECENT_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1);
  query = toUserId === null ? query.is('to_user_id', null) : query.eq('to_user_id', toUserId);
  const { data: cheers } = await query;
  const cheer = cheers?.[0];
  if (!cheer) return json(req, 404, { error: 'no_cheer' });

  // Claim it: a second call for the same cheer finds nothing to send.
  const { data: claimed } = await admin.from('cheers').update({ notified_at: new Date().toISOString() }).eq('id', cheer.id).is('notified_at', null).select('id');
  if (!claimed || claimed.length === 0) return json(req, 200, { sent: 0 });

  const { data: members } = await admin.from('household_members').select('user_id').eq('household_id', toHouseholdId).is('left_at', null);
  const receivers = cheerRecipients(cheer, (members ?? []).map((m: { user_id: string }) => m.user_id));
  if (receivers.length === 0) return json(req, 200, { sent: 0 });
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', receivers);

  webpush.setVapidDetails('https://haoquang1990.github.io/diamond-challenge/', publicKey, privateKey);
  const payload = JSON.stringify(cheerPushPayload(cheer.sender_name, cheer.message));
  let sent = 0;
  for (const s of (subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86_400, urgency: 'normal' });
      sent += 1;
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 0;
      if (isGoneSubscription(status)) await admin.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('[notify-cheer] push failed', status);
    }
  }
  return json(req, 200, { sent });
});
