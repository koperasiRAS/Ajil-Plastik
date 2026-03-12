'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { clearAuthCache } from '@/lib/authFetch';
import { AppUser, UserRole, Store } from '@/lib/types';

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  role: UserRole | null;
  store: Store | null;
  stores: Store[];
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  setStore: (storeId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);
  const initDone = useRef(false);

  // Check if Supabase is configured on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.error('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to environment variables.');
      setConfigError(true);
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (userId: string) => {
    let userData: AppUser | null = null;
    let userRole: UserRole | null = null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.warn('User profile not found in users table, attempting to create...');

        // Try to get user email from auth
        const { data: { user: authUser } } = await supabase.auth.getUser(userId);

        if (authUser?.email) {
          // Create user record in users table
          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: authUser.email,
              name: authUser.email.split('@')[0],
              role: 'owner' // Default role
            })
            .select()
            .single();

          if (!createError && newUser) {
            console.log('Created user profile:', newUser);
            userData = newUser as AppUser;
            userRole = newUser.role as UserRole;
          } else {
            console.error('Failed to create user profile:', createError?.message);
          }
        }
      } else {
        userData = data as AppUser;
        userRole = data.role as UserRole;
      }

      setUser(userData);
      setRole(userRole);
    } catch (err) {
      console.error('fetchUserProfile error:', err);
      setUser(null);
      setRole(null);
    }

    // Fetch stores for multi-branch support (always fetch, regardless of user existence)
    try {
      const { data: storesData } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (storesData && storesData.length > 0) {
        setStores(storesData as Store[]);
        // Set current store based on user data or first store
        if (userData?.store_id) {
          const currentStore = storesData.find(s => s.id === userData.store_id);
          if (currentStore) setStore(currentStore as Store);
        } else {
          setStore(storesData[0] as Store);
        }
      }
    } catch (storeErr) {
      console.error('Failed to fetch stores:', storeErr);
    }
  };

  useEffect(() => {
    // Don't initialize if Supabase is not configured
    if (configError) return;

    let mounted = true;

    // Safety timeout — never stay loading for more than 10 seconds
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth timeout — forcing loading to false');
        setLoading(false);
      }
    }, 10000);

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('Auth getSession error:', error.message);
          setLoading(false);
          return;
        }

        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
          initDone.current = true;
        }
      }
    };

    initAuth();

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Skip if initAuth hasn't completed yet (avoid duplicate fetch)
        if (!initDone.current && event === 'INITIAL_SESSION') return;

        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setRole(null);
          setStore(null);
          setStores([]);
        }

        // Ensure loading is false after any auth state change
        if (loading) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [configError]);

  const login = async (email: string, password: string) => {
    if (configError) {
      return { error: 'Aplikasi belum dikonfigurasi dengan benar. Hubungi administrator.' };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    if (configError) {
      return { error: 'Aplikasi belum dikonfigurasi dengan benar. Hubungi administrator.' };
    }

    try {
      // Sign up user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (error) return { error: error.message };

      // Check if user was created
      if (!data.user) {
        return { error: 'Gagal membuat akun. Silakan coba lagi.' };
      }

      // Create user record in users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          name,
          role,
        });

      if (insertError) {
        console.error('Failed to create user record:', insertError);
        // Continue anyway - the trigger might have created it
      }

      return { error: null };
    } catch (err) {
      console.error('Signup error:', err);
      return { error: 'Terjadi kesalahan. Silakan coba lagi.' };
    }
  };

  const logout = async () => {
    clearAuthCache(); // Clear cached token first
    setSession(null);
    setUser(null);
    setRole(null);
    setStore(null);
    setStores([]);
    await supabase.auth.signOut();
  };

  const switchStore = async (storeId: string) => {
    const selectedStore = stores.find(s => s.id === storeId);
    if (selectedStore) {
      setStore(selectedStore);
      if (typeof window !== 'undefined') {
        localStorage.setItem('selected_store_id', storeId);
      }
    }
  };

  const contextValue = useMemo(() => ({
    session, user, role, store, stores, loading, isConfigured: !configError, login, signup, logout, setStore: switchStore
  }), [session, user, role, store, stores, loading, configError]);

  // If Supabase is not configured, show error
  if (configError) {
    return (
      <AuthContext.Provider value={{
        session: null, user: null, role: null, store: null, stores: [],
        loading: false, isConfigured: false, login, signup, logout, setStore: switchStore
      }}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
