'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
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

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        setUser(null);
        setRole(null);
        return;
      }

      setUser(data as AppUser);
      setRole(data.role as UserRole);

      // Fetch stores for multi-branch support
      const { data: storesData } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (storesData) {
        setStores(storesData as Store[]);
        // Set current store based on user data or first store
        if (data.store_id) {
          const currentStore = storesData.find(s => s.id === data.store_id);
          if (currentStore) setStore(currentStore as Store);
        } else if (storesData.length > 0) {
          setStore(storesData[0] as Store);
        }
      }
    } catch {
      setUser(null);
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout — never stay loading for more than 10 seconds
    const timeout = setTimeout(() => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      if (mounted && loading) {
        console.warn('Auth timeout — forcing loading to false');
        setLoading(false);
      }
    }, 10000);

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        }
      } catch (err) {
        console.error('Auth session error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setSession(session);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
          setRole(null);
        }
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
    await supabase.auth.signOut();
    clearAuthCache(); // Clear cached token
    setSession(null);
    setUser(null);
    setRole(null);
    setStore(null);
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
