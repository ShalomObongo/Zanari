import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) must be set to initialise Supabase client.');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set to initialise Supabase client.');
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
