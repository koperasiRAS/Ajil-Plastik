'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';

const OWNER_ROUTES = ['/products', '/inventory', '/employees', '/settings'];

// Guard component that auto-redirects to login if stuck on "Mengalihkan..." for too long
function StaleSessionGuard() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // If we're still showing "Mengalihkan..." after 3 seconds, force redirect to login
    timerRef.current = setTimeout(() => {
      console.warn('StaleSessionGuard: stuck on Mengalihkan for 3s, forcing redirect to /login');
      router.replace('/login');
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Mengalihkan...</p>
      </div>
    </div>
  );
}

export default function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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

  // Show loading spinner while auth is initializing
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

  // Not authenticated — redirect is happening, show spinner briefly
  // Only redirect if there's definitely no session (not just role loading)
  if (!session && !loading) {
    return <StaleSessionGuard />;
  }

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
          <div className="w-10 h-10 relative">
            <Image src="/logo.png" alt="Logo" fill sizes="40px" className="object-contain" />
          </div>
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
