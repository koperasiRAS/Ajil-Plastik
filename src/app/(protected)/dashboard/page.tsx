'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';

interface DashboardData {
  todaySales: number;
  todayTransactions: number;
  totalProducts: number;
  lowStockCount: number;
  todayExpenses: number;
  todayCOGS: number;
  todayGrossProfit: number;
  todayNetProfit: number;
  grossMargin: number;
  recentTransactions: { id: string; total: number; created_at: string; users: { name: string } | null; payment_method: string; }[];
  topProducts: { name: string; totalSold: number; }[];
  salesByPayment: { cash: number; qris: number; transfer: number; };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await authFetch('/api/dashboard');
        if (!res.ok) throw new Error('API error');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Dashboard error:', err);
        setData({
          todaySales: 0, todayTransactions: 0, totalProducts: 0,
          lowStockCount: 0, todayExpenses: 0, todayCOGS: 0,
          todayGrossProfit: 0, todayNetProfit: 0, grossMargin: 0,
          recentTransactions: [], topProducts: [],
          salesByPayment: { cash: 0, qris: 0, transfer: 0 },
        });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 mb-6 animate-fade-in">
        <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      </div>

      {/* Revenue Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 stagger-children">
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💰 Penjualan Hari Ini</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-green)' }}>{formatRupiah(data.todaySales)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{data.todayTransactions} transaksi</p>
        </div>
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📦 HPP (Harga Pokok)</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{formatRupiah(data.todayCOGS)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Cost of Goods Sold</p>
        </div>
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💸 Pengeluaran</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-red)' }}>{formatRupiah(data.todayExpenses)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Biaya operasional</p>
        </div>
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📊 Margin Kotor</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-blue)' }}>{data.grossMargin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Profit Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 stagger-children">
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📈 Laba Kotor</p>
          <p className="text-xl font-bold mt-1" style={{ color: data.todayGrossProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {formatRupiah(data.todayGrossProfit)}
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Penjualan - HPP</p>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💎 Laba Bersih</p>
          <p className="text-xl font-bold mt-1" style={{ color: data.todayNetProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {formatRupiah(data.todayNetProfit)}
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>Laba Kotor - Pengeluaran</p>
        </div>
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📦 Total Produk</p>
          <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{data.totalProducts}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🔔 Stok Rendah</p>
          <p className="text-xl font-bold mt-1" style={{ color: data.lowStockCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{data.lowStockCount}</p>
        </div>
      </div>

      {/* Saldo Kas & Saldo Bank */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 mb-6 stagger-children">
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>💵 Saldo Kas (Cash)</p>
          <p className="text-2xl font-bold mt-1" style={{ color: (data.salesByPayment.cash - data.todayExpenses) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {formatRupiah(data.salesByPayment.cash - data.todayExpenses)}
          </p>
          <div className="flex gap-3 mt-1 flex-wrap">
            <span className="text-[10px]" style={{ color: 'var(--accent-green)' }}>💰 Masuk: {formatRupiah(data.salesByPayment.cash)}</span>
            <span className="text-[10px]" style={{ color: 'var(--accent-red)' }}>💸 Keluar: {formatRupiah(data.todayExpenses)}</span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Pemasukan cash − Pengeluaran kas</p>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-blue)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>🏦 Saldo Bank (QRIS + Transfer)</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-blue)' }}>
            {formatRupiah(data.salesByPayment.qris + data.salesByPayment.transfer)}
          </p>
          <div className="flex gap-3 mt-1 flex-wrap">
            <span className="text-[10px]" style={{ color: 'var(--accent-blue)' }}>📱 QRIS: {formatRupiah(data.salesByPayment.qris)}</span>
            <span className="text-[10px]" style={{ color: 'var(--accent-purple)' }}>🏦 Transfer: {formatRupiah(data.salesByPayment.transfer)}</span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Transfer + QRIS masuk ke rekening bank</p>
        </div>
      </div>

      {/* Payment Breakdown + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
        <div className="stat-card">
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>💳 Metode Bayar Hari Ini</p>
          <div className="space-y-2">
            {[
              { label: '💵 Cash', value: data.salesByPayment.cash, color: 'var(--accent-green)' },
              { label: '📱 QRIS', value: data.salesByPayment.qris, color: 'var(--accent-blue)' },
              { label: '🏦 Transfer', value: data.salesByPayment.transfer, color: 'var(--accent-purple)' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatRupiah(item.value)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${data.todaySales > 0 ? (item.value / data.todaySales * 100) : 0}%`,
                    background: item.color,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden lg:col-span-2">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>🕐 Transaksi Terakhir</h3>
          </div>
          <div>
            {data.recentTransactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{txn.users?.name || '-'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(txn.created_at).toLocaleString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(txn.total)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{txn.payment_method === 'cash' ? '💵' : txn.payment_method === 'qris' ? '📱' : '🏦'}</p>
                </div>
              </div>
            ))}
            {data.recentTransactions.length === 0 && <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Belum ada transaksi</p>}
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>🏆 Produk Terlaris (7 Hari)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
          {data.topProducts.map((product, i) => (
            <div key={product.name} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: i === 0 ? 'var(--accent-yellow)' : 'var(--bg-input)', color: i === 0 ? 'white' : 'var(--text-muted)' }}>
                {i + 1}
              </span>
              <p className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
              <span className="badge badge-blue">{product.totalSold}</span>
            </div>
          ))}
          {data.topProducts.length === 0 && <p className="px-4 py-6 text-center text-sm col-span-5" style={{ color: 'var(--text-muted)' }}>Belum ada data</p>}
        </div>
      </div>
    </div>
  );
}
