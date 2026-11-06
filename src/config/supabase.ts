import type { SupabaseClient } from '@supabase/supabase-js';

/** Public Supabase settings read from the Vite build env (story 019). */
export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/** The env keys this module reads. */
export interface SupabaseEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

/**
 * Validates the Supabase env at the data boundary. Returns null (the app stays offline)
 * when either value is missing or malformed, and refuses anything that looks like a
 * secret key: only `sb_publishable_…` keys (or a legacy anon JWT) may reach the app.
 */
export function readSupabaseConfig(env: SupabaseEnv): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return null;
  if (key.startsWith('sb_secret_')) {
    console.error('[supabase] a secret key was given to the app; refusing to use it');
    return null;
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !isAnonJwt(key)) return null;
  return { url, publishableKey: key };
}

function isAnonJwt(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

/** Config for this build, or null when Supabase is not configured. */
export const SUPABASE_CONFIG: SupabaseConfig | null = readSupabaseConfig(import.meta.env as SupabaseEnv);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The shared Supabase client, created on first use so offline builds never load the
 * library. Resolves to null when Supabase is not configured.
 */
export function getSupabaseClient(config: SupabaseConfig | null = SUPABASE_CONFIG): Promise<SupabaseClient> | null {
  if (config === null) return null;
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.publishableKey, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return clientPromise;
}
