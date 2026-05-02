import { supabase } from './supabase';

// Cache session token to avoid extra getSession() calls on every request
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Authenticated fetch wrapper — gets current session token and passes it to API routes
// Caches the token using Supabase's actual token expiry (with 60s buffer) to avoid
// using an expired token. Falls back to 55-minute cache if expires_at unavailable.
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

  // Use the actual Supabase token expiry (expires_at is in seconds)
  // Subtract 60s buffer so we refresh before it actually expires
  if (session?.expires_at) {
    tokenExpiry = session.expires_at * 1000 - 60_000;
  } else {
    // Fallback: cache for 55 minutes if expires_at not available
    tokenExpiry = now + 55 * 60 * 1000;
  }

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
