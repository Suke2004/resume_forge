import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

/**
 * Checks whether valid (non-placeholder) Supabase credentials exist in `.env`.
 */
export function isSupabaseConfigured(): boolean {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) return false;
  if (
    url.includes('your-project-ref.supabase.co') ||
    key === 'your-supabase-anon-key' ||
    key === 'your-supabase-service-role-key'
  ) {
    return false;
  }
  return url.startsWith('https://') || url.startsWith('http://');
}

/**
 * Returns the initialized Supabase client when `.env` credentials are set, or null otherwise.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cachedSupabase) return cachedSupabase;

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  cachedSupabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedSupabase;
}
