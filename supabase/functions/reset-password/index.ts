/**
 * reset-password (story 019): admin only. Sets a new temporary password for a user and
 * forces a change on their next sign-in.
 * Body: { phone?: string, userId?: string, password: string }. Responds { userId }.
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
  if (caller.role !== 'admin') return json(req, 403, { error: 'admin_only' });

  const body = await req.json().catch(() => null);
  if (!isValidTempPassword(body?.password)) return json(req, 400, { error: 'invalid_password' });

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
