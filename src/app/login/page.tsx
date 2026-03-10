'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to POS
  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/pos');
    }
  }, [session, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await login(email, password);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      // Login success — onAuthStateChange in AuthProvider will update session
      // which triggers the useEffect above to redirect to /pos
      // Keep loading=true so user sees "Memproses..." until redirect happens
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pos-theme', next);
  };

  // Show loading if auth is still initializing
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-teal)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-xl transition-all duration-300 hover:scale-110"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
      >
        🌗
      </button>

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--accent-teal)' }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: 'var(--accent-purple)' }} />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Logo" className="w-40 h-40 sm:w-48 sm:h-48 mx-auto object-contain animate-fade-in-scale" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {error && <div className="alert-error">{error}</div>}

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="input-field" placeholder="email@contoh.com" />
          </div>

          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="input-field" placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base font-semibold" style={{ borderRadius: '10px' }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </span>
            ) : 'Masuk'}
          </button>
        </form>

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>© 2026</p>
      </div>
    </div>
  );
}
