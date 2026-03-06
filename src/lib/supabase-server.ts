import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

// Server-side Supabase client for API routes
// Forwards the user's auth token from the request headers
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // If we have a service role key, use it (bypasses RLS)
  if (serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }

  // Otherwise, use anon key + forward auth header from client
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  return client;
}
