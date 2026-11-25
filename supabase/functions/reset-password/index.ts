/**
 * reset-password (story 019): sets a new temporary password for a user and forces a change on
 * their next sign-in. Body: { phone?: string, userId?: string, password: string }. Responds { userId }.
 *
 * Admins may reset anyone. Since story 048 the direct sponsor may also reset a member of an F1
 * household, by `userId` only, and only while that account has never changed its first
 * password (`must_change_password` still true), so a sponsor can re-send a lost temporary
 * password but can never take over an account in use (`already_active`, 409).
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { isValidTempPassword, normalizePhone } from '../_shared/phone.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const admin = adminClient();
  const caller = await getCaller(req, admin);
  if (!caller) return json(req, 401, { error: 'not_signed_in' });
  const body = await req.json().catch(() => null);
  if (!isValidTempPassword(body?.password)) return json(req, 400, { error: 'invalid_password' });

  if (caller.role !== 'admin') {
    // Sponsor path (story 048): userId only, direct F1, never activated.
    if (caller.mustChangePassword) return json(req, 403, { error: 'change_password_first' });
    const target = typeof body?.userId === 'string' ? body.userId : null;
    if (!target) return json(req, 403, { error: 'admin_only' });
    const { data: mine } = await admin.from('household_members').select('household_id').eq('user_id', caller.id).is('left_at', null).maybeSingle();
    const { data: theirs } = await admin.from('household_members').select('household_id').eq('user_id', target).is('left_at', null).maybeSingle();
    if (!mine?.household_id || !theirs?.household_id) return json(req, 403, { error: 'not_allowed' });
    const { data: household } = await admin.from('households').select('sponsor_household_id').eq('id', theirs.household_id).maybeSingle();
    if (household?.sponsor_household_id !== mine.household_id) return json(req, 403, { error: 'not_allowed' });
    const { data: profile } = await admin.from('profiles').select('must_change_password').eq('id', target).maybeSingle();
    if (!profile) return json(req, 404, { error: 'not_found' });
    if (profile.must_change_password !== true) return json(req, 409, { error: 'already_active' });
  }

  let userId: string | null = typeof body?.userId === 'string' ? body.userId : null;
  if (!userId) {
    const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : null;
    if (!phone) return json(req, 400, { error: 'invalid_phone' });
    const { data } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) return json(req, 404, { error: 'not_found' });

  const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
  if (error) return json(req, error.status === 404 ? 404 : 500, { error: 'reset_failed' });
  const { error: flagError } = await admin.from('profiles').update({ must_change_password: true }).eq('id', userId);
  if (flagError) return json(req, 500, { error: 'reset_failed' });

  return json(req, 200, { userId });
});
