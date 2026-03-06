import { supabase } from './supabase';

// Authenticated fetch wrapper — gets current session token and passes it to API routes
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
