'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { login, signup, session, loading: authLoading } = useAuth();
  const router = useRouter();

  // Tab: 'login' or 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'owner' | 'employee'>('owner');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // If already logged in, redirect to POS
  useEffect(() => {
    if (!authLoading && session) {
      router.replace('/pos');
    }
  }, [session, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { error } = await login(email, password);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      // Login success — onAuthStateChange in AuthProvider will update session
      setTimeout(() => {
        router.replace('/pos');
      }, 3000);
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { error } = await signup(email, password, name, role);
      if (error) {
        setError(error);
        setLoading(false);
        return;
      }
      setSuccessMsg('Akun berhasil dibuat! Silakan login dengan email dan password Anda.');
      setActiveTab('login');
      setEmail(email);
      setPassword('');
      setLoading(false);
    } catch (err) {
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
          <img src="/logo.png" alt="Ajil Plastik" className="w-28 h-28 mx-auto mb-3 object-contain animate-fade-in-scale" />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ajil Plastik</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sistem Management</p>
        </div>

        {/* Tab */}
        <div className="flex mb-4 glass-card p-1 rounded-lg" style={{ background: 'var(--bg-card)' }}>
          <button
            onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'login' ? 'shadow-sm' : ''}`}
            style={activeTab === 'login'
              ? { background: 'var(--accent-teal)', color: 'white' }
              : { background: 'transparent', color: 'var(--text-muted)' }}
          >
            Masuk
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'register' ? 'shadow-sm' : ''}`}
            style={activeTab === 'register'
              ? { background: 'var(--accent-teal)', color: 'white' }
              : { background: 'transparent', color: 'var(--text-muted)' }}
          >
            Daftar
          </button>
        </div>

        {/* Form */}
        <div className="glass-card p-5" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {error && <div className="alert-error mb-4">{error}</div>}
          {successMsg && <div className="alert-success mb-4">{successMsg}</div>}

          {activeTab === 'register' && (
            <div className="mb-3">
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nama Lengkap</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="input-field"
                placeholder="Nama Anda"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="email@contoh.com"
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          {activeTab === 'register' && (
            <div className="mb-4">
              <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'owner' | 'employee')}
                className="input-field"
              >
                <option value="owner">Owner (Pemilik)</option>
                <option value="employee">Employee (Karyawan)</option>
              </select>
            </div>
          )}

          {activeTab === 'login' ? (
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm font-semibold"
              style={{ borderRadius: '8px' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Memproses...
                </span>
              ) : 'Masuk'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm font-semibold"
              style={{ borderRadius: '8px' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mendaftarkan...
                </span>
              ) : 'Daftar'}
            </button>
          )}
        </div>

        <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>© 2026 Ajil Plastik</p>
      </div>
    </div>
  );
}
