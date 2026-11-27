/**
 * send-reminders (story 058): pushes the daily reminder to every account whose chosen time has
 * come (local time zone), that was not reminded today and whose goal is not known to be met
 * (`member_progress.stats_day` = today and `goal_today`). Marks `last_reminded_on` first, so a
 * second run sends nothing. Called by pg_cron every 15 minutes; safe to call any time, so it needs
 * no caller identity. Responds { reminded, sent }.
 */
import webpush from 'npm:web-push@3.6.7';
import { adminClient } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { isGoneSubscription } from '../_shared/push.ts';
import { reminderDue, reminderPushPayload } from '../_shared/reminder.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) return json(req, 503, { error: 'not_configured' });
  webpush.setVapidDetails('https://haoquang1990.github.io/diamond-challenge/', publicKey, privateKey);

  const admin = adminClient();
  const now = new Date();
  const { data: prefs } = await admin.from('notification_prefs').select('user_id, reminder_time, time_zone, last_reminded_on').eq('reminder_enabled', true);
  const rows = (prefs ?? []) as { user_id: string; reminder_time: string; time_zone: string; last_reminded_on: string | null }[];
  if (rows.length === 0) return json(req, 200, { reminded: 0, sent: 0 });
  const ids = rows.map((r) => r.user_id);
  const { data: progress } = await admin.from('member_progress').select('user_id, stats_day, goal_today, streak').in('user_id', ids);
  const byUser = new Map(((progress ?? []) as { user_id: string; stats_day: string | null; goal_today: boolean; streak: number }[]).map((p) => [p.user_id, p]));

  let reminded = 0;
  let sent = 0;
  for (const r of rows) {
    const p = byUser.get(r.user_id);
    const { due, localDate } = reminderDue(now, {
      timeZone: r.time_zone,
      time: r.reminder_time.slice(0, 5),
      lastRemindedOn: r.last_reminded_on,
      statsDay: p?.stats_day ?? null,
      goalToday: p?.goal_today === true,
    });
    if (!due) continue;
    // Claim the day first: an overlapping run sends nothing for this account.
    const { data: claimed } = await admin
      .from('notification_prefs')
      .update({ last_reminded_on: localDate })
      .eq('user_id', r.user_id)
      .or(`last_reminded_on.is.null,last_reminded_on.neq.${localDate}`)
      .select('user_id');
    if (!claimed || claimed.length === 0) continue;
    reminded += 1;
    const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', r.user_id);
    const payload = JSON.stringify(reminderPushPayload(p?.streak ?? 0));
    for (const s of (subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3 * 3600, urgency: 'normal' });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode ?? 0;
        if (isGoneSubscription(status)) await admin.from('push_subscriptions').delete().eq('id', s.id);
        else console.error('[send-reminders] push failed', status);
      }
    }
  }
  return json(req, 200, { reminded, sent });
});
