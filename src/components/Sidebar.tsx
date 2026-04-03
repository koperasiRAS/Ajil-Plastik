'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { broadcastCacheReset } from '@/hooks/useCrossTabSync';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: ('owner' | 'employee')[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊', roles: ['owner', 'employee'] },
  { label: 'POS Kasir', href: '/pos', icon: '🛒', roles: ['owner', 'employee'] },
  { label: 'Produk', href: '/products', icon: '📦', roles: ['owner'] },
  { label: 'Inventori', href: '/inventory', icon: '📋', roles: ['owner'] },
  { label: 'Pengeluaran', href: '/expenses', icon: '💸', roles: ['owner', 'employee'] },
  { label: 'Laporan', href: '/reports', icon: '📈', roles: ['owner', 'employee'] },
  { label: 'Riwayat', href: '/history', icon: '🧾', roles: ['owner', 'employee'] },
  { label: 'Karyawan', href: '/employees', icon: '👥', roles: ['owner'] },
  { label: 'Pengaturan', href: '/settings', icon: '⚙️', roles: ['owner'] },
];

export default function Sidebar({ onNavigate }: Readonly<{ onNavigate?: () => void }>) {
  const { user, role, logout, store, stores, setStore } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Check for low stock — cached with React Query, refreshes every 60s
  // Always call useQuery (hooks can't be conditional)
  const { data: lowStockCount = 0 } = useQuery({
    queryKey: ['low-stock-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .lte('stock', 5);
      return count || 0;
    },
    staleTime: 60_000, // 60 seconds
    refetchInterval: 60_000, // Auto-refresh every 60s
  });

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-64'} flex flex-col min-h-screen transition-all duration-300 ease-in-out`}
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-default)',
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex flex-col gap-2"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        {!collapsed && (
          <div className="animate-fade-in flex items-center gap-2">
            <div className="w-14 h-10 relative">
              <Image src="/logo.png" alt="Logo" fill sizes="56px" className="object-contain" />
            </div>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 ml-auto"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Perbesar sidebar' : ' Perkecil sidebar'}
            >
              {collapsed ? '→' : '←'}
            </button>
          </div>
        )}
        {/* Store Selector */}
        {!collapsed && stores.length > 0 && (
          <select
            value={store?.id || ''}
            onChange={(e) => {
              setStore(e.target.value);
              // Clear all cache when switching stores to ensure fresh data
              queryClient.clear();
              broadcastCacheReset();
            }}
            className="input-field text-xs py-1.5"
            style={{ fontSize: '0.75rem' }}
            aria-label="Pilih cabang toko"
          >
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="p-1.5 rounded-lg transition-all duration-200 hover:scale-110 mx-auto mt-2 block"
            style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            title="Expand"
          >
            →
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 stagger-children overflow-y-auto">
        {(!role && !user) ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
        NAV_ITEMS.filter(item => item.roles.includes(role || (user?.role as 'owner' | 'employee') || 'owner')).map(item => {
          const isActive = pathname === item.href;
          const isInventory = item.href === '/inventory';
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative group ${
                collapsed ? 'justify-center' : ''
              }`}
              style={{
                background: isActive ? 'var(--accent-teal)' : 'transparent',
                color: isActive ? 'white' : 'var(--text-secondary)',
                fontWeight: isActive ? 500 : 400,
                transform: isActive ? 'scale(1)' : undefined,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                }
              }}
            >
              <span className="text-base relative">
                {item.icon}
                {isInventory && lowStockCount > 0 && (
                  <span className="notification-dot" />
                )}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <span
                  className="absolute left-full ml-2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)' }}
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })
        )}
      </nav>

      {/* Low Stock Alert */}
      {!collapsed && lowStockCount > 0 && (
        <div
          className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs animate-fade-in"
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)' }}
        >
          🔔 {lowStockCount} produk stok rendah
        </div>
      )}

      {/* Theme Toggle + User */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border-default)' }}>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-2 transition-all duration-200 hover:scale-[1.02] ${
            collapsed ? 'justify-center' : ''
          }`}
          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
        >
          <span className="transition-transform duration-300" style={{ display: 'inline-block', transform: theme === 'light' ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </span>
          {!collapsed && <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>}
        </button>

        {/* User Info */}
        {!collapsed && (
          <div className="mb-2 px-3 animate-fade-in">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
            <p className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{role}</p>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
            collapsed ? 'justify-center' : ''
          }`}
          style={{ color: 'var(--accent-red)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span>🚪</span>
          {!collapsed && <span>Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
