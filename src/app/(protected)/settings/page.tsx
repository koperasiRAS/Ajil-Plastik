'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/authFetch';

interface DataSection {
  key: string;
  label: string;
  icon: string;
  table: string;
  description: string;
}

const DATA_SECTIONS: DataSection[] = [
  { key: 'transaction_items', label: 'Item Transaksi', icon: '🧾', table: 'transaction_items', description: 'Semua detail item dalam transaksi' },
  { key: 'transactions', label: 'Transaksi', icon: '💳', table: 'transactions', description: 'Semua riwayat transaksi' },
  { key: 'stock_logs', label: 'Log Stok', icon: '📋', table: 'stock_logs', description: 'Riwayat perubahan stok' },
  { key: 'expenses', label: 'Pengeluaran', icon: '💸', table: 'expenses', description: 'Semua catatan pengeluaran' },
  { key: 'shifts', label: 'Shift Kasir', icon: '⏰', table: 'shifts', description: 'Riwayat shift kasir' },
  { key: 'products', label: 'Produk', icon: '📦', table: 'products', description: 'Semua data produk (hati-hati!)' },
  { key: 'categories', label: 'Kategori', icon: '🏷️', table: 'categories', description: 'Semua kategori produk' },
];

export default function SettingsPage() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [confirmAll, setConfirmAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const res = await authFetch('/api/settings');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        setCounts(data);
      } catch { setCounts({}); }
      setLoadingCounts(false);
    };
    loadCounts();
  }, []);

  const deleteTable = async (section: DataSection) => {
    const input = prompt(`Hapus semua data ${section.label}? Ketik "HAPUS" untuk konfirmasi.`);
    if (input !== 'HAPUS') {
      setMessage({ type: 'error', text: 'Dibatalkan — ketik "HAPUS" untuk konfirmasi.' });
      return;
    }

    setDeleting(section.key);
    setMessage(null);

    try {
      const res = await fetch(`/api/settings?table=${section.table}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      setCounts(prev => ({ ...prev, [section.key]: 0 }));
      if (section.key === 'transactions') setCounts(prev => ({ ...prev, transaction_items: 0 }));
      if (section.key === 'products') setCounts(prev => ({ ...prev, stock_logs: 0, transaction_items: 0 }));
      setMessage({ type: 'success', text: `✓ Data ${section.label} berhasil dihapus` });
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal: ${err instanceof Error ? err.message : 'Error'}` });
    } finally {
      setDeleting(null);
    }
  };

  const deleteAllData = async () => {
    setDeletingAll(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/settings?all=true', { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setCounts(prev => ({ ...prev, transaction_items: 0, transactions: 0, stock_logs: 0, expenses: 0, shifts: 0 }));
      setMessage({ type: 'success', text: '✓ Semua data dihapus. Produk & kategori tetap ada.' });
    } catch (err) {
      setMessage({ type: 'error', text: `Gagal: ${err instanceof Error ? err.message : 'Error'}` });
    } finally {
      setDeletingAll(false);
      setConfirmAll(false);
    }
  };

  const totalRows = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="flex items-center gap-3 mb-6 animate-fade-in">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>⚙️ Pengaturan</h1>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm animate-fade-in ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {message.text}
        </div>
      )}

      <div className="stat-card mb-6 animate-fade-in">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📊 Total Data di Database</p>
        <p className="text-3xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
          {loadingCounts ? '...' : totalRows.toLocaleString('id-ID')} <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>baris</span>
        </p>
      </div>

      <div className="glass-card p-5 mb-6 animate-fade-in" style={{ borderLeft: '3px solid var(--accent-red)' }}>
        <h2 className="text-sm font-bold mb-2" style={{ color: 'var(--accent-red)' }}>🗑️ Hapus Semua Data (Reset)</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Menghapus semua transaksi, item, log stok, pengeluaran, dan shift. <strong>Produk & kategori TIDAK dihapus</strong>.
        </p>
        {!confirmAll ? (
          <button onClick={() => setConfirmAll(true)} className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105" style={{ background: 'var(--accent-red)', color: 'white' }}>
            🗑️ Hapus Semua Data
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap animate-fade-in">
            <p className="text-xs font-bold" style={{ color: 'var(--accent-red)' }}>⚠️ Yakin? Data tidak bisa dikembalikan!</p>
            <button onClick={deleteAllData} disabled={deletingAll} className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105" style={{ background: 'var(--accent-red)', color: 'white' }}>
              {deletingAll ? '⏳ Menghapus...' : '✓ YA, HAPUS SEMUA'}
            </button>
            <button onClick={() => setConfirmAll(false)} className="px-4 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>Batal</button>
          </div>
        )}
      </div>

      <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>📋 Kelola Per Tabel</h2>
      <div className="space-y-2 stagger-children">
        {DATA_SECTIONS.map(section => (
          <div key={section.key} className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{section.icon}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{section.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{section.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge badge-blue">{loadingCounts ? '...' : (counts[section.key] || 0)} baris</span>
              <button
                onClick={() => deleteTable(section)}
                disabled={deleting === section.key || (counts[section.key] || 0) === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105 disabled:opacity-30"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                {deleting === section.key ? '⏳...' : '🗑️ Hapus'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-lg text-xs" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
        <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>ℹ️ Catatan</p>
        <ul className="space-y-1" style={{ color: 'var(--text-muted)' }}>
          <li>• Semua query berjalan di <strong>server-side</strong> (API routes)</li>
          <li>• Hapus Semua: transaksi, log, pengeluaran, shifts. Produk & kategori tetap.</li>
          <li>• Data yang dihapus <strong>tidak bisa dikembalikan</strong>.</li>
        </ul>
      </div>
    </div>
  );
}
