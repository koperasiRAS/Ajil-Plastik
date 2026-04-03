'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  // Show login form immediately with skeleton, redirect if already logged in
  useEffect(() => {
    // Show form after a short delay to allow auth to initialize
    const timer = setTimeout(() => {
      setShowLoginForm(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // If already logged in, redirect to POS (no setTimeout needed — use session + authLoading directly)
  useEffect(() => {
    if (session && !authLoading) {
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
      // Redirect immediately after successful login
      router.replace('/pos');
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

  // Show loading skeleton while waiting for form (or if auth still loading after form shows)
  // This ensures the form appears quickly even on slow browsers like Brave
  if (!showLoginForm) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-full max-w-sm">
          {/* Logo skeleton */}
          <div className="text-center mb-8">
            <div className="w-36 h-36 mx-auto mb-4 rounded-xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
            <div className="h-6 w-32 mx-auto rounded animate-pulse" style={{ background: 'var(--bg-card)' }} />
          </div>
          {/* Form skeleton */}
          <div className="glass-card p-6 space-y-4">
            <div className="h-4 w-16 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
            <div className="h-10 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
            <div className="h-4 w-20 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
            <div className="h-10 rounded animate-pulse" style={{ background: 'var(--bg-input)' }} />
            <div className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--accent-teal)', opacity: 0.3 }} />
          </div>
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
        <div className="text-center mb-8">
          <div className="w-36 h-36 mx-auto mb-4 relative animate-fade-in-scale">
            <Image src="/logo.png" alt="Ajil Plastik" fill sizes="144px" priority className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Ajil Plastik</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Sistem Management</p>
        </div>

        {/* Login Form */}
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

        <p className="text-center mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Ajil Plastik</p>
      </div>
    </div>
  );
}
