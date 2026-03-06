'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';
import { Transaction } from '@/lib/types';

interface TransactionWithItems extends Transaction {
  users: { name: string } | null;
  transaction_items: { id: string; quantity: number; price: number; products: { name: string } | null; }[];
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<TransactionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await authFetch(`/api/history?${params.toString()}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setTransactions(data || []);
    } catch { setTransactions([]); }
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [dateFrom, dateTo]);

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const paymentLabel = (m: string) => m === 'cash' ? '💵 Cash' : m === 'qris' ? '📱 QRIS' : '🏦 Transfer';
  const totalRevenue = transactions.reduce((s, t) => s + Number(t.total), 0);

  // Export CSV
  const exportCSV = () => {
    const headers = ['Tanggal', 'Kasir', 'Total', 'Metode Bayar', 'Diskon', 'Items'];
    const rows = transactions.map(t => [
      new Date(t.created_at).toLocaleString('id-ID'), t.users?.name || '-', t.total,
      t.payment_method, t.discount, t.transaction_items.length,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `riwayat_penjualan.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>🧾 Riwayat Penjualan</h1>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
          📥 Export CSV
        </button>
      </div>

      {/* Date Filter */}
      <div className="flex gap-3 mb-4 animate-fade-in">
        <div className="flex-1">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Dari Tanggal</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
        </div>
        <div className="flex-1">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Sampai Tanggal</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="self-end px-3 py-2 text-xs rounded-lg"
            style={{ color: 'var(--accent-red)', background: 'var(--bg-input)' }}>Reset</button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6 animate-fade-in">
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Transaksi</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-blue)' }}>{transactions.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Pendapatan</p>
          <p className="text-xl font-bold" style={{ color: 'var(--accent-green)' }}>{formatRupiah(totalRevenue)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {transactions.map(txn => (
            <div key={txn.id} className="glass-card overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === txn.id ? null : txn.id)}
                className="w-full flex items-center justify-between p-4 transition-all duration-200">
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {new Date(txn.created_at).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {txn.users?.name || '-'} • {txn.transaction_items.length} item • {paymentLabel(txn.payment_method)}
                    {txn.discount > 0 && ` • Diskon ${formatRupiah(txn.discount)}`}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <p className="font-semibold" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(txn.total)}</p>
                  <span className="transition-transform duration-200" style={{ color: 'var(--text-muted)', transform: expandedId === txn.id ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
                </div>
              </button>
              {expandedId === txn.id && (
                <div className="px-4 py-3 animate-fade-in" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-card-hover)' }}>
                  <table className="data-table">
                    <thead><tr><th>Produk</th><th className="text-right">Qty</th><th className="text-right">Harga</th><th className="text-right">Subtotal</th></tr></thead>
                    <tbody>
                      {txn.transaction_items.map(item => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--text-primary)' }}>{item.products?.name || '-'}</td>
                          <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{item.quantity}</td>
                          <td className="text-right" style={{ color: 'var(--text-secondary)' }}>{formatRupiah(item.price)}</td>
                          <td className="text-right" style={{ color: 'var(--accent-blue)' }}>{formatRupiah(item.price * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          {transactions.length === 0 && <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Belum ada riwayat transaksi</p>}
        </div>
      )}
    </div>
  );
}
