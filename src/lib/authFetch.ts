import { supabase } from './supabase';

// Cache session token to avoid extra getSession() calls on every request
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Authenticated fetch wrapper — gets current session token and passes it to API routes
// Optimized to use cached token when available and not expired
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  // Use cached token if still valid (within 5 minutes)
  const now = Date.now();
  if (cachedToken && tokenExpiry > now) {
    return fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${cachedToken}`,
      },
    });
  }

  // Get fresh session - supabase caches this in memory so it's fast
  const { data: { session } } = await supabase.auth.getSession();
  cachedToken = session?.access_token || null;
  tokenExpiry = now + 5 * 60 * 1000; // Cache for 5 minutes

  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...(cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {}),
    },
  });
}

// Clear cached token (call on logout)
export function clearAuthCache() {
  cachedToken = null;
  tokenExpiry = 0;
}
