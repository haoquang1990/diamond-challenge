/**
 * add-household-member (ADR-0001): creates a sign-in for a spouse and adds them to a household.
 * Body: { phone, password, householdId?, displayName? }. Without `householdId` the caller's
 * own household is used. The caller must be a member of that household, a member of its
 * sponsor household, or an admin; the household holds at most `max_household_members`.
 * Responds { userId, householdId, phone }.
 */
import { adminClient, getCaller } from '../_shared/auth.ts';
import { rpcError } from '../_shared/errors.ts';
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

  let householdId: string | null = typeof body?.householdId === 'string' ? body.householdId : null;
  if (!householdId) {
    const { data: membership } = await admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', caller.id)
      .is('left_at', null)
      .maybeSingle();
    householdId = membership?.household_id ?? null;
  }
  if (!householdId) return json(req, 404, { error: 'no_household' });

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

  const { error: provisionError } = await admin.rpc('provision_member', {
    p_user: created.user.id,
    p_phone: phone,
    p_household: householdId,
    p_created_by: caller.id,
    p_display_name: typeof body?.displayName === 'string' ? body.displayName : null,
  });
  if (provisionError) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error('[add-household-member] provision failed', provisionError.code, provisionError.message);
    const mapped = rpcError(provisionError.code);
    return json(req, mapped.status, { error: mapped.error });
  }

  return json(req, 201, { userId: created.user.id, householdId, phone });
});
