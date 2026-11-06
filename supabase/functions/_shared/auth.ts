import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0';

/** The caller's profile as the account functions need it. */
export interface Caller {
  readonly id: string;
  readonly role: 'user' | 'admin';
  readonly mustChangePassword: boolean;
}

/**
 * Service-role client. The key comes from the function's environment, which Supabase
 * fills in; it is never in the repository or the app.
 */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('function environment is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Resolves the signed-in caller from the request's bearer token, or null. */
export async function getCaller(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, must_change_password')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile) return null;
  return { id: profile.id, role: profile.role, mustChangePassword: profile.must_change_password };
}
