/**
 * create-f1-account (story 019): creates a sign-in for one of the caller's NPP F1.
 * Body: { phone: string, password: string, root?: boolean }.
 * The new profile's sponsor is the caller; an admin may pass `root: true` to create a
 * root account with no sponsor. Responds { userId, phone }.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { isValidTempPassword, normalizePhone, phoneToEmail } from '../_shared/phone.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });

  const admin = adminClient();
  const caller = await getCaller(req, admin);
  if (!caller) return json(req, 401, { error: 'not_signed_in' });
  if (caller.mustChangePassword) return json(req, 403, { error: 'change_password_first' });

  const body = await req.json().catch(() => null);
  const phone = typeof body?.phone === 'string' ? normalizePhone(body.phone) : null;
  if (!phone) return json(req, 400, { error: 'invalid_phone' });
  if (!isValidTempPassword(body?.password)) return json(req, 400, { error: 'invalid_password' });
  const root = body?.root === true;
  if (root && caller.role !== 'admin') return json(req, 403, { error: 'admin_only' });

  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (existing) return json(req, 409, { error: 'phone_taken' });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: phoneToEmail(phone),
    password: body.password,
    email_confirm: true,
    user_metadata: { phone },
  });
  if (createError || !created.user) {
    const taken = /already|exists|registered/i.test(createError?.message ?? '');
    return json(req, taken ? 409 : 500, { error: taken ? 'phone_taken' : 'create_failed' });
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    phone,
    sponsor_id: root ? null : caller.id,
    role: 'user',
    must_change_password: true,
    created_by: caller.id,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error('[create-f1-account] profile insert failed', profileError.message);
    return json(req, 500, { error: 'create_failed' });
  }

  return json(req, 201, { userId: created.user.id, phone });
});
