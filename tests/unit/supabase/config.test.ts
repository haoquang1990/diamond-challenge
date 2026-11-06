import { describe, expect, it } from 'vitest';
import { readSupabaseConfig } from '../../../src/config/supabase';

const URL = 'https://ixxtoriatszyeapnyiwh.supabase.co';
const KEY = 'sb_publishable_exampleKey_123';

describe('readSupabaseConfig', () => {
  it('accepts a project URL and a publishable key', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: KEY })).toEqual({
      url: URL,
      publishableKey: KEY,
    });
  });

  it('stays offline when a value is missing or malformed', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL })).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: KEY })).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'nope' })).toBeNull();
  });

  it('refuses a secret key', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' })).toBeNull();
  });

  it('refuses a JWT whose role is not anon', () => {
    const jwt = (role: string) => `x.${btoa(JSON.stringify({ role }))}.y`;
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('service_role') })).toBeNull();
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon') })).not.toBeNull();
  });
});
