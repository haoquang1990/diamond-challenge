/**
 * create-f1-account (ADR-0001): creates a sign-in and a new F1 household for an NPP contact.
 * Body: { phone, password, amwayCode, displayName?, root? }.
 * The new household's sponsor is the caller's household and its active code is `amwayCode`
 * (the contact's code). An admin may pass `root: true` for a household with no sponsor.
 * Responds { userId, householdId, phone }.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { rpcError } from '../_shared/errors.ts';
import { corsHeaders, json } from '../_shared/http.ts';
import { isValidTempPassword, normalizeAmwayCode, normalizePhone, phoneToEmail } from '../_shared/phone.ts';

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
  const code = typeof body?.amwayCode === 'string' ? normalizeAmwayCode(body.amwayCode) : null;
  if (!code) return json(req, 400, { error: 'invalid_code' });
  const root = body?.root === true;
  if (root && caller.role !== 'admin') return json(req, 403, { error: 'admin_only' });

  let sponsorHousehold: string | null = null;
  if (!root) {
    const { data: membership } = await admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', caller.id)
      .is('left_at', null)
      .maybeSingle();
    if (!membership) return json(req, 403, { error: 'no_household' });
    sponsorHousehold = membership.household_id;
  }

  const { data: existing } = await admin.from('profiles').select('id').eq('phone', phone).maybeSingle();
  if (existing) return json(req, 409, { error: 'phone_taken' });
  const { data: codeInUse } = await admin
    .from('household_codes')
    .select('id')
    .eq('code', code)
    .eq('status', 'active')
    .maybeSingle();
  if (codeInUse) return json(req, 409, { error: 'code_taken' });

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

  const { data: householdId, error: provisionError } = await admin.rpc('provision_household', {
    p_user: created.user.id,
    p_phone: phone,
    p_sponsor_household: sponsorHousehold,
    p_code: code,
    p_created_by: caller.id,
    p_display_name: typeof body?.displayName === 'string' ? body.displayName : null,
  });
  if (provisionError) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error('[create-f1-account] provision failed', provisionError.code, provisionError.message);
    const mapped = rpcError(provisionError.code);
    return json(req, mapped.status, { error: mapped.error });
  }

  return json(req, 201, { userId: created.user.id, householdId, phone });
});
