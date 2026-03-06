'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';

const OWNER_ROUTES = ['/dashboard', '/products', '/inventory', '/expenses', '/employees', '/reports', '/settings'];

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/login');
      return;
    }

    if (role === 'employee' && OWNER_ROUTES.includes(pathname)) {
      router.replace('/pos');
    }
  }, [session, role, loading, pathname, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Memuat...</p>
        </div>
      </div>
    );
  }

  if (!session || !role) return null;

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 lg:hidden"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)' }}>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg transition-all"
          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Warung Sembako</span>
        </div>
        <div className="w-9" /> {/* Spacer */}
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={() => {}}
          role="presentation"
        >
          <div
            className="w-64 h-full animate-slide-in-left"
            onClick={e => e.stopPropagation()}
            onKeyDown={() => {}}
            role="dialog"
          >
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
