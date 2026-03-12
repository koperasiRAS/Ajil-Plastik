import { createClient, SupabaseClient } from "@supabase/supabase-js";

const getSupabaseEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Log detailed error for debugging
    console.error("=== Supabase Configuration Error ===");
    console.error("NEXT_PUBLIC_SUPABASE_URL:", url ? "✓ set" : "✗ MISSING");
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY:", key ? "✓ set" : "✗ MISSING");
    console.error("=====================================");
    return { url: "", key: "", isConfigured: false };
  }

  return { url, key, isConfigured: true };
};

const { url, key, isConfigured } = getSupabaseEnv();

// Create client only once - using singleton pattern
let supabaseInstance: SupabaseClient | null = null;

// Custom storage that handles SSR gracefully
const getStorage = () => {
  if (typeof window === 'undefined') {
    // Return a no-op storage on server
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return window.localStorage;
};

export const supabase: SupabaseClient = (() => {
  if (supabaseInstance) return supabaseInstance;

  if (!isConfigured) {
    // Return a mock client that won't crash but will show errors
    console.error("Supabase client initialized without valid credentials");
  }

  supabaseInstance = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "pos-warung-auth",
      storage: getStorage(),
    },
  });

  return supabaseInstance;
})();

// Helper to check if Supabase is properly configured
export const isSupabaseConfigured = () => isConfigured;
