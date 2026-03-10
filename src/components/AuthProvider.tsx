'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearAuthCache } from '@/lib/authFetch';
import { AppUser, UserRole, Store } from '@/lib/types';

interface AuthContextType {
  session: Session | null;
  user: AppUser | null;
  role: UserRole | null;
  store: Store | null;
  stores: Store[];
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
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
  const initDone = useRef(false);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Failed to fetch user profile:', error?.message);
        setUser(null);
        setRole(null);
        return;
      }

      setUser(data as AppUser);
      setRole(data.role as UserRole);

      // Fetch stores for multi-branch support
      try {
        const { data: storesData } = await supabase
          .from('stores')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (storesData && storesData.length > 0) {
          setStores(storesData as Store[]);
          // Set current store based on user data or first store
          if (data.store_id) {
            const currentStore = storesData.find(s => s.id === data.store_id);
            if (currentStore) setStore(currentStore as Store);
          } else {
            setStore(storesData[0] as Store);
          }
        }
      } catch (storeErr) {
        console.error('Failed to fetch stores:', storeErr);
        // Non-critical — continue without stores
      }
    } catch (err) {
      console.error('fetchUserProfile error:', err);
      setUser(null);
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout — never stay loading for more than 5 seconds
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth timeout — forcing loading to false');
        setLoading(false);
      }
    }, 5000);

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
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
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
      localStorage.setItem('selected_store_id', storeId);
    }
  };

  const contextValue = useMemo(() => ({
    session, user, role, store, stores, loading, login, logout, setStore: switchStore
  }), [session, user, role, store, stores, loading]);

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
